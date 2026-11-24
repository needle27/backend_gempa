import { API_BASE_URL, IS_PREVIEW_MODE } from '../config/env';

export type CacheNamespace = 'public' | 'admin';

export type CachedResourceEntry<T = unknown> = {
  storageKey: string;
  scope: string;
  namespace: CacheNamespace;
  key: string;
  data: T;
  savedAt: number;
};

export type CacheChangeEvent = {
  type: 'revalidated' | 'invalidated';
  namespace: CacheNamespace;
  keyPrefix?: string;
  storageKey?: string;
};

type CacheDescriptor = {
  namespace: CacheNamespace;
  key: string;
  staleTimeMs?: number;
};

type CacheListener = (event: CacheChangeEvent) => void;

const DB_NAME = 'seismap-resource-cache';
const DB_VERSION = 1;
const STORE_NAME = 'resources';
const MAP_CACHE_DB_NAME = 'seismap-webgis-cache';
export const DEFAULT_STALE_TIME_MS = 60_000;
export const IMMUTABLE_STALE_TIME_MS = 24 * 60 * 60 * 1000;

const memoryCache = new Map<string, CachedResourceEntry<unknown>>();
const inFlightFetches = new Map<string, Promise<unknown>>();
const cacheListeners = new Set<CacheListener>();
const loaderDescriptors = new WeakMap<Function, CacheDescriptor>();

let forceRefreshDepth = 0;
const keyTrackingStack: Array<Set<string>> = [];
let dbOpenDisabled = false;

export function getCacheScope(): string {
  return IS_PREVIEW_MODE ? 'preview' : API_BASE_URL || 'same-origin';
}

export function buildStorageKey(namespace: CacheNamespace, key: string): string {
  return `${getCacheScope()}:${namespace}:${key}`;
}

export function registerLoaderCache<T extends (...args: never[]) => Promise<unknown>>(
  loader: T,
  descriptor: CacheDescriptor,
): T {
  loaderDescriptors.set(loader, descriptor);
  return loader;
}

export function getRegisteredLoaderDescriptor(loader: unknown): CacheDescriptor | null {
  if (typeof loader !== 'function') return null;
  return loaderDescriptors.get(loader) ?? null;
}

export function getMemoryCacheEntry<T>(namespace: CacheNamespace, key: string): CachedResourceEntry<T> | null {
  const storageKey = buildStorageKey(namespace, key);
  const entry = memoryCache.get(storageKey);
  return entry ? (entry as CachedResourceEntry<T>) : null;
}

export function getMemoryEntryForLoader<T>(loader: unknown): CachedResourceEntry<T> | null {
  const descriptor = getRegisteredLoaderDescriptor(loader);
  if (!descriptor) return null;
  return getMemoryCacheEntry<T>(descriptor.namespace, descriptor.key);
}

export function isForceRefreshActive(): boolean {
  return forceRefreshDepth > 0;
}

export function callWithForceRefresh<T>(fn: () => Promise<T>): Promise<T> {
  forceRefreshDepth += 1;
  try {
    return fn();
  } finally {
    forceRefreshDepth -= 1;
  }
}

export function trackLoaderDependencies<T>(fn: () => Promise<T>): {
  promise: Promise<T>;
  storageKeys: string[];
} {
  const tracked = new Set<string>();
  keyTrackingStack.push(tracked);
  try {
    const promise = fn();
    return { promise, storageKeys: [...tracked] };
  } finally {
    keyTrackingStack.pop();
  }
}

function recordAccessedKey(storageKey: string): void {
  const current = keyTrackingStack[keyTrackingStack.length - 1];
  if (current) current.add(storageKey);
}

export function subscribeCacheChanges(listener: CacheListener): () => void {
  cacheListeners.add(listener);
  return () => {
    cacheListeners.delete(listener);
  };
}

function emitCacheEvent(event: CacheChangeEvent): void {
  cacheListeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // Abaikan kegagalan listener agar tidak memutus siklus cache.
    }
  });
}

function openResourceDb(): Promise<IDBDatabase | null> {
  if (dbOpenDisabled || typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'storageKey' });
          store.createIndex('namespace', 'namespace', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbOpenDisabled = true;
        resolve(null);
      };
      request.onblocked = () => resolve(null);
    } catch {
      dbOpenDisabled = true;
      resolve(null);
    }
  });
}

async function readPersistedEntry<T>(storageKey: string): Promise<CachedResourceEntry<T> | null> {
  const db = await openResourceDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(storageKey);
      req.onsuccess = () => {
        const record = req.result as CachedResourceEntry<T> | undefined;
        resolve(record && typeof record.savedAt === 'number' && 'data' in record ? record : null);
      };
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
      tx.onabort = () => db.close();
    } catch {
      try { db.close(); } catch { /* noop */ }
      resolve(null);
    }
  });
}

async function writePersistedEntry<T>(entry: CachedResourceEntry<T>): Promise<void> {
  const db = await openResourceDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(entry);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        resolve();
      };
    } catch {
      try { db.close(); } catch { /* noop */ }
      resolve();
    }
  });
}

async function deletePersistedByPredicate(predicate: (entry: CachedResourceEntry) => boolean): Promise<void> {
  const db = await openResourceDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const entry = cursor.value as CachedResourceEntry | undefined;
        if (entry && predicate(entry)) {
          cursor.delete();
        }
        cursor.continue();
      };
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        resolve();
      };
    } catch {
      try { db.close(); } catch { /* noop */ }
      resolve();
    }
  });
}

export function clearMapDataIndexedDb(): void {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;
  try {
    window.indexedDB.deleteDatabase(MAP_CACHE_DB_NAME);
  } catch {
    // Abaikan kegagalan pembersihan database peta.
  }
}

export type ResolveCachedOptions<T> = {
  namespace: CacheNamespace;
  key: string;
  staleTimeMs?: number;
  forceRefresh?: boolean;
  shouldCache?: (value: T) => boolean;
  onCacheHydrate?: (value: T) => void;
  onNetworkValue?: (value: T, source: 'network' | 'revalidate') => void;
};

async function fetchAndStore<T>(
  storageKey: string,
  options: ResolveCachedOptions<T>,
  fetcher: () => Promise<T>,
  source: 'network' | 'revalidate',
): Promise<T> {
  if (source === 'network' && !(options.forceRefresh || isForceRefreshActive())) {
    const existing = inFlightFetches.get(storageKey);
    if (existing) {
      return existing as Promise<T>;
    }
  }

  const request = (async () => {
    const fresh = await fetcher();
    options.onNetworkValue?.(fresh, source);
    const cacheable = options.shouldCache ? options.shouldCache(fresh) : fresh !== undefined;
    if (cacheable) {
      const entry: CachedResourceEntry<T> = {
        storageKey,
        scope: getCacheScope(),
        namespace: options.namespace,
        key: options.key,
        data: fresh,
        savedAt: Date.now(),
      };
      memoryCache.set(storageKey, entry);
      await writePersistedEntry(entry);
    }
    if (source === 'revalidate') {
      emitCacheEvent({
        type: 'revalidated',
        namespace: options.namespace,
        storageKey,
      });
    }
    return fresh;
  })();

  inFlightFetches.set(storageKey, request);
  try {
    return await request;
  } finally {
    if (inFlightFetches.get(storageKey) === request) {
      inFlightFetches.delete(storageKey);
    }
  }
}

export async function resolveCachedResource<T>(
  options: ResolveCachedOptions<T>,
  fetcher: () => Promise<T>,
): Promise<T> {
  const storageKey = buildStorageKey(options.namespace, options.key);
  recordAccessedKey(storageKey);

  const staleTimeMs = options.staleTimeMs ?? DEFAULT_STALE_TIME_MS;
  const forceRefresh = Boolean(options.forceRefresh || isForceRefreshActive());

  if (!forceRefresh) {
    const memEntry = memoryCache.get(storageKey) as CachedResourceEntry<T> | undefined;
    if (memEntry) {
      const isFresh = staleTimeMs === Infinity || Date.now() - memEntry.savedAt < staleTimeMs;
      if (!isFresh && !inFlightFetches.has(storageKey)) {
        void fetchAndStore(storageKey, options, fetcher, 'revalidate').catch(() => undefined);
      }
      return memEntry.data;
    }

    const persisted = await readPersistedEntry<T>(storageKey);
    if (persisted) {
      memoryCache.set(storageKey, persisted);
      options.onCacheHydrate?.(persisted.data);
      const isFresh = staleTimeMs === Infinity || Date.now() - persisted.savedAt < staleTimeMs;
      if (!isFresh && !inFlightFetches.has(storageKey)) {
        void fetchAndStore(storageKey, options, fetcher, 'revalidate').catch(() => undefined);
      }
      return persisted.data;
    }
  }

  return fetchAndStore(storageKey, options, fetcher, 'network');
}

export function invalidateCacheKey(namespace: CacheNamespace, key: string): void {
  const storageKey = buildStorageKey(namespace, key);
  memoryCache.delete(storageKey);
  void deletePersistedByPredicate((entry) => entry.storageKey === storageKey);
  emitCacheEvent({ type: 'invalidated', namespace, storageKey });
}

export function invalidateCachePrefix(namespace: CacheNamespace, keyPrefix: string): void {
  const scope = getCacheScope();
  const fullPrefix = `${scope}:${namespace}:${keyPrefix}`;
  for (const storageKey of [...memoryCache.keys()]) {
    if (storageKey.startsWith(fullPrefix)) {
      memoryCache.delete(storageKey);
    }
  }
  void deletePersistedByPredicate(
    (entry) => entry.scope === scope && entry.namespace === namespace && entry.key.startsWith(keyPrefix),
  );
  emitCacheEvent({ type: 'invalidated', namespace, keyPrefix });
}

export function clearNamespaceCache(namespace: CacheNamespace): void {
  const scope = getCacheScope();
  const scopePrefix = `${scope}:${namespace}:`;
  for (const storageKey of [...memoryCache.keys()]) {
    if (storageKey.startsWith(scopePrefix)) {
      memoryCache.delete(storageKey);
    }
  }
  if (namespace === 'public') {
    clearMapDataIndexedDb();
  }
  void deletePersistedByPredicate((entry) => entry.scope === scope && entry.namespace === namespace);
  emitCacheEvent({ type: 'invalidated', namespace });
}
