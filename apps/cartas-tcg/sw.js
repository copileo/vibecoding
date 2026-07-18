const PREFIX="vibecode-cartas-tcg-";
const CACHE=PREFIX+"v8";
const ASSETS=["./","./index.html","./manifest.webmanifest","./icon.svg","./layout-fixes.js"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim()});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  if(event.request.mode==="navigate"){
    event.respondWith((async()=>{
      try{
        const response=await fetch(event.request);
        const text=await response.text();
        const injected=text.includes("layout-fixes.js")?text:text.replace("</body>","<script src=\"./layout-fixes.js\"></script></body>");
        const patched=new Response(injected,{status:response.status,statusText:response.statusText,headers:{"Content-Type":"text/html; charset=utf-8"}});
        caches.open(CACHE).then(cache=>cache.put("./index.html",patched.clone()));
        return patched;
      }catch{
        const cached=await caches.match("./index.html");
        if(!cached)return Response.error();
        const text=await cached.text();
        const injected=text.includes("layout-fixes.js")?text:text.replace("</body>","<script src=\"./layout-fixes.js\"></script></body>");
        return new Response(injected,{headers:{"Content-Type":"text/html; charset=utf-8"}});
      }
    })());
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response})));
});