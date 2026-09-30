/**
 * Single source of truth for budget categories.
 * Consumed by categorize.ts (TypeSafe choice criteria) and aggregate.ts (row order).
 * Edit this list to change categories everywhere at once.
 */
export const CATEGORY_DEFINITIONS = [
  { name: "Income", description: "Salary, wages, or other regular earnings arriving in the account." },
  { name: "Transfers", description: "Money moved between the user's own accounts, or to/from a person, not a purchase." },
  { name: "Groceries", description: "Supermarkets and grocery stores." },
  { name: "Dining", description: "Restaurants, cafes, bars, and food delivery." },
  { name: "Transport", description: "Fuel, public transit, rideshare, parking, and vehicle maintenance." },
  { name: "Utilities", description: "Electricity, gas, water, internet, and phone bills." },
  { name: "Rent/Mortgage", description: "Housing payments." },
  { name: "Subscriptions", description: "Recurring software, streaming, and membership charges." },
  { name: "Entertainment", description: "Movies, events, hobbies, and leisure activities." },
  { name: "Healthcare", description: "Doctors, pharmacies, and medical expenses." },
  { name: "Insurance", description: "Insurance premiums of any kind." },
  { name: "Shopping", description: "Retail purchases not covered by another category." },
  { name: "Travel", description: "Flights, hotels, and trip-related expenses." },
  { name: "Other", description: "Anything that doesn't clearly fit another category." },
] as const;

export const CATEGORIES = CATEGORY_DEFINITIONS.map((c) => c.name);

export type Category = (typeof CATEGORY_DEFINITIONS)[number]["name"];

export const DEFAULT_CATEGORY: Category = "Other";

/** TypeSafe `choice()` criteria derived from the category definitions above. */
export const CATEGORY_CRITERIA: Record<Category, string> = Object.fromEntries(
  CATEGORY_DEFINITIONS.map((c) => [c.name, c.description]),
) as Record<Category, string>;
