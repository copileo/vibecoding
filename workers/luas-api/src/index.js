const ALLOWED_ORIGIN='https://copileo.github.io';
const NTA_URL='https://api.nationaltransport.ie/gtfsr/v2/gtfsr?format=json';
const CACHE_SECONDS=20;

const STOPS={
 tpt:['The Point','8220GA00437','8220GA00436'],sdk:['Spencer Dock','8220GA00433','8220GA00434'],msq:['Mayor Square - NCI','8220GA00431','8220GA00430'],gdk:["George's Dock",'8220GA00427','8220GA00428'],con:['Connolly','8220GA00424','8220GA00423'],bus:['Busáras','8220GA00421','8220GA00420'],abb:['Abbey Street','8220GA00409','8220GA00408'],jer:['Jervis','8220GA00404','8220GA00405'],fou:['Four Courts','8220GA00401','8220GA00402'],smi:['Smithfield','8220GA00398','8220GA00399'],mus:['Museum','8220GA00389','8220GA00390'],heu:['Heuston','8220GA00386','8220GA00387'],jam:["James's",'8220GA00381','8220GA00382'],fat:['Fatima','8220GA00379','8220GA00378'],ria:['Rialto','8220GA00376','8220GA00375'],sui:['Suir Road','8220GA00372','8220GA00373'],gol:['Goldenbridge','8220GA00369','8220GA00370'],dri:['Drimnagh','8220GA00367','8220GA00366'],bla:['Blackhorse','8220GA00364','8220GA00363'],blu:['Bluebell','8220GA00361','8220GA00360'],kyl:['Kylemore','8220GA00356','8220GA00357'],red:['Red Cow','8230GA00354','8230GA00353'],kin:['Kingswood','8230GA00350','8230GA00351'],bel:['Belgard','8230GA00347','8230GA00348'],coo:['Cookstown','8230GA00338','8230GA00339'],hos:['Hospital','8230GA00341','8230GA00342'],tal:['Tallaght','8230GA00344','8230GA00345'],fet:['Fettercairn','8230GA00392','8230GA00393'],che:['Cheeverstown','8230GA00396','8230GA00395'],cit:['Citywest Campus','8230GA00413','8230GA00412'],for:['Fortunestown','8230GA00416','8230GA00415'],sag:['Saggart','8230GA00418','8230GA00419'],bro:['Broombridge','8220GA00459','8220GA00460'],cab:['Cabra','8220GA00480','8220GA00469'],phi:['Phibsborough','8220GA00455','8220GA00456'],gra:['Grangegorman','8220GA00479','8220GA00452'],brd:['Broadstone - University','8220GA00468','8220GA00481'],dom:['Dominick','8220GA00467','8220GA00478'],par:['Parnell','8220GA00471'],ocu:["O'Connell - Upper",'8220GA00470'],ocg:["O'Connell - GPO",'8220GA00444'],mar:['Marlborough','8220GA00034'],wes:['Westmoreland','8220GA00443'],tri:['Trinity','8220GA00035'],daw:['Dawson','8220GA00031','8220GA00441'],sti:["St. Stephen's Green",'8220GA00058','8220GA00059'],har:['Harcourt','8220GA00440','8220GA00062'],cha:['Charlemont','8220GA00071','8220GA00070'],ran:['Ranelagh','8220GA00074','8220GA00075'],bee:['Beechwood','8220GA00083','8220GA00084'],cow:['Cowper','8220GA00275','8220GA00276'],mil:['Milltown','8220GA00279','8220GA00278'],win:['Windy Arbour','8250GA00281','8250GA00282'],dun:['Dundrum','8250GA00286','8250GA00287'],bal:['Balally','8250GA00291','8250GA00292'],kil:['Kilmacud','8250GA00296','8250GA00295'],sti2:['Stillorgan','8250GA00297','8250GA00298'],san:['Sandyford','8250GA00293','8250GA00294'],cen:['Central Park','8250GA00310','8250GA00311'],gln:['Glencairn','8250GA00313','8250GA00314'],gal:['The Gallops','8250GA00316','8250GA00317'],leo:['Leopardstown Valley','8250GA00319','8250GA00320'],bal2:['Ballyogan Wood','8250GA00323','8250GA00322'],car:['Carrickmines','8250GA00326','8250GA00325'],lau:['Laughanstown','8250GA00329','8250GA00330'],che2:['Cherrywood','8250GA00333','8250GA00332'],bri:['Brides Glen','8250GA00335','8250GA00336']
};
const STOP_NAME_BY_ID=Object.fromEntries(Object.values(STOPS).flatMap(([name,...ids])=>ids.map(id=>[id,name])));

export default {async fetch(request,env,ctx){
 const url=new URL(request.url);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders()});
 if(request.method!=='GET')return json({error:'Method not allowed.'},405);
 if(url.pathname==='/health')return json({ok:true,service:'vibecode-luas-api',provider:'nta-gtfs-realtime',apiVersion:1});
 if(url.pathname!=='/forecast'&&url.pathname!=='/v1/forecast')return json({error:'Not found.'},404);
 const code=(url.searchParams.get('stop')||'').toLowerCase();
 const stop=STOPS[code];
 if(!stop)return json({error:'A valid Luas stop code is required.'},400);
 if(!env.NTA_SUBSCRIPTION_KEY)return json({error:'NTA API key is not configured.'},500);
 try{
  const feed=await getFeed(env.NTA_SUBSCRIPTION_KEY,ctx);
  return json(buildForecast(code,stop,feed),200,{'Cache-Control':`public,max-age=5,s-maxage=${CACHE_SECONDS}`,'X-Luas-Provider':'nta-gtfs-realtime'});
 }catch(error){return json({error:'The NTA realtime feed could not be processed.',detail:error instanceof Error?error.message:String(error)},502);}
}};

async function getFeed(key,ctx){
 const cache=caches.default;
 const cacheKey=new Request('https://cache.vibecode.invalid/nta-gtfsr-v2');
 let response=await cache.match(cacheKey);
 if(!response){
  response=await fetch(NTA_URL,{headers:{Accept:'application/json','Cache-Control':'no-cache','x-api-key':key}});
  if(!response.ok)throw new Error(`NTA returned HTTP ${response.status}.`);
  response=new Response(response.body,response);
  response.headers.set('Cache-Control',`public,max-age=${CACHE_SECONDS}`);
  ctx.waitUntil(cache.put(cacheKey,response.clone()));
 }
 const data=await response.json();
 if(!data||!Array.isArray(data.entity))throw new Error('NTA returned an unexpected JSON structure.');
 return data;
}

function buildForecast(code,[name,...stopIds],feed){
 const wanted=new Set(stopIds);const now=Math.floor(Date.now()/1000);const departures=[];
 for(const entity of feed.entity){
  const update=entity.tripUpdate||entity.trip_update;if(!update)continue;
  const trip=update.trip||{};const routeId=trip.routeId||trip.route_id||'';
  if(routeId&&!/GREEN|RED/i.test(routeId))continue;
  const items=update.stopTimeUpdate||update.stop_time_update||[];
  const destination=findDestination(items);
  for(const item of items){
   const stopId=String(item.stopId||item.stop_id||'');if(!wanted.has(stopId))continue;
   const event=item.departure||item.arrival||{};const timestamp=toSeconds(event.time);
   if(!timestamp||timestamp<now-60||timestamp>now+10800)continue;
   const directionId=Number(trip.directionId??trip.direction_id);
   departures.push({destination:destination||'Luas',direction:directionId===1?'Inbound':'Outbound',minutes:Math.max(0,Math.ceil((timestamp-now)/60)),scheduledAt:new Date(timestamp*1000).toISOString(),tripId:String(trip.tripId||trip.trip_id||''),route:routeId});
  }
 }
 departures.sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt));
 return {apiVersion:1,provider:'nta-gtfs-realtime',stop:{code,name,ids:stopIds},updated:new Date().toISOString(),message:'Official NTA GTFS-Realtime forecast',departures:dedupe(departures).slice(0,12)};
}
function findDestination(items){for(let i=items.length-1;i>=0;i--){const id=String(items[i].stopId||items[i].stop_id||'');if(STOP_NAME_BY_ID[id])return STOP_NAME_BY_ID[id];}return '';}
function toSeconds(value){if(value===undefined||value===null)return 0;const n=Number(typeof value==='object'?(value.low??value.value??value.toString?.()):value);return Number.isFinite(n)?n:0;}
function dedupe(items){const seen=new Set();return items.filter(item=>{const key=`${item.tripId}|${item.scheduledAt}|${item.destination}`;if(seen.has(key))return false;seen.add(key);return true;});}
function corsHeaders(){return {'Access-Control-Allow-Origin':ALLOWED_ORIGIN,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type',Vary:'Origin'};}
function json(body,status=200,extra={}){return Response.json(body,{status,headers:{...corsHeaders(),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});}
