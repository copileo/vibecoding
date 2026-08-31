import{loadPhrases,DEFAULT_PHRASES}from'./phrase-loader.js';

const PHRASES_URL='https://raw.githubusercontent.com/fernandosivelli/ArydiaPhrases/main/Phrases';
const originalFetch=window.fetch.bind(window);
const originalLocalStorage=window.localStorage;

window.fetch=async(input,init)=>{
  const url=typeof input==='string'?input:input?.url;
  if(!url||!url.startsWith(`${PHRASES_URL}?`))return originalFetch(input,init);
  const result=await loadPhrases({fetchImpl:originalFetch,storage:originalLocalStorage,url:PHRASES_URL,fallback:DEFAULT_PHRASES,timeoutMs:5000});
  if(result.source!=='remote')console.warn(`Phrase list loaded from ${result.source}.`);
  return new Response(result.phrases.join('\n'),{status:200,headers:{'Content-Type':'text/plain; charset=utf-8'}});
};
