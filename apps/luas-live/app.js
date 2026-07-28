const APP_VERSION='1.1.0';
const API='https://luasforecasts.rpa.ie/xml/get.ashx';
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
let stops=[];

if(versionLabel)versionLabel.textContent=`v${APP_VERSION}`;

function loadQueries(){try{const value=JSON.parse(localStorage.getItem(STORAGE_KEY));return Array.isArray(value)&&value.length?value:DEFAULT_QUERIES}catch{return DEFAULT_QUERIES}}
function saveQueries(){localStorage.setItem(STORAGE_KEY,JSON.stringify(queries))}
function escapeText(value=''){return String(value).trim()}
function parseXML(text){const xml=new DOMParser().parseFromString(text,'application/xml');if(xml.querySelector('parsererror'))throw new Error('The Luas feed returned invalid data.');return xml}
function buildApiUrl(params){const url=new URL(API);Object.entries({...params,encrypt:'false'}).forEach(([key,value])=>url.searchParams.set(key,value));return url.toString()}

async function requestText(url){
  const response=await fetch(url,{cache:'no-store',headers:{Accept:'application/xml,text/xml,text/plain,*/*'}});
  if(!response.ok)throw new Error(`Feed request failed (${response.status})`);
  return response.text();
}

async function fetchXML(params){
  const target=buildApiUrl(params);
  const candidates=[
    target,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
    `https://corsproxy.io/?url=${encodeURIComponent(target)}`
  ];
  let lastError;
  for(const candidate of candidates){
    try{return parseXML(await requestText(candidate))}
    catch(error){lastError=error}
  }
  throw new Error(lastError?.message||'Could not reach the Luas live feed.');
}

async function loadStops(){
  try{
    const xml=await fetchXML({action:'stops'});
    stops=[...xml.querySelectorAll('stop')].map(node=>({name:node.getAttribute('name')||node.textContent.trim(),code:node.getAttribute('abrev')||node.getAttribute('abbr')||node.getAttribute('code')})).filter(stop=>stop.name&&stop.code);
  }catch{stops=FALLBACK_STOPS}
  stops.sort((a,b)=>a.name.localeCompare(b.name,'en-IE'));
  stopSelect.innerHTML=stops.map(stop=>`<option value="${stop.code}">${stop.name}</option>`).join('');
  const trinity=stops.find(stop=>stop.name.toLowerCase()==='trinity');if(trinity)stopSelect.value=trinity.code;
}

function normaliseMinutes(value){const clean=String(value??'').trim();if(!clean)return null;if(/^due$/i.test(clean))return 0;const number=Number.parseInt(clean,10);return Number.isFinite(number)?number:null}
function getDirection(xml,name){return [...xml.querySelectorAll('direction')].find(node=>(node.getAttribute('name')||'').toLowerCase()===name.toLowerCase())}
function parseForecast(xml,query){
  const direction=getDirection(xml,query.direction);
  const all=direction?[...direction.querySelectorAll('tram')]:[];
  const destination=escapeText(query.destination).toLowerCase();
  const trams=all.filter(node=>!destination||(node.getAttribute('destination')||'').toLowerCase().includes(destination)).map(node=>({destination:node.getAttribute('destination')||'Tram',minutes:normaliseMinutes(node.getAttribute('dueMins'))})).filter(item=>item.minutes!==null).slice(0,3);
  const message=xml.documentElement.getAttribute('message')||direction?.getAttribute('message')||'Live Luas forecast';
  const created=xml.documentElement.getAttribute('created')||new Date().toISOString();
  return{trams,message,created};
}
function formatUpdated(value){const date=new Date(value);if(Number.isNaN(date.getTime()))return 'Updated now';return `Updated ${new Intl.DateTimeFormat('en-IE',{hour:'2-digit',minute:'2-digit'}).format(date)}`}
function renderSkeleton(query){
  const node=template.content.firstElementChild.cloneNode(true);node.dataset.id=query.id;
  node.querySelector('.direction').textContent=query.direction;
  node.querySelector('.route-title').textContent=`${query.stopName} → ${query.destination||query.direction}`;
  node.querySelector('.times').innerHTML='<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  node.querySelector('.message').textContent='Loading live forecast…';
  node.querySelector('.updated').textContent='';
  node.querySelector('.menu-button').addEventListener('click',()=>removeQuery(query.id));
  boards.append(node);return node;
}
function renderForecast(node,data){
  const times=node.querySelector('.times');
  times.innerHTML=data.trams.length?data.trams.map(tram=>`<div class="time-chip ${tram.minutes===0?'due':''}"><strong>${tram.minutes===0?'Due':tram.minutes}</strong><span>${tram.minutes===0?'now':'min'} · ${tram.destination}</span></div>`).join(''):'<div class="time-chip"><strong>—</strong><span>No trams forecast</span></div>';
  node.querySelector('.message').textContent=data.message;
  node.querySelector('.updated').textContent=formatUpdated(data.created);
}
function renderError(node,error){node.querySelector('.times').innerHTML='<div class="time-chip"><strong>!</strong><span>Unavailable</span></div>';node.querySelector('.message').textContent=error.message||'Could not reach the live feed';node.querySelector('.updated').textContent='Tap refresh to retry'}

async function refreshBoard(query,node){
  try{const xml=await fetchXML({action:'forecast',stop:query.stopCode});const data=parseForecast(xml,query);renderForecast(node,data);return data}
  catch(error){renderError(node,error);throw error}
}
async function refreshAll(){
  boards.innerHTML='';emptyState.hidden=queries.length>0;
  if(!queries.length){networkStatus.textContent='Add a board to check service';networkDot.className='status-dot loading';return}
  networkStatus.textContent='Checking live service…';networkDot.className='status-dot loading';
  const cards=queries.map(query=>[query,renderSkeleton(query)]);
  const results=await Promise.allSettled(cards.map(([query,node])=>refreshBoard(query,node)));
  const ok=results.filter(result=>result.status==='fulfilled');
  if(ok.length){const messages=ok.map(result=>result.value.message).filter(Boolean);const abnormal=messages.find(message=>!/operating normally/i.test(message));networkStatus.textContent=abnormal||'Luas services available';networkDot.className=`status-dot ${abnormal?'loading':''}`.trim()}
  else{networkStatus.textContent='Live feed unavailable';networkDot.className='status-dot error'}
}
function removeQuery(id){queries=queries.filter(query=>query.id!==id);saveQueries();refreshAll()}
function openForm(){dialog.showModal()}
function closeForm(){dialog.close()}

form.addEventListener('submit',event=>{
  event.preventDefault();const stop=stops.find(item=>item.code===stopSelect.value);if(!stop)return;
  queries.push({id:crypto.randomUUID?.()||String(Date.now()),stopCode:stop.code,stopName:stop.name,direction:directionSelect.value,destination:escapeText(destinationInput.value)});
  saveQueries();destinationInput.value='';closeForm();refreshAll();
});
document.querySelector('#open-form').addEventListener('click',openForm);
document.querySelectorAll('[data-open-form]').forEach(button=>button.addEventListener('click',openForm));
document.querySelector('#close-form').addEventListener('click',closeForm);
document.querySelector('#refresh-all').addEventListener('click',refreshAll);
dialog.addEventListener('click',event=>{if(event.target===dialog)closeForm()});

(async()=>{await loadStops();await refreshAll();if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}))})();