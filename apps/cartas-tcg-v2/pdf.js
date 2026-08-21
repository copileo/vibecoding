window.TCGPdf=(()=>{
  const encoder=new TextEncoder(),mm=value=>value*72/25.4;
  const bytes=value=>typeof value==='string'?encoder.encode(value):value;
  const dataBytes=url=>{const raw=atob(url.slice(url.indexOf(',')+1)),result=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)result[i]=raw.charCodeAt(i);return result};
  const blobDataUrl=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)});
  async function portableSvg(source){
    const svg=source.cloneNode(true);
    for(const image of svg.querySelectorAll('image')){
      const href=image.getAttribute('href')||image.getAttributeNS('http://www.w3.org/1999/xlink','href');
      if(!href||href.startsWith('data:'))continue;
      const response=await fetch(new URL(href,location.href));
      if(!response.ok)throw new Error(`Não foi possível carregar uma imagem (${response.status}).`);
      image.setAttribute('href',await blobDataUrl(await response.blob()))
    }
    svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
    return new XMLSerializer().serializeToString(svg)
  }
  async function jpeg(svg,{viewBox,width}={}){
    const source=svg.cloneNode(true),sourceViewBox=viewBox||source.getAttribute('viewBox')||'0 0 630 880';source.setAttribute('viewBox',sourceViewBox);
    if(!width)width=Math.round(744*(Number(sourceViewBox.trim().split(/\s+/)[2])||630)/630);
    const markup=await portableSvg(source),url=URL.createObjectURL(new Blob([markup],{type:'image/svg+xml'}));
    try{
      const image=new Image();image.src=url;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=1039;
      const context=canvas.getContext('2d',{alpha:false});context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
      return{data:dataBytes(canvas.toDataURL('image/jpeg',.97)),width:canvas.width,height:canvas.height}
    }finally{URL.revokeObjectURL(url)}
  }
  function build(images,{mirror=false,scale=1}={}){
    const pageWidth=mm(210),pageHeight=mm(297),cardWidth=mm(63)*scale,cardHeight=mm(88)*scale,gapX=0,gapY=0;
    const gridWidth=cardWidth*3,gridHeight=cardHeight*3,left=(pageWidth-gridWidth)/2,top=(pageHeight-gridHeight)/2;
    const gridBottom=top,gridTop=pageHeight-top,markInner=mm(1),markOuter=mm(6);
    const objects=[null,null,null,bytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')],pageIds=[];
    for(let start=0;start<images.length;start+=9){
      const group=images.slice(start,start+9),pageId=objects.length,contentId=pageId+1;objects.push(null,null);
      const imageIds=group.map(()=>{const value=objects.length;objects.push(null);return value});
      const resources=imageIds.map((id,index)=>`/Im${index} ${id} 0 R`).join(' ');
      const cards=group.map((_,index)=>{const sourceColumn=index%3,column=mirror?2-sourceColumn:sourceColumn,row=Math.floor(index/3),x=left+column*cardWidth,y=pageHeight-top-cardHeight-row*cardHeight;return`q ${cardWidth.toFixed(4)} 0 0 ${cardHeight.toFixed(4)} ${x.toFixed(4)} ${y.toFixed(4)} cm /Im${index} Do Q`}).join('\n');
      const vertical=Array.from({length:4},(_,index)=>{const x=left+index*cardWidth;return`${x.toFixed(4)} ${(gridTop+markInner).toFixed(4)} m ${x.toFixed(4)} ${(gridTop+markOuter).toFixed(4)} l S\n${x.toFixed(4)} ${(gridBottom-markInner).toFixed(4)} m ${x.toFixed(4)} ${(gridBottom-markOuter).toFixed(4)} l S`}).join('\n');
      const horizontal=Array.from({length:4},(_,index)=>{const y=gridBottom+index*cardHeight;return`${(left-markOuter).toFixed(4)} ${y.toFixed(4)} m ${(left-markInner).toFixed(4)} ${y.toFixed(4)} l S\n${(left+gridWidth+markInner).toFixed(4)} ${y.toFixed(4)} m ${(left+gridWidth+markOuter).toFixed(4)} ${y.toFixed(4)} l S`}).join('\n');
      const rulerWidth=mm(50)*scale,rulerLeft=(pageWidth-rulerWidth)/2,rulerY=mm(6);
      const guides=`0.35 w 0 G\n${vertical}\n${horizontal}\n${rulerLeft.toFixed(4)} ${rulerY.toFixed(4)} m ${(rulerLeft+rulerWidth).toFixed(4)} ${rulerY.toFixed(4)} l S\n${rulerLeft.toFixed(4)} ${(rulerY-mm(1.5)).toFixed(4)} m ${rulerLeft.toFixed(4)} ${(rulerY+mm(1.5)).toFixed(4)} l S\n${(rulerLeft+rulerWidth).toFixed(4)} ${(rulerY-mm(1.5)).toFixed(4)} m ${(rulerLeft+rulerWidth).toFixed(4)} ${(rulerY+mm(1.5)).toFixed(4)} l S\nBT /F1 7 Tf ${(pageWidth/2-mm(8)).toFixed(4)} ${(rulerY+mm(2)).toFixed(4)} Td (50 mm) Tj ET\nBT /F1 8 Tf ${(pageWidth/2-mm(12)).toFixed(4)} ${(pageHeight-mm(7)).toFixed(4)} Td (TOP - ${mirror?'BACK':'FRONT'}) Tj ET`;
      const commands=`${cards}\n${guides}`;
      const content=bytes(commands);
      objects[pageId]=bytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(4)} ${pageHeight.toFixed(4)}] /Resources << /Font << /F1 3 0 R >> /XObject << ${resources} >> >> /Contents ${contentId} 0 R >>`);
      objects[contentId]=[bytes(`<< /Length ${content.length} >>\nstream\n`),content,bytes('\nendstream')];
      group.forEach((image,index)=>{objects[imageIds[index]]=[bytes(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.data.length} >>\nstream\n`),image.data,bytes('\nendstream')]});
      pageIds.push(pageId)
    }
    objects[1]=bytes('<< /Type /Catalog /Pages 2 0 R >>');objects[2]=bytes(`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
    const parts=[bytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')],offsets=[0];let length=parts[0].length;
    for(let id=1;id<objects.length;id++){offsets[id]=length;const body=Array.isArray(objects[id])?objects[id]:[objects[id]],head=bytes(`${id} 0 obj\n`),tail=bytes('\nendobj\n');parts.push(head,...body,tail);length+=head.length+body.reduce((sum,item)=>sum+item.length,0)+tail.length}
    const xref=length;let table=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let id=1;id<objects.length;id++)table+=`${String(offsets[id]).padStart(10,'0')} 00000 n \n`;
    parts.push(bytes(table+`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`));return new Blob(parts,{type:'application/pdf'})
  }
  function buildFold(pairs,{scale=1}={}){
    const pageWidth=mm(297),pageHeight=mm(210),cardWidth=mm(63)*scale,cardHeight=mm(88)*scale,foldMargin=mm(6)*scale,gap=mm(4);
    const pieceWidth=cardWidth*2+foldMargin,pieceHeight=cardHeight,layoutWidth=pieceWidth*2+gap,layoutHeight=pieceHeight*2+gap,left=(pageWidth-layoutWidth)/2,top=(pageHeight-layoutHeight)/2;
    const objects=[null,null,null,bytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')],pageIds=[];
    for(let start=0;start<pairs.length;start+=4){
      const group=pairs.slice(start,start+4),pageId=objects.length,contentId=pageId+1;objects.push(null,null);
      const flat=group.flatMap(pair=>[pair.back,pair.front]),imageIds=flat.map(()=>{const value=objects.length;objects.push(null);return value});
      const resources=imageIds.map((id,index)=>`/Im${index} ${id} 0 R`).join(' ');
      const cards=group.map((_,index)=>{
        const column=index%2,row=Math.floor(index/2),x=left+column*(pieceWidth+gap),y=pageHeight-top-pieceHeight-row*(pieceHeight+gap),half=foldMargin/2,imageIndex=index*2,extendedWidth=cardWidth+half;
        return`q ${extendedWidth.toFixed(4)} 0 0 ${cardHeight.toFixed(4)} ${x.toFixed(4)} ${y.toFixed(4)} cm /Im${imageIndex} Do Q\nq ${extendedWidth.toFixed(4)} 0 0 ${cardHeight.toFixed(4)} ${(x+extendedWidth).toFixed(4)} ${y.toFixed(4)} cm /Im${imageIndex+1} Do Q`
      }).join('\n');
      const marks=group.map((_,index)=>{
        const column=index%2,row=Math.floor(index/2),x=left+column*(pieceWidth+gap),y=pageHeight-top-pieceHeight-row*(pieceHeight+gap),right=x+pieceWidth,upper=y+cardHeight,backTrim=x+cardWidth,frontTrim=backTrim+foldMargin,fold=backTrim+foldMargin/2,m=mm(2);
        return`0.35 w 0 G\n${x.toFixed(4)} ${(upper+m).toFixed(4)} m ${x.toFixed(4)} ${upper.toFixed(4)} l S\n${right.toFixed(4)} ${(upper+m).toFixed(4)} m ${right.toFixed(4)} ${upper.toFixed(4)} l S\n${x.toFixed(4)} ${(y-m).toFixed(4)} m ${x.toFixed(4)} ${y.toFixed(4)} l S\n${right.toFixed(4)} ${(y-m).toFixed(4)} m ${right.toFixed(4)} ${y.toFixed(4)} l S\n${(x-m).toFixed(4)} ${upper.toFixed(4)} m ${x.toFixed(4)} ${upper.toFixed(4)} l S\n${(x-m).toFixed(4)} ${y.toFixed(4)} m ${x.toFixed(4)} ${y.toFixed(4)} l S\n${right.toFixed(4)} ${upper.toFixed(4)} m ${(right+m).toFixed(4)} ${upper.toFixed(4)} l S\n${right.toFixed(4)} ${y.toFixed(4)} m ${(right+m).toFixed(4)} ${y.toFixed(4)} l S\n0.3 w 0.25 G ${backTrim.toFixed(4)} ${(y-m).toFixed(4)} m ${backTrim.toFixed(4)} ${y.toFixed(4)} l S\n${backTrim.toFixed(4)} ${upper.toFixed(4)} m ${backTrim.toFixed(4)} ${(upper+m).toFixed(4)} l S\n${frontTrim.toFixed(4)} ${(y-m).toFixed(4)} m ${frontTrim.toFixed(4)} ${y.toFixed(4)} l S\n${frontTrim.toFixed(4)} ${upper.toFixed(4)} m ${frontTrim.toFixed(4)} ${(upper+m).toFixed(4)} l S\n0.72 G [4 4] 0 d ${fold.toFixed(4)} ${y.toFixed(4)} m ${fold.toFixed(4)} ${upper.toFixed(4)} l S [] 0 d 0 G`
      }).join('\n');
      const rulerWidth=mm(50)*scale,rulerLeft=(pageWidth-rulerWidth)/2,rulerY=mm(5);
      const guides=`${marks}\n0.35 w 0 G ${rulerLeft.toFixed(4)} ${rulerY.toFixed(4)} m ${(rulerLeft+rulerWidth).toFixed(4)} ${rulerY.toFixed(4)} l S\n${rulerLeft.toFixed(4)} ${(rulerY-mm(1.5)).toFixed(4)} m ${rulerLeft.toFixed(4)} ${(rulerY+mm(1.5)).toFixed(4)} l S\n${(rulerLeft+rulerWidth).toFixed(4)} ${(rulerY-mm(1.5)).toFixed(4)} m ${(rulerLeft+rulerWidth).toFixed(4)} ${(rulerY+mm(1.5)).toFixed(4)} l S\nBT /F1 7 Tf ${(pageWidth/2-mm(8)).toFixed(4)} ${(rulerY+mm(2)).toFixed(4)} Td (50 mm) Tj ET\nBT /F1 8 Tf ${(pageWidth/2-mm(19)).toFixed(4)} ${(pageHeight-mm(5)).toFixed(4)} Td (TOP - FOLD-OVER) Tj ET`;
      const content=bytes(`${cards}\n${guides}`);
      objects[pageId]=bytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(4)} ${pageHeight.toFixed(4)}] /Resources << /Font << /F1 3 0 R >> /XObject << ${resources} >> >> /Contents ${contentId} 0 R >>`);
      objects[contentId]=[bytes(`<< /Length ${content.length} >>\nstream\n`),content,bytes('\nendstream')];
      flat.forEach((image,index)=>{objects[imageIds[index]]=[bytes(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.data.length} >>\nstream\n`),image.data,bytes('\nendstream')]});
      pageIds.push(pageId)
    }
    objects[1]=bytes('<< /Type /Catalog /Pages 2 0 R >>');objects[2]=bytes(`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
    const parts=[bytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')],offsets=[0];let length=parts[0].length;
    for(let id=1;id<objects.length;id++){offsets[id]=length;const body=Array.isArray(objects[id])?objects[id]:[objects[id]],head=bytes(`${id} 0 obj\n`),tail=bytes('\nendobj\n');parts.push(head,...body,tail);length+=head.length+body.reduce((sum,item)=>sum+item.length,0)+tail.length}
    const xref=length;let table=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let id=1;id<objects.length;id++)table+=`${String(offsets[id]).padStart(10,'0')} 00000 n \n`;
    parts.push(bytes(table+`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`));return new Blob(parts,{type:'application/pdf'})
  }
  async function download(nodes,filename='cartas.pdf',progress=()=>{},{mirror=false,scale=1}={}){
    if(!nodes.length)throw new Error('Nenhuma carta preparada.');if(document.fonts?.ready)await document.fonts.ready;
    const images=[];for(let index=0;index<nodes.length;index++){progress(index+1,nodes.length);images.push(await jpeg(nodes[index]))}
    const url=URL.createObjectURL(build(images,{mirror,scale})),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000)
  }
  async function downloadFold(pairs,filename='cartas-dobraveis.pdf',progress=()=>{},{scale=1}={}){
    if(!pairs.length)throw new Error('Nenhuma carta preparada.');if(document.fonts?.ready)await document.fonts.ready;
    const images=[];
    for(let index=0;index<pairs.length;index++){progress(index+1,pairs.length);images.push({back:await jpeg(pairs[index].back),front:await jpeg(pairs[index].front)})}
    const url=URL.createObjectURL(buildFold(images,{scale})),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000)
  }
  return{download,downloadFold}
})();
