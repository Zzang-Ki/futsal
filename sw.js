/* 풋살 매니저 서비스 워커
   온라인이면 최신 파일을 받아 저장하고, 오프라인(또는 3초 안에 응답 없음)이면 저장본을 쓴다.
   앱을 업데이트할 때 이 파일은 바꿀 필요가 없다. */
var CACHE = 'futsal-manager-v1';
var CORE = ['./', './index.html', './manifest.json'];
/* 이미지는 없어도 설치가 실패하지 않도록 따로 저장을 시도한다 */
var OPTIONAL = ['./App_Icon_512.png', './Favicon_FM_192.png', './App_Icon_Maskable_512.png', './Timer_BG.png', './Timer_BG.jpg'];
var TIMEOUT_MS = 3000;

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(CORE).then(function () {
        return Promise.all(OPTIONAL.map(function (u) { return c.add(u).catch(function () {}); }));
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(networkFirst(req));
});

function fromCache(cache, req) {
  return cache.match(req, { ignoreSearch: true }).then(function (hit) {
    if (hit) return hit;
    if (req.mode === 'navigate') return cache.match('./index.html');
    return undefined;
  });
}

function networkFirst(req) {
  return caches.open(CACHE).then(function (cache) {
    var net = fetch(req.url, { cache: 'no-store' }).then(function (res) {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    });
    var timer = new Promise(function (resolve) { setTimeout(function () { resolve('timeout'); }, TIMEOUT_MS); });

    return Promise.race([net, timer]).then(function (first) {
      if (first !== 'timeout') return first;
      return fromCache(cache, req).then(function (hit) { return hit || net; });
    }).catch(function () {
      return fromCache(cache, req).then(function (hit) {
        if (hit) return hit;
        return new Response('오프라인 상태이고 저장된 파일이 없습니다.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      });
    });
  });
}
