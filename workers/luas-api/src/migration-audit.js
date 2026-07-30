import {APP_STOPS,auditOfficialStops,getOfficialForecast} from './luas-official.js';

const MAX_CONCURRENCY=3;
const DEFAULT_BATCH_SIZE=8;
const MAX_BATCH_SIZE=10;
const MAX_UPDATED_AGE_SECONDS=600;

export async function auditForecastMigration(ctx,options={}){
 const startedAt=Date.now();
 const offset=clampInteger(options.offset,0,APP_STOPS.length,0);
 const limit=clampInteger(options.limit,1,MAX_BATCH_SIZE,DEFAULT_BATCH_SIZE);
 const selected=APP_STOPS.slice(offset,offset+limit);
 const catalogue=await auditOfficialStops(ctx);
 const rows=await mapWithConcurrency(selected,MAX_CONCURRENCY,async([appCode,expectedName])=>validateStop(appCode,expectedName,ctx));
 const passed=rows.filter(row=>row.status==='passed').length;
 const warnings=rows.filter(row=>row.status==='warning').length;
 const failed=rows.filter(row=>row.status==='failed').length;
 const nextOffset=offset+rows.length<APP_STOPS.length?offset+rows.length:null;
 return {
  generatedAt:new Date().toISOString(),durationMs:Date.now()-startedAt,
  validation:{maxConcurrency:MAX_CONCURRENCY,maxUpdatedAgeSeconds:MAX_UPDATED_AGE_SECONDS,batchSize:limit,maxBatchSize:MAX_BATCH_SIZE},
  pagination:{offset,limit,returned:rows.length,total:APP_STOPS.length,nextOffset,complete:nextOffset===null},
  summary:{total:rows.length,passed,warnings,failed,complete:failed===0&&nextOffset===null&&catalogue.missing.length===0},
  catalogue:{appStopCount:catalogue.appStopCount,officialStopCount:catalogue.officialStopCount,matched:catalogue.matched,missing:catalogue.missing,differences:catalogue.differences},
  failures:rows.filter(row=>row.status==='failed'),warnings:rows.filter(row=>row.status==='warning'),stops:rows
 };
}

async function validateStop(appCode,expectedName,ctx){
 const began=Date.now();
 try{
  const data=await getOfficialForecast(appCode,ctx);
  const updatedAt=Date.parse(data.updated);
  const updatedAgeSeconds=Number.isFinite(updatedAt)?Math.max(0,Math.floor((Date.now()-updatedAt)/1000)):null;
  const directions=[...new Set((data.departures||[]).map(item=>item.direction).filter(Boolean))];
  const invalidDepartures=(data.departures||[]).filter(item=>!validDeparture(item));
  const issues=[];
  const fatalIssues=[];
  if(data.provider!=='luas-official-avls')issues.push(`Unexpected provider: ${data.provider||'missing'}`);
  if(!data.stop?.officialCode)fatalIssues.push('Missing official stop code.');
  if(!namesCompatible(data.stop?.name,expectedName))fatalIssues.push(`Official name differs: ${data.stop?.name||'missing'}`);
  if(updatedAgeSeconds===null)issues.push('Invalid updated timestamp.');
  else if(updatedAgeSeconds>MAX_UPDATED_AGE_SECONDS)issues.push(`Forecast is ${updatedAgeSeconds}s old.`);
  if(!Array.isArray(data.departures))issues.push('Departures is not an array.');
  if(invalidDepartures.length)issues.push(`${invalidDepartures.length} invalid departure(s).`);
  const allIssues=[...fatalIssues,...issues];
  const status=fatalIssues.length?'failed':issues.length?'warning':'passed';
  return {appCode,expectedName,officialCode:data.stop?.officialCode||null,officialName:data.stop?.name||null,status,provider:data.provider||null,cacheStatus:data.cache?.status||null,updated:data.updated||null,updatedAgeSeconds,directions,departureCount:data.departures?.length||0,invalidDepartureCount:invalidDepartures.length,durationMs:Date.now()-began,issues:allIssues};
 }catch(error){
  return {appCode,expectedName,officialCode:null,officialName:null,status:'failed',provider:null,cacheStatus:null,updated:null,updatedAgeSeconds:null,directions:[],departureCount:0,invalidDepartureCount:0,durationMs:Date.now()-began,issues:[error instanceof Error?error.message:String(error)]};
 }
}

function validDeparture(item){return !!item&&typeof item==='object'&&['Inbound','Outbound'].includes(item.direction)&&!!String(item.destination||'').trim()&&Number.isFinite(Number(item.minutes))&&Number(item.minutes)>=0&&Number(item.minutes)<=180&&Number.isFinite(Date.parse(item.scheduledAt));}
function normaliseName(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(st|saint)\.?\b/g,'saint').replace(/[^a-z0-9]/g,'');}
function namesCompatible(actual,expected){const a=normaliseName(actual),b=normaliseName(expected);return a===b||a&&b&&(a.includes(b)||b.includes(a));}
function clampInteger(value,min,max,fallback){const parsed=Number.parseInt(value,10);return Number.isFinite(parsed)?Math.min(max,Math.max(min,parsed)):fallback;}
async function mapWithConcurrency(items,limit,mapper){const results=new Array(items.length);let next=0;async function worker(){while(true){const index=next++;if(index>=items.length)return;results[index]=await mapper(items[index],index);}}await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return results;}