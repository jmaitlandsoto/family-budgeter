import { CATEGORIES } from "../categories.js";
import type { AggregateResult, CategorizedTransaction } from "../types.js";

export function aggregate(transactions: CategorizedTransaction[]): AggregateResult {
  const totalsByCategory = new Map<string, { total: number; count: number }>();

  let totalIncome = 0;
  let totalExpenses = 0;

  for (const tx of transactions) {
    const entry = totalsByCategory.get(tx.category) ?? { total: 0, count: 0 };
    entry.total += tx.amount;
    entry.count += 1;
    totalsByCategory.set(tx.category, entry);

    if (tx.amount >= 0) {
      totalIncome += tx.amount;
    } else {
      totalExpenses += tx.amount;
    }
  }

  // Order by the canonical category list so the sheet reads the same way every session;
  // any category the model returned that isn't in CATEGORIES (shouldn't happen, but the
  // choice() answer type is technically just `string & keyof criteria`) is appended at the end.
  const orderedNames = [...CATEGORIES, ...[...totalsByCategory.keys()].filter((name) => !CATEGORIES.includes(name as never))];

  const categoryTotals = orderedNames
    .filter((name) => totalsByCategory.has(name))
    .map((name) => {
      const entry = totalsByCategory.get(name)!;
      return { category: name, total: entry.total, count: entry.count };
    });

  return {
    categoryTotals,
    totalIncome,
    totalExpenses,
    net: totalIncome + totalExpenses,
  };
}
