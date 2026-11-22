export const devicesMapJs = String.raw`
export async function drawMap(rows) {
 const none=()=>{};
 const container=document.querySelector('#map'),status=document.querySelector('#map-state');let map;
 let loaded=false;
 const mq=window.matchMedia('(prefers-color-scheme: dark)');
 const palette=d=>d?{bg:'#121312',land:'#1b1d1a',water:'#10292b',road:'#2a2d28',line:'#5a5d55',text:'#b9b7ad'}:{bg:'#efede8',land:'#f6f5f2',water:'#b8d6d1',road:'#dcd8cd',line:'#8b877e',text:'#4a4842'};
 const paints=()=>{const c=palette(mq.matches);return [['background','background-color',c.bg],['wland','fill-color',c.land],['wwater','fill-color',c.water],['wboundaries','line-color',c.line],['land','fill-color',c.land],['water','fill-color',c.water],['roads','line-color',c.road],['boundaries','line-color',c.line],...['wcountry','wplaces','places'].flatMap(id=>[[id,'text-color',c.text],[id,'text-halo-color',c.bg]])].filter(p=>map.getLayer(p[0]));};
 const fallback=reason=>{console.warn('Jellypass map fallback:',reason);status.textContent='Map unavailable, here is your list'+(reason?' ('+reason+')':'');container.hidden=true;try{map?.remove();}catch{}map=null;};
 try {
  if(document.readyState!=='complete') await new Promise(resolve=>window.addEventListener('load',resolve,{once:true}));
  if(!window.maplibregl) {fallback('map library did not load');return none;}
  if(!window.pmtiles) {fallback('tile reader did not load');return none;}
  if(typeof maplibregl.supported==='function' && !maplibregl.supported()) {fallback('this browser cannot draw maps');return none;}
  const response=await fetch('/tiles/uk.pmtiles?v=z10',{headers:{Range:'bytes=0-0'},credentials:'same-origin'});if(!response.ok){fallback('tiles answered '+response.status);return none;}
  maplibregl.addProtocol('pmtiles',new pmtiles.Protocol().tile);
  // Worldwide low-zoom tiles sit underneath the detailed UK extract, so a member watching from abroad still shows on a real map.
  // If world.pmtiles is not in R2 the map simply stays UK-only.
  const world=await fetch('/tiles/world.pmtiles?v=z6',{headers:{Range:'bytes=0-0'},credentials:'same-origin'}).then(r=>r.ok,()=>false);
  const c=palette(mq.matches),src=name=>({type:'vector',url:'pmtiles://'+location.origin+'/tiles/'+name+'?v='+(name==='uk.pmtiles'?'z10':'z6')});
  const label=(id,source,filter,size,extra)=>({id,type:'symbol',source,'source-layer':'places',filter,layout:{'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':size,'symbol-sort-key':['-',0,['coalesce',['get','population'],0]],'text-max-width':7,...(extra||{})},paint:{'text-color':c.text,'text-halo-color':c.bg,'text-halo-width':1.5}});
  const place=['==',['get','kind'],'locality'];
  const layers=[{id:'background',type:'background',paint:{'background-color':c.bg}},
   ...(world?[{id:'wland',type:'fill',source:'world','source-layer':'earth',paint:{'fill-color':c.land}},{id:'wwater',type:'fill',source:'world','source-layer':'water',paint:{'fill-color':c.water}},{id:'wboundaries',type:'line',source:'world','source-layer':'boundaries',maxzoom:7,paint:{'line-color':c.line,'line-width':0.8}}]:[]),
   {id:'land',type:'fill',source:'land','source-layer':'earth',paint:{'fill-color':c.land}},{id:'water',type:'fill',source:'land','source-layer':'water',paint:{'fill-color':c.water}},{id:'roads',type:'line',source:'land','source-layer':'roads',minzoom:7,paint:{'line-color':c.road,'line-width':0.7}},{id:'boundaries',type:'line',source:'land','source-layer':'boundaries',paint:{'line-color':c.line,'line-width':1}},
   ...(world?[label('wcountry','world',['==',['get','kind'],'country'],['interpolate',['linear'],['zoom'],1,10,6,14],{'text-transform':'uppercase','text-letter-spacing':0.08}),label('wplaces','world',place,['interpolate',['linear'],['zoom'],3,10,8,14])]:[]),
   {...label('places','land',place,['interpolate',['linear'],['zoom'],6,11,11,16]),minzoom:6}];
  map=new maplibregl.Map({container,attributionControl:false,center:[-2,54],zoom:4,style:{version:8,glyphs:location.origin+'/assets/glyphs/{fontstack}/{range}.pbf',sources:{land:src('uk.pmtiles'),...(world?{world:src('world.pmtiles')}:{})},layers},transformRequest:url=>{const target=new URL(url,location.origin);if(target.protocol!=='pmtiles:'&&target.origin!==location.origin)throw new Error('External map request blocked');return {url,credentials:'same-origin'};}});
  map.on('error',e=>{if(!loaded)fallback(e&&e.error&&e.error.message?e.error.message:'map error');});mq.addEventListener('change',()=>{if(map&&loaded)for(const [id,prop,val] of paints())map.setPaintProperty(id,prop,val);});
  map.on('load',()=>{loaded=true;status.textContent=container.dataset.note||'City-level sign-in locations. Use the recent sign-ins list for details.';});
  // Pins carry the city, IP address and time. The map opens on the pins at city-region zoom, or the whole UK if there are none.
  // The returned function replaces the pins (live streams refresh every 15 s) and only re-fits the view when the places change.
  let markers=[],fitted='';
  const setPins=next=>{
   if(!map)return;markers.forEach(m=>m.remove());markers=[];const pts=[];
   for(const row of next) if(Number.isFinite(row.lat)&&Number.isFinite(row.lng)){
    const pin=document.createElement('button');pin.className='map-pin';pin.setAttribute('aria-label',row.city||'Location');
    const box=document.createElement('div');const t=document.createElement('b');t.textContent=row.city||'Location unknown';const l1=document.createElement('p');l1.textContent=row.device||'Unknown device';const l2=document.createElement('p');l2.textContent=[row.ip,row.seenAt?new Date(row.seenAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):''].filter(Boolean).join(' · ');box.append(t,l1,l2);
    markers.push(new maplibregl.Marker({element:pin}).setLngLat([row.lng,row.lat]).setPopup(new maplibregl.Popup({offset:14}).setDOMContent(box)).addTo(map)); pts.push([row.lng,row.lat]);
   }
   const key=JSON.stringify(pts);if(key===fitted)return;fitted=key;
   if(pts.length){ const bounds=pts.reduce((b,p)=>b.extend(p),new maplibregl.LngLatBounds(pts[0],pts[0])); map.fitBounds(bounds,{padding:60,maxZoom:10,duration:0}); } else map.jumpTo({center:[-2,54],zoom:4});
  };
  setPins(rows);return setPins;
 }catch(e){fallback(e&&e.message?e.message:'unexpected error');return none;}
}
`;
