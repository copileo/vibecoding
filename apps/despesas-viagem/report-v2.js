function reportFmt(n,mode){if(mode==='EUR')return eur(n);if(mode==='BRL')return brl(n*(data.rate||0));return `${eur(n)} · ${brl(n*(data.rate||0))}`}
function reportWrap(ctx,text,maxWidth){const words=String(text||'').split(/\s+/),lines=[];let line='';for(const word of words){const test=line?`${line} ${word}`:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word}else line=test}if(line)lines.push(line);return lines.length?lines:['']}
function reportRoundRect(ctx,x,y,w,h,r,fill,stroke){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}}
window.drawReport=function(){
  const c=calc(),payments=settle(c.people),mode=reportCurrency.value,W=1200,pad=56,contentW=W-pad*2;
  const tmp=document.createElement('canvas');tmp.width=W;tmp.height=12000;const ctx=tmp.getContext('2d');
  ctx.textBaseline='alphabetic';ctx.fillStyle='#f5f7fb';ctx.fillRect(0,0,W,tmp.height);
  const navy='#102b50',ink='#132033',muted='#5a6b82',line='#d7dfeb',blue='#dff2ff',green='#e7f7ed';
  ctx.fillStyle=navy;ctx.fillRect(0,0,W,188);
  ctx.fillStyle='#fff';ctx.font='700 48px -apple-system,Arial';ctx.fillText(data.name||'Despesas da viagem',pad,72);
  ctx.font='500 25px -apple-system,Arial';ctx.fillText(`Total da viagem: ${reportFmt(c.total,mode)}`,pad,116);
  ctx.font='400 19px -apple-system,Arial';ctx.fillStyle='#c8d9ee';ctx.fillText(data.rate?`Cotação utilizada: 1 EUR = ${brl(data.rate)}`:'Cotação em real não informada',pad,151);
  ctx.textAlign='right';ctx.fillText(`${data.expenses.length} despesas · ${data.members.length} participantes`,W-pad,151);ctx.textAlign='left';
  let y=232;
  const sectionTitle=title=>{ctx.fillStyle=ink;ctx.font='700 31px -apple-system,Arial';ctx.fillText(title,pad,y);y+=18;ctx.fillStyle=navy;ctx.fillRect(pad,y,contentW,4);y+=22};
  sectionTitle('Despesas e divisão');
  const cols={n:48,desc:320,payer:180,division:340};
  ctx.fillStyle=navy;ctx.fillRect(pad,y,contentW,48);ctx.fillStyle='#fff';ctx.font='700 18px -apple-system,Arial';let x=pad;
  ctx.textAlign='center';ctx.fillText('#',x+cols.n/2,y+31);x+=cols.n;ctx.textAlign='left';ctx.fillText('DESPESA',x+12,y+31);x+=cols.desc;ctx.fillText('PAGO POR',x+12,y+31);x+=cols.payer;ctx.fillText('DIVISÃO / COTAS',x+12,y+31);ctx.textAlign='right';ctx.fillText('VALOR',pad+contentW-12,y+31);ctx.textAlign='left';y+=48;
  data.expenses.forEach((e,index)=>{
    const payerName=data.members.find(m=>m.id===e.payerId)?.name||'—';
    const division=e.shares.map(s=>{const n=data.members.find(m=>m.id===s.memberId)?.name||'?';return `${n} (${s.quota} cota${s.quota===1?'':'s'})`}).join(', ');
    ctx.font='500 18px -apple-system,Arial';const divLines=reportWrap(ctx,division,cols.division-24),descLines=reportWrap(ctx,e.description,cols.desc-24);const h=Math.max(58,Math.max(divLines.length,descLines.length)*23+22);
    ctx.fillStyle=index%2===0?'#eef3f9':'#f9fbfd';ctx.fillRect(pad,y,contentW,h);ctx.strokeStyle=line;ctx.strokeRect(pad,y,contentW,h);
    let cx=pad;ctx.fillStyle=ink;ctx.font='600 18px -apple-system,Arial';ctx.textAlign='center';ctx.fillText(String(index+1),cx+cols.n/2,y+33);cx+=cols.n;ctx.textAlign='left';descLines.forEach((t,i)=>ctx.fillText(t,cx+12,y+30+i*22));cx+=cols.desc;ctx.font='500 17px -apple-system,Arial';ctx.fillText(payerName,cx+12,y+30);cx+=cols.payer;ctx.fillStyle=muted;divLines.forEach((t,i)=>ctx.fillText(t,cx+12,y+30+i*22));ctx.fillStyle=ink;ctx.font='700 18px -apple-system,Arial';ctx.textAlign='right';ctx.fillText(reportFmt(e.amount,mode),pad+contentW-12,y+33);ctx.textAlign='left';y+=h;
  });
  y+=42;sectionTitle('Resumo por pessoa');
  const pCols={name:250,paid:250,owed:250};
  ctx.fillStyle=navy;ctx.fillRect(pad,y,contentW,48);ctx.fillStyle='#fff';ctx.font='700 18px -apple-system,Arial';ctx.fillText('PESSOA',pad+12,y+31);ctx.textAlign='right';ctx.fillText('PAGOU',pad+pCols.name+pCols.paid-12,y+31);ctx.fillText('COTA',pad+pCols.name+pCols.paid+pCols.owed-12,y+31);ctx.fillText('SALDO',pad+contentW-12,y+31);ctx.textAlign='left';y+=48;
  c.people.forEach((p,index)=>{const h=56;ctx.fillStyle=index%2===0?'#eef3f9':'#f9fbfd';ctx.fillRect(pad,y,contentW,h);ctx.strokeStyle=line;ctx.strokeRect(pad,y,contentW,h);ctx.fillStyle=ink;ctx.font='700 19px -apple-system,Arial';ctx.fillText(p.name,pad+12,y+35);ctx.font='500 18px -apple-system,Arial';ctx.textAlign='right';ctx.fillText(reportFmt(p.paid,mode),pad+pCols.name+pCols.paid-12,y+35);ctx.fillText(reportFmt(p.owed,mode),pad+pCols.name+pCols.paid+pCols.owed-12,y+35);ctx.fillStyle=p.balance>=-.005?'#13834b':'#c0392b';ctx.font='700 18px -apple-system,Arial';ctx.fillText(reportFmt(p.balance,mode),pad+contentW-12,y+35);ctx.textAlign='left';y+=h});
  y+=42;sectionTitle('Liquidação sugerida');
  if(!payments.length){reportRoundRect(ctx,pad,y,contentW,64,12,green,line);ctx.fillStyle='#176b3a';ctx.font='700 21px -apple-system,Arial';ctx.fillText('As contas já estão equilibradas. Nenhuma transferência é necessária.',pad+18,y+40);y+=64}else payments.forEach((p,index)=>{const h=68;reportRoundRect(ctx,pad,y,contentW,h,12,index%2===0?blue:'#edf7ff',line);ctx.fillStyle='#075985';ctx.font='700 21px -apple-system,Arial';ctx.fillText(`${p.from} paga`,pad+18,y+42);ctx.fillStyle=ink;ctx.fillText(reportFmt(p.amount,mode),pad+260,y+42);ctx.fillStyle='#075985';ctx.fillText(`para ${p.to}`,pad+700,y+42);y+=h+10});
  y+=34;reportRoundRect(ctx,pad,y,contentW,76,14,'#fff',line);ctx.fillStyle=muted;ctx.font='500 17px -apple-system,Arial';ctx.fillText('Relatório gerado pelo Vibecode Hub',pad+18,y+31);ctx.fillText('Os cálculos usam a moeda-base em euro e a cotação definida para a viagem.',pad+18,y+56);ctx.textAlign='right';ctx.fillText(new Date().toLocaleDateString('pt-BR'),W-pad-18,y+43);ctx.textAlign='left';y+=76;
  const finalH=y+36,canvas=reportCanvas;canvas.width=W;canvas.height=finalH;canvas.getContext('2d').drawImage(tmp,0,0,W,finalH,0,0,W,finalH);return new Promise(resolve=>canvas.toBlob(resolve,'image/png',1));
};