import forecastWorker from './index.js';
import {handlePushRequest,ReminderScheduler} from './push-reminders.js';
import {getOfficialForecast} from './luas-official.js';

export {ReminderScheduler};

const ALLOWED_ORIGIN='https://copileo.github.io';

export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(url.pathname.startsWith('/push/'))return handlePushRequest(request,env);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders()});
  if(request.method==='GET'&&(url.pathname==='/forecast'||url.pathname==='/v1/forecast')){
   const stop=(url.searchParams.get('stop')||'').toLowerCase();
   try{
    const data=await getOfficialForecast(stop,ctx);
    return Response.json(data,{headers:{...corsHeaders(),'Cache-Control':'public,max-age=5,s-maxage=20','X-Luas-Provider':'luas-official-avls','X-Worker-Version':data.workerVersion}});
   }catch(error){
    const fallback=await forecastWorker.fetch(request,env,ctx);
    const headers=new Headers(fallback.headers);
    headers.set('X-Luas-Primary-Fallback',error instanceof Error?error.message:String(error));
    return new Response(fallback.body,{status:fallback.status,statusText:fallback.statusText,headers});
   }
  }
  return forecastWorker.fetch(request,env,ctx);
 }
};

function corsHeaders(){return {'Access-Control-Allow-Origin':ALLOWED_ORIGIN,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type',Vary:'Origin','X-Content-Type-Options':'nosniff'};}
