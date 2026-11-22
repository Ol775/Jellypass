export const scrollJs = String.raw`
const main=document.querySelector('.member-app #content');
if(main&&main.dataset.page!=='wrapped'){
 const root=document.documentElement,bar=document.querySelector('.mobilebar'),toolbar=main.querySelector('.discover-toolbar');
 root.setAttribute('data-scroll-app','');
 const top=document.createElement('button');
 top.className='scroll-top';top.type='button';top.hidden=true;top.setAttribute('aria-label','Back to top');
 top.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12 6-6 6 6M12 6v12"/></svg>';
 document.body.append(top);
 top.addEventListener('click',()=>{main.focus({preventScroll:true});window.scrollTo({top:0,behavior:root.dataset.motion==='reduce'||matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});});
 const rows=new Set(),seen=new WeakSet();
 const io='IntersectionObserver' in window?new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.setAttribute('data-in','');io.unobserve(e.target);}}),{rootMargin:'0px 0px -12% 0px',threshold:.05}):null;let frame=0,dirty=true;
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
 const resize=typeof ResizeObserver==='function'?new ResizeObserver(()=>{dirty=true;schedule();}):null;
 function update(){
  frame=0;root.toggleAttribute('data-scrolled',scrollY>8);
  top.hidden=scrollY<400&&document.activeElement!==top;
  if(dirty){
   dirty=false;
   root.style.setProperty('--scroll-bar',(bar?bar.getBoundingClientRect().height:0)+'px');
   root.style.setProperty('--scroll-tools',(toolbar?toolbar.getBoundingClientRect().height:0)+'px');
   main.querySelectorAll('.recent-shelf,.settings-tabs').forEach(el=>{if(!rows.has(el)){rows.add(el);el.setAttribute('data-scroll-row','');el.addEventListener('scroll',schedule,{passive:true});if(resize)resize.observe(el);}});
   const items=main.querySelectorAll('.recent-section,.discover-section,.help-steps,.help-clients,.help-docs,.status-incident,.page-content>.card,.page-content .stack>.card,.history-row,.history-group,.discover-grid>*,.request-grid>*,.request-grid-wide>*,.recent-shelf>*');
   items.forEach(el=>{if(seen.has(el))return;seen.add(el);if(io&&el.getBoundingClientRect().top>innerHeight){const i=[...el.parentElement.children].indexOf(el)%6;el.style.setProperty('--i',i);el.setAttribute('data-scroll-enter','');io.observe(el);}});
  }
  rows.forEach(el=>{if(!el.isConnected){rows.delete(el);if(resize)resize.unobserve(el);return;}el.toggleAttribute('data-left',el.scrollLeft>1);el.toggleAttribute('data-right',el.scrollLeft+el.clientWidth<el.scrollWidth-1);});
 }
 if(resize){resize.observe(main);if(bar)resize.observe(bar);if(toolbar)resize.observe(toolbar);}
 const content=main.querySelector('.page-content');
 if(content&&typeof MutationObserver==='function')new MutationObserver(changes=>{if(changes.some(c=>!c.target.closest?.('#map'))){dirty=true;schedule();}}).observe(content,{childList:true,subtree:true});
 window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',()=>{dirty=true;schedule();},{passive:true});
 top.addEventListener('blur',schedule);window.addEventListener('pageshow',schedule);update();
}
`;
