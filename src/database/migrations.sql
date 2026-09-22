-- ==========================================================
-- AI Finance Tracker Database Migrations
-- ==========================================================
-- Run this script in the Supabase SQL Editor.
-- This does NOT touch or modify the existing `transactions` table.
-- ==========================================================

-- 1. Budgets Table
-- Stores monthly, weekly, or yearly budget limits per category for each user.
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null,
  category text not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'INR',
  period text not null default 'monthly' check (period in ('monthly', 'weekly', 'yearly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_user_category_period unique (user_id, category, period)
);

-- 2. Recurring Expenses Table
-- Stores scheduled/recurring transactions (e.g., rent, subscriptions, bills).
create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null,
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'INR',
  category text not null,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  next_occurrence date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Row Level Security Policies
-- Ensures secure access. For development/bot usage, allow bot operations.
alter table public.budgets enable row level security;
alter table public.recurring_expenses enable row level security;

create policy "Allow bot access on budgets"
  on public.budgets for all
  using (true)
  with check (true);

create policy "Allow bot access on recurring_expenses"
  on public.recurring_expenses for all
  using (true)
  with check (true);
