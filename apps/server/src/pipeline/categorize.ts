import { TypeSafeClient, choice, AuthenticationError, PermissionDeniedError, APIConnectionError } from "@typesafe-ai/sdk";
import { config } from "../config.js";
import { CATEGORY_CRITERIA, DEFAULT_CATEGORY } from "../categories.js";
import { PipelineError } from "../errors.js";
import type { Transaction, CategorizedTransaction, TypeSafeStageUsage } from "../types.js";

const client = new TypeSafeClient({ apiKey: config.typesafeApiKey });

const CONCURRENCY = 20;

export interface CategorizeOutcome {
  transactions: CategorizedTransaction[];
  usage: TypeSafeStageUsage;
}

export async function categorizeTransactions(
  transactions: Transaction[],
  onProgress?: (index: number, category: string) => void,
): Promise<CategorizeOutcome> {
  const results: CategorizedTransaction[] = new Array(transactions.length);
  const usage: TypeSafeStageUsage = { calls: 0, inputTokens: 0, outputTokens: 0 };

  for (let i = 0; i < transactions.length; i += CONCURRENCY) {
    const batch = transactions.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((tx, offset) =>
        categorizeOne(tx, usage).then((result) => {
          onProgress?.(i + offset, result.category);
          return result;
        }),
      ),
    );
    batchResults.forEach((result, offset) => {
      results[i + offset] = result;
    });
  }

  return { transactions: results, usage };
}

async function categorizeOne(tx: Transaction, usage: TypeSafeStageUsage): Promise<CategorizedTransaction> {
  try {
    const { answers, usage: callUsage } = await client.systemOne({
      state: { description: tx.description, amount: tx.amount, date: tx.date },
      questions: {
        category: choice(
          "Classify this bank transaction into the single best budget category. A negative amount is money leaving the account (an expense or transfer out); a positive amount is money arriving (income, a refund, or a transfer in).",
          CATEGORY_CRITERIA,
        ),
      },
    });
    usage.calls += 1;
    usage.inputTokens += callUsage.input_tokens;
    usage.outputTokens += callUsage.output_tokens;
    return { ...tx, category: answers.category.choice };
  } catch (err) {
    // Systemic failures (bad key, no access, can't reach the service) should abort the
    // whole session rather than silently mislabel every transaction "Other".
    if (err instanceof AuthenticationError || err instanceof PermissionDeniedError || err instanceof APIConnectionError) {
      throw new PipelineError("categorization", `TypeSafe categorization is unavailable: ${(err as Error).message}`, { cause: err });
    }
    // A single bad/rate-limited item shouldn't abort the batch.
    return { ...tx, category: DEFAULT_CATEGORY };
  }
}
