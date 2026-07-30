import {APP_STOPS,auditOfficialStops,getOfficialForecast} from './luas-official.js';

const MAX_CONCURRENCY=4;
const MAX_UPDATED_AGE_SECONDS=600;

export async function auditForecastMigration(ctx){
 const startedAt=Date.now();
 const catalogue=await auditOfficialStops(ctx);
 const rows=await mapWithConcurrency(APP_STOPS,MAX_CONCURRENCY,async([appCode,expectedName])=>{
  const began=Date.now();
  try{
   const data=await getOfficialForecast(appCode,ctx);
   const updatedAt=Date.parse(data.updated);
   const updatedAgeSeconds=Number.isFinite(updatedAt)?Math.max(0,Math.floor((Date.now()-updatedAt)/1000)):null;
   const directions=[...new Set((data.departures||[]).map(item=>item.direction).filter(Boolean))];
   const invalidDepartures=(data.departures||[]).filter(item=>!validDeparture(item));
   const nameMatches=normaliseName(data.stop?.name)===normaliseName(expectedName);
   const issues=[];
   if(data.provider!=='luas-official-avls')issues.push(`Unexpected provider: ${data.provider||'missing'}`);
   if(!data.stop?.officialCode)issues.push('Missing official stop code.');
   if(!nameMatches)issues.push(`Official name differs: ${data.stop?.name||'missing'}`);
   if(updatedAgeSeconds===null)issues.push('Invalid updated timestamp.');
   else if(updatedAgeSeconds>MAX_UPDATED_AGE_SECONDS)issues.push(`Forecast is ${updatedAgeSeconds}s old.`);
   if(!Array.isArray(data.departures))issues.push('Departures is not an array.');
   if(invalidDepartures.length)issues.push(`${invalidDepartures.length} invalid departure(s).`);
   return {
    appCode,expectedName,officialCode:data.stop?.officialCode||null,officialName:data.stop?.name||null,
    status:issues.length?'warning':'passed',provider:data.provider||null,cacheStatus:data.cache?.status||null,
    updated:data.updated||null,updatedAgeSeconds,directions,departureCount:data.departures?.length||0,
    invalidDepartureCount:invalidDepartures.length,durationMs:Date.now()-began,issues
   };
  }catch(error){
   return {appCode,expectedName,officialCode:null,officialName:null,status:'failed',provider:null,cacheStatus:null,updated:null,updatedAgeSeconds:null,directions:[],departureCount:0,invalidDepartureCount:0,durationMs:Date.now()-began,issues:[error instanceof Error?error.message:String(error)]};
  }
 });
 const passed=rows.filter(row=>row.status==='passed').length;
 const warnings=rows.filter(row=>row.status==='warning').length;
 const failed=rows.filter(row=>row.status==='failed').length;
 return {
  generatedAt:new Date().toISOString(),durationMs:Date.now()-startedAt,
  validation:{maxConcurrency:MAX_CONCURRENCY,maxUpdatedAgeSeconds:MAX_UPDATED_AGE_SECONDS},
  summary:{total:rows.length,passed,warnings,failed,complete:failed===0&&catalogue.missing.length===0},
  catalogue:{appStopCount:catalogue.appStopCount,officialStopCount:catalogue.officialStopCount,matched:catalogue.matched,missing:catalogue.missing,differences:catalogue.differences},
  failures:rows.filter(row=>row.status==='failed'),warnings:rows.filter(row=>row.status==='warning'),stops:rows
 };
}

function validDeparture(item){
 if(!item||typeof item!=='object')return false;
 if(!['Inbound','Outbound'].includes(item.direction))return false;
 if(!String(item.destination||'').trim())return false;
 if(!Number.isFinite(Number(item.minutes))||Number(item.minutes)<0||Number(item.minutes)>180)return false;
 return Number.isFinite(Date.parse(item.scheduledAt));
}
function normaliseName(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(st|saint)\.?\b/g,'saint').replace(/[^a-z0-9]/g,'');}
async function mapWithConcurrency(items,limit,mapper){
 const results=new Array(items.length);let next=0;
 async function worker(){while(true){const index=next++;if(index>=items.length)return;results[index]=await mapper(items[index],index);}}
 await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));
 return results;
}
