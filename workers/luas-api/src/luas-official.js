const LUAS_URL='https://luasforecasts.rpa.ie/xml/get.ashx';
const FRESH_SECONDS=20;
const STALE_SECONDS=300;
const CATALOG_SECONDS=86400;
const CACHE_PREFIX='https://cache.vibecode.invalid/luas-official-v3/';
const CATALOG_KEY=new Request('https://cache.vibecode.invalid/luas-official-stop-catalog-v1');
const KNOWN_CODE_OVERRIDES={gln:'gle',ocu:'oup',ocg:'ogp'};

export const APP_STOPS=[
 ['tpt','The Point'],['sdk','Spencer Dock'],['msq','Mayor Square - NCI'],['gdk',"George's Dock"],['con','Connolly'],['bus','Busáras'],['abb','Abbey Street'],['jer','Jervis'],['fou','Four Courts'],['smi','Smithfield'],['mus','Museum'],['heu','Heuston'],['jam',"James's"],['fat','Fatima'],['ria','Rialto'],['sui','Suir Road'],['gol','Goldenbridge'],['dri','Drimnagh'],['bla','Blackhorse'],['blu','Bluebell'],['kyl','Kylemore'],['red','Red Cow'],['kin','Kingswood'],['bel','Belgard'],['coo','Cookstown'],['hos','Hospital'],['tal','Tallaght'],['fet','Fettercairn'],['che','Cheeverstown'],['cit','Citywest Campus'],['for','Fortunestown'],['sag','Saggart'],
 ['bro','Broombridge'],['cab','Cabra'],['phi','Phibsborough'],['gra','Grangegorman'],['brd','Broadstone - University'],['dom','Dominick'],['par','Parnell'],['ocu',"O'Connell - Upper"],['ocg',"O'Connell - GPO"],['mar','Marlborough'],['wes','Westmoreland'],['tri','Trinity'],['daw','Dawson'],['sti',"St. Stephen's Green"],['har','Harcourt'],['cha','Charlemont'],['ran','Ranelagh'],['bee','Beechwood'],['cow','Cowper'],['mil','Milltown'],['win','Windy Arbour'],['dun','Dundrum'],['bal','Balally'],['kil','Kilmacud'],['sti2','Stillorgan'],['san','Sandyford'],['cen','Central Park'],['gln','Glencairn'],['gal','The Gallops'],['leo','Leopardstown Valley'],['bal2','Ballyogan Wood'],['car','Carrickmines'],['lau','Laughanstown'],['che2','Cherrywood'],['bri','Brides Glen']
];

export async function getOfficialForecast(stopCode,ctx){
 const code=String(stopCode||'').trim().toLowerCase();
 if(!APP_STOPS.some(([candidate])=>candidate===code))throw new Error('Invalid Luas stop code.');
 const catalog=await getOfficialStopCatalog(ctx);
 const officialCode=resolveOfficialCode(code,catalog);
 const cache=caches.default;
 const cacheKey=new Request(`${CACHE_PREFIX}${officialCode}`);
 const cached=await cache.match(cacheKey);
 if(cached){const age=cacheAge(cached);if(age<=FRESH_SECONDS)return parseCached(cached,'fresh',age);}
 try{
  const xml=await fetchXml(`${LUAS_URL}?action=forecast&stop=${encodeURIComponent(officialCode)}&encrypt=false`);
  const data=parseOfficialXml(xml,code,officialCode);
  const stored=new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json','Cache-Control':`public,max-age=${STALE_SECONDS}`,'X-Fetched-At':String(Math.floor(Date.now()/1000))}});
  ctx?.waitUntil(cache.put(cacheKey,stored));
  return {...data,cache:{status:'refreshed',ageSeconds:0}};
 }catch(error){
  if(cached){const age=cacheAge(cached);if(age<=STALE_SECONDS){const data=await cached.clone().json();return {...data,cache:{status:'stale',ageSeconds:age,fallbackReason:error instanceof Error?error.message:String(error)}};}}
  throw error;
 }
}

export async function auditOfficialStops(ctx){
 const catalog=await getOfficialStopCatalog(ctx,true);
 const rows=APP_STOPS.map(([appCode,name])=>{const officialCode=resolveOfficialCode(appCode,catalog);const official=catalog.find(stop=>stop.code===officialCode);return {name,appCode,officialCode,status:official?'matched':'missing',codeDiffers:appCode!==officialCode,officialName:official?.name||null};});
 return {generatedAt:new Date().toISOString(),appStopCount:APP_STOPS.length,officialStopCount:catalog.length,matched:rows.filter(row=>row.status==='matched').length,missing:rows.filter(row=>row.status==='missing'),differences:rows.filter(row=>row.codeDiffers),stops:rows};
}

async function getOfficialStopCatalog(ctx,force=false){
 const cache=caches.default;
 if(!force){const cached=await cache.match(CATALOG_KEY);if(cached&&cacheAge(cached)<=CATALOG_SECONDS)return cached.json();}
 const xml=await fetchXml(`${LUAS_URL}?action=stops&encrypt=false`);
 const catalog=parseStopCatalog(xml);
 if(!catalog.length)throw new Error('Official Luas stop catalogue was empty.');
 const stored=new Response(JSON.stringify(catalog),{headers:{'Content-Type':'application/json','Cache-Control':`public,max-age=${CATALOG_SECONDS}`,'X-Fetched-At':String(Math.floor(Date.now()/1000))}});
 ctx?.waitUntil(cache.put(CATALOG_KEY,stored));
 return catalog;
}

function parseStopCatalog(xml){
 const stops=[];const pattern=/<stop\b([^>]*?)\/?\s*>/gi;let match;
 while((match=pattern.exec(xml))){const attrs=match[1];const code=(attribute(attrs,'abrev')||attribute(attrs,'abbr')||attribute(attrs,'code')).toLowerCase();const name=attribute(attrs,'pronunciation')||attribute(attrs,'name')||attribute(attrs,'stop');if(code&&name)stops.push({code,name,line:attribute(attrs,'line')||null});}
 return [...new Map(stops.map(stop=>[stop.code,stop])).values()];
}

function resolveOfficialCode(appCode,catalog){
 const override=KNOWN_CODE_OVERRIDES[appCode];if(override&&catalog.some(stop=>stop.code===override))return override;
 if(catalog.some(stop=>stop.code===appCode))return appCode;
 const appName=APP_STOPS.find(([code])=>code===appCode)?.[1]||'';const wanted=normaliseName(appName);
 const exact=catalog.find(stop=>normaliseName(stop.name)===wanted);if(exact)return exact.code;
 const compatible=catalog.find(stop=>normaliseName(stop.name).includes(wanted)||wanted.includes(normaliseName(stop.name)));if(compatible)return compatible.code;
 return override||appCode;
}

async function fetchXml(url){const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),8000);try{const response=await fetch(url,{headers:{Accept:'application/xml,text/xml,*/*'},signal:controller.signal});if(!response.ok)throw new Error(`Official Luas API returned HTTP ${response.status}.`);return await response.text();}catch(error){if(error?.name==='AbortError')throw new Error('Official Luas API request timed out.');throw error;}finally{clearTimeout(timeout);}}
function cacheAge(response){const fetchedAt=Number(response.headers.get('X-Fetched-At')||0);return fetchedAt?Math.max(0,Math.floor(Date.now()/1000-fetchedAt)):Infinity;}
async function parseCached(response,status,ageSeconds){const data=await response.clone().json();return {...data,cache:{status,ageSeconds}};}
function parseOfficialXml(xml,code,officialCode){
 if(!/<stopInfo\b/i.test(xml))throw new Error(`Official Luas API rejected stop code ${officialCode}.`);
 const root=xml.match(/<stopInfo\b([^>]*)>/i)?.[1]||'';const stopName=attribute(root,'stop')||code.toUpperCase();const createdRaw=attribute(root,'created');const created=parseDublinLocal(createdRaw);const updated=created?created.toISOString():new Date().toISOString();const baseTime=created?.getTime()||Date.now();
 const message=decodeXml(xml.match(/<message>([\s\S]*?)<\/message>/i)?.[1]||'Official Luas realtime forecast').trim();const departures=[];
 const directionPattern=/<direction\b([^>]*)>([\s\S]*?)<\/direction>/gi;let directionMatch;
 while((directionMatch=directionPattern.exec(xml))){const direction=normaliseDirection(attribute(directionMatch[1],'name'));const tramPattern=/<tram\b([^>]*?)(?:\/?>)/gi;let tramMatch;while((tramMatch=tramPattern.exec(directionMatch[2]))){const dueRaw=attribute(tramMatch[1],'dueMins');const destination=normaliseDestination(attribute(tramMatch[1],'destination')||'Luas');const minutes=/^due$/i.test(dueRaw)?0:Number(dueRaw);if(!Number.isFinite(minutes)||minutes<0||minutes>180)continue;departures.push({destination,direction,minutes,scheduledAt:new Date(baseTime+minutes*60000).toISOString(),tripId:`official-${officialCode}-${direction}-${destination}-${minutes}`,route:'LUAS'});}}
 departures.sort((a,b)=>a.minutes-b.minutes);
 return {apiVersion:1,workerVersion:'1.8.3',provider:'luas-official-avls',stop:{code,name:stopName,officialCode},updated,message,departures,diagnostics:{source:'official-luas-pid',matches:departures.length,createdRaw,officialStopCode:officialCode}};
}
function parseDublinLocal(value){const raw=String(value||'').trim();if(!raw)return null;if(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw)){const date=new Date(raw);return Number.isNaN(date.getTime())?null:date;}let match=raw.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2}):(\d{2})/);if(!match)match=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[T\s](\d{1,2}):(\d{2}):(\d{2})/);if(!match)return null;const isoFirst=/^\d{4}-/.test(raw);const year=Number(isoFirst?match[1]:match[3]),month=Number(match[2]),day=Number(isoFirst?match[3]:match[1]),hour=Number(match[4]),minute=Number(match[5]),second=Number(match[6]);const utcGuess=Date.UTC(year,month-1,day,hour,minute,second);const parts=new Intl.DateTimeFormat('en-IE',{timeZone:'Europe/Dublin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(new Date(utcGuess));const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));const represented=Date.UTC(Number(values.year),Number(values.month)-1,Number(values.day),Number(values.hour),Number(values.minute),Number(values.second));return new Date(utcGuess-(represented-utcGuess));}
function attribute(source,name){const match=String(source).match(new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`,'i'));return match?decodeXml(match[2]):'';}
function decodeXml(value){return String(value).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
function normaliseName(value){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(st|saint)\.?\b/g,'saint').replace(/[^a-z0-9]/g,'');}
function normaliseDirection(value){return /^inbound$/i.test(value)?'Inbound':/^outbound$/i.test(value)?'Outbound':value||'Unknown';}
function normaliseDestination(value){return String(value).replace(/Bride'?s Glen/gi,'Brides Glen').trim();}
