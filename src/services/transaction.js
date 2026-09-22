import { supabase } from "../database/supabase.js";

// ========================================
// Add Transaction
// ========================================

export async function addTransaction(userId, transaction) {
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      type: transaction.type,
      amount: transaction.amount,
      currency: transaction.currency || "INR",
      category: transaction.category,
      description: transaction.description,
      transaction_date: transaction.date,
    })
    .select()
    .single();

  if (error) {
    console.error("Supabase insert error:", error);
    throw new Error("Could not save transaction.");
  }

  return data;
}

// ========================================
// Get Transactions for a Specific Date
// ========================================

export async function getTransactionsByDate(userId, date) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("transaction_date", date)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error("Supabase fetch error:", error);
    throw new Error("Could not fetch transactions.");
  }

  return data;
}

// ========================================
// Get Transactions for a Specific Month
// ========================================

export async function getTransactionsByMonth(userId, startDate, endDate) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .gte("transaction_date", startDate)
    .lte("transaction_date", endDate)
    .order("transaction_date", {
      ascending: false,
    });

  if (error) {
    console.error("Supabase fetch error:", error);
    throw new Error("Could not fetch transactions.");
  }

  return data;
}

// ========================================
// General Transactions Query by Date Range
// ========================================

export async function queryTransactions(
  userId,
  startDate,
  endDate,
  category = null
) {
  let query = supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .gte("transaction_date", startDate)
    .lte("transaction_date", endDate)
    .order("transaction_date", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Supabase query error:", error);
    throw new Error("Could not query transactions.");
  }

  return data;
}

// ========================================
// Get Total Spending for a Category in Date Range
// ========================================

export async function getCategorySpending(userId, category, startDate, endDate) {
  const transactions = await queryTransactions(userId, startDate, endDate, category);
  return transactions
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
}