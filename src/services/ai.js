import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { getToday, getKolkataDateParts } from "../utils/date.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Entertainment",
  "Health",
  "Education",
  "Travel",
  "Rent",
  "Subscriptions",
  "Salary",
  "Freelance",
  "Investment",
  "Other",
];

const PRIMARY_MODEL = "gemini-3.5-flash-lite";
const BACKUP_MODEL = "gemini-3.5-flash";

// ========================================
// Gemini API Call with Fallback and Retry
// ========================================

async function generateContentWithRetry(options) {
  const models = [PRIMARY_MODEL, BACKUP_MODEL];

  for (const model of models) {
    try {
      return await ai.models.generateContent({
        ...options,
        model,
      });
    } catch (error) {
      console.warn(`Model ${model} call encountered error: ${error.message}. Checking alternative...`);
      // If last model in list, re-throw to trigger fallback
      if (model === models[models.length - 1]) {
        throw error;
      }
    }
  }
}

// ========================================
// JSON Extraction Helper
// ========================================

function extractJson(text) {
  let cleaned = text.trim();
  // Remove markdown code fences if present
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/i, "").replace(/```$/, "").trim();
  }

  // Find opening and closing brackets if there is any surrounding text
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  return JSON.parse(cleaned);
}

// ========================================
// Fallback Rule-Based Intent Classifier (Safety Net)
// ========================================

function fallbackIntentClassification(message) {
  const lower = message.toLowerCase();
  if (lower.includes("budget")) return { intent: "budget" };
  if (lower.includes("recurring") || lower.includes("subscription") || lower.includes("netflix") || lower.includes("rent of")) {
    return { intent: "recurring" };
  }
  if (
    message.includes("?") ||
    lower.includes("how much") ||
    lower.includes("what did") ||
    lower.includes("show") ||
    lower.includes("list") ||
    lower.includes("biggest") ||
    lower.includes("largest") ||
    lower.includes("dashboard") ||
    lower.includes("summary")
  ) {
    return { intent: "finance_query" };
  }
  if (
    lower.includes("spent") ||
    lower.includes("earned") ||
    lower.includes("paid") ||
    lower.includes("bought") ||
    lower.includes("salary") ||
    /₹|\b(rs|inr)\b|\d+\s*(on|for|at)/i.test(message)
  ) {
    return { intent: "add_transaction" };
  }
  return { intent: "unknown" };
}

// ========================================
// Phase 1: Intent Classification
// ========================================

/**
 * Classifies high-level user intent using Gemini.
 * Returns ONLY valid JSON:
 * { "intent": "add_transaction" | "finance_query" | "budget" | "recurring" | "unknown" }
 *
 * @param {string} message
 * @returns {Promise<{ intent: "add_transaction" | "finance_query" | "budget" | "recurring" | "unknown" }>}
 */
export async function classifyFinanceIntent(message) {
  try {
    const response = await generateContentWithRetry({
      contents: `
You are an intent classification system for an AI Personal Finance Bot.

Classify the user's message into EXACTLY ONE of these intents:
1. "add_transaction" — User is recording money spent or received, or setting starting/opening account balance (e.g. "I spent ₹500 on dinner", "I earned ₹50,000 salary", "I currently have 20000 in my account", "Starting balance 20000", "Paid 200 for tea", "Received ₹5000 cashback").
2. "finance_query" — User is asking about their financial history, summaries, transactions, largest expense, or reports (e.g. "How much did I spend this month?", "Show my transactions", "What was my biggest expense?", "Financial dashboard", "Expenses yesterday", "Spending on food").
3. "budget" — User wants to set a budget, check budget status, or ask about remaining budget (e.g. "Set my food budget to ₹5,000", "How much of my food budget is left?", "Am I over my food budget?", "Show my budgets").
4. "recurring" — User wants to add, view, or remove a recurring transaction/subscription (e.g. "Set my Netflix subscription to ₹649 monthly", "Add recurring rent of ₹20,000", "Show my recurring expenses", "Remove my Netflix recurring expense").
5. "unknown" — General greetings, chit-chat, or irrelevant messages (e.g. "Hello", "Good morning", "Who are you?", "Help", "Thanks").

Return ONLY valid JSON.
Do NOT parse amounts, dates, or details.
Do NOT use markdown code fences.

JSON format:
{
  "intent": "add_transaction" | "finance_query" | "budget" | "recurring" | "unknown"
}

User message:
${message}
`,
    });

    const parsed = extractJson(response.text);
    if (!parsed || !parsed.intent) {
      return fallbackIntentClassification(message);
    }
    return parsed;
  } catch (error) {
    console.error("classifyFinanceIntent fallback triggered:", error.message);
    return fallbackIntentClassification(message);
  }
}

// ========================================
// Transaction Message Parser
// ========================================

export async function analyzeFinanceMessage(message) {
  const today = getToday();

  const response = await generateContentWithRetry({
    contents: `
You are a financial transaction parser.

Today's date is: ${today} (Asia/Kolkata)

Analyze the user's message and extract financial information.

Return ONLY valid JSON.

The JSON must have exactly these fields:

{
  "type": "expense" | "income" | "unknown",
  "amount": number | null,
  "currency": "INR" | null,
  "category": string | null,
  "description": string | null,
  "date": "YYYY-MM-DD" | null
}

Allowed categories:
${CATEGORIES.join(", ")}

Rules:
1. "expense" means money spent.
2. "income" means money received, earned, or opening/starting funds in an account (e.g. "I currently have 20000 in my account", "Starting balance ₹20,000", "Added 5000 to bank").
3. If the amount cannot be identified, use null.
4. If the currency is not specified, assume INR.
5. If the user does not mention a date, ALWAYS use today's date: ${today}.
6. If the user says "today", use today's date: ${today}.
7. If the user says "yesterday", calculate yesterday's date relative to ${today}.
8. Convert explicit dates to YYYY-MM-DD.
9. Never return null for date when the message represents a valid transaction.
10. Choose ONLY one category from the allowed categories.
11. Map dinner, lunch, restaurant, groceries to "Food".
12. Map Uber, taxi, cab, metro, petrol, fuel to "Transport".
13. Map electricity, water, internet, mobile bills to "Bills".
14. Map clothes, shoes, electronics, online shopping to "Shopping".
15. Map Netflix, Spotify, gym to "Subscriptions".
16. Map salary to "Salary".
17. Map freelance earnings to "Freelance".
18. Map doctor, hospital, medicines to "Health".
19. Map house rent to "Rent".
20. Map mutual funds, stocks, shares to "Investment".
21. If the user mentions starting/current account balance (e.g. "I have 20000 in my account"), set type to "income", category to "Other", and description to "Opening balance".
22. If no category reasonably matches, use "Other".
23. Do not invent financial information.
24. Return JSON only. Do not use markdown code fences.

User message:
${message}
`,
  });

  const text = response.text.trim();
  try {
    return extractJson(text);
  } catch (error) {
    console.error("Invalid transaction JSON returned by Gemini:", text);
    throw new Error("Gemini returned invalid financial data.");
  }
}

// ========================================
// Phase 4: Natural Language Query Parser
// ========================================

export async function analyzeFinanceQuery(message) {
  const today = getToday();
  const { weekday } = getKolkataDateParts();

  const response = await generateContentWithRetry({
    contents: `
You are an advanced financial query parser.
Today's date is: ${today} (Asia/Kolkata).
Current day of week is: ${weekday}.

Analyze the user's finance question and return ONLY valid JSON.

The JSON structure:
{
  "intent": "summary" | "transactions" | "category" | "largest_expense" | "income" | "dashboard",
  "dateType": "preset" | "last_n_days" | "day_of_week" | "days_ago" | "date_range" | "exact_date",
  "period": "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | null,
  "days": number | null,
  "dayOfWeek": "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday" | null,
  "startDate": "YYYY-MM-DD" | null,
  "endDate": "YYYY-MM-DD" | null,
  "exactDate": "YYYY-MM-DD" | null,
  "category": string | null
}

Allowed categories:
${CATEGORIES.join(", ")}

RULES FOR INTENT:
1. If the user asks for a dashboard, full financial review, or breakdown:
   intent = "dashboard"
2. If the user asks how much they spent or general spending summary:
   intent = "summary"
3. If the user asks how much they earned or income:
   intent = "income"
4. If the user asks specifically about spending in a category (e.g. food, shopping, travel):
   intent = "category"
5. If the user asks to show, list, or display transactions / expenses:
   intent = "transactions"
6. If the user asks for biggest / largest expense:
   intent = "largest_expense"

RULES FOR DATE UNDERSTANDING:
7. "last 7 days" or "past 7 days" -> dateType: "last_n_days", days: 7
8. "last 30 days" -> dateType: "last_n_days", days: 30
9. "on Monday", "on Friday", "what did I spend on Wednesday" -> dateType: "day_of_week", dayOfWeek: "monday" (or friday, etc.)
10. "two days ago", "3 days ago" -> dateType: "days_ago", days: 2
11. Explicit date range like "from 1 September to 15 September" or "between September 1 and September 15" ->
    dateType: "date_range", startDate: "2026-09-01", endDate: "2026-09-15" (use current year 2026 unless stated)
12. Specific date like "on 15 September" -> dateType: "exact_date", exactDate: "2026-09-15"
13. Presets:
    "today" -> dateType: "preset", period: "today"
    "yesterday" -> dateType: "preset", period: "yesterday"
    "this week" -> dateType: "preset", period: "this_week"
    "last week" -> dateType: "preset", period: "last_week"
    "this month" -> dateType: "preset", period: "this_month"
    "last month" -> dateType: "preset", period: "last_month"
14. If no date is mentioned, default to: dateType: "preset", period: "this_month".

RULES FOR CATEGORY:
15. Map food, dinner, lunch, groceries -> "Food"
16. Map uber, taxi, cab, petrol, fuel -> "Transport"
17. Map electricity, water, wifi, bills -> "Bills"
18. Map shopping, clothes, amazon -> "Shopping"
19. Map movie, netflix, outing -> "Entertainment"
20. Map doctor, medicine, hospital -> "Health"
21. Map rent -> "Rent"
22. Map salary -> "Salary"
23. Map freelance -> "Freelance"
24. Map investment, stocks -> "Investment"
25. If no specific category is queried, category = null.

Return ONLY valid JSON. Do not use markdown code fences.

User question:
${message}
`,
  });

  const text = response.text.trim();
  try {
    return extractJson(text);
  } catch (error) {
    console.error("Invalid query JSON returned by Gemini:", text);
    throw new Error("Gemini returned invalid query data.");
  }
}

// ========================================
// Phase 5: Budget Intent Parser
// ========================================

/**
 * Parses budget commands and inquiries.
 * @param {string} message
 * @returns {Promise<{ action: "set" | "check" | "list", category: string | null, amount: number | null, period: string }>}
 */
export async function analyzeBudgetIntent(message) {
  const response = await generateContentWithRetry({
    contents: `
You are a budget command parser.

Analyze the user's budget request and return ONLY valid JSON.

Allowed categories:
${CATEGORIES.join(", ")}

JSON structure:
{
  "action": "set" | "check" | "list",
  "category": string | null,
  "amount": number | null,
  "period": "monthly" | "weekly" | "yearly"
}

Rules:
1. If the user wants to set, create, or update a budget:
   action = "set"
   Extract the category (from allowed categories, e.g. Food, Shopping) and numeric amount.
   Default period is "monthly" unless weekly/yearly is mentioned.
2. If the user asks how much budget is left, how much they used, or if they are over budget:
   action = "check"
   Extract the category.
3. If the user asks to show or view all budgets:
   action = "list"
4. Map categories: food/groceries -> "Food", clothes/shopping -> "Shopping", etc.
5. Return ONLY valid JSON. Do not use markdown fences.

User message:
${message}
`,
  });

  const text = response.text.trim();
  try {
    return extractJson(text);
  } catch (error) {
    console.error("Invalid budget JSON returned by Gemini:", text);
    throw new Error("Could not parse budget instruction.");
  }
}

// ========================================
// Phase 6: Recurring Expense Parser
// ========================================

/**
 * Parses recurring transaction commands.
 * @param {string} message
 * @returns {Promise<{ action: "add" | "list" | "remove", description: string | null, amount: number | null, frequency: string, category: string | null }>}
 */
export async function analyzeRecurringIntent(message) {
  const response = await generateContentWithRetry({
    contents: `
You are a recurring expense parser.

Analyze the user's recurring expense message and return ONLY valid JSON.

Allowed categories:
${CATEGORIES.join(", ")}

Allowed frequencies:
"daily" | "weekly" | "monthly" | "yearly"

JSON structure:
{
  "action": "add" | "list" | "remove",
  "description": string | null,
  "amount": number | null,
  "frequency": "daily" | "weekly" | "monthly" | "yearly",
  "category": string | null
}

Rules:
1. If the user wants to add/set a recurring expense or subscription:
   action = "add"
   Extract description (e.g. "Netflix subscription", "House rent", "Gym membership"), amount, frequency (default to "monthly"), and category (e.g. "Subscriptions", "Rent").
2. If the user asks to see or list recurring expenses:
   action = "list"
3. If the user asks to delete, cancel, or remove a recurring expense:
   action = "remove"
   Extract description (e.g. "Netflix").
4. Return ONLY valid JSON. Do not use markdown fences.

User message:
${message}
`,
  });

  const text = response.text.trim();
  try {
    return extractJson(text);
  } catch (error) {
    console.error("Invalid recurring JSON returned by Gemini:", text);
    throw new Error("Could not parse recurring expense instruction.");
  }
}
