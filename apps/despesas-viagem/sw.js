const CACHE='vibecode-despesas-viagem-v4';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg','./report-v2.js'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k.startsWith('vibecode-despesas-viagem')).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',event=>{
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(async response=>{
      const html=await response.text();
      const injected=html.includes('report-v2.js')?html:html.replace('</body>','<script src="./report-v2.js"></script></body>');
      return new Response(injected,{headers:{'Content-Type':'text/html; charset=utf-8'}});
    }).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{})}return response}).catch(()=>caches.match(event.request)));
});