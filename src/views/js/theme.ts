// Applies saved display preferences before first paint (classic script in <head>, so no flash). The Settings page writes localStorage 'theme' and 'motion'.
export const themeJs = String.raw`try{var d=document.documentElement,t=localStorage.getItem('theme');if(t==='light'||t==='dark'||t==='oled')d.dataset.theme=t;if(localStorage.getItem('motion')==='reduce')d.dataset.motion='reduce';if(location.hostname.indexOf('-beta')>0)d.dataset.env='beta';}catch(e){}
`;
