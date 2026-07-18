(()=>{
  "use strict";

  const PATCH_VERSION="1.4.3";
  const clampValue=(value,min,max)=>Math.max(min,Math.min(max,value));

  function cardWidth(root){
    return root.getBoundingClientRect().width||root.clientWidth||315;
  }

  function fontPixels(root,value){
    return Math.max(7,cardWidth(root)*(Number(value)||1)/100)+"px";
  }

  window.imageStyle=function imageStyleFixed(image,prefix){
    if(!image)return;
    Object.assign(image.style,{
      objectFit:layout[prefix+"Fit"]||"cover",
      objectPosition:(layout[prefix+"PosX"]??50)+"% "+(layout[prefix+"PosY"]??50)+"%",
      transform:"scale("+((layout[prefix+"Zoom"]||100)/100)+")",
      transformOrigin:"50% 50%"
    });
  };

  window.apply=function applyFixed(root){
    const query=selector=>root.querySelector(selector);
    const art=query(".art"),logo=query(".logo"),name=query(".name"),meta=query(".meta"),bg=query(".bg"),mark=query(".backmark");
    if(bg)imageStyle(bg,root.dataset.side==="back"?"back":"front");
    if(art){
      Object.assign(art.style,{left:(layout.artX??7)+"%",top:(layout.artY??16)+"%",width:(layout.artW??86)+"%",height:(layout.artH??58)+"%"});
      imageStyle(art,"art");
    }
    if(logo){
      Object.assign(logo.style,{left:(layout.logoX??70)+"%",top:(layout.logoY??4)+"%",width:(layout.logoW??25)+"%",height:(layout.logoH??9)+"%"});
      imageStyle(logo,"logo");
    }
    [[name,"name"],[meta,"meta"],[mark,"backText"]].forEach(([element,prefix])=>{
      if(!element)return;
      Object.assign(element.style,{
        left:(layout[prefix+"X"]??0)+"%",
        top:(layout[prefix+"Y"]??0)+"%",
        width:(layout[prefix+"W"]??70)+"%",
        height:(layout[prefix+"H"]??8)+"%",
        fontSize:fontPixels(root,layout[prefix+"Size"]??4)
      });
    });
    return root;
  };

  window.resetGesture=function resetGestureFixed(){
    const active=[...pointers.values()];
    if(!active.length||!gesture?.card)return;
    const component=gesture.component||selected;
    const card=gesture.card;
    const rect=card.getBoundingClientRect();
    const isImage=defs[component]?.[1]==="image";
    gesture={
      card,
      component,
      image:isImage,
      count:active.length,
      origin:{...active[0]},
      distance:active.length>1?Math.hypot(active[0].x-active[1].x,active[0].y-active[1].y):0,
      rect,
      start:{
        x:layout[component+"X"]??0,
        y:layout[component+"Y"]??0,
        w:layout[component+"W"]??100,
        h:layout[component+"H"]??100,
        posX:layout[component+"PosX"]??50,
        posY:layout[component+"PosY"]??50,
        zoom:layout[component+"Zoom"]??100
      }
    };
  };

  window.startGesture=function startGestureFixed(event){
    event.preventDefault();
    const card=event.currentTarget;
    const component=selected;
    const side=card.dataset.side;
    if(component==="front"&&side!=="front")return;
    if(component==="back"&&side!=="back")return;
    if(component==="backText"&&side!=="back")return;
    if(["art","logo","name","meta"].includes(component)&&side!=="front")return;
    card.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    gesture={card,component};
    resetGesture();
  };

  window.moveGesture=function moveGestureFixed(event){
    if(!gesture||!pointers.has(event.pointerId))return;
    event.preventDefault();
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    const active=[...pointers.values()];
    if(active.length!==gesture.count){resetGesture();return;}
    const component=gesture.component;
    const {rect,start,image}=gesture;
    if(active.length===1){
      const dx=(active[0].x-gesture.origin.x)/rect.width*100;
      const dy=(active[0].y-gesture.origin.y)/rect.height*100;
      if(image){
        // Sensibilidade menor e direção de “arrastar a própria imagem”.
        layout[component+"PosX"]=clampValue(start.posX-dx*.65,0,100);
        layout[component+"PosY"]=clampValue(start.posY-dy*.65,0,100);
      }else{
        layout[component+"X"]=clampValue(start.x+dx,-20,100);
        layout[component+"Y"]=clampValue(start.y+dy,-20,100);
      }
    }else{
      const distance=Math.hypot(active[0].x-active[1].x,active[0].y-active[1].y);
      const ratio=distance/Math.max(1,gesture.distance);
      if(image){
        layout[component+"Zoom"]=clampValue(start.zoom*ratio,50,300);
      }else{
        layout[component+"W"]=clampValue(start.w*ratio,3,120);
        layout[component+"H"]=clampValue(start.h*ratio,3,120);
      }
    }
    if(!raf)raf=requestAnimationFrame(()=>{raf=0;updateAllStyles();});
  };

  window.endGesture=function endGestureFixed(event){
    pointers.delete(event.pointerId);
    if(!pointers.size){
      gesture=null;
      buildControls();
    }else{
      resetGesture();
    }
  };

  window.wireEditor=function wireEditorFixed(){
    document.querySelectorAll(".layout-preview").forEach(card=>{
      card.onpointerdown=startGesture;
      card.onpointermove=moveGesture;
      card.onpointerup=endGesture;
      card.onpointercancel=endGesture;
      card.querySelectorAll("[data-component]").forEach(element=>element.classList.add("editable"));
    });
  };

  const originalRender=window.renderLayoutPreview;
  if(typeof originalRender==="function"){
    window.renderLayoutPreview=function(){
      originalRender();
      requestAnimationFrame(()=>{
        document.querySelectorAll(".layout-preview").forEach(apply);
        wireEditor();
      });
    };
  }

  const observer=new ResizeObserver(entries=>{
    entries.forEach(entry=>apply(entry.target));
  });
  document.querySelectorAll(".layout-preview,.print-card,.card").forEach(card=>observer.observe(card));

  requestAnimationFrame(()=>{
    updateAllStyles();
    wireEditor();
    const footer=document.querySelector("#ver");
    if(footer)footer.textContent="Cartas TCG · v"+PATCH_VERSION;
  });
})();