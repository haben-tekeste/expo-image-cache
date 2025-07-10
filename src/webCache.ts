import { DB_NAME, DB_VERSION, STORE_NAME } from "./consts";
import { CachedImage } from "./types";
import { sanitizeCacheKey } from "./utils";

class WebImageCache {
  private db: IDBDatabase | null = null;

  async init() {
    if (this.db) return;

    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        const error = request.error || new Error("IndexedDB open failed");
        reject(error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };
    });
  }

  async getImage(key: string): Promise<string | null> {
    await this.init();
    const sanitizedKey = sanitizeCacheKey(key);

    return new Promise((resolve) => {
      if (!this.db) {
        resolve(null);
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(sanitizedKey);

      request.onsuccess = () => {
        const data = request.result as CachedImage | undefined;
        if (!data) {
          resolve(null);
          return;
        }

        // Check expiration
        if (data.expiresIn) {
          const elapsed = (Date.now() - data.timestamp) / 1000;
          if (elapsed > data.expiresIn) {
            // Delete expired image
            this.deleteImage(sanitizedKey);
            resolve(null);
            return;
          }
        }

        // Convert blob to URL
        const url = URL.createObjectURL(data.blob);
        resolve(url);
      };

      request.onerror = () => resolve(null);
    });
  }

  async saveImage(
    key: string,
    blob: Blob,
    expiresIn?: number
  ): Promise<string | null> {
    await this.init();
    const sanitizedKey = sanitizeCacheKey(key);

    return new Promise((resolve) => {
      if (!this.db) {
        resolve(null);
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const data: CachedImage = {
        key: sanitizedKey,
        blob,
        timestamp: Date.now(),
        expiresIn,
      };

      const request = store.put(data);

      request.onsuccess = () => {
        const url = URL.createObjectURL(blob);
        resolve(url);
      };

      request.onerror = () => resolve(null);
    });
  }

  async deleteImage(key: string): Promise<void> {
    await this.init();
    const sanitizedKey = sanitizeCacheKey(key);

    return new Promise((resolve) => {
      if (!this.db) {
        resolve();
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      store.delete(sanitizedKey);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  }

  async downloadAndCache(
    uri: string,
    key: string,
    expiresIn?: number
  ): Promise<string | null> {
    try {
      const response = await fetch(uri);
      if (!response.ok) return null;

      const blob = await response.blob();
      return await this.saveImage(key, blob, expiresIn);
    } catch (error) {
      console.error("Error downloading image:", error);
      return null;
    }
  }
}

export const webCache = new WebImageCache();
