import { supabase } from "../database/supabase.js";
import { formatCurrency, getCategoryEmoji } from "../utils/format.js";
import { formatDisplayDate, getToday } from "../utils/date.js";

// ========================================
// Calculate Next Occurrence
// ========================================

/**
 * Calculates the next occurrence date formatted as YYYY-MM-DD in UTC/Asia/Kolkata
 * @param {string} frequency - 'daily' | 'weekly' | 'monthly' | 'yearly'
 * @param {string} [fromDateStr] - base date 'YYYY-MM-DD'
 * @returns {string}
 */
export function calculateNextOccurrence(frequency = "monthly", fromDateStr = null) {
  const base = fromDateStr ? fromDateStr : getToday();
  const [year, month, day] = base.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  switch (frequency.toLowerCase()) {
    case "daily":
      date.setUTCDate(date.getUTCDate() + 1);
      break;
    case "weekly":
      date.setUTCDate(date.getUTCDate() + 7);
      break;
    case "monthly":
      date.setUTCMonth(date.getUTCMonth() + 1);
      break;
    case "yearly":
      date.setUTCFullYear(date.getUTCFullYear() + 1);
      break;
    default:
      date.setUTCMonth(date.getUTCMonth() + 1);
      break;
  }

  return date.toISOString().split("T")[0];
}

// ========================================
// Add Recurring Expense
// ========================================

export async function addRecurringExpense(userId, {
  description,
  amount,
  category = "Subscriptions",
  frequency = "monthly",
  startDate = null,
  currency = "INR",
}) {
  const nextOccurrence = calculateNextOccurrence(frequency, startDate || getToday());

  const { data, error } = await supabase
    .from("recurring_expenses")
    .insert({
      user_id: userId,
      description,
      amount,
      category,
      frequency: frequency.toLowerCase(),
      next_occurrence: nextOccurrence,
      is_active: true,
      currency,
    })
    .select()
    .single();

  if (error) {
    console.error("Supabase insert recurring expense error:", error);
    if (error.message && error.message.includes("does not exist") || error.code === "42P01") {
      throw new Error("The 'recurring_expenses' table does not exist in your database yet. Please run src/database/migrations.sql in Supabase SQL Editor.");
    }
    throw new Error("Could not save recurring expense.");
  }

  return data;
}

// ========================================
// Get Recurring Expenses
// ========================================

export async function getUserRecurringExpenses(userId, onlyActive = true) {
  let query = supabase
    .from("recurring_expenses")
    .select("*")
    .eq("user_id", userId);

  if (onlyActive) {
    query = query.eq("is_active", true);
  }

  query = query.order("next_occurrence", { ascending: true });

  const { data, error } = await query;

  if (error) {
    console.error("Supabase get recurring expenses error:", error);
    if (error.message && error.message.includes("does not exist") || error.code === "42P01") {
      throw new Error("The 'recurring_expenses' table does not exist in your database yet. Please run src/database/migrations.sql in Supabase SQL Editor.");
    }
    throw new Error("Could not retrieve recurring expenses.");
  }

  return data || [];
}

// ========================================
// Remove / Deactivate Recurring Expense
// ========================================

export async function removeRecurringExpense(userId, descriptionQuery) {
  const normalized = descriptionQuery.toLowerCase().trim();

  // Find matching active recurring expenses
  const allActive = await getUserRecurringExpenses(userId, true);
  const match = allActive.find((item) =>
    item.description.toLowerCase().includes(normalized) ||
    normalized.includes(item.description.toLowerCase())
  );

  if (!match) {
    return null;
  }

  // Deactivate
  const { data, error } = await supabase
    .from("recurring_expenses")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", match.id)
    .select()
    .single();

  if (error) {
    console.error("Supabase deactivate recurring error:", error);
    throw new Error("Could not remove recurring expense.");
  }

  return data;
}

// ========================================
// Format Recurring Expenses List
// ========================================

export function formatRecurringExpensesList(items) {
  if (!items || items.length === 0) {
    return "📭 You don't have any recurring expenses set up.\n\nExample: \"Set my Netflix subscription to ₹649 monthly\"";
  }

  let message = `🔄 Recurring Expenses\n\n`;
  message += `━━━━━━━━━━━━━━\n\n`;

  const blocks = items.map((item) => {
    const emoji = getCategoryEmoji(item.category);
    let block = `${emoji} ${item.description}\n`;
    block += `💸 Amount: ${formatCurrency(item.amount)} (${item.frequency})\n`;
    block += `📂 Category: ${item.category}\n`;
    block += `📅 Next Due: ${formatDisplayDate(item.next_occurrence)}`;
    return block;
  });

  message += blocks.join("\n\n━━━━━━━━━━━━━━\n\n");
  return message;
}
