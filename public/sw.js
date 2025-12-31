const SHELL_CACHE = "kinship-shell-v1";
const ASSETS = ["/", "/manifest.json", "/globe.svg", "/file.svg", "/next.svg", "/vercel.svg"];
const DB_NAME = "kinship-status-queue";
const STORE_NAME = "status";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method === "POST" && url.pathname === "/api/status") {
    event.respondWith(handleStatusPost(request));
    return;
  }

  if (request.method === "GET" && url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === "kinship-flush-status") {
    event.waitUntil(flushQueue());
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "KINSHIP_FLUSH_QUEUE") {
    event.waitUntil(flushQueue());
  }
});

async function cacheFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(SHELL_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ offline: true }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function handleStatusPost(request) {
  const clone = request.clone();

  try {
    const response = await fetch(request);
    return response;
  } catch {
    const body = await safeReadJson(clone);
    await enqueue(body, clone.url);
    await self.registration.sync?.register("kinship-flush-status");

    return new Response(JSON.stringify({ queued: true }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function enqueue(body, url) {
  const db = await getDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put({
      id: crypto.randomUUID(),
      body,
      url,
      createdAt: Date.now(),
    });

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

async function flushQueue() {
  const records = await getAll();

  for (const record of records) {
    try {
      const res = await fetch(record.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record.body),
      });

      if (res.ok) {
        await deleteRecord(record.id);
      }
    } catch {
      // Keep in queue until network recovers.
    }
  }
}

function getDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAll() {
  return getDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      })
  );
}

function deleteRecord(id) {
  return getDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      })
  );
}

async function safeReadJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
