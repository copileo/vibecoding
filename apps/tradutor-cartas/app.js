import{CopileoAI,CopileoAIError,StaticTokenCredentialsProvider}from'./copileo-ai.js';
import{findPhraseMatches}from'./phrase-matcher.js';

const APP_VERSION='0.4.1';
const STORE='vibecode-card-translator-v1';
const LEGACY_HISTORY='vibecode-card-translator-history-v2';
const DB_NAME='vibecode-card-translator';
const DB_VERSION=1;
const HISTORY_STORE='history';
const HISTORY_LIMIT=30;
const DEFAULT_URL='https://vibecoding-ai-api.copileo.workers.dev';
const PHRASES_URL='https://raw.githubusercontent.com/fernandosivelli/ArydiaPhrases/main/Phrases';
const $=id=>document.getElementById(id);

let settings=load(STORE,{url:DEFAULT_URL,token:'',model:'gpt-5.4-nano'});
let images={front:null,back:null};
let urls={front:null,back:null};
let reviewSide='front';
let currentResult=null;
let recentItems=[];
let configuredPhrases=[];
let phraseMatches=[];
let phraseListError=null;

const PROMPT=`Translate the photographed board-game card from English into Brazilian Portuguese for immediate use during gameplay. Preserve exact rules, choices, numbers, codes, reading order and visible emphasis. Return valid JSON only: {"title":{"original":"","translated":""},"cardId":"","side":"","sections":[{"type":"narrative|dialogue|rules|choice|identifier|other","original":"","translated":"","linkKey":"","originalSegments":[{"text":"","bold":false,"italic":false}],"translatedSegments":[{"text":"","bold":false,"italic":false}]}],"warnings":[{"type":"unreadable|uncertain|unknown_symbol","message":""}]}. Use segments when bold or italic formatting is visible. For every front-side choice or option whose result is written on the back, assign a short stable linkKey (for example, "medicine", "cure", "other") to that front section. Assign the exact same linkKey to the matching back-side section. Do not add a separate instruction to see or refer to the back; the choices themselves open their matching back text. Do not invent emphasis, links or unreadable text.`;

init().catch(showBootError);

async function init(){
  $('version').textContent=`v${APP_VERSION}`;
  bind();
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  show(settings.token?'home':'setup');
  fillSetup();
  await migrateLegacyHistory();
  configuredPhrases=await loadPhrases();
  await renderRecent();
}

function bind(){
  $('camera-input').onchange=e=>pick(e,'front');
  $('gallery-input').onchange=e=>pick(e,'front');
  $('back-input').onchange=e=>pick(e,'back');
  $('retake').onclick=retake;
  $('add-back').onclick=()=>$('back-input').click();
  $('translate').onclick=translateBoth;
  $('another').onclick=resetCapture;
  $('large-text').onclick=()=>$('translation').classList.toggle('large');
  $('test-api').onclick=testConnection;
  $('save-settings').onclick=saveSetup;
  $('settings-open').onclick=openSettings;
  $('settings-save').onclick=saveDialog;
  $('forget-token').onclick=forgetToken;
  $('clear-history').onclick=clearHistory;
  $('clear-history-settings').onclick=clearHistory;
  $('refresh-storage').onclick=refreshStorageDiagnostics;
  document.querySelectorAll('[data-review-side]').forEach(b=>b.onclick=()=>showReviewSide(b.dataset.reviewSide));
}
function show(id){document.querySelectorAll('.screen').forEach(x=>x.hidden=true);$(id).hidden=false;scrollTo(0,0)}
function showBootError(e){$('setup').hidden=false;$('setup-status').textContent=`Falha ao iniciar: ${e?.message||'erro desconhecido'}`}

async function pick(e,side){
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  try{images[side]=await prepareImage(file);if(urls[side])URL.revokeObjectURL(urls[side]);urls[side]=URL.createObjectURL(images[side]);reviewSide=side;showReviewSide(side);show('review')}catch(err){alert(messageFor(err))}
}
async function prepareImage(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Selecione JPEG, PNG ou WebP.');
  const bitmap=await createImageBitmap(file),max=1600,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
  canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  return await new Promise((r,j)=>canvas.toBlob(b=>b?r(b):j(Error('Falha ao preparar imagem.')),'image/jpeg',.86));
}
function showReviewSide(side){
  if(!images[side]){if(side==='back')$('back-input').click();return}
  reviewSide=side;$('preview').src=urls[side];document.querySelectorAll('[data-review-side]').forEach(b=>b.classList.toggle('active',b.dataset.reviewSide===side));$('review-hint').textContent=images.back?'Frente e verso prontos para tradução.':'Você pode traduzir apenas a frente ou adicionar o verso.';$('add-back').textContent=images.back?'Trocar verso':'Adicionar verso';
}
function retake(){if(reviewSide==='back')$('back-input').click();else $('camera-input').click()}
function client(){if(!settings.token)throw Error('Configure o token.');return new CopileoAI({gatewayUrl:settings.url,defaultModel:settings.model,timeoutMs:60000,credentialsProvider:new StaticTokenCredentialsProvider(settings.token)})}

async function translateBoth(){
  if(!images.front)return;show('loading');
  try{
    const out={front:null,back:null};$('loading-label').textContent='Traduzindo frente…';out.front=await translateSide(images.front);
    if(images.back){$('loading-label').textContent='Traduzindo verso…';out.back=await translateSide(images.back)}
    currentResult={front:out.front,back:out.back,createdAt:new Date().toISOString()};phraseMatches=findPhraseMatches(currentResult,configuredPhrases);showResultSide();show('result');setPersistenceStatus('Salvando no histórico…','muted');
    saveHistory(currentResult).then(()=>setPersistenceStatus('',null)).catch(err=>{console.warn('History persistence failed',err);setPersistenceStatus('Tradução concluída, mas não foi possível salvá-la no histórico deste dispositivo.','warning')});
  }catch(e){show('review');alert(messageFor(e))}
}
async function translateSide(image){
  const response=await client().chatWithImage({prompt:PROMPT,image,detail:'high'}),text=response?.data?.content;if(typeof text!=='string')throw Error('Resposta sem conteúdo.');
  const parsed=JSON.parse(text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));if(!Array.isArray(parsed.sections))throw Error('Formato de tradução inválido.');parsed.warnings=Array.isArray(parsed.warnings)?parsed.warnings:[];return parsed;
}
function showResultSide(){
  const data=currentResult?.front;if(!data)return;$('result-title').textContent=data.title?.translated||data.cardId||'Tradução';$('result-meta').textContent=[currentResult.back?'Frente e verso':'Frente',data.cardId,data.side&&`Lado ${data.side}`].filter(Boolean).join(' · ');renderPhraseListStatus();
  $('translation').innerHTML=data.sections.map((s,index)=>`<section class="section ${safeType(s.type)}">${renderTranslated(s,currentResult.back,index)}</section>`).join('');$('original').innerHTML=data.sections.map(s=>`<section class="section">${renderOriginal(s)}</section>`).join('');renderPhraseMatches();$('warnings').hidden=!data.warnings.length;$('warnings').innerHTML=data.warnings.map(w=>`<div>${esc(w.message||'Trecho incerto.')}</div>`).join('');
}
function renderPhraseListStatus(){const element=$('phrase-list-status');if(!element)return;if(phraseListError){element.textContent='⚠ A lista de frases não pôde ser carregada. As correspondências não estão disponíveis.';element.hidden=false;return}element.hidden=true;element.textContent=''}
async function loadPhrases(){phraseListError=null;try{const response=await fetch(`${PHRASES_URL}?v=${APP_VERSION}`,{cache:'no-store'});if(!response.ok)throw Error(`Phrase list request failed with HTTP ${response.status}.`);return[...new Set((await response.text()).split(/\r?\n/).map(phrase=>phrase.trim()).filter(Boolean))]}catch(error){phraseListError=error;console.warn('Could not load shared phrase list',error);return[]}}
function renderPhraseMatches(){const element=$('phrase-matches');element.hidden=!phraseMatches.length;element.innerHTML=phraseMatches.length?`<p class="eyebrow">Frases correspondentes</p>${phraseMatches.map(match=>`<div class="phrase-match"><strong>${esc(match.phrase)}</strong><span>Detectada em ${esc(formatDate(match.detectedAt))}</span></div>`).join('')}`:''}
function formatDate(value){try{return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value))}catch{return String(value||'')}}

function renderTranslated(s,back,index){if(back&&s.type==='choice')return renderChoice(s,back,index);return renderSegments(s.translatedSegments)||paragraphs(s.translated)}
function renderOriginal(s){return renderSegments(s.originalSegments)||paragraphs(s.original)}
function renderSegments(a){if(!Array.isArray(a)||!a.length)return'';return`<p>${a.map(renderSegment).join('')}</p>`}
function renderSegment(x){let t=esc(x.text||'');if(x.bold)t=`<strong>${t}</strong>`;if(x.italic)t=`<em>${t}</em>`;return t}
function renderChoice(front,back,index){const linked=findBackSections(front,back,index),content=linked.length?linked.map(s=>`<section class="section ${safeType(s.type)}">${renderTranslated(s)}</section>`).join(''):'<p>Não foi possível localizar o texto correspondente no verso.</p>';return`<details class="choice-reference"><summary>${renderTranslatedText(front)}</summary><div class="choice-reference-content">${content}</div></details>`}
function renderTranslatedText(s){return renderSegments(s.translatedSegments)||esc(s.translated||'')}
function findBackSections(front,back,index){const sections=Array.isArray(back?.sections)?back.sections:[],key=String(front.linkKey||'').trim().toLowerCase();if(key){const linked=sections.filter(s=>String(s.linkKey||'').trim().toLowerCase()===key);if(linked.length)return linked}const frontText=normalise(front.translated||front.original),textMatch=sections.filter(s=>normalise(`${s.translated||''} ${s.original||''}`).includes(frontText));if(textMatch.length)return textMatch;const backChoices=sections.filter(s=>s.type==='choice');return backChoices[index]?[backChoices[index]]:[]}
function normalise(value){return String(value||'').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function paragraphs(t){return String(t||'').split(/\n+/).filter(Boolean).map(p=>`<p>${esc(p)}</p>`).join('')}
function safeType(t){return['narrative','dialogue','rules','choice','identifier','other'].includes(t)?t:'other'}
function setPersistenceStatus(message,type){const el=$('persistence-status');el.textContent=message;el.hidden=!message;el.className=type==='warning'?'persistence-status warning':'persistence-status muted'}

function openDb(){return new Promise((resolve,reject)=>{if(!('indexedDB'in window))return reject(Error('IndexedDB não está disponível neste navegador.'));const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(HISTORY_STORE)){const store=db.createObjectStore(HISTORY_STORE,{keyPath:'id'});store.createIndex('createdAt','createdAt')}};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('Falha ao abrir IndexedDB.'))})}
function requestResult(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function historyGetAll(){const db=await openDb();try{const tx=db.transaction(HISTORY_STORE,'readonly');const items=await requestResult(tx.objectStore(HISTORY_STORE).getAll());return items.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))}finally{db.close()}}
async function waitTransaction(tx){return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error('Falha no armazenamento.'));tx.onabort=()=>reject(tx.error||Error('Operação de armazenamento cancelada.'))})}
async function historyPut(item){const db=await openDb();try{const tx=db.transaction(HISTORY_STORE,'readwrite');tx.objectStore(HISTORY_STORE).put(item);await waitTransaction(tx)}finally{db.close()}const all=await historyGetAll();if(all.length>HISTORY_LIMIT){const db2=await openDb();try{const tx=db2.transaction(HISTORY_STORE,'readwrite'),store=tx.objectStore(HISTORY_STORE);all.slice(HISTORY_LIMIT).forEach(x=>store.delete(x.id));await waitTransaction(tx)}finally{db2.close()}}}
async function historyClear(){const db=await openDb();try{const tx=db.transaction(HISTORY_STORE,'readwrite');tx.objectStore(HISTORY_STORE).clear();await waitTransaction(tx)}finally{db.close()}}
async function saveHistory(result){const front=result.front,item={id:crypto.randomUUID(),createdAt:result.createdAt,cardId:front.cardId||'',title:front.title?.translated||'Tradução',result};await historyPut(item);await renderRecent()}
async function renderRecent(){try{recentItems=await historyGetAll()}catch(err){console.warn('Could not load history',err);recentItems=[]}$('recent-section').hidden=!recentItems.length;$('recent-list').innerHTML=recentItems.map((x,i)=>`<button class="recent-item" data-i="${i}"><strong>${esc(x.title)}</strong><span>${esc(x.cardId||'Carta sem código')}${x.result?.back?' · frente e verso':''}</span></button>`).join('');$('recent-list').querySelectorAll('button').forEach(b=>b.onclick=()=>{currentResult=recentItems[+b.dataset.i].result;phraseMatches=findPhraseMatches(currentResult,configuredPhrases);setPersistenceStatus('',null);showResultSide();show('result')})}
async function clearHistory(){if(!confirm('Apagar histórico?'))return;try{await historyClear();localStorage.removeItem(LEGACY_HISTORY);await renderRecent();await refreshStorageDiagnostics()}catch(e){alert('Não foi possível apagar o histórico.')}}
async function migrateLegacyHistory(){let legacy=[];try{legacy=JSON.parse(localStorage.getItem(LEGACY_HISTORY)||'[]')}catch{}if(!Array.isArray(legacy)||!legacy.length){try{localStorage.removeItem(LEGACY_HISTORY)}catch{};return}try{for(const item of legacy.slice(0,HISTORY_LIMIT))if(item?.id&&item?.result)await historyPut(item);localStorage.removeItem(LEGACY_HISTORY)}catch(err){console.warn('Legacy history migration failed; translations remain available in legacy storage.',err)}}
function resetCapture(){Object.values(urls).forEach(url=>url&&URL.revokeObjectURL(url));images={front:null,back:null};urls={front:null,back:null};currentResult=null;setPersistenceStatus('',null);show('home');setTimeout(()=>$('camera-input').click(),80)}
function fillSetup(){$('api-url').value=settings.url;$('api-token').value=settings.token;$('model').value=settings.model}
async function testConnection(){try{$('setup-status').textContent='Testando…';const c=new CopileoAI({gatewayUrl:$('api-url').value.trim()||DEFAULT_URL,credentialsProvider:new StaticTokenCredentialsProvider($('api-token').value.trim())});await c.models();$('setup-status').textContent='Conexão funcionando.'}catch(e){$('setup-status').textContent=messageFor(e)}}
function saveSetup(){settings={url:$('api-url').value.trim()||DEFAULT_URL,token:$('api-token').value.trim(),model:$('model').value.trim()||'gpt-5.4-nano'};if(!settings.token)return $('setup-status').textContent='Informe o token.';if(!save(STORE,settings))return $('setup-status').textContent='Não foi possível salvar as configurações neste dispositivo.';show('home');}
function openSettings(){$('settings-url').value=settings.url;$('settings-token').value=settings.token;$('settings-model').value=settings.model;$('settings-dialog').showModal();refreshStorageDiagnostics()}
function saveDialog(e){e.preventDefault();const next={url:$('settings-url').value.trim()||DEFAULT_URL,token:$('settings-token').value.trim(),model:$('settings-model').value.trim()||'gpt-5.4-nano'};if(!save(STORE,next)){alert('Não foi possível salvar as configurações neste dispositivo.');return}settings=next;$('settings-dialog').close()}
function forgetToken(){settings.token='';save(STORE,settings);$('settings-dialog').close();fillSetup();show('setup')}
async function refreshStorageDiagnostics(){const el=$('storage-diagnostics');if(!el)return;el.textContent='Calculando…';try{const history=await historyGetAll().catch(()=>[]);const localBytes=estimateLocalStorageBytes();let origin='Uso total do site indisponível';if(navigator.storage?.estimate){const {usage=0,quota=0}=await navigator.storage.estimate();origin=`Site: ${formatBytes(usage)} de ${formatBytes(quota)} (${quota?Math.round(usage/quota*100):0}%)`}el.textContent=`${origin} · Histórico: ${history.length} item(ns) · localStorage: ${formatBytes(localBytes)}`}catch(e){el.textContent='Não foi possível consultar o armazenamento neste navegador.'}}
function estimateLocalStorageBytes(){let total=0;try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'',v=localStorage.getItem(k)||'';total+=(k.length+v.length)*2}}catch{}return total}
function formatBytes(n){if(n<1024)return`${n} B`;if(n<1024*1024)return`${(n/1024).toFixed(1)} KB`;return`${(n/1024/1024).toFixed(1)} MB`}
function messageFor(e){if(e instanceof CopileoAIError){if(e.status===401)return'Token inválido ou expirado.';if(e.code==='TIMEOUT')return'A API demorou demais.';if(e.code==='NETWORK_ERROR')return'Não foi possível acessar a AI API.'}return e?.message||'Erro inesperado.'}
function load(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){console.warn('localStorage write failed',e);return false}}
function esc(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}
