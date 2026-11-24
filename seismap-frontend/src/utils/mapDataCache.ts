import { API_BASE_URL, IS_PREVIEW_MODE } from '../config/env';
import type { PublicMetadata, PublicSummary, ResearchEarthquake } from '../types/domain';

export interface CachedMapDataset {
  scope: string;
  cacheKey: string;
  runId: number;
  activatedAt: string | null;
  totalPoints: number;
  metadata: PublicMetadata;
  summary: PublicSummary;
  points: ResearchEarthquake[];
  cachedAt: number;
}

const DB_NAME = 'seismap-webgis-cache';
const DB_VERSION = 1;
const STORE_NAME = 'mapDatasets';
const REVALIDATE_INTERVAL_MS = 60_000;

let memoryCache: CachedMapDataset | null = null;
let lastValidatedAt = 0;

function getCacheScope(): string {
  return IS_PREVIEW_MODE ? 'preview' : API_BASE_URL || 'same-origin';
}

export function buildMapCacheKey(metadata: PublicMetadata, summary: PublicSummary): string | null {
  const runId = metadata.run?.id;
  if (!runId) return null;
  const activatedAt = metadata.run?.activated_at ?? '';
  const totalPoints = summary.total_points ?? 0;
  return `v1:run:${runId}:pts:${totalPoints}:act:${activatedAt}`;
}

export function getMemoryCachedMapDataset(): CachedMapDataset | null {
  if (!memoryCache) return null;
  if (memoryCache.scope !== getCacheScope()) return null;
  return memoryCache;
}

export function shouldRevalidateCachedDataset(): boolean {
  if (!memoryCache || memoryCache.scope !== getCacheScope()) return true;
  return Date.now() - lastValidatedAt > REVALIDATE_INTERVAL_MS;
}

export function markDatasetValidated(): void {
  lastValidatedAt = Date.now();
}

export function setMemoryCachedMapDataset(dataset: CachedMapDataset): void {
  memoryCache = dataset;
  lastValidatedAt = Date.now();
}

function openCacheDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'scope' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function readPersistedMapDataset(): Promise<CachedMapDataset | null> {
  const mem = getMemoryCachedMapDataset();
  if (mem) return mem;

  const db = await openCacheDatabase();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(getCacheScope());
      req.onsuccess = () => {
        const result = req.result as CachedMapDataset | undefined;
        if (
          result &&
          Array.isArray(result.points) &&
          result.points.length > 0 &&
          result.metadata?.run?.id &&
          result.summary &&
          result.cacheKey
        ) {
          memoryCache = result;
          resolve(result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
      tx.onabort = () => db.close();
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export async function persistMapDataset(dataset: Omit<CachedMapDataset, 'scope' | 'cachedAt'>): Promise<void> {
  const fullRecord: CachedMapDataset = {
    ...dataset,
    scope: getCacheScope(),
    cachedAt: Date.now(),
  };
  setMemoryCachedMapDataset(fullRecord);

  const db = await openCacheDatabase();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(fullRecord);
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
      db.close();
      resolve();
    }
  });
}
