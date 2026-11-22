// Prints a new Web Push (VAPID) key as one line of JSON, for piping straight into a Worker secret. It is never shown on screen:
//   node scripts/gen-vapid.mjs | npx wrangler secret put VAPID_KEYS --env beta
import { webcrypto } from "node:crypto";
const { privateKey } = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
const { kty, crv, x, y, d } = await webcrypto.subtle.exportKey("jwk", privateKey);
process.stdout.write(JSON.stringify({ kty, crv, x, y, d }));
