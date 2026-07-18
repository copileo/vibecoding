(()=>{
"use strict";
const cache={};
const parse=text=>new DOMParser().parseFromString(text,"image/svg+xml").documentElement;
async function source(side){if(!cache[side])cache[side]=fetch(`./template-${side}.svg?v=1.8.0`,{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error(`Template ${side} indisponível`);return r.text()});return cache[side]}
function text(root,id,value){const el=root.querySelector(`#${id}`);if(el)el.textContent=value??""}
function image(root,id,href){const el=root.querySelector(`#${id}`);if(!el)return;el.setAttribute("href",href||"");el.setAttributeNS("http://www.w3.org/1999/xlink","href",href||"");if(!href)el.setAttribute("display","none")}
async function render(side,d={}){const root=parse(await source(side));root.classList.add("svg-card","template-card");root.dataset.side=side;if(side==="front"){text(root,"name",d.name||"Villager");text(root,"meta-left",d.metaLeft||(d.collection?`Série: ${d.collection}`:"Série: AC"));text(root,"meta-right",d.metaRight||d.franchise||"");text(root,"number-top",d.numberTop||d.numberShort||"001");text(root,"number-bottom",d.numberBottom||d.number||"1/12");text(root,"rarity",d.rarity||"SP");text(root,"set-icon",d.setIcon||"⌂");image(root,"front-bg",d.frontBg);image(root,"art",d.art)}else{text(root,"back-text",d.backText||d.franchise||"TCG");image(root,"back-bg",d.backBg);image(root,"back-logo",d.backLogo)}return root}
window.__tcgTemplateSVG={renderFront:d=>render("front",d),renderBack:d=>render("back",d),render};
})();