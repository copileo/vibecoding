const state={side:'front'};
function openCamera(side){const input=document.getElementById('camera-input');if(!input)return;state.side=side;input.click()}
window.addEventListener('DOMContentLoaded',()=>{
 const camera=document.getElementById('camera-input');
 const back=document.getElementById('back-input');
 document.getElementById('front-capture')?.addEventListener('click',()=>openCamera('front'));
 back?.setAttribute('capture','environment');
 camera?.addEventListener('change',event=>{
  if(state.side!=='back')return;
  event.stopImmediatePropagation();
  const file=camera.files?.[0];
  if(!file||!back)return;
  const transfer=new DataTransfer();transfer.items.add(file);back.files=transfer.files;
  back.dispatchEvent(new Event('change',{bubbles:true}));
  camera.value='';state.side='front';
 });
 camera?.addEventListener('click',()=>{if(state.side!=='back')state.side='front'});
});
