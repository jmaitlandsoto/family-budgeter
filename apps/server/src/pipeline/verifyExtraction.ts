import { TypeSafeClient, noul, AuthenticationError, PermissionDeniedError, APIConnectionError } from "@typesafe-ai/sdk";
import { config } from "../config.js";
import { PipelineError } from "../errors.js";
import type { Transaction } from "../types.js";

const client = new TypeSafeClient({ apiKey: config.typesafeApiKey });

const CONCURRENCY = 20;
const PLAUSIBILITY_THRESHOLD = 0.5;

export async function verifyExtraction(transactions: Transaction[]): Promise<string[]> {
  const warnings: string[] = [];

  for (let i = 0; i < transactions.length; i += CONCURRENCY) {
    const batch = transactions.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(verifyOne));
    for (const warning of batchResults) {
      if (warning) warnings.push(warning);
    }
  }

  return warnings;
}

async function verifyOne(tx: Transaction): Promise<string | null> {
  try {
    const { answers } = await client.systemOne({
      state: { date: tx.date, description: tx.description, amount: tx.amount },
      questions: {
        plausible: noul(
          "This is a real, correctly-extracted bank transaction line item — not OCR garbage, not a table header/footer/subtotal/balance row mistaken for a transaction, and not a hallucinated entry. " +
            "`date` is a well-formed, plausible calendar date for a bank statement line. " +
            "`description` reads like an actual merchant, payee, or transfer counterparty (not a column label such as 'Date' or 'Description', not a summary/boundary label such as 'Subtotal', 'Total', 'Balance', 'Opening Balance', 'Closing Balance', 'Continued', or garbled/nonsensical text). " +
            "`amount` is a sensible value for a single transaction, not an implausible magnitude suggestive of a running balance or statement total rather than one purchase or transfer.",
          {
            true: "date, description, and amount are all consistent with a single genuine transaction line",
            false: "at least one field looks like OCR noise, a non-transaction row (header, footer, subtotal, balance line), or a fabricated/implausible entry",
          },
        ),
      },
    });

    if (answers.plausible.noul < PLAUSIBILITY_THRESHOLD) {
      const confidencePct = Math.round(answers.plausible.noul * 100);
      return `Possible extraction error: "${tx.description}" on ${tx.date} for ${tx.amount} looks implausible (${confidencePct}% confidence it's a real transaction) — please double-check this entry.`;
    }
    return null;
  } catch (err) {
    // Systemic failures (bad key, no access, can't reach the service) should abort the
    // whole session rather than silently skip verification for every transaction.
    if (err instanceof AuthenticationError || err instanceof PermissionDeniedError || err instanceof APIConnectionError) {
      throw new PipelineError("verification", `TypeSafe verification is unavailable: ${(err as Error).message}`, { cause: err });
    }
    // A single item that fails to verify is treated as unverifiable, not implausible —
    // never let a verification hiccup suppress a real transaction or abort the batch.
    return null;
  }
}
