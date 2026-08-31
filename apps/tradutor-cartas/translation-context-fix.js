import{CopileoAI}from'./copileo-ai.js';

let callNumber=0;
let frontResult=null;
let resetTimer=null;
const original=CopileoAI.prototype.chatWithImage;

CopileoAI.prototype.chatWithImage=async function(request){
  callNumber+=1;
  const isBack=callNumber===2&&frontResult;
  const next=isBack?{...request,prompt:`${request.prompt||''}\n\nBACK-SIDE CONTEXT: The image being translated is the back of the same card. Use the front translation below to preserve terminology and choices. Do not omit any back-side rules or outcome text. For every back section that is the result of a front choice, reuse the exact linkKey from the corresponding front choice. Do not invent or reorder choices. FRONT TRANSLATION:\n${JSON.stringify(frontResult)}`}:request;
  try{
    const response=await original.call(this,next);
    if(callNumber===1){
      try{frontResult=JSON.parse(response?.data?.content||'')}catch{frontResult=null}
      resetTimer=setTimeout(()=>{callNumber=0;frontResult=null},1000);
    }
    if(callNumber>=2){clearTimeout(resetTimer);callNumber=0;frontResult=null}
    return response;
  }catch(error){clearTimeout(resetTimer);callNumber=0;frontResult=null;throw error}
};
