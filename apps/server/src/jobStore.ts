import { randomUUID } from "node:crypto";
import type { AggregateResult, CategorizedTransaction } from "./types.js";

// Deliberate, narrow exception to this repo's "nothing is retained after the
// response" rule (see CLAUDE.md): the streamed /upload run no longer writes
// to Sheets itself, so the categorized transactions have to live somewhere
// between "processing finished" and the user clicking "Export to Google
// Drive." This is an in-memory map, cleared on successful export or after
// TTL_MS — nothing is ever persisted to disk or a database.
//
// Known limitation: this assumes a single Fastify/Cloud Run instance. If the
// service ever scales to multiple concurrent instances, an /export call can
// land on an instance that never saw the matching /upload run and get a
// spurious 404. Fine at this app's (two-person household) scale; the real
// fix would be a shared store (e.g. Redis/Firestore) or session affinity.

interface JobRecord {
  categorized: CategorizedTransaction[];
  result: AggregateResult;
  createdAt: number;
}

const TTL_MS = 30 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

const jobs = new Map<string, JobRecord>();

export function createJob(categorized: CategorizedTransaction[], result: AggregateResult): string {
  const jobId = randomUUID();
  jobs.set(jobId, { categorized, result, createdAt: Date.now() });
  return jobId;
}

export function getJob(jobId: string): JobRecord | undefined {
  return jobs.get(jobId);
}

export function deleteJob(jobId: string): void {
  jobs.delete(jobId);
}

setInterval(() => {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, record] of jobs) {
    if (record.createdAt < cutoff) jobs.delete(id);
  }
}, SWEEP_INTERVAL_MS).unref();
