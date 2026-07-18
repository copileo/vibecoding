const PREFIX="vibecode-cartas-tcg-";
const CACHE=PREFIX+"v9";
const ASSETS=["./","./index.html","./manifest.webmanifest","./icon.svg","./layout-fixes.js","./svg-editor.js"];
function injectEditor(text){
  let out=text;
  if(!out.includes("layout-fixes.js"))out=out.replace("</body>","<script src=\"./layout-fixes.js\"></script></body>");
  if(!out.includes("svg-editor.js"))out=out.replace("</body>","<script src=\"./svg-editor.js\"></script></body>");
  return out;
}
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim()});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  if(event.request.mode==="navigate"){
    event.respondWith((async()=>{
      try{
        const response=await fetch(event.request);
        const text=injectEditor(await response.text());
        const patched=new Response(text,{status:response.status,statusText:response.statusText,headers:{"Content-Type":"text/html; charset=utf-8"}});
        caches.open(CACHE).then(cache=>cache.put("./index.html",patched.clone()));
        return patched;
      }catch{
        const cached=await caches.match("./index.html");
        if(!cached)return Response.error();
        return new Response(injectEditor(await cached.text()),{headers:{"Content-Type":"text/html; charset=utf-8"}});
      }
    })());
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response})));
});