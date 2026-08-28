import {findPhraseMatches} from './phrase-matcher.js';

const PHRASES_URL='https://raw.githubusercontent.com/fernandosivelli/ArydiaPhrases/main/Phrases';
const VERSION='0.4.0';
const $=id=>document.getElementById(id);

async function loadPhrases(){
  const response=await fetch(`${PHRASES_URL}?v=${VERSION}`,{cache:'no-store'});
  if(!response.ok)throw new Error(`Phrase list request failed with HTTP ${response.status}.`);
  return [...new Set((await response.text()).split(/\r?\n/).map(x=>x.trim()).filter(Boolean))];
}

function render(matches){
  const element=$('phrase-matches');
  if(!element)return;
  element.hidden=!matches.length;
  element.innerHTML=matches.length
    ? `<p class="eyebrow">Frases correspondentes</p>${matches.map(match=>`<div class="phrase-match"><strong>${escapeHtml(match.phrase)}</strong><span>Detectada em ${escapeHtml(new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(match.detectedAt)))}</span></div>`).join('')}`
    : '';
}

function escapeHtml(value){return String(value??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}

async function refresh(phrases){
  const original=$('original');
  if(!original)return;
  const text=original.textContent||'';
  const matches=findPhraseMatches({createdAt:new Date().toISOString(),front:{sections:[{original:text}]}},phrases);
  render(matches);
}

async function init(){
  try{
    const phrases=await loadPhrases();
    const original=$('original');
    if(!original)return;
    const observer=new MutationObserver(()=>refresh(phrases));
    observer.observe(original,{childList:true,subtree:true,characterData:true});
    await refresh(phrases);
  }catch(error){
    console.warn('Could not load shared phrase list for card matching',error);
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
