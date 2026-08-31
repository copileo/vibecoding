const state={side:'front'};
const nativeGetElementById=document.getElementById.bind(document);
const galleryCompat={set onchange(_handler){},click(){}};
// app.js from the previous revision still binds this legacy element. Keep a
// non-DOM compatibility object so camera-only markup can boot safely.
document.getElementById=id=>id==='gallery-input'?galleryCompat:nativeGetElementById(id);
function openCamera(side){const input=nativeGetElementById(side==='back'?'back-input':'camera-input');if(!input)return;state.side=side;input.click()}
window.addEventListener('DOMContentLoaded',()=>{
 const camera=nativeGetElementById('camera-input');
 const back=nativeGetElementById('back-input');
 nativeGetElementById('front-capture')?.addEventListener('click',()=>openCamera('front'));
 back?.setAttribute('capture','environment');
 camera?.addEventListener('click',()=>{state.side='front'});
});
