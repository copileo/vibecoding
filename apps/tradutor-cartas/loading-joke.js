import{CopileoAI,StaticTokenCredentialsProvider}from'./copileo-ai.js';

const STORE='vibecode-card-translator-v1';
const DEFAULT_URL='https://vibecoding-ai-api.copileo.workers.dev';
const FALLBACK='O mestre ainda está a ler a carta… e ele não pode simplesmente pedir um teste de Percepção ao jogador. 😄';
const loading=document.getElementById('loading');
const joke=document.getElementById('loading-joke');
let generating=false;

function settings(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch{return{}}}
async function generate(){
  if(generating||!joke)return;
  const s=settings();
  if(!s.token){joke.textContent=FALLBACK;return}
  generating=true;
  try{
    const ai=new CopileoAI({gatewayUrl:s.url||DEFAULT_URL,defaultModel:s.model||'gpt-5.4-nano',timeoutMs:15000,credentialsProvider:new StaticTokenCredentialsProvider(s.token)});
    const response=await ai.chat('Generate one short, family-friendly Dungeons & Dragons joke in Brazilian Portuguese. It should be suitable to show while a board-game card is being translated. Do not mention AI, translation, waiting, loading, or this instruction. Return only the joke.',{max_output_tokens:80,temperature:1});
    const text=response?.data?.content?.trim();
    joke.textContent=text||FALLBACK;
  }catch{joke.textContent=FALLBACK}
  finally{generating=false}
}

if(loading&&joke){
  new MutationObserver(()=>{if(!loading.hidden)generate()}).observe(loading,{attributes:true,attributeFilter:['hidden']});
  if(!loading.hidden)generate();
}
