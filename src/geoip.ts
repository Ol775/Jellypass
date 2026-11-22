/** Local IP geolocation from a MaxMind-format (.mmdb) city database held in R2. No IP ever leaves the Worker. */
export interface GeoPlace { city: string | null; country: string | null; countryCode: string | null; lat: number | null; lng: number | null }

const MARKER = [0xab, 0xcd, 0xef, ...new TextEncoder().encode("MaxMind.com")];

function parseIp(ip: string): number[] | null {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) { const p = ip.split(".").map(Number); return p.every((x) => x < 256) ? p : null; }
  if (!/^[0-9a-f:]+$/i.test(ip) || (ip.match(/::/g)?.length ?? 0) > 1) return null;
  const [h, t] = ip.split("::");
  const head = h ? h.split(":") : [], tail = t ? t.split(":") : [];
  if (ip.includes("::") ? head.length + tail.length > 7 : head.length !== 8) return null;
  const groups = [...head, ...Array(ip.includes("::") ? 8 - head.length - tail.length : 0).fill("0"), ...tail];
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/i.test(g))) return null;
  return groups.flatMap((g) => [parseInt(g, 16) >> 8, parseInt(g, 16) & 255]);
}

class Db {
  private v: DataView; private b: Uint8Array;
  nodeCount: number; recordSize: number; ipVersion: number; treeSize: number; ipv4Start = -1;
  constructor(buf: ArrayBuffer) {
    this.b = new Uint8Array(buf); this.v = new DataView(buf);
    let at = -1;
    for (let i = this.b.length - MARKER.length; i >= 0 && at < 0; i--) if (MARKER.every((m, j) => this.b[i + j] === m)) at = i + MARKER.length;
    if (at < 0) throw new Error("not an mmdb file");
    const meta: any = this.decode(at, at).value;
    this.nodeCount = meta.node_count; this.recordSize = meta.record_size; this.ipVersion = meta.ip_version;
    if (![24, 28, 32].includes(this.recordSize) || ![4, 6].includes(this.ipVersion)) throw new Error("unsupported mmdb");
    this.treeSize = (this.nodeCount * this.recordSize) / 4;
  }
  private record(node: number, right: number): number {
    const o = node * (this.recordSize / 4), b = this.b;
    if (this.recordSize === 24) return (b[o + right * 3] << 16) | (b[o + right * 3 + 1] << 8) | b[o + right * 3 + 2];
    if (this.recordSize === 32) return this.v.getUint32(o + right * 4);
    return right ? ((b[o + 3] & 15) << 24) | (b[o + 4] << 16) | (b[o + 5] << 8) | b[o + 6] : ((b[o + 3] >> 4) << 24) | (b[o] << 16) | (b[o + 1] << 8) | b[o + 2];
  }
  find(bytes: number[]): any | null {
    let node = 0;
    if (bytes.length === 4 && this.ipVersion === 6) {
      if (this.ipv4Start < 0) { let n = 0; for (let i = 0; i < 96 && n < this.nodeCount; i++) n = this.record(n, 0); this.ipv4Start = n; }
      node = this.ipv4Start;
    }
    for (let i = 0; i < bytes.length * 8 && node < this.nodeCount; i++) node = this.record(node, (bytes[i >> 3] >> (7 - (i & 7))) & 1);
    if (node <= this.nodeCount) return null;
    return this.decode(this.treeSize + 16, this.treeSize + (node - this.nodeCount)).value;
  }
  /** Decodes one value at `at`; pointers resolve relative to `base` (start of the data section). */
  private decode(base: number, at: number): { value: any; next: number } {
    const b = this.b; let ctrl = b[at++], type = ctrl >> 5;
    if (type === 1) {
      const ss = (ctrl >> 3) & 3, vvv = ctrl & 7; let p: number;
      if (ss === 0) p = (vvv << 8) | b[at];
      else if (ss === 1) p = ((vvv << 16) | (b[at] << 8) | b[at + 1]) + 2048;
      else if (ss === 2) p = ((vvv << 24) | (b[at] << 16) | (b[at + 1] << 8) | b[at + 2]) + 526336;
      else p = this.v.getUint32(at);
      return { value: this.decode(base, base + p).value, next: at + ss + 1 };
    }
    if (type === 0) type = 7 + b[at++];
    let size = ctrl & 31;
    if (size === 29) size = 29 + b[at++];
    else if (size === 30) { size = 285 + ((b[at] << 8) | b[at + 1]); at += 2; }
    else if (size === 31) { size = 65821 + ((b[at] << 16) | (b[at + 1] << 8) | b[at + 2]); at += 3; }
    switch (type) {
      case 2: return { value: new TextDecoder().decode(b.subarray(at, at + size)), next: at + size };
      case 3: return { value: this.v.getFloat64(at), next: at + 8 };
      case 15: return { value: this.v.getFloat32(at), next: at + 4 };
      case 5: case 6: case 8: case 9: case 10: { let n = 0; for (let i = 0; i < size; i++) n = n * 256 + b[at + i]; return { value: n, next: at + size }; }
      case 14: return { value: size === 1, next: at };
      case 7: { const m: Record<string, any> = {}; for (let i = 0; i < size; i++) { const k = this.decode(base, at); const v = this.decode(base, k.next); m[k.value] = v.value; at = v.next; } return { value: m, next: at }; }
      case 11: { const a: any[] = []; for (let i = 0; i < size; i++) { const v = this.decode(base, at); a.push(v.value); at = v.next; } return { value: a, next: at }; }
      default: return { value: null, next: at + size };
    }
  }
}

/** ponytail: the whole file is read into Worker memory once per isolate (GeoLite2-City is ~60 MB of the 128 MB limit); switch to ranged R2 reads or a country-only file if memory ever bites. */
function makeLookup<T>(bucket: R2Bucket, key: string, pick: (record: any) => T | null) {
  // Only the finished database is cached. Caching the in-flight promise breaks once the request that started it has ended
  // ("promise created by a request that has since ended"), which then fails every later lookup in the isolate.
  let db: Db | null = null;
  const load = async () => db ??= await bucket.get(key).then(async (o) => (o ? new Db(await o.arrayBuffer()) : null)).catch(() => null);
  return async (ip: string): Promise<T | null> => {
    const bytes = parseIp(ip.trim());
    const d = bytes && (await load());
    if (!d) return null;
    try { const r = d.find(bytes); return r ? pick(r) : null; } catch { return null; }
  };
}

/** Works with GeoLite2 City or Country files (a Country file just has no city or coordinates). */
export function makeGeo(bucket: R2Bucket, key = "geoip-city.mmdb") {
  const lookup = makeLookup<GeoPlace>(bucket, key, (r) => ({ city: r.city?.names?.en ?? null, country: r.country?.names?.en ?? null, countryCode: r.country?.iso_code ?? null, lat: r.location?.latitude ?? null, lng: r.location?.longitude ?? null }));
  return { lookup };
}
export type Geo = ReturnType<typeof makeGeo>;

/** The network (ISP) an IP belongs to, from a GeoLite2 ASN file. */
export function makeAsn(bucket: R2Bucket, key = "geoip-asn.mmdb") {
  const lookup = makeLookup<{ asn: number; org: string }>(bucket, key, (r) => (typeof r.autonomous_system_organization === "string" ? { asn: Number(r.autonomous_system_number) || 0, org: r.autonomous_system_organization } : null));
  return { lookup };
}
export type Asn = ReturnType<typeof makeAsn>;
