-- 0001_init.sql — Supabase schema for cross-device accounts (Option B).
--
-- Key hierarchy recap:
--   VMK  (Vault Master Key)   — client-held, never stored raw.
--   KEK  (Key Encryption Key) — PBKDF2(password, kdf_salt); wraps VMK for normal login.
--   RK   (Recovery Key)       — random key; wraps VMK for recovery.
--   RK is itself encrypted by the server-held recovery key (see vault-key edge function)
--   and stored in `recovery_key_encrypted`.
--
-- All binary blobs are stored as base64 / JSON text for cross-client portability.

-- ---------------------------------------------------------------------------
-- profiles — one row per auth.users entry; holds the key-wrapping material.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- base64 of the 16-byte PBKDF2 salt
  kdf_salt text not null,
  -- JSON {"iv": base64, "data": base64} — VMK wrapped under the password KEK
  password_wrapped_vmk text not null,
  -- JSON {"iv": base64, "data": base64} — VMK wrapped under the recovery key
  recovery_wrapped_vmk text not null,
  -- JSON {"iv": base64, "data": base64} — recovery key encrypted by the server key
  recovery_key_encrypted text not null,
  -- set true by the edge function after a password reset until the client re-wraps
  needs_rekey boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- vault_data — one encrypted blob per user containing the full holdings list.
-- ---------------------------------------------------------------------------
create table if not exists public.vault_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- base64 of the 12-byte AES-GCM IV
  iv text not null,
  -- base64 of the AES-GCM ciphertext (holds the encrypted holdings JSON)
  ciphertext text not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security: a user may only read/write their own rows.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.vault_data enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "vault_data_select_own" on public.vault_data
  for select using (auth.uid() = user_id);

create policy "vault_data_insert_own" on public.vault_data
  for insert with check (auth.uid() = user_id);

create policy "vault_data_update_own" on public.vault_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "vault_data_delete_own" on public.vault_data
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Keep updated_at current.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists vault_data_set_updated_at on public.vault_data;
create trigger vault_data_set_updated_at
  before update on public.vault_data
  for each row execute function public.set_updated_at();
