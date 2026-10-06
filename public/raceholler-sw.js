/* Only the generic offline shell and content-hashed app assets are cached.
   Private dashboard HTML, API responses, cookies and public live results are network-only. */
const CACHE='raceholler-shell-v1';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(url.pathname.startsWith('/_next/static/')){event.respondWith(caches.open(CACHE).then(async cache=>{const saved=await cache.match(request,{ignoreSearch:true});if(saved)return saved;const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response;}));return;}
 if(request.mode==='navigate'){event.respondWith(fetch(request).catch(async()=>{if(url.pathname!=='/offline')return Response.redirect(new URL('/offline',self.location.origin),302);const shell=await caches.open(CACHE).then(c=>c.match('/offline'));return shell||new Response('Prepare an event online before using offline scoring.',{status:503,headers:{'Content-Type':'text/plain'}});}));}
});
