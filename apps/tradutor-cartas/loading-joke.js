import{CopileoAI,StaticTokenCredentialsProvider}from'./copileo-ai.js';

const STORE='vibecode-card-translator-v1';
const DEFAULT_URL='https://vibecoding-ai-api.copileo.workers.dev';
const FALLBACK='Um goblin entra num bar. O barman diz: “Não servimos goblins.” O goblin responde: “Ainda bem, vim só de passagem.” 😄';
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
    const response=await ai.chat('Cria UMA piada de D&D muito curta e genuinamente engraçada, em português do Brasil. Máximo 12 palavras. Humor de mesa de RPG, trocadilho ou situação absurda. Não fale de IA, tradução, espera ou carregamento. Retorna apenas a piada.',{max_output_tokens:50,temperature:1.2});
    const text=response?.data?.content?.trim();
    joke.textContent=text||FALLBACK;
  }catch{joke.textContent=FALLBACK}
  finally{generating=false}
}

if(loading&&joke){
  new MutationObserver(()=>{if(!loading.hidden)generate()}).observe(loading,{attributes:true,attributeFilter:['hidden']});
  if(!loading.hidden)generate();
}
