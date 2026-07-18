(()=>{
"use strict";
const VERSION="1.9.1";
const loadScript=src=>new Promise((resolve,reject)=>{const clean=src.split("?")[0];if([...document.scripts].some(s=>s.getAttribute("src")?.split("?")[0]===clean))return resolve();const s=document.createElement("script");s.src=src;s.defer=true;s.onload=resolve;s.onerror=()=>reject(new Error(`Falha ao carregar ${src}`));document.head.appendChild(s)});
const updateVersion=()=>{const footer=document.querySelector("#ver");if(footer)footer.textContent=`Cartas TCG · v${VERSION} · fluxo de template`;document.documentElement.dataset.appVersion=VERSION};
const boot=async()=>{updateVersion();try{for(const src of["./layout-fixes.js","./collection-layout.js","./template-renderer.js","./svg-editor.js","./print-svg.js","./template-mode.js","./template-print.js","./template-customization.js","./layout-workspace.js"])await loadScript(`${src}?v=${VERSION}`);updateVersion()}catch(error){const status=document.querySelector("#layout-status")||document.querySelector("#ps")||document.querySelector("#cs");if(status)status.textContent=`Não foi possível carregar a versão ${VERSION}: ${error.message}`;console.error(error)}};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();