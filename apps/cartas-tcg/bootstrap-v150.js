(()=>{
"use strict";
const VERSION="1.9.2",LABEL=`Cartas TCG · v${VERSION} · fluxo de template`;
const loadScript=src=>new Promise((resolve,reject)=>{const clean=src.split("?")[0];if([...document.scripts].some(s=>s.getAttribute("src")?.split("?")[0]===clean))return resolve();const s=document.createElement("script");s.src=src;s.defer=true;s.onload=resolve;s.onerror=()=>reject(new Error(`Falha ao carregar ${src}`));document.head.appendChild(s)});
function updateVersion(){const footer=document.querySelector("#ver");if(footer&&footer.textContent!==LABEL)footer.textContent=LABEL;document.documentElement.dataset.appVersion=VERSION}
function lockVersion(){updateVersion();const footer=document.querySelector("#ver");if(!footer)return;new MutationObserver(updateVersion).observe(footer,{childList:true,characterData:true,subtree:true})}
const boot=async()=>{lockVersion();try{for(const src of["./layout-fixes.js","./collection-layout.js","./template-renderer.js","./svg-editor.js","./print-svg.js","./template-mode.js","./template-print.js","./template-customization.js","./layout-workspace.js"])await loadScript(`${src}?v=${VERSION}`)}catch(error){const status=document.querySelector("#layout-status")||document.querySelector("#ps")||document.querySelector("#cs");if(status)status.textContent=`Não foi possível carregar a versão ${VERSION}: ${error.message}`;console.error(error)}finally{updateVersion()}};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();