const LUAS_URL='https://luasforecasts.rpa.ie/xml/get.ashx';
const FRESH_SECONDS=20;
const STALE_SECONDS=300;
const CACHE_PREFIX='https://cache.vibecode.invalid/luas-official-v1/';

export async function getOfficialForecast(stopCode,ctx){
 const code=String(stopCode||'').trim().toLowerCase();
 if(!/^[a-z0-9]{2,5}$/.test(code))throw new Error('Invalid Luas stop code.');
 const cache=caches.default;
 const cacheKey=new Request(`${CACHE_PREFIX}${code}`);
 const cached=await cache.match(cacheKey);
 if(cached){
  const age=cacheAge(cached);
  if(age<=FRESH_SECONDS)return parseCached(cached,'fresh',age);
 }
 try{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  let response;
  try{response=await fetch(`${LUAS_URL}?action=forecast&stop=${encodeURIComponent(code)}&encrypt=false`,{headers:{Accept:'application/xml,text/xml,*/*'},signal:controller.signal});}
  finally{clearTimeout(timeout);}
  if(!response.ok)throw new Error(`Official Luas API returned HTTP ${response.status}.`);
  const xml=await response.text();
  const data=parseOfficialXml(xml,code);
  const stored=new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json','Cache-Control':`public,max-age=${STALE_SECONDS}`,'X-Fetched-At':String(Math.floor(Date.now()/1000))}});
  ctx?.waitUntil(cache.put(cacheKey,stored));
  return {...data,cache:{status:'refreshed',ageSeconds:0}};
 }catch(error){
  if(cached){
   const age=cacheAge(cached);
   if(age<=STALE_SECONDS){const data=await cached.clone().json();return {...data,cache:{status:'stale',ageSeconds:age,fallbackReason:error instanceof Error?error.message:String(error)}};}
  }
  throw error;
 }
}

function cacheAge(response){const fetchedAt=Number(response.headers.get('X-Fetched-At')||0);return fetchedAt?Math.max(0,Math.floor(Date.now()/1000-fetchedAt)):Infinity;}
async function parseCached(response,status,ageSeconds){const data=await response.clone().json();return {...data,cache:{status,ageSeconds}};}

function parseOfficialXml(xml,code){
 if(!/<stopInfo\b/i.test(xml))throw new Error('Official Luas API returned an unexpected response.');
 const root=xml.match(/<stopInfo\b([^>]*)>/i)?.[1]||'';
 const stopName=attribute(root,'stop')||code.toUpperCase();
 const createdRaw=attribute(root,'created');
 const created=new Date(createdRaw);
 const updated=Number.isNaN(created.getTime())?new Date().toISOString():created.toISOString();
 const message=decodeXml(xml.match(/<message>([\s\S]*?)<\/message>/i)?.[1]||'Official Luas realtime forecast').trim();
 const departures=[];
 const directionPattern=/<direction\b([^>]*)>([\s\S]*?)<\/direction>/gi;
 let directionMatch;
 while((directionMatch=directionPattern.exec(xml))){
  const direction=normaliseDirection(attribute(directionMatch[1],'name'));
  const tramPattern=/<tram\b([^>]*?)(?:\/?>)/gi;
  let tramMatch;
  while((tramMatch=tramPattern.exec(directionMatch[2]))){
   const dueRaw=attribute(tramMatch[1],'dueMins');
   const destination=normaliseDestination(attribute(tramMatch[1],'destination')||'Luas');
   const minutes=/^due$/i.test(dueRaw)?0:Number(dueRaw);
   if(!Number.isFinite(minutes)||minutes<0||minutes>180)continue;
   departures.push({destination,direction,minutes,scheduledAt:new Date(Date.now()+minutes*60000).toISOString(),tripId:`official-${code}-${direction}-${destination}-${minutes}`,route:'LUAS'});
  }
 }
 departures.sort((a,b)=>a.minutes-b.minutes);
 return {apiVersion:1,workerVersion:'1.8.0',provider:'luas-official-avls',stop:{code,name:stopName},updated,message,departures,diagnostics:{source:'official-luas-pid',matches:departures.length}};
}

function attribute(source,name){const match=source.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`,'i'));return match?decodeXml(match[1]):'';}
function decodeXml(value){return String(value).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
function normaliseDirection(value){return /^inbound$/i.test(value)?'Inbound':/^outbound$/i.test(value)?'Outbound':value||'Unknown';}
function normaliseDestination(value){return String(value).replace(/Bride'?s Glen/gi,'Brides Glen').trim();}
