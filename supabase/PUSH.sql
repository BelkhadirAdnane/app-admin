-- =============================================================================
--  NOTIFICATIONS PUSH — à coller une fois dans Supabase → SQL Editor → Run.
--
--  Deux tables techniques, accessibles UNIQUEMENT avec la clé service_role
--  (RLS activée, aucune politique pour anon/authenticated) :
--    • push_subscriptions      : appareils abonnés (endpoint + clés Web Push)
--    • push_notifications_log  : rapports déjà notifiés (anti-doublon)
--
--  Aucune donnée métier n'est dupliquée ici. Idempotent.
-- =============================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.push_notifications_log (
  rapport_id text primary key,
  secteur text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions     enable row level security;
alter table public.push_notifications_log enable row level security;

revoke all on public.push_subscriptions     from anon, authenticated;
revoke all on public.push_notifications_log from anon, authenticated;

create index if not exists push_notifications_log_created_idx
  on public.push_notifications_log (created_at desc);

-- Purge facultative des anciens journaux (à planifier si besoin).
-- delete from public.push_notifications_log where created_at < now() - interval '90 days';

select
  to_regclass('public.push_subscriptions') is not null as abonnements_ok,
  to_regclass('public.push_notifications_log') is not null as journal_ok;
