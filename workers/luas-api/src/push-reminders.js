import webpush from 'web-push';

const ALLOWED_ORIGIN='https://copileo.github.io';
const MAX_REMINDER_MS=3*60*60*1000;

export async function handlePushRequest(request,env){
 const url=new URL(request.url);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders()});
 if(url.pathname==='/push/config'&&request.method==='GET')return json({enabled:Boolean(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY&&env.REMINDER_SCHEDULER),publicKey:env.VAPID_PUBLIC_KEY||''});
 if(url.pathname==='/push/reminders'&&request.method==='POST'){
  if(!env.REMINDER_SCHEDULER||!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY)return json({error:'Push notifications are not configured.'},503);
  const body=await request.json().catch(()=>null);
  if(!body?.subscription?.endpoint)return json({error:'A valid push subscription is required.'},400);
  const notifyAt=Date.parse(body.notifyAt);
  if(!Number.isFinite(notifyAt)||notifyAt<Date.now()-30000||notifyAt>Date.now()+MAX_REMINDER_MS)return json({error:'The notification time is invalid or outside the supported window.'},400);
  const payload={
   subscription:body.subscription,
   notifyAt,
   title:clean(body.title,90)||'Luas reminder',
   body:clean(body.body,180)||'Your Luas is due shortly.',
   url:clean(body.url,300)||'https://copileo.github.io/vibecoding/apps/luas-live/',
   tag:clean(body.tag,100)||`luas-${notifyAt}`
  };
  const id=env.REMINDER_SCHEDULER.idFromName('global');
  const response=await env.REMINDER_SCHEDULER.get(id).fetch('https://scheduler.internal/reminders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  return new Response(response.body,{status:response.status,headers:{...corsHeaders(),'Content-Type':'application/json','Cache-Control':'no-store'}});
 }
 return json({error:'Not found.'},404);
}

export class ReminderScheduler{
 constructor(state,env){this.state=state;this.env=env;}
 async fetch(request){
  if(request.method!=='POST')return Response.json({error:'Method not allowed.'},{status:405});
  const reminder=await request.json();
  const id=crypto.randomUUID();
  await this.state.storage.put(`reminder:${id}`,reminder);
  await this.scheduleNextAlarm();
  return Response.json({ok:true,id,notifyAt:new Date(reminder.notifyAt).toISOString()},{status:201});
 }
 async alarm(){
  const entries=await this.state.storage.list({prefix:'reminder:'});
  const now=Date.now();
  const due=[];
  for(const [key,value] of entries){if(Number(value.notifyAt)<=now+15000)due.push([key,value]);}
  for(const [key,reminder] of due){
   try{await sendPush(reminder,this.env);}catch(error){console.error('Push reminder failed',error instanceof Error?error.message:String(error));}
   await this.state.storage.delete(key);
  }
  await this.scheduleNextAlarm();
 }
 async scheduleNextAlarm(){
  const entries=await this.state.storage.list({prefix:'reminder:'});
  let next=Infinity;
  for(const value of entries.values())next=Math.min(next,Number(value.notifyAt)||Infinity);
  if(Number.isFinite(next))await this.state.storage.setAlarm(Math.max(Date.now()+1000,next));else await this.state.storage.deleteAlarm();
 }
}

async function sendPush(reminder,env){
 webpush.setVapidDetails(env.VAPID_SUBJECT||'mailto:admin@example.com',env.VAPID_PUBLIC_KEY,env.VAPID_PRIVATE_KEY);
 const payload=JSON.stringify({title:reminder.title,body:reminder.body,url:reminder.url,tag:reminder.tag});
 await webpush.sendNotification(reminder.subscription,payload,{TTL:300,urgency:'high'});
}
function clean(value,max){return String(value??'').trim().slice(0,max);}
function corsHeaders(){return {'Access-Control-Allow-Origin':ALLOWED_ORIGIN,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type',Vary:'Origin'};}
function json(body,status=200){return Response.json(body,{status,headers:{...corsHeaders(),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
