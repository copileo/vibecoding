const TRIP_APP_VERSION='1.1.0';
function reportFmt(n,mode){if(mode==='EUR')return eur(n);if(mode==='BRL')return brl(n*(data.rate||0));return `${eur(n)} · ${brl(n*(data.rate||0))}`}
function reportWrap(ctx,text,maxWidth,maxLines=99){const words=String(text||'').split(/\s+/),lines=[];let line='';for(const word of words){const test=line?`${line} ${word}`:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word;if(lines.length===maxLines-1)break}else line=test}if(line&&lines.length<maxLines)lines.push(line);if(words.length&&lines.length===maxLines){let last=lines[maxLines-1];while(ctx.measureText(last+'…').width>maxWidth&&last.length>1)last=last.slice(0,-1);lines[maxLines-1]=last+'…'}return lines.length?lines:['']}
function reportRoundRect(ctx,x,y,w,h,r,fill,stroke){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}}
function reportCell(ctx,lines,x,y,lineHeight=22){lines.forEach((t,i)=>ctx.fillText(t,x,y+i*lineHeight))}
window.drawReport=function(){
  const c=calc(),payments=settle(c.people),mode=reportCurrency.value,W=1200,pad=56,contentW=W-pad*2;
  const tmp=document.createElement('canvas');tmp.width=W;tmp.height=Math.max(14000,900+data.expenses.length*120);const ctx=tmp.getContext('2d');
  ctx.textBaseline='alphabetic';ctx.fillStyle='#f5f7fb';ctx.fillRect(0,0,W,tmp.height);
  const navy='#102b50',ink='#132033',muted='#5a6b82',line='#d7dfeb',blue='#dff2ff',green='#e7f7ed';
  ctx.fillStyle=navy;ctx.fillRect(0,0,W,188);
  ctx.fillStyle='#fff';ctx.font='700 48px -apple-system,Arial';reportCell(ctx,reportWrap(ctx,data.name||'Despesas da viagem',contentW,1),pad,72);
  ctx.font='500 25px -apple-system,Arial';ctx.fillText(`Total da viagem: ${reportFmt(c.total,mode)}`,pad,116);
  ctx.font='400 19px -apple-system,Arial';ctx.fillStyle='#c8d9ee';ctx.fillText(data.rate?`Cotação utilizada: 1 EUR = ${brl(data.rate)}`:'Cotação em real não informada',pad,151);
  ctx.textAlign='right';ctx.fillText(`${data.expenses.length} despesas · ${data.members.length} participantes`,W-pad,151);ctx.textAlign='left';
  let y=232;
  const sectionTitle=title=>{ctx.fillStyle=ink;ctx.font='700 31px -apple-system,Arial';ctx.fillText(title,pad,y);y+=18;ctx.fillStyle=navy;ctx.fillRect(pad,y,contentW,4);y+=22};
  sectionTitle('Despesas e divisão');
  const cols={n:48,desc:260,payer:155,division:365,value:260};
  ctx.fillStyle=navy;ctx.fillRect(pad,y,contentW,48);ctx.fillStyle='#fff';ctx.font='700 17px -apple-system,Arial';let x=pad;
  ctx.textAlign='center';ctx.fillText('#',x+cols.n/2,y+31);x+=cols.n;ctx.textAlign='left';ctx.fillText('DESPESA',x+12,y+31);x+=cols.desc;ctx.fillText('PAGO POR',x+12,y+31);x+=cols.payer;ctx.fillText('DIVISÃO / COTAS',x+12,y+31);ctx.textAlign='right';ctx.fillText('VALOR',pad+contentW-12,y+31);ctx.textAlign='left';y+=48;
  data.expenses.forEach((e,index)=>{
    const payerName=data.members.find(m=>m.id===e.payerId)?.name||'—';
    const division=e.shares.map(s=>{const n=data.members.find(m=>m.id===s.memberId)?.name||'?';return `${n} (${s.quota} cota${s.quota===1?'':'s'})`}).join(', ');
    ctx.font='500 17px -apple-system,Arial';
    const descLines=reportWrap(ctx,e.description,cols.desc-24,3),payerLines=reportWrap(ctx,payerName,cols.payer-24,2),divLines=reportWrap(ctx,division,cols.division-24,4);
    const lineCount=Math.max(descLines.length,payerLines.length,divLines.length),h=Math.max(62,lineCount*22+26);
    ctx.fillStyle=index%2===0?'#eef3f9':'#f9fbfd';ctx.fillRect(pad,y,contentW,h);ctx.strokeStyle=line;ctx.strokeRect(pad,y,contentW,h);
    let cx=pad;ctx.fillStyle=ink;ctx.font='600 18px -apple-system,Arial';ctx.textAlign='center';ctx.fillText(String(index+1),cx+cols.n/2,y+34);cx+=cols.n;
    ctx.textAlign='left';ctx.font='600 17px -apple-system,Arial';reportCell(ctx,descLines,cx+12,y+31);cx+=cols.desc;
    ctx.font='500 16px -apple-system,Arial';reportCell(ctx,payerLines,cx+12,y+31);cx+=cols.payer;
    ctx.fillStyle=muted;ctx.font='500 16px -apple-system,Arial';reportCell(ctx,divLines,cx+12,y+31);
    ctx.fillStyle=ink;ctx.font='700 17px -apple-system,Arial';ctx.textAlign='right';ctx.fillText(reportFmt(e.amount,mode),pad+contentW-12,y+34);ctx.textAlign='left';y+=h;
  });
  y+=42;sectionTitle('Resumo por pessoa');
  const pCols={name:250,paid:250,owed:250};
  ctx.fillStyle=navy;ctx.fillRect(pad,y,contentW,48);ctx.fillStyle='#fff';ctx.font='700 18px -apple-system,Arial';ctx.fillText('PESSOA',pad+12,y+31);ctx.textAlign='right';ctx.fillText('PAGOU',pad+pCols.name+pCols.paid-12,y+31);ctx.fillText('COTA',pad+pCols.name+pCols.paid+pCols.owed-12,y+31);ctx.fillText('SALDO',pad+contentW-12,y+31);ctx.textAlign='left';y+=48;
  c.people.forEach((p,index)=>{const h=56;ctx.fillStyle=index%2===0?'#eef3f9':'#f9fbfd';ctx.fillRect(pad,y,contentW,h);ctx.strokeStyle=line;ctx.strokeRect(pad,y,contentW,h);ctx.fillStyle=ink;ctx.font='700 19px -apple-system,Arial';ctx.fillText(reportWrap(ctx,p.name,pCols.name-24,1)[0],pad+12,y+35);ctx.font='500 18px -apple-system,Arial';ctx.textAlign='right';ctx.fillText(reportFmt(p.paid,mode),pad+pCols.name+pCols.paid-12,y+35);ctx.fillText(reportFmt(p.owed,mode),pad+pCols.name+pCols.paid+pCols.owed-12,y+35);ctx.fillStyle=p.balance>=-.005?'#13834b':'#c0392b';ctx.font='700 18px -apple-system,Arial';ctx.fillText(reportFmt(p.balance,mode),pad+contentW-12,y+35);ctx.textAlign='left';y+=h});
  y+=42;sectionTitle('Liquidação sugerida');
  if(!payments.length){reportRoundRect(ctx,pad,y,contentW,64,12,green,line);ctx.fillStyle='#176b3a';ctx.font='700 21px -apple-system,Arial';ctx.fillText('As contas já estão equilibradas. Nenhuma transferência é necessária.',pad+18,y+40);y+=64}else payments.forEach((p,index)=>{const h=68;reportRoundRect(ctx,pad,y,contentW,h,12,index%2===0?blue:'#edf7ff',line);ctx.fillStyle='#075985';ctx.font='700 20px -apple-system,Arial';const text=`${p.from} paga ${reportFmt(p.amount,mode)} para ${p.to}`;ctx.fillText(reportWrap(ctx,text,contentW-36,1)[0],pad+18,y+42);y+=h+10});
  y+=34;reportRoundRect(ctx,pad,y,contentW,86,14,'#fff',line);ctx.fillStyle=muted;ctx.font='500 17px -apple-system,Arial';ctx.fillText('Relatório gerado pelo Vibecode Hub',pad+18,y+31);ctx.fillText('Os cálculos usam a moeda-base em euro e a cotação definida para a viagem.',pad+18,y+58);ctx.textAlign='right';ctx.fillText(new Date().toLocaleDateString('pt-BR'),W-pad-18,y+31);ctx.fillText(`App v${TRIP_APP_VERSION}`,W-pad-18,y+58);ctx.textAlign='left';y+=86;
  const finalH=y+36,canvas=reportCanvas;canvas.width=W;canvas.height=finalH;canvas.getContext('2d').drawImage(tmp,0,0,W,finalH,0,0,W,finalH);return new Promise(resolve=>canvas.toBlob(resolve,'image/png',1));
};
(function addVersionFooter(){if(document.getElementById('tripAppVersion'))return;const footer=document.createElement('div');footer.id='tripAppVersion';footer.textContent=`Despesas da viagem · v${TRIP_APP_VERSION}`;footer.style.cssText='text-align:center;color:#94a3b8;font-size:.78rem;margin:18px 0 8px';document.querySelector('main')?.appendChild(footer)})();