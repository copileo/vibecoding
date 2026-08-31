import{CopileoAI,StaticTokenCredentialsProvider}from'./copileo-ai.js';

const STORE='vibecode-card-translator-v1';
const DEFAULT_URL='https://vibecoding-ai-api.copileo.workers.dev';
const FALLBACK='Os polvos têm três corações — e ainda assim nenhum aguenta uma sessão de D&D longa.';
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
    const response=await ai.chat('Cria UMA trivia curta, verdadeira e surpreendente, em português do Brasil. Máximo 20 palavras. Deve ser genuinamente divertida ou absurda, daquelas que fazem alguém dizer “não é possível”. Prefere curiosidades sobre animais, história, ciência, comida, linguagem ou factos estranhos. Pode ter uma pequena punchline, mas NÃO é uma piada. Não fale de IA, tradução, espera ou carregamento. Retorna apenas a trivia.',{max_output_tokens:60,temperature:1.1});
    const text=response?.data?.content?.trim();
    joke.textContent=text||FALLBACK;
  }catch{joke.textContent=FALLBACK}
  finally{generating=false}
}

if(loading&&joke){
  new MutationObserver(()=>{if(!loading.hidden)generate()}).observe(loading,{attributes:true,attributeFilter:['hidden']});
  if(!loading.hidden)generate();
}
