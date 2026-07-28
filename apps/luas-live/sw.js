const CACHE='luas-live-v12';
const SHELL=['./','./index.html','./styles.css','./config.js','./app.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==location.origin)return;
 event.respondWith((async()=>{try{const response=await fetch(event.request);if(response&&response.ok){const copy=response.clone();const cache=await caches.open(CACHE);await cache.put(event.request,copy)}return response}catch{return(await caches.match(event.request))||Response.error()}})());
});
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{}}catch{data={body:event.data?.text()||'Your Luas is due shortly.'}}
 event.waitUntil(self.registration.showNotification(data.title||'Luas reminder',{body:data.body||'Your Luas is due shortly.',icon:'./icon.svg',badge:'./icon.svg',tag:data.tag||'luas-reminder',renotify:true,data:{url:data.url||'./'}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const target=new URL(event.notification.data?.url||'./',self.location.origin).href;
 event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const client of list){if(client.url.startsWith(self.location.origin)&&'focus'in client){client.navigate(target);return client.focus()}}return clients.openWindow?clients.openWindow(target):undefined}));
});
