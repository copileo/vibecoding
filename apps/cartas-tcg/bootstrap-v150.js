(()=>{
"use strict";
const VERSION="1.6.2";
const loadScript=src=>new Promise((resolve,reject)=>{if(document.querySelector(`script[src="${src}"]`))return resolve();const s=document.createElement("script");s.src=src;s.defer=true;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
const updateVersion=()=>{const footer=document.querySelector("#ver");if(footer)footer.textContent=`Cartas TCG · v${VERSION} · recorte SVG corrigido`;document.documentElement.dataset.appVersion=VERSION};
const boot=async()=>{updateVersion();try{await loadScript("./layout-fixes.js?v=1.6.2");await loadScript("./collection-layout.js?v=1.6.2");await loadScript("./svg-editor.js?v=1.6.2");updateVersion()}catch(error){const status=document.querySelector("#layout-status")||document.querySelector("#cs");if(status)status.textContent="Não foi possível carregar a versão 1.6.2: "+error.message}};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();