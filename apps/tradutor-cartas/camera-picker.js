const state={allow:null};

function openPicker(side){
  const dialog=document.getElementById('image-source-dialog');
  if(!dialog)return;
  dialog.dataset.side=side;
  dialog.showModal();
}

function choose(kind){
  const dialog=document.getElementById('image-source-dialog');
  const side=dialog?.dataset.side||'front';
  const input=document.getElementById(kind==='camera'?'camera-input':side==='back'?'back-input':'gallery-input');
  if(!input)return;
  state.allow=input;
  dialog?.close();
  input.click();
}

window.addEventListener('DOMContentLoaded',()=>{
  const camera=document.getElementById('camera-input');
  const gallery=document.getElementById('gallery-input');
  const back=document.getElementById('back-input');
  const dialog=document.getElementById('image-source-dialog');
  const close=document.getElementById('image-source-cancel');
  document.getElementById('front-capture')?.addEventListener('click',()=>openPicker('front'));
  document.getElementById('choose-back')?.addEventListener('click',()=>openPicker('back'));
  document.getElementById('choose-retake')?.addEventListener('click',()=>openPicker('front'));
  document.getElementById('image-source-camera')?.addEventListener('click',()=>choose('camera'));
  document.getElementById('image-source-gallery')?.addEventListener('click',()=>choose('gallery'));
  close?.addEventListener('click',()=>dialog?.close());
  [camera,gallery,back].forEach(input=>input?.addEventListener('click',event=>{
    if(state.allow===input){state.allow=null;return;}
    event.preventDefault();
    openPicker(input===back?'back':'front');
  }));
});
