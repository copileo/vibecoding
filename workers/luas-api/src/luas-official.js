const LUAS_URL='https://luasforecasts.rpa.ie/xml/get.ashx';
const FRESH_SECONDS=20;
const STALE_SECONDS=300;
const CACHE_PREFIX='https://cache.vibecode.invalid/luas-official-v2/';
const OFFICIAL_STOP_CODES={gln:'gle'};

export async function getOfficialForecast(stopCode,ctx){
 const code=String(stopCode||'').trim().toLowerCase();
 if(!/^[a-z0-9]{2,5}$/.test(code))throw new Error('Invalid Luas stop code.');
 const officialCode=OFFICIAL_STOP_CODES[code]||code;
 const cache=caches.default;
 const cacheKey=new Request(`${CACHE_PREFIX}${officialCode}`);
 const cached=await cache.match(cacheKey);
 if(cached){
  const age=cacheAge(cached);
  if(age<=FRESH_SECONDS)return parseCached(cached,'fresh',age);
 }
 try{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  let response;
  try{response=await fetch(`${LUAS_URL}?action=forecast&stop=${encodeURIComponent(officialCode)}&encrypt=false`,{headers:{Accept:'application/xml,text/xml,*/*'},signal:controller.signal});}
  finally{clearTimeout(timeout);}
  if(!response.ok)throw new Error(`Official Luas API returned HTTP ${response.status}.`);
  const xml=await response.text();
  const data=parseOfficialXml(xml,code,officialCode);
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

function parseOfficialXml(xml,code,officialCode){
 if(!/<stopInfo\b/i.test(xml))throw new Error('Official Luas API returned an unexpected response.');
 const root=xml.match(/<stopInfo\b([^>]*)>/i)?.[1]||'';
 const stopName=attribute(root,'stop')||code.toUpperCase();
 const createdRaw=attribute(root,'created');
 const created=parseDublinLocal(createdRaw);
 const updated=created?created.toISOString():new Date().toISOString();
 const baseTime=created?.getTime()||Date.now();
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
   departures.push({destination,direction,minutes,scheduledAt:new Date(baseTime+minutes*60000).toISOString(),tripId:`official-${officialCode}-${direction}-${destination}-${minutes}`,route:'LUAS'});
  }
 }
 departures.sort((a,b)=>a.minutes-b.minutes);
 return {apiVersion:1,workerVersion:'1.8.1',provider:'luas-official-avls',stop:{code,name:stopName,officialCode},updated,message,departures,diagnostics:{source:'official-luas-pid',matches:departures.length,createdRaw,officialStopCode:officialCode}};
}

function parseDublinLocal(value){
 const raw=String(value||'').trim();
 if(!raw)return null;
 if(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw)){const date=new Date(raw);return Number.isNaN(date.getTime())?null:date;}
 let match=raw.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2}):(\d{2})/);
 if(!match)match=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[T\s](\d{1,2}):(\d{2}):(\d{2})/);
 if(!match)return null;
 const isoFirst=/^\d{4}-/.test(raw);
 const year=Number(isoFirst?match[1]:match[3]),month=Number(match[2]),day=Number(isoFirst?match[3]:match[1]),hour=Number(match[4]),minute=Number(match[5]),second=Number(match[6]);
 const utcGuess=Date.UTC(year,month-1,day,hour,minute,second);
 const parts=new Intl.DateTimeFormat('en-IE',{timeZone:'Europe/Dublin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(new Date(utcGuess));
 const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
 const represented=Date.UTC(Number(values.year),Number(values.month)-1,Number(values.day),Number(values.hour),Number(values.minute),Number(values.second));
 return new Date(utcGuess-(represented-utcGuess));
}
function attribute(source,name){const match=source.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`,'i'));return match?decodeXml(match[1]):'';}
function decodeXml(value){return String(value).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
function normaliseDirection(value){return /^inbound$/i.test(value)?'Inbound':/^outbound$/i.test(value)?'Outbound':value||'Unknown';}
function normaliseDestination(value){return String(value).replace(/Bride'?s Glen/gi,'Brides Glen').trim();}
