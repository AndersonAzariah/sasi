"use client";

/* ============================================================
   SASI — offline data layer (IndexedDB snapshot of YOUR data)

   The offline shell (sw.js) reloads the app with no network, but
   the app's user data (cases, chat, notifications, evidence,
   location, briefing) lived only in SQLite + memory — an offline
   reload showed demo data with nothing of the user's work.

   This module keeps a small private snapshot of the user's data
   in the browser's IndexedDB ("sasi-offline" DB, single "kv"
   store). Every persistence point in the main store mirrors a
   write here (fire-and-forget, never blocks the UI), and hydrate
   reads the snapshot FIRST so an offline reload still shows the
   user's work. When the network returns, the server copy takes
   over again (hydrate merges server state over the snapshot).

   Honesty rules preserved:
   - Nothing here fabricates data; it only replays what the user
     actually created or received on this device.
   - The snapshot never leaves the device (no upload path).
   - Failures are silent — the demo degrades to in-memory state.
   ============================================================ */

const DB_NAME = "sasi-offline";
const DB_VERSION = 1;
const STORE = "kv";

/* ------------------------------------------------------------------
   One cached connection + a serialized write queue.

   An earlier draft opened a fresh connection per operation and
   closed it immediately; under real concurrency (hydrate mirroring
   notifications while the briefing warm-up mirrors the briefing)
   individual writes could silently lose the race. A single shared
   connection with a strict write queue removes the entire class of
   failure — writes commit in order, reads stay cheap, and a broken
   connection is re-opened once, transparently.
   ------------------------------------------------------------------ */
let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB unavailable"));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => {
        /* if the connection dies later (e.g. evicted), the next
           operation re-opens instead of failing forever */
        req.result.onclose = () => {
          dbPromise = null;
        };
        resolve(req.result);
      };
      req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    });
  }
  return dbPromise;
}

/* serialized write queue — every mutation waits for the previous one */
let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite<T>(op: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const run = writeQueue.then(() => getDb()).then(op);
  /* keep the queue alive even when an individual write fails */
  writeQueue = run.then(
    () => undefined,
    (err) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[sasi-offline] snapshot write failed:", err);
      }
    }
  );
  return run;
}

async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    await enqueueWrite(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE, "readwrite");
          tx.objectStore(STORE).put(value, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
          tx.onabort = () => reject(tx.error ?? new Error("IndexedDB write aborted"));
        })
    );
  } catch {
    /* storage blocked/full — the in-memory state still works */
  }
}

async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await getDb();
    const out = await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB read failed"));
    });
    return out;
  } catch {
    return null;
  }
}

async function idbDel(key: string): Promise<void> {
  try {
    await enqueueWrite(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE, "readwrite");
          tx.objectStore(STORE).delete(key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
        })
    );
  } catch {
    /* ignore */
  }
}

/* ---------- typed snapshot slices (loose shapes to avoid a store import cycle) ---------- */

export interface SnapshotCase {
  id: string;
  ref: string;
  title: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  [k: string]: unknown;
}

export interface SnapshotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: string;
  refs?: string[];
}

export interface SnapshotNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  at: string;
  read?: boolean;
  caseRef?: string;
  [k: string]: unknown;
}

export interface SnapshotLocation {
  province: string;
  city: string;
  suburb: string;
}

const MAX_CASES = 40;
const MAX_CHAT = 60;
const MAX_NOTIFICATIONS = 30;
const MAX_EVIDENCE = 24;

/* ---------- per-slice writers (called by the main store) ---------- */

export async function snapshotCase(c: SnapshotCase): Promise<void> {
  const list = (await idbGet<SnapshotCase[]>("cases")) ?? [];
  const next = [c, ...list.filter((x) => x.id !== c.id)].slice(0, MAX_CASES);
  await idbSet("cases", next);
  await touchMeta();
}

export async function snapshotEvidence(item: { id: string }): Promise<void> {
  const list = (await idbGet<{ id: string }[]>("evidence")) ?? [];
  const next = [item, ...list.filter((x) => x.id !== item.id)].slice(0, MAX_EVIDENCE);
  await idbSet("evidence", next);
  await touchMeta();
}

export async function snapshotChat(msgs: SnapshotMessage[]): Promise<void> {
  await idbSet("chat", msgs.slice(0, MAX_CHAT));
  await touchMeta();
}

export async function clearSnapshotChat(): Promise<void> {
  await idbDel("chat");
  await touchMeta();
}

export async function snapshotNotifications(list: SnapshotNotification[]): Promise<void> {
  await idbSet("notifications", list.slice(0, MAX_NOTIFICATIONS));
  await touchMeta();
}

export async function snapshotBriefing(b: unknown): Promise<void> {
  await idbSet("briefing", b);
  await touchMeta();
}

export async function snapshotLocation(loc: SnapshotLocation): Promise<void> {
  await idbSet("location", loc);
}

/* ---------- metadata for the Settings "on this device" card ---------- */

export interface OfflineSnapshotInfo {
  cases: number;
  chat: number;
  notifications: number;
  evidence: number;
  briefing: boolean;
  savedAt: string | null;
}

async function touchMeta() {
  await idbSet("meta", { at: new Date().toISOString() });
}

export async function offlineSnapshotInfo(): Promise<OfflineSnapshotInfo> {
  const [cases, chat, notifications, evidence, briefing, meta] = await Promise.all([
    idbGet<SnapshotCase[]>("cases"),
    idbGet<SnapshotMessage[]>("chat"),
    idbGet<SnapshotNotification[]>("notifications"),
    idbGet<{ id: string }[]>("evidence"),
    idbGet<unknown>("briefing"),
    idbGet<{ at?: string }>("meta"),
  ]);
  return {
    cases: cases?.length ?? 0,
    chat: chat?.length ?? 0,
    notifications: notifications?.length ?? 0,
    evidence: evidence?.length ?? 0,
    briefing: Boolean(briefing),
    savedAt: meta?.at ?? null,
  };
}

/** full snapshot read used by hydrate (single DB open per slice is fine at this scale) */
export async function readSnapshot() {
  const [cases, chat, notifications, evidence, location, briefing] = await Promise.all([
    idbGet<SnapshotCase[]>("cases"),
    idbGet<SnapshotMessage[]>("chat"),
    idbGet<SnapshotNotification[]>("notifications"),
    idbGet<{ id: string; [k: string]: unknown }[]>("evidence"),
    idbGet<SnapshotLocation>("location"),
    idbGet<unknown>("briefing"),
  ]);
  return { cases, chat, notifications, evidence, location, briefing };
}
