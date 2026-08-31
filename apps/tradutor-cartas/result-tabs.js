import{CopileoAI}from'./copileo-ai.js';

const DB_NAME='vibecoding-card-translator';
const HISTORY_STORE='history';
const $=id=>document.getElementById(id);
let callNumber=0;
let frontResult=null;
let backResult=null;
let resetTimer=null;
let activeSide='front';
const original=CopileoAI.prototype.chatWithImage;

function parsedContent(response){try{const text=response?.data?.content;if(typeof text!=='string')return null;return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''))}catch{return null}}
CopileoAI.prototype.chatWithImage=async function(request){
  callNumber+=1;
  const response=await original.call(this,request);
  const parsed=parsedContent(response);
  if(callNumber===1){frontResult=parsed;backResult=null;clearTimeout(resetTimer);resetTimer=setTimeout(()=>{callNumber=0},1500)}
  else if(callNumber===2){backResult=parsed;clearTimeout(resetTimer);callNumber=0}
  return response;
};
function esc(value){return String(value??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}
function renderSegments(segments,fallback){if(Array.isArray(segments)&&segments.length)return`<p>${segments.map(x=>{let t=esc(x.text||'');if(x.bold)t=`<strong>${t}</strong>`;if(x.italic)t=`<em>${t}</em>`;return t}).join('')}</p>`;return paragraphs(fallback)}
function paragraphs(value){return String(value||'').split(/\n+/).filter(Boolean).map(x=>`<p>${esc(x)}</p>`).join('')}
function typeOf(section){return['narrative','dialogue','rules','choice','identifier','other'].includes(section?.type)?section.type:'other'}
function renderSection(section){return`<section class="section ${typeOf(section)}">${renderSegments(section?.translatedSegments,section?.translated)}</section>`}
function renderCard(card){return Array.isArray(card?.sections)?card.sections.map(renderSection).join(''):'<p>Não foi possível mostrar a tradução deste lado.</p>'}
function renderOriginal(card){return Array.isArray(card?.sections)?card.sections.map(section=>`<section class="section">${renderSegments(section?.originalSegments,section?.original)}</section>`).join(''):''}
function ensureTabs(){
  const translation=$('translation');if(!translation)return null;
  let tabs=$('result-side-tabs');
  if(!tabs){tabs=document.createElement('div');tabs.id='result-side-tabs';tabs.className='side-tabs';tabs.setAttribute('role','tablist');translation.before(tabs);tabs.addEventListener('click',event=>{const button=event.target.closest('[data-result-side]');if(!button)return;activeSide=button.dataset.resultSide;renderResult()})}
  return tabs;
}
function renderResult(){
  const tabs=ensureTabs();if(!tabs)return;
  const hasBack=!!backResult;
  tabs.innerHTML=`<button class="side-tab ${activeSide==='front'?'active':''}" data-result-side="front" role="tab" aria-selected="${activeSide==='front'}">Frente</button>${hasBack?`<button class="side-tab ${activeSide==='back'?'active':''}" data-result-side="back" role="tab" aria-selected="${activeSide==='back'}">Verso</button>`:''}`;
  const card=activeSide==='back'&&hasBack?backResult:frontResult;if(!card)return;
  $('translation').innerHTML=renderCard(card);$('original').innerHTML=renderOriginal(card);
  const title=frontResult?.title?.translated||frontResult?.cardId||'Tradução';$('result-title').textContent=title;$('result-meta').textContent=[hasBack?'Frente e verso':'Frente',frontResult?.cardId,card?.side&&`Lado ${card.side}`].filter(Boolean).join(' · ');
  const warnings=card?.warnings||[];$('warnings').hidden=!warnings.length;$('warnings').innerHTML=warnings.map(w=>`<div>${esc(w.message||'Trecho incerto.')}</div>`).join('');
}
async function loadLatestSaved(){
  if(frontResult||!('indexedDB'in window))return;
  try{
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
    if(!db.objectStoreNames.contains(HISTORY_STORE)){db.close();return}
    const tx=db.transaction(HISTORY_STORE,'readonly');const items=await new Promise((resolve,reject)=>{const request=tx.objectStore(HISTORY_STORE).getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});db.close();
    const latest=items.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    if(latest?.result){frontResult=latest.result.front;backResult=latest.result.back||null;activeSide='front';renderResult()}
  }catch(error){console.warn('Could not load saved result for tabs',error)}
}
const result=$('result');
if(result)new MutationObserver(()=>{if(!result.hidden){if(frontResult)renderResult();else loadLatestSaved()}}).observe(result,{attributes:true,attributeFilter:['hidden']});
window.addEventListener('click',event=>{if(event.target.closest('.recent-item')&&!frontResult)setTimeout(loadLatestSaved,50)});
