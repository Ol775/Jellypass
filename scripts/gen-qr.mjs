import QRCode from 'qrcode'; import jsQR from 'jsqr'; import fs from 'fs';
const items={ios:'https://apps.apple.com/gb/app/jellytv/id6752357290',android:'https://play.google.com/store/apps/details?id=org.jellyfin.mobile'};
let out='// Static QR codes (error correction M) for the official Jellyfin phone apps, generated offline and decoded back to verify.\n// No third party sees a member: nothing here is generated at request time.\n';
const o={};
for(const [k,url] of Object.entries(items)){
  const q=QRCode.create(url,{errorCorrectionLevel:'M'}); const n=q.modules.size, d=q.modules.data;
  // verify: render with 4-module quiet zone at 8px per module and decode
  const sc=8,quiet=4,W=(n+quiet*2)*sc,img=new Uint8ClampedArray(W*W*4).fill(255);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(d[y*n+x])for(let py=0;py<sc;py++)for(let px=0;px<sc;px++){const i=(((y+quiet)*sc+py)*W+(x+quiet)*sc+px)*4;img[i]=img[i+1]=img[i+2]=0;}
  const r=jsQR(img,W,W); if(!r||r.data!==url) throw new Error('decode failed '+k);
  let path=''; for(let y=0;y<n;y++){let x=0;while(x<n){if(d[y*n+x]){let l=0;while(x+l<n&&d[y*n+x+l])l++;path+=`M${x} ${y}h${l}v1h-${l}z`;x+=l;}else x++;}}
  o[k]={size:n,path,url};
}
out+=`export const qrCodes: Record<'ios' | 'android', { size: number; path: string; url: string }> = ${JSON.stringify(o)};\n`;
fs.writeFileSync(process.argv[2],out); console.log('ok',Object.values(o).map(v=>v.size));
