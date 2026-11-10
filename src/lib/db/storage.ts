import {
  encodeValue,
  joinParts,
  partCount,
  partIndexOf,
  partKey,
  partOwner,
  partsComplete,
} from "./chunks";
import * as DB from "./db";
import * as Stream from "./stream";

/** IndexedDB storage provider */
// TODO: clean up indexeddb usage, convert to promises and double check error handling
export const indexeddb = (
  db: DB.Database,
  name: string,
): Promise<Stream.Stream<StorageError>> => {
  // Map idb errors to a standard format
  const mapError = (message: string, err: unknown): StorageError => {
    const cause =
      err instanceof Event &&
      err.target instanceof IDBRequest &&
      err.target.error instanceof Error
        ? err.target.error
        : undefined;
    return new StorageError(`IndexedDB: ${name}: ${message}`, { cause });
  };

  return new Promise((resolve, reject) => {
    const rejectError = (message: string) => (err: unknown) => {
      reject(mapError(message, err));
    };

    const open = indexedDB.open(name, 1);
    open.onerror = rejectError("Cannot open database");
    open.onupgradeneeded = () => {
      open.result.createObjectStore("changes");
    };
    open.onsuccess = () => {
      const conn = open.result;

      const trx = conn.transaction("changes", "readonly");
      trx.onerror = rejectError("Cannot read changes from store");

      const changes: DB.Change[] = [];
      const cursor = trx.objectStore("changes").openCursor();
      cursor.onsuccess = () => {
        if (cursor.result) {
          if (typeof cursor.result.key === "string")
            changes.push([cursor.result.key, cursor.result.value]);
          cursor.result.continue();
        } else {
          // Finished loading
          DB.atomic(db, (trx) => {
            changes.forEach(([key, val]) => DB.put(trx, key, val));
          });

          // Write
          const errors = Stream.init<StorageError>();
          DB.listen(
            db,
            batch((changes) => {
              if (DEV) console.log("Storage: saving changes:", changes);

              const trx = conn.transaction("changes", "readwrite");
              trx.oncomplete = () => {}; // nice
              trx.onerror = (error) =>
                Stream.publish(
                  errors,
                  mapError("Cannot write changes to store", error),
                );

              const store = trx.objectStore("changes");
              // TODO: iterator helpers
              for (const [key, val] of changes) {
                if (val === undefined) store.delete(key);
                else store.put(val, key);
              }
            }),
          );
          resolve(errors);
        }
      };
    };
  });
};

/** Web Extension storage provider */
export const extension = async (
  db: DB.Database,
  name: string,
  area: "local" | "sync" | "managed",
): Promise<Stream.Stream<StorageError>> => {
  // Map errors to a standard format
  const mapError = (message: string, err: unknown) =>
    new StorageError(`Extension[${area}]: ${name}: ${message}`, {
      cause: err instanceof Error ? err : undefined,
    });

  const storageArea = browser.storage[area];
  const prefix = `${name}/`;

  // How many items each logical key currently occupies, so that shrinking a
  // value can clear the parts it no longer needs.
  const partCounts = new Map<string, number>();

  // Pull
  await storageArea
    .get()
    .then((stored) => {
      const keys = Object.keys(stored).filter((key) => key.startsWith(prefix));

      // Collect the pieces of any split value first.
      const gathered = new Map<string, string[]>();
      for (const key of keys) {
        const logical = key.slice(prefix.length);
        const index = partIndexOf(logical);
        if (index === null) continue;

        const owner = partOwner(logical);
        const parts = gathered.get(owner) ?? [];
        parts[index] = stored[key];
        gathered.set(owner, parts);
      }

      for (const key of keys) {
        const logical = key.slice(prefix.length);
        if (partIndexOf(logical) !== null) continue;

        const count = partCount(stored[key]);
        if (count === 0) {
          DB.put(db, logical, stored[key]);
          continue;
        }

        // A value split over several items is only usable once every part is
        // present; a partially synced one is left out rather than half loaded.
        const parts = gathered.get(logical);
        partCounts.set(logical, count);
        if (!parts || !partsComplete(parts, count)) continue;

        try {
          DB.put(db, logical, joinParts(parts));
        } catch {
          // Unreadable payload: skip it instead of failing start up.
        }
      }
    })
    .catch((error) => {
      throw mapError("Cannot read from storage", error);
    });

  // Push
  const errors = Stream.init<StorageError>();
  const handleError = (message: string) => (err: unknown) => {
    Stream.publish(errors, mapError(message, err));
  };
  DB.listen(
    db,
    batch((changes) => {
      if (DEV) console.log("Storage: saving changes:", changes);

      const updates: Record<string, unknown> = {};
      const deletes: string[] = [];

      for (const [key, value] of changes) {
        const fullKey = `${prefix}${key}`;
        const previous = partCounts.get(key) ?? 0;

        if (value === undefined) {
          deletes.push(fullKey);
          for (let index = 0; index < previous; index += 1)
            deletes.push(partKey(fullKey, index));
          partCounts.delete(key);
          continue;
        }

        const encoded = encodeValue(fullKey, value);
        Object.assign(updates, encoded.updates);
        partCounts.set(key, encoded.count);

        // Clear parts left behind by a value that used to be larger.
        for (let index = encoded.count; index < previous; index += 1)
          deletes.push(partKey(fullKey, index));
      }

      storageArea
        .set(updates)
        .catch(handleError("Cannot write updates to storage"));
      storageArea
        .remove(deletes)
        .catch(handleError("Cannot write deletes to storage"));
    }),
  );

  return errors;
};

const batch = (
  flush: (batch: Iterable<DB.Change>) => void,
  timeout = 0,
): DB.Listener => {
  const changes = new Map();
  let timer: number | null = null;

  const run = () => {
    flush(changes);
    changes.clear();
    timer = null;
  };

  // If there are pending changes on browser close, flush immediately
  window.addEventListener("beforeunload", () => {
    if (timer) {
      clearTimeout(timer);
      run();
    }
  });

  return ([key, val]) => {
    changes.set(key, val);
    if (!timer) timer = setTimeout(run, timeout);
  };
};

/** Storage Error */
class StorageError extends Error {
  override name = "StorageError";
}
