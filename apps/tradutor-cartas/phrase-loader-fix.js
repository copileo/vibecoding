import{CopileoAI}from'./copileo-ai.js';
import{loadPhrases,DEFAULT_PHRASES}from'./phrase-loader.js';

const PHRASES_URL='https://raw.githubusercontent.com/fernandosivelli/ArydiaPhrases/main/Phrases';
const originalFetch=window.fetch.bind(window);
const originalLocalStorage=window.localStorage;
const originalChatWithImage=CopileoAI.prototype.chatWithImage;

const phraseListPromise=loadPhrases({fetchImpl:originalFetch,storage:originalLocalStorage,url:PHRASES_URL,fallback:DEFAULT_PHRASES,timeoutMs:5000})
  .then(result=>{
    if(result.source!=='remote')console.warn(`Phrase list loaded from ${result.source}.`);
    return result;
  })
  .catch(error=>({phrases:[],source:'error',error}));

window.fetch=async(input,init)=>{
  const url=typeof input==='string'?input:input?.url;
  if(!url||!url.startsWith(`${PHRASES_URL}?`))return originalFetch(input,init);
  const result=await phraseListPromise;
  return new Response(result.phrases.join('\n'),{status:200,headers:{'Content-Type':'text/plain; charset=utf-8'}});
};

if(typeof originalChatWithImage==='function'){
  CopileoAI.prototype.chatWithImage=async function(request){
    const result=await phraseListPromise;
    const phrases=Array.isArray(result.phrases)?result.phrases.filter(Boolean):[];
    const phraseInstruction=phrases.length
      ? `\n\nPHRASE DETECTION: Some exact phrases may appear in small text, footer text, instruction boxes, inventory reminders, or other easily missed parts of the photographed card. Inspect the entire image carefully. If any of these phrases is visible, preserve the exact English phrase in the returned original/originalSegments even if it is not part of the main narrative. Do not omit it because it is small or secondary. Important exact phrases:\n${phrases.map(p=>`- ${p}`).join('\n')}`
      : '';
    return originalChatWithImage.call(this,{...request,prompt:`${request?.prompt||''}${phraseInstruction}`});
  };
}
