import { supabase } from "../database/supabase.js";
import { formatCurrency, getCategoryEmoji } from "../utils/format.js";

// ========================================
// Threshold Constants
// ========================================

export const BUDGET_WARNING_THRESHOLD_PERCENT = 80;

// ========================================
// Set / Upsert Budget
// ========================================

/**
 * Creates or updates a budget for a given user, category, and period.
 * @param {number} userId
 * @param {{ category: string, amount: number, period?: string, currency?: string }} budgetData
 */
export async function setBudget(userId, { category, amount, period = "monthly", currency = "INR" }) {
  const { data, error } = await supabase
    .from("budgets")
    .upsert(
      {
        user_id: userId,
        category,
        amount,
        currency,
        period,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id, category, period" }
    )
    .select()
    .single();

  if (error) {
    console.error("Supabase budget upsert error:", error);
    if (error.message && error.message.includes("does not exist") || error.code === "42P01") {
      throw new Error("The 'budgets' table does not exist in your database yet. Please run src/database/migrations.sql in Supabase SQL Editor.");
    }
    throw new Error("Could not save budget.");
  }

  return data;
}

// ========================================
// Get Budget by Category
// ========================================

export async function getBudget(userId, category, period = "monthly") {
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("user_id", userId)
    .eq("category", category)
    .eq("period", period)
    .maybeSingle();

  if (error) {
    console.error("Supabase getBudget error:", error);
    if (error.message && error.message.includes("does not exist") || error.code === "42P01") {
      throw new Error("The 'budgets' table does not exist in your database yet. Please run src/database/migrations.sql in Supabase SQL Editor.");
    }
    throw new Error("Could not retrieve budget.");
  }

  return data;
}

// ========================================
// Get All Budgets for User
// ========================================

export async function getUserBudgets(userId, period = "monthly") {
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("user_id", userId)
    .eq("period", period)
    .order("category", { ascending: true });

  if (error) {
    console.error("Supabase getUserBudgets error:", error);
    if (error.message && error.message.includes("does not exist") || error.code === "42P01") {
      throw new Error("The 'budgets' table does not exist in your database yet. Please run src/database/migrations.sql in Supabase SQL Editor.");
    }
    throw new Error("Could not retrieve budgets.");
  }

  return data || [];
}

// ========================================
// Calculate Budget Status
// ========================================

export function calculateBudgetStatus(budget, currentSpending = 0) {
  const amount = Number(budget.amount) || 0;
  const used = Number(currentSpending) || 0;
  const remaining = Math.max(0, amount - used);
  const percentage = amount > 0 ? Math.round((used / amount) * 100) : 0;
  const isApproaching = percentage >= BUDGET_WARNING_THRESHOLD_PERCENT && percentage < 100;
  const isExceeded = percentage >= 100;

  return {
    category: budget.category,
    amount,
    used,
    remaining,
    percentage,
    isApproaching,
    isExceeded,
    period: budget.period,
  };
}

// ========================================
// Format Single Budget Status Message
// ========================================

export function formatBudgetStatus(status) {
  const emoji = getCategoryEmoji(status.category);
  let message = `${emoji} ${status.category} Budget\n\n`;

  message += `Budget: ${formatCurrency(status.amount)}\n`;
  message += `Used: ${formatCurrency(status.used)}\n`;
  message += `Remaining: ${formatCurrency(status.remaining)}\n`;
  message += `Used: ${status.percentage}%\n`;

  if (status.isExceeded) {
    message += `\n🚨 You have exceeded your ${status.category.toLowerCase()} budget!`;
  } else if (status.isApproaching) {
    message += `\n⚠️ You are approaching your ${status.category.toLowerCase()} budget.`;
  }

  return message;
}

// ========================================
// Format All Budgets Status
// ========================================

export function formatAllBudgets(statuses) {
  if (!statuses || statuses.length === 0) {
    return "📭 You haven't set any budgets yet.\n\nExample: \"Set my food budget to ₹5,000\"";
  }

  let message = `🎯 Your Monthly Budgets\n\n━━━━━━━━━━━━━━\n\n`;

  const blocks = statuses.map((st) => formatBudgetStatus(st));
  message += blocks.join("\n\n━━━━━━━━━━━━━━\n\n");

  return message;
}
