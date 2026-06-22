/**
 * Persistence with two interchangeable backends behind one async API:
 *
 *   - Upstash Redis  — used in production / on Vercel (serverless-safe).
 *                      Enabled when UPSTASH_REDIS_REST_URL + _TOKEN (or the
 *                      Vercel KV equivalents KV_REST_API_URL/_TOKEN) are set.
 *   - JSON file      — local dev fallback (./data/store.json), so the app
 *                      runs on localhost with no Redis creds.
 *
 * Holds:
 *   - cards          : slug → ReceiptCard
 *   - recent_by_handle: handle → slug (dedupe re-generations)
 *   - ticket_counter : monotonically increasing receipt number
 *   - print_jobs     : id → PrintJob (+ an ordered queue for FIFO claim)
 *
 * All exported functions are async so the backend can be swapped freely.
 */

import path from "node:path";
import fs from "node:fs";
import { Redis } from "@upstash/redis";
import type { PrintJob, ReceiptCard } from "./types";

// ---------------------------------------------------------------------------
// Backend selection
// ---------------------------------------------------------------------------

function makeRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = makeRedis();

const K = {
  card: (slug: string) => `card:${slug}`,
  handle: (handle: string) => `handle:${handle.toLowerCase()}`,
  job: (id: string) => `job:${id}`,
  ticket: "ticket_counter",
  queue: "print_jobs",
  cardIndex: "card_index",
};

// ---------------------------------------------------------------------------
// File backend (local dev fallback)
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

type StoreShape = {
  cards: Record<string, ReceiptCard>;
  recent_by_handle: Record<string, string>;
  ticket_counter: number;
  print_jobs: Record<string, PrintJob>;
};

declare global {
  var __stanleyReceiptsStore: StoreShape | undefined;
}

function fileRead(): StoreShape {
  if (globalThis.__stanleyReceiptsStore) return globalThis.__stanleyReceiptsStore;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(STORE_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(STORE_FILE, "utf8")) as Partial<StoreShape>;
      const store: StoreShape = {
        cards: parsed.cards ?? {},
        recent_by_handle: parsed.recent_by_handle ?? {},
        ticket_counter: parsed.ticket_counter ?? 0,
        print_jobs: parsed.print_jobs ?? {},
      };
      globalThis.__stanleyReceiptsStore = store;
      return store;
    } catch {
      /* fall through to fresh */
    }
  }
  const fresh: StoreShape = { cards: {}, recent_by_handle: {}, ticket_counter: 0, print_jobs: {} };
  globalThis.__stanleyReceiptsStore = fresh;
  return fresh;
}

function fileFlush(): void {
  if (!globalThis.__stanleyReceiptsStore) return;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = STORE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(globalThis.__stanleyReceiptsStore, null, 2));
  fs.renameSync(tmp, STORE_FILE);
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export async function nextTicket(): Promise<number> {
  if (redis) return await redis.incr(K.ticket);
  const s = fileRead();
  s.ticket_counter += 1;
  fileFlush();
  return s.ticket_counter;
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export async function saveCard(card: ReceiptCard): Promise<void> {
  if (redis) {
    await redis.set(K.card(card.slug), card);
    await redis.set(K.handle(card.instagram_handle), card.slug);
    await redis.zadd(K.cardIndex, { score: Date.now(), member: card.slug });
    return;
  }
  const s = fileRead();
  s.cards[card.slug] = card;
  s.recent_by_handle[card.instagram_handle.toLowerCase()] = card.slug;
  fileFlush();
}

export async function getCard(slug: string): Promise<ReceiptCard | null> {
  if (redis) return (await redis.get<ReceiptCard>(K.card(slug))) ?? null;
  return fileRead().cards[slug] ?? null;
}

/**
 * Latest stored card for a handle, ignoring age. Used so a pre-warmed
 * (pinned) creator always gets their ready-made card instantly.
 */
export async function getCardForHandle(handle: string): Promise<ReceiptCard | null> {
  if (redis) {
    const slug = await redis.get<string>(K.handle(handle));
    if (!slug) return null;
    return await getCard(slug);
  }
  const s = fileRead();
  const slug = s.recent_by_handle[handle.toLowerCase()];
  return slug ? s.cards[slug] ?? null : null;
}

export async function getRecentCardForHandle(
  handle: string,
  maxAgeMs: number,
): Promise<ReceiptCard | null> {
  const card = await getCardForHandle(handle);
  if (!card) return null;
  if (Date.now() - new Date(card.generated_at).getTime() > maxAgeMs) return null;
  return card;
}

export async function listCards(): Promise<ReceiptCard[]> {
  if (redis) {
    const slugs = (await redis.zrange<string[]>(K.cardIndex, 0, -1, { rev: true })) ?? [];
    const cards: ReceiptCard[] = [];
    for (const slug of slugs) {
      const card = await getCard(slug);
      if (card) cards.push(card);
    }
    return cards;
  }
  return Object.values(fileRead().cards).sort(
    (a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime(),
  );
}

// ---------------------------------------------------------------------------
// Print queue
// ---------------------------------------------------------------------------

// Print jobs (and their inlined PNG snapshots) are bounded with a TTL in
// Redis so a long event doesn't accumulate large image payloads forever.
const JOB_TTL_SECONDS = 6 * 60 * 60;

export async function enqueuePrintJob(
  slug: string,
  id: string,
  image?: string,
): Promise<PrintJob> {
  const now = new Date().toISOString();
  const job: PrintJob = { id, slug, status: "queued", created_at: now, updated_at: now };
  if (image) job.image = image;
  if (redis) {
    await redis.set(K.job(id), job, { ex: JOB_TTL_SECONDS });
    await redis.zadd(K.queue, { score: Date.now(), member: id });
    return job;
  }
  const s = fileRead();
  s.print_jobs[id] = job;
  fileFlush();
  return job;
}

export async function claimNextPrintJob(): Promise<PrintJob | null> {
  if (redis) {
    const ids = (await redis.zrange<string[]>(K.queue, 0, -1)) ?? []; // oldest first
    for (const id of ids) {
      const job = await redis.get<PrintJob>(K.job(id));
      if (!job) {
        await redis.zrem(K.queue, id);
        continue;
      }
      if (job.status === "queued") {
        job.status = "printing";
        job.updated_at = new Date().toISOString();
        await redis.set(K.job(id), job, { ex: JOB_TTL_SECONDS });
        await redis.zrem(K.queue, id); // out of the pending queue once claimed
        return job;
      }
    }
    return null;
  }
  const s = fileRead();
  const queued = Object.values(s.print_jobs)
    .filter((j) => j.status === "queued")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const job = queued[0];
  if (!job) return null;
  job.status = "printing";
  job.updated_at = new Date().toISOString();
  fileFlush();
  return job;
}

export async function updatePrintJob(
  id: string,
  status: PrintJob["status"],
  error?: string,
): Promise<PrintJob | null> {
  if (redis) {
    const job = await redis.get<PrintJob>(K.job(id));
    if (!job) return null;
    job.status = status;
    job.updated_at = new Date().toISOString();
    if (error) job.error = error;
    await redis.set(K.job(id), job, { ex: JOB_TTL_SECONDS });
    return job;
  }
  const s = fileRead();
  const job = s.print_jobs[id];
  if (!job) return null;
  job.status = status;
  job.updated_at = new Date().toISOString();
  if (error) job.error = error;
  fileFlush();
  return job;
}

export async function getPrintJob(id: string): Promise<PrintJob | null> {
  if (redis) return (await redis.get<PrintJob>(K.job(id))) ?? null;
  return fileRead().print_jobs[id] ?? null;
}
