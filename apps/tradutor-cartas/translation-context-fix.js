import{CopileoAI}from'./copileo-ai.js';

let callNumber=0;
let frontResult=null;
let resetTimer=null;
const original=CopileoAI.prototype.chatWithImage;

function parsedContent(response){try{return JSON.parse(response?.data?.content||'')}catch{return null}}
function alignBackLinks(front,back){
  if(!front?.sections||!back?.sections)return back;
  const frontChoices=front.sections.filter(s=>s.type==='choice');
  const backChoices=back.sections.filter(s=>s.type==='choice');
  const keys=frontChoices.map(s=>String(s.linkKey||'').trim()).filter(Boolean);
  frontChoices.forEach((s,i)=>{if(!s.linkKey&&keys[i])s.linkKey=keys[i]});
  frontChoices.forEach((s,i)=>{
    if(!s.linkKey)return;
    const match=backChoices.find(b=>String(b.linkKey||'').trim().toLowerCase()===String(s.linkKey).trim().toLowerCase());
    if(!match&&backChoices[i])backChoices[i].linkKey=s.linkKey;
  });
  return back;
}

CopileoAI.prototype.chatWithImage=async function(request){
  callNumber+=1;
  const isBack=callNumber===2&&frontResult;
  const next=isBack?{...request,prompt:`${request.prompt||''}\n\nBACK-SIDE CONTEXT: The image being translated is the back of the same card. Use the front translation below to preserve terminology and choices. Do not omit any back-side rules or outcome text. For every back section that is the result of a front choice, reuse the exact linkKey from the corresponding front choice. Do not invent or reorder choices. FRONT TRANSLATION:\n${JSON.stringify(frontResult)}`}:request;
  try{
    const response=await original.call(this,next);
    if(callNumber===1){
      frontResult=parsedContent(response);
      resetTimer=setTimeout(()=>{callNumber=0;frontResult=null},1000);
    }else if(callNumber>=2){
      const backResult=parsedContent(response);
      if(backResult&&frontResult){
        alignBackLinks(frontResult,backResult);
        if(typeof response?.data?.content==='string')response.data.content=JSON.stringify(backResult);
      }
      clearTimeout(resetTimer);callNumber=0;frontResult=null;
    }
    return response;
  }catch(error){clearTimeout(resetTimer);callNumber=0;frontResult=null;throw error}
};
