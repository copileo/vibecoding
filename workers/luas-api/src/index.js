import {LUAS_HEADSIGNS,LUAS_ROUTES,LUAS_SCHEDULE_ROWS} from './luas-schedule.js';

const ALLOWED_ORIGIN='https://copileo.github.io';
const NTA_URL='https://api.nationaltransport.ie/gtfsr/v2/TripUpdates?format=json';
const FRESH_SECONDS=60;
const STALE_SECONDS=900;
const UPSTREAM_TIMEOUT_MS=10000;
const WORKER_VERSION='1.7.6';
const FEED_CACHE_KEY=new Request('https://cache.vibecode.invalid/nta-trip-updates-v2');
let feedRefreshPromise=null;

const STOPS={
 tpt:['The Point','8220GA00437','8220GA00436'],sdk:['Spencer Dock','8220GA00433','8220GA00434'],msq:['Mayor Square - NCI','8220GA00431','8220GA00430'],gdk:["George's Dock",'8220GA00427','8220GA00428'],con:['Connolly','8220GA00424','8220GA00423'],bus:['Busáras','8220GA00421','8220GA00420'],abb:['Abbey Street','8220GA00409','8220GA00408'],jer:['Jervis','8220GA00404','8220GA00405'],fou:['Four Courts','8220GA00401','8220GA00402'],smi:['Smithfield','8220GA00398','8220GA00399'],mus:['Museum','8220GA00389','8220GA00390'],heu:['Heuston','8220GA00386','8220GA00387'],jam:["James's",'8220GA00381','8220GA00382'],fat:['Fatima','8220GA00379','8220GA00378'],ria:['Rialto','8220GA00376','8220GA00375'],sui:['Suir Road','8220GA00372','8220GA00373'],gol:['Goldenbridge','8220GA00369','8220GA00370'],dri:['Drimnagh','8220GA00367','8220GA00366'],bla:['Blackhorse','8220GA00364','8220GA00363'],blu:['Bluebell','8220GA00361','8220GA00360'],kyl:['Kylemore','8220GA00356','8220GA00357'],red:['Red Cow','8230GA00354','8230GA00353'],kin:['Kingswood','8230GA00350','8230GA00351'],bel:['Belgard','8230GA00347','8230GA00348'],coo:['Cookstown','8230GA00338','8230GA00339'],hos:['Hospital','8230GA00341','8230GA00342'],tal:['Tallaght','8230GA00344','8230GA00345'],fet:['Fettercairn','8230GA00392','8230GA00393'],che:['Cheeverstown','8230GA00396','8230GA00395'],cit:['Citywest Campus','8230GA00413','8230GA00412'],for:['Fortunestown','8230GA00416','8230GA00415'],sag:['Saggart','8230GA00418','8230GA00419'],bro:['Broombridge','8220GA00459','8220GA00460'],cab:['Cabra','8220GA00480','8220GA00469'],phi:['Phibsborough','8220GA00455','8220GA00456'],gra:['Grangegorman','8220GA00479','8220GA00452'],brd:['Broadstone - University','8220GA00468','8220GA00481'],dom:['Dominick','8220GA00467','8220GA00478'],par:['Parnell','8220GA00471'],ocu:["O'Connell - Upper",'8220GA00470'],ocg:["O'Connell - GPO",'8220GA00444'],mar:['Marlborough','8220GA00034'],wes:['Westmoreland','8220GA00443'],tri:['Trinity','8220GA00035'],daw:['Dawson','8220GA00031','8220GA00441'],sti:["St. Stephen's Green",'8220GA00058','8220GA00059'],har:['Harcourt','8220GA00440','8220GA00062'],cha:['Charlemont','8220GA00071','8220GA00070'],ran:['Ranelagh','8220GA00074','8220GA00075'],bee:['Beechwood','8220GA00083','8220GA00084'],cow:['Cowper','8220GA00275','8220GA00276'],mil:['Milltown','8220GA00279','8220GA00278'],win:['Windy Arbour','8250GA00281','8250GA00282'],dun:['Dundrum','8250GA00286','8250GA00287'],bal:['Balally','8250GA00291','8250GA00292'],kil:['Kilmacud','8250GA00296','8250GA00295'],sti2:['Stillorgan','8250GA00297','8250GA00298'],san:['Sandyford','8250GA00293','8250GA00294'],cen:['Central Park','8250GA00310','8250GA00311'],gln:['Glencairn','8250GA00313','8250GA00314'],gal:['The Gallops','8250GA00316','8250GA00317'],leo:['Leopardstown Valley','8250GA00319','8250GA00320'],bal2:['Ballyogan Wood','8250GA00323','8250GA00322'],car:['Carrickmines','8250GA00326','8250GA00325'],lau:['Laughanstown','8250GA00329','8250GA00330'],che2:['Cherrywood','8250GA00333','8250GA00332'],bri:['Brides Glen','8250GA00335','8250GA00336']
};
const STOP_CODES={tpt:['998070'],sdk:['998069'],msq:['998068'],gdk:['998067','998167'],con:['998023','998123'],bus:['998022','998122'],abb:['998021'],jer:['998020'],fou:['998019'],smi:['998018'],mus:['998017'],heu:['998016','998116'],jam:['998015'],fat:['998014'],ria:['998013'],sui:['998012','998112'],gol:['998011'],dri:['998010'],bla:['998009'],blu:['998008'],kyl:['998007'],red:['998006','998106'],kin:['998005'],bel:['998004'],coo:['998003'],hos:['998002'],tal:['998001'],fet:['998073'],che:['998074'],cit:['998075'],for:['998076'],sag:['998077'],bro:['998090'],cab:['998089'],phi:['998088'],gra:['998087'],brd:['998086'],dom:['998085'],par:['998084'],ocu:['998081'],ocg:['998080'],mar:['998083'],wes:['998079'],tri:['998082'],daw:['998078'],sti:['998024'],har:['998025'],cha:['998026','998126'],ran:['998027'],bee:['998028'],cow:['998029'],mil:['998030'],win:['998031'],dun:['998032','998132'],bal:['998033'],kil:['998034'],sti2:['998035'],san:['998036','998136'],cen:['998053'],gln:['998054'],gal:['998055'],leo:['998056'],bal2:['998057'],car:['998059'],lau:['998061'],che2:['998062'],bri:['998063']};
const STOP_NAME_BY_ID=Object.fromEntries(Object.entries(STOPS).flatMap(([code,[name,...ids]])=>[...ids,...(STOP_CODES[code]||[])].map(id=>[normaliseStopId(id),name])));
const SCHEDULE_INDEX=new Map(LUAS_SCHEDULE_ROWS.map(([routeIndex,direction,stopId,sequence,offset,headsignIndex])=>[scheduleKey(LUAS_ROUTES[routeIndex],direction,stopId,sequence),{offset,destination:LUAS_HEADSIGNS[headsignIndex]}]));

const GREEN_SOUTH_EXTENSION=new Set(['8250GA00310','8250GA00311','8250GA00313','8250GA00314','8250GA00316','8250GA00317','8250GA00319','8250GA00320','8250GA00322','8250GA00323','8250GA00325','8250GA00326','8250GA00329','8250GA00330','8250GA00332','8250GA00333','8250GA00335','8250GA00336']);
const GREEN_NORTH_EXTENSION=new Set(['8220GA00452','8220GA00455','8220GA00456','8220GA00459','8220GA00460','8220GA00468','8220GA00469','8220GA00478','8220GA00479','8220GA00480','8220GA00481']);
const RED_SAGGART_BRANCH=new Set(['8230GA00392','8230GA00393','8230GA00395','8230GA00396','8230GA00412','8230GA00413','8230GA00415','8230GA00416','8230GA00418','8230GA00419']);
const RED_TALLAGHT_BRANCH=new Set(['8230GA00338','8230GA00339','8230GA00341','8230GA00342','8230GA00344','8230GA00345']);
const RED_POINT_EXTENSION=new Set(['8220GA00427','8220GA00428','8220GA00430','8220GA00431','8220GA00433','8220GA00434','8220GA00436','8220GA00437']);

export default {async fetch(request,env,ctx){
 const url=new URL(request.url);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders()});
 if(request.method!=='GET')return json({error:'Method not allowed.',workerVersion:WORKER_VERSION},405);
 if(url.pathname==='/health')return json({ok:true,service:'vibecode-luas-api',provider:'nta-gtfs-realtime',apiVersion:1,workerVersion:WORKER_VERSION,upstream:NTA_URL,scheduleRows:LUAS_SCHEDULE_ROWS.length,cache:{freshSeconds:FRESH_SECONDS,staleSeconds:STALE_SECONDS}});
 if(!env.NTA_SUBSCRIPTION_KEY)return json({error:'NTA API key is not configured.',workerVersion:WORKER_VERSION},500);
 try{
  const feed=await getFeed(env.NTA_SUBSCRIPTION_KEY,ctx);
  if(url.pathname==='/debug/feed')return json(buildFeedDiagnostics(feed),200,{'Cache-Control':'no-store'});
  if(url.pathname!=='/forecast'&&url.pathname!=='/v1/forecast')return json({error:'Not found.',workerVersion:WORKER_VERSION},404);
  const code=(url.searchParams.get('stop')||'').toLowerCase();
  const stop=STOPS[code];
  if(!stop)return json({error:'A valid Luas stop code is required.',workerVersion:WORKER_VERSION},400);
  return json(buildForecast(code,stop,feed),200,{'Cache-Control':`public,max-age=5,s-maxage=${FRESH_SECONDS}`,'X-Luas-Provider':'nta-gtfs-realtime','X-Worker-Version':WORKER_VERSION,'X-Feed-Cache':feed.cache.status});
 }catch(error){return json({error:'The NTA realtime feed could not be processed.',detail:error instanceof Error?error.message:String(error),workerVersion:WORKER_VERSION},502);}
}};

async function getFeed(key,ctx){
 const cache=caches.default;
 const cached=await readCachedFeed(cache);
 if(cached&&cached.ageSeconds<=FRESH_SECONDS)return withCacheMetadata(cached.data,'fresh',cached.ageSeconds);
 try{
  const refreshed=await refreshFeedOnce(key,cache,ctx);
  return withCacheMetadata(refreshed.data,'refreshed',0);
 }catch(error){
  if(cached&&cached.ageSeconds<=STALE_SECONDS)return withCacheMetadata(cached.data,'stale',cached.ageSeconds,error);
  throw error;
 }
}

async function readCachedFeed(cache){
 const response=await cache.match(FEED_CACHE_KEY);
 if(!response)return null;
 const fetchedAt=Number(response.headers.get('X-Fetched-At')||0);
 if(!fetchedAt)return null;
 const data=await response.json();
 validateFeed(data);
 return {data,ageSeconds:Math.max(0,Math.floor(Date.now()/1000-fetchedAt))};
}

async function refreshFeedOnce(key,cache,ctx){
 if(feedRefreshPromise)return feedRefreshPromise;
 feedRefreshPromise=(async()=>{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),UPSTREAM_TIMEOUT_MS);
  try{
   const response=await fetch(NTA_URL,{headers:{Accept:'application/json','Cache-Control':'no-cache','x-api-key':key},signal:controller.signal});
   if(!response.ok){const retryAfter=response.headers.get('Retry-After');throw new Error(`NTA returned HTTP ${response.status}${retryAfter?` (retry after ${retryAfter})`:''}.`);}
   const data=await response.json();
   validateFeed(data);
   const stored=new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json','Cache-Control':`public,max-age=${STALE_SECONDS}`,'X-Fetched-At':String(Math.floor(Date.now()/1000))}});
   ctx.waitUntil(cache.put(FEED_CACHE_KEY,stored));
   return {data};
  }catch(error){
   if(error?.name==='AbortError')throw new Error(`NTA request timed out after ${UPSTREAM_TIMEOUT_MS}ms.`);
   throw error;
  }finally{clearTimeout(timeout);}
 })();
 try{return await feedRefreshPromise}finally{feedRefreshPromise=null;}
}

function validateFeed(data){
 const entities=data?.entity||data?.Entity;
 if(!Array.isArray(entities))throw new Error('NTA returned an unexpected JSON structure.');
 if(!data.entity)data={...data,entity:entities};
 return data;
}

function withCacheMetadata(data,status,ageSeconds,error){
 const entities=data?.entity||data?.Entity;
 return {...data,entity:entities,cache:{status,ageSeconds,freshSeconds:FRESH_SECONDS,staleSeconds:STALE_SECONDS,...(error?{fallbackReason:error instanceof Error?error.message:String(error)}:{})}};
}

function buildForecast(code,[name,...stopIds],feed){
 const expectedIds=[...stopIds,...(STOP_CODES[code]||[])];
 const now=Math.floor(Date.now()/1000);const departures=[];let tripUpdates=0;let stopUpdates=0;let matchedStops=0;let reconstructed=0;
 for(const entity of feed.entity){
  const update=entity.tripUpdate||entity.trip_update||entity.TripUpdate;if(!update)continue;tripUpdates++;
  const trip=update.trip||update.Trip||{};
  const routeId=String(trip.routeId||trip.route_id||trip.RouteId||'');
  if(!LUAS_ROUTES.includes(routeId))continue;
  const directionId=Number(trip.directionId??trip.direction_id??trip.DirectionId);
  const items=update.stopTimeUpdate||update.stop_time_update||update.StopTimeUpdate||[];
  for(const item of items){
   stopUpdates++;
   const rawStopId=String(item.stopId??item.stop_id??item.StopId??'');
   if(!matchesAnyStop(rawStopId,expectedIds))continue;matchedStops++;
   const sequence=Number(item.stopSequence??item.stop_sequence??item.StopSequence);
   const schedule=SCHEDULE_INDEX.get(scheduleKey(routeId,directionId,rawStopId,sequence));
   const event=item.departure||item.Departure||item.arrival||item.Arrival||{};
   let timestamp=toSeconds(event.time??event.Time);
   if(!timestamp&&schedule){
    const startDate=String(trip.startDate||trip.start_date||trip.StartDate||'');
    const startTime=String(trip.startTime||trip.start_time||trip.StartTime||'');
    const startEpoch=dublinLocalEpoch(startDate,startTime);
    const delay=toDelaySeconds(event.delay??event.Delay);
    if(startEpoch){timestamp=startEpoch+schedule.offset+delay;reconstructed++;}
   }
   if(!timestamp||timestamp<now-60||timestamp>now+10800)continue;
   const destination=resolveDestination(routeId,directionId,items,schedule?.destination||trip.tripHeadsign||trip.trip_headsign||trip.TripHeadsign||'Luas');
   departures.push({destination,direction:directionId===1?'Inbound':'Outbound',minutes:Math.max(0,Math.ceil((timestamp-now)/60)),scheduledAt:new Date(timestamp*1000).toISOString(),tripId:String(trip.tripId||trip.trip_id||trip.TripId||''),route:routeId});
  }
 }
 departures.sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt));
 return {apiVersion:1,workerVersion:WORKER_VERSION,provider:'nta-gtfs-realtime',stop:{code,name,ids:stopIds,codes:STOP_CODES[code]||[]},updated:new Date().toISOString(),message:feed.cache.status==='stale'?'Official NTA forecast (temporarily using cached data)':'Official NTA GTFS-Realtime forecast',cache:feed.cache,departures:dedupe(departures).slice(0,12),diagnostics:{entities:feed.entity.length,tripUpdates,stopUpdates,matchedStops,reconstructed,matches:departures.length}};
}

function resolveDestination(routeId,directionId,items,fallback){
 const ids=new Set(items.map(item=>normaliseStopId(item.stopId??item.stop_id??item.StopId??'')));
 const hasAny=set=>[...set].some(id=>ids.has(id));
 if(routeId.includes('GREEN')){
  if(directionId===0&&hasAny(GREEN_SOUTH_EXTENSION))return 'Brides Glen';
  if(directionId===1&&hasAny(GREEN_NORTH_EXTENSION))return 'Broombridge';
  return fallback;
 }
 if(routeId.includes('RED')){
  if(directionId===0){if(hasAny(RED_SAGGART_BRANCH))return 'Saggart';if(hasAny(RED_TALLAGHT_BRANCH))return 'Tallaght';}
  if(directionId===1&&hasAny(RED_POINT_EXTENSION))return 'The Point';
 }
 return fallback;
}

function buildFeedDiagnostics(feed){
 const first=feed.entity[0]||{};const update=first.tripUpdate||first.trip_update||first.TripUpdate||{};const trip=update.trip||update.Trip||{};const stopUpdates=update.stopTimeUpdate||update.stop_time_update||update.StopTimeUpdate||[];
 const routeCounts={};const tripSamples=[];const luasCandidates=[];
 for(const entity of feed.entity){
  const tu=entity.tripUpdate||entity.trip_update||entity.TripUpdate;if(!tu)continue;
  const descriptor=tu.trip||tu.Trip||{};const route=String(descriptor.routeId||descriptor.route_id||descriptor.RouteId||'(missing)');const tripId=String(descriptor.tripId||descriptor.trip_id||descriptor.TripId||'');routeCounts[route]=(routeCounts[route]||0)+1;
  if(tripSamples.length<12)tripSamples.push({routeId:route,tripId,directionId:descriptor.directionId??descriptor.direction_id??descriptor.DirectionId??null,startTime:descriptor.startTime??descriptor.start_time??descriptor.StartTime??null,startDate:descriptor.startDate??descriptor.start_date??descriptor.StartDate??null,stopIds:(tu.stopTimeUpdate||tu.stop_time_update||tu.StopTimeUpdate||[]).slice(0,4).map(item=>String(item.stopId??item.stop_id??item.StopId??''))});
  if(luasCandidates.length<20&&LUAS_ROUTES.includes(route))luasCandidates.push({routeId:route,tripId,trip:sanitise(descriptor,3),updates:sanitise((tu.stopTimeUpdate||tu.stop_time_update||tu.StopTimeUpdate||[]).slice(0,3),4)});
 }
 return {workerVersion:WORKER_VERSION,upstream:NTA_URL,generatedAt:new Date().toISOString(),cache:feed.cache,topLevelKeys:Object.keys(feed).filter(key=>key!=='cache'),entityCount:feed.entity.length,firstEntityKeys:Object.keys(first),firstEntity:sanitise(first,4),firstTripUpdateKeys:Object.keys(update),firstTripDescriptor:sanitise(trip,3),firstStopUpdate:sanitise(stopUpdates[0]||null,3),scheduleRows:LUAS_SCHEDULE_ROWS.length,topRoutes:topEntries(routeCounts,30),tripSamples,luasCandidates};
}

function scheduleKey(route,direction,stopId,sequence){return `${route}|${Number(direction)}|${normaliseStopId(stopId)}|${Number(sequence)}`;}
function dublinLocalEpoch(dateValue,timeValue){
 if(!/^\d{8}$/.test(dateValue)||!/^\d{1,2}:\d{2}:\d{2}$/.test(timeValue))return 0;
 const year=Number(dateValue.slice(0,4)),month=Number(dateValue.slice(4,6)),day=Number(dateValue.slice(6,8));const [hour,minute,second]=timeValue.split(':').map(Number);
 const utcGuess=Date.UTC(year,month-1,day,hour,minute,second);
 const parts=new Intl.DateTimeFormat('en-IE',{timeZone:'Europe/Dublin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(new Date(utcGuess));
 const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
 const represented=Date.UTC(Number(values.year),Number(values.month)-1,Number(values.day),Number(values.hour),Number(values.minute),Number(values.second));
 return Math.floor((utcGuess-(represented-utcGuess))/1000);
}
function sanitise(value,depth){if(depth<0)return '[depth-limit]';if(value===null||value===undefined||typeof value==='string'||typeof value==='number'||typeof value==='boolean')return value;if(Array.isArray(value))return value.slice(0,8).map(item=>sanitise(item,depth-1));if(typeof value==='object')return Object.fromEntries(Object.entries(value).slice(0,30).map(([key,item])=>[key,sanitise(item,depth-1)]));return String(value);}
function topEntries(counts,limit){return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([id,count])=>({id,count}));}
function normaliseStopId(value){return String(value??'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');}
function numericStopPart(value){const normalised=normaliseStopId(value);const ga=normalised.match(/GA0*(\d+)$/);if(ga)return String(Number(ga[1]));const digits=normalised.match(/0*(\d+)$/);return digits?String(Number(digits[1])):'';}
function matchesAnyStop(candidate,expectedIds){const normalised=normaliseStopId(candidate);const numeric=numericStopPart(candidate);return expectedIds.some(expected=>{const wanted=normaliseStopId(expected);return normalised===wanted||normalised.endsWith(wanted)||wanted.endsWith(normalised)||(numeric&&numeric===numericStopPart(wanted));});}
function toSeconds(value){if(value===undefined||value===null)return 0;const raw=typeof value==='object'?(value.low??value.value??value.seconds??value.toString?.()):value;let n=Number(raw);if(!Number.isFinite(n))return 0;if(n>1e12)n=Math.floor(n/1000);return n;}
function toDelaySeconds(value){const raw=typeof value==='object'?(value.low??value.value??value.seconds??value.toString?.()):value;const n=Number(raw);return Number.isFinite(n)?n:0;}
function dedupe(items){const seen=new Set();return items.filter(item=>{const key=`${item.tripId}|${item.scheduledAt}|${item.destination}`;if(seen.has(key))return false;seen.add(key);return true;});}
function corsHeaders(){return {'Access-Control-Allow-Origin':ALLOWED_ORIGIN,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type',Vary:'Origin'};}
function json(body,status=200,extra={}){return Response.json(body,{status,headers:{...corsHeaders(),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Worker-Version':WORKER_VERSION,...extra}});}
