const APP_VERSION='1.7.0';
const API_BASE=String(window.LUAS_API_BASE||'').replace(/\/$/,'');
const STORAGE_KEY='vibecode-luas-live-v1';
const DEFAULT_QUERIES=[{id:'trinity-brides-glen',stopCode:'tri',stopName:'Trinity',direction:'Outbound',destination:'Brides Glen'}];
const FALLBACK_STOPS=[
  ['The Point','tpt'],['Spencer Dock','sdk'],['Mayor Square - NCI','msq'],["George's Dock",'gdk'],['Connolly','con'],['Busáras','bus'],['Abbey Street','abb'],['Jervis','jer'],['Four Courts','fou'],['Smithfield','smi'],['Museum','mus'],['Heuston','heu'],["James's",'jam'],['Fatima','fat'],['Rialto','ria'],['Suir Road','sui'],['Goldenbridge','gol'],['Drimnagh','dri'],['Blackhorse','bla'],['Bluebell','blu'],['Kylemore','kyl'],['Red Cow','red'],['Kingswood','kin'],['Belgard','bel'],['Cookstown','coo'],['Hospital','hos'],['Tallaght','tal'],['Fettercairn','fet'],['Cheeverstown','che'],['Citywest Campus','cit'],['Fortunestown','for'],['Saggart','sag'],['Broombridge','bro'],['Cabra','cab'],['Phibsborough','phi'],['Grangegorman','gra'],['Broadstone - University','brd'],['Dominick','dom'],['Parnell','par'],["O'Connell - Upper",'ocu'],["O'Connell - GPO",'ocg'],['Marlborough','mar'],['Westmoreland','wes'],['Trinity','tri'],['Dawson','daw'],["St. Stephen's Green",'sti'],['Harcourt','har'],['Charlemont','cha'],['Ranelagh','ran'],['Beechwood','bee'],['Cowper','cow'],['Milltown','mil'],['Windy Arbour','win'],['Dundrum','dun'],['Balally','bal'],['Kilmacud','kil'],['Stillorgan','sti2'],['Sandyford','san'],['Central Park','cen'],['Glencairn','gln'],['The Gallops','gal'],['Leopardstown Valley','leo'],['Ballyogan Wood','bal2'],['Carrickmines','car'],['Laughanstown','lau'],['Cherrywood','che2'],['Brides Glen','bri']
].map(([name,code])=>({name,code}));

const boards=document.querySelector('#boards');
const emptyState=document.querySelector('#empty-state');
const template=document.querySelector('#board-template');
const dialog=document.querySelector('#query-dialog');
const form=document.querySelector('#query-form');
const stopSelect=document.querySelector('#stop-select');
const directionSelect=document.querySelector('#direction-select');
const destinationInput=document.querySelector('#destination-input');
const networkStatus=document.querySelector('#network-status');
const networkDot=document.querySelector('#network-dot');
const versionLabel=document.querySelector('#app-version');
let queries=loadQueries();
let stops=[...FALLBACK_STOPS];
let boardData=new Map();

if(versionLabel)versionLabel.textContent=`v${APP_VERSION}`;
function loadQueries(){try{const value=JSON.parse(localStorage.getItem(STORAGE_KEY));return Array.isArray(value)&&value.length?value:DEFAULT_QUERIES}catch{return DEFAULT_QUERIES}}
function saveQueries(){localStorage.setItem(STORAGE_KEY,JSON.stringify(queries))}
function escapeText(value=''){return String(value).trim()}

async function fetchForecast(stopCode){
  if(!API_BASE)throw new Error('Realtime API URL is not configured.');
  const response=await fetch(`${API_BASE}/v1/forecast?stop=${encodeURIComponent(stopCode)}`,{cache:'no-store',headers:{Accept:'application/json'}});
  if(!response.ok){let detail='';try{const body=await response.json();detail=body.detail||body.error||''}catch{}throw new Error(detail||`Realtime feed unavailable (${response.status}).`)}
  const data=await response.json();
  if(!data||data.apiVersion!==1||!Array.isArray(data.departures))throw new Error('The realtime feed returned invalid data.');
  return data;
}
function loadStops(){stops.sort((a,b)=>a.name.localeCompare(b.name,'en-IE'));stopSelect.innerHTML=stops.map(stop=>`<option value="${stop.code}">${stop.name}</option>`).join('');const trinity=stops.find(stop=>stop.name.toLowerCase()==='trinity');if(trinity)stopSelect.value=trinity.code}
function parseCreated(value){const date=new Date(value);return Number.isNaN(date.getTime())?new Date():date}
function parseForecast(payload,query){
  const destination=escapeText(query.destination).toLowerCase();const direction=escapeText(query.direction).toLowerCase();const created=parseCreated(payload.updated);
  const trams=payload.departures.filter(item=>{const itemDirection=escapeText(item.direction).toLowerCase();const itemDestination=escapeText(item.destination).toLowerCase();return(!direction||itemDirection===direction)&&(!destination||itemDestination.includes(destination))}).map(item=>{const exact=new Date(item.scheduledAt);const minutes=Number(item.minutes);const scheduledAt=!Number.isNaN(exact.getTime())?exact:(Number.isFinite(minutes)?new Date(created.getTime()+minutes*60000):null);return{destination:item.destination||'Tram',scheduledAt}}).filter(item=>item.scheduledAt).slice(0,3);
  return{trams,message:payload.message||'Official NTA realtime forecast',created};
}
function formatClock(value){return new Intl.DateTimeFormat('en-IE',{hour:'2-digit',minute:'2-digit',hour12:false}).format(value)}
function feedAgeMinutes(created){return Math.max(0,Math.floor((Date.now()-created.getTime())/60000))}
function formatUpdated(created){const age=feedAgeMinutes(created);return `Updated ${formatClock(created)} · ${age}m ago`}
function getRemainingMinutes(scheduledAt){return Math.max(0,Math.ceil((scheduledAt.getTime()-Date.now())/60000))}
function renderSkeleton(query){const node=template.content.firstElementChild.cloneNode(true);node.dataset.id=query.id;node.querySelector('.direction').textContent=query.direction;node.querySelector('.route-title').textContent=`${query.stopName} → ${query.destination||query.direction}`;node.querySelector('.times').innerHTML='<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';node.querySelector('.message').textContent='Loading realtime forecast…';node.querySelector('.updated').textContent='';node.querySelector('.menu-button').addEventListener('click',()=>removeQuery(query.id));boards.append(node);return node}
function renderForecast(node,data){const active=data.trams.filter(tram=>tram.scheduledAt.getTime()>Date.now()-60000);const times=node.querySelector('.times');times.innerHTML=active.length?active.map(tram=>{const remaining=getRemainingMinutes(tram.scheduledAt);return`<div class="time-chip ${remaining===0?'due':''}"><strong>${remaining===0?'Due':remaining}</strong><span>${formatClock(tram.scheduledAt)} · ${tram.destination}</span></div>`}).join(''):'<div class="time-chip"><strong>—</strong><span>No current trams</span></div>';node.querySelector('.message').textContent=data.message;node.querySelector('.updated').textContent=formatUpdated(data.created)}
function rerenderCountdowns(){for(const [id,data] of boardData){const node=boards.querySelector(`[data-id="${CSS.escape(id)}"]`);if(node)renderForecast(node,data)}}
function renderError(node,error){node.querySelector('.times').innerHTML='<div class="time-chip"><strong>!</strong><span>Unavailable</span></div>';node.querySelector('.message').textContent=error.message||'Could not reach the realtime feed';node.querySelector('.updated').textContent='Tap refresh to retry'}
async function refreshBoard(query,node){try{const payload=await fetchForecast(query.stopCode);const data=parseForecast(payload,query);boardData.set(query.id,data);renderForecast(node,data);return data}catch(error){boardData.delete(query.id);renderError(node,error);throw error}}
async function refreshAll(){boards.innerHTML='';boardData.clear();emptyState.hidden=queries.length>0;if(!queries.length){networkStatus.textContent='Add a board to check service';networkDot.className='status-dot loading';return}networkStatus.textContent='Checking official realtime service…';networkDot.className='status-dot loading';const cards=queries.map(query=>[query,renderSkeleton(query)]);const results=await Promise.allSettled(cards.map(([query,node])=>refreshBoard(query,node)));const ok=results.filter(result=>result.status==='fulfilled');if(ok.length){networkStatus.textContent='Official NTA realtime data available';networkDot.className='status-dot'}else{networkStatus.textContent='Realtime feed unavailable';networkDot.className='status-dot error'}}
function removeQuery(id){queries=queries.filter(query=>query.id!==id);saveQueries();refreshAll()}
function openForm(){dialog.showModal()}
function closeForm(){dialog.close()}
form.addEventListener('submit',event=>{event.preventDefault();const stop=stops.find(item=>item.code===stopSelect.value);if(!stop)return;queries.push({id:crypto.randomUUID?.()||String(Date.now()),stopCode:stop.code,stopName:stop.name,direction:directionSelect.value,destination:escapeText(destinationInput.value)});saveQueries();destinationInput.value='';closeForm();refreshAll()});
document.querySelector('#open-form').addEventListener('click',openForm);document.querySelectorAll('[data-open-form]').forEach(button=>button.addEventListener('click',openForm));document.querySelector('#close-form').addEventListener('click',closeForm);document.querySelector('#refresh-all').addEventListener('click',refreshAll);dialog.addEventListener('click',event=>{if(event.target===dialog)closeForm()});
loadStops();refreshAll();setInterval(rerenderCountdowns,15000);if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
