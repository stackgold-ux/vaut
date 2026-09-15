# Stack Your Vault — Architecture

## Stack
- **Frontend**: Vite + React 19 + TypeScript + Tailwind CSS 4
- **PWA**: vite-plugin-pwa (service worker, manifest, offline caching)
- **Encryption**: Web Crypto API (PBKDF2 + AES-GCM 256-bit, HKDF-SHA256)
- **Local storage**: IndexedDB (via `VaultStorage` class) — offline-first local vault
- **Cloud storage / auth**: Supabase (Postgres + Auth + Edge Functions) — cross-device accounts
- **Sync**: client-encrypted holdings pushed/pulled as a single AES-GCM blob

## Dual-Mode
The app runs identically in two contexts:
- **Standalone**: Installed as a PWA on the user's device
- **Inline**: Embedded as a page on www.stackyourgold.com (Wix Headless → Vercel)
Detected via `src/utils/pwa.ts` — checks display-mode, iframe context, and URL params.

## Account & encryption model (Option B — recoverable accounts)

Cross-device accounts use **envelope encryption** with a **server-side recovery path** so a
forgotten password never destroys the vault. This is the "recoverable accounts" model the
owner selected; it trades a degree of privacy (the server can, in principle, recover the
Vault Master Key) for the guarantee that password reset does not lose data.

### Key hierarchy
| Key | Origin | Purpose |
|-----|--------|---------|
| **VMK** (Vault Master Key) | Client-generated random 256-bit AES-GCM key | Encrypts all vault data. Lives only in memory when unlocked. |
| **KEK** (Key Encryption Key) | `PBKDF2(password, kdf_salt)` (100k, SHA-256) | Wraps the VMK for normal login. Never stored. |
| **RK** (Recovery Key) | Client-generated random 256-bit AES-GCM key | Wraps the VMK for recovery. Encrypted by the server key and stored. |
| **EWK** (Ephemeral Wrap Key) | Client-generated, single-use | Lets the edge function return the VMK to a resetting user without exposing it raw. |

### Data at rest (Supabase, all RLS-scoped to the user)
- `profiles.kdf_salt` — base64 PBKDF2 salt.
- `profiles.password_wrapped_vmk` — `wrapKey(VMK, KEK)` as `{iv, data}` JSON.
- `profiles.recovery_wrapped_vmk` — `wrapKey(VMK, RK)` as `{iv, data}` JSON.
- `profiles.recovery_key_encrypted` — `encrypt(RK)` under a **per-user server key** derived
  from `SUPABASE_SECRET_KEY` + `user.id` via HKDF-SHA256 (see the edge function).
- `vault_data` — one row per user holding `encryptVaultPayload(holdings, VMK)`.

Only ciphertext / wrapped keys are ever persisted; the VMK, KEK, and RK are never stored raw.

### Normal sign-in
```
email/password → Supabase Auth signIn
              → fetch profile (salt + password_wrapped_vmk)
              → KEK = PBKDF2(password, salt)
              → VMK = unwrapKey(password_wrapped_vmk, KEK)
              → pullVault(VMK) → holdings
```

### Password reset (recoverable)
1. `resetPassword(email)` → Supabase sends a reset email; user sets a new password.
2. Client calls the `vault-key` edge function (`action: "recover"`) with a fresh EWK.
3. Edge function verifies the JWT, decrypts `recovery_key_encrypted` with the server key,
   unwraps `recovery_wrapped_vmk` → VMK, re-wraps it under the EWK, and returns it.
4. Client unwraps with the EWK, then re-wraps the VMK under the **new** password's KEK and
   persists `password_wrapped_vmk`. No data is lost.

### Security tradeoff (explicit)
Because the server holds the recovery key (derived from `SUPABASE_SECRET_KEY`), a compromise
of the Supabase service-role key would allow decryption of user vaults. This is the accepted
cost of recoverability (Option B) and was ratified by the owner. The publishable/anon key and
the service-role key are kept separate: the anon key is exposed to the browser via
`vite.config.ts` `define`, while `SUPABASE_SECRET_KEY` is read **only** inside the edge function.

## Data flow (local vault)
```
Password → PBKDF2 key derivation (100k iterations)
         → AES-GCM encrypt vault data
         → Store encrypted blob in IndexedDB
         → Decrypt in-memory while unlocked
         → Lock clears the encryption key from memory
```

## Key modules
| File | Purpose |
|------|---------|
| `src/lib/crypto.ts` | PBKDF2 deriveKey + AES-GCM encrypt/decrypt |
| `src/lib/keyManagement.ts` | Envelope-encryption primitives (VMK/KEK/RK/EWK, wrap/unwrap, payload encrypt) |
| `src/lib/supabase.ts` | Supabase client factory + injectable singleton |
| `src/lib/account.ts` | Auth + key-management service (`signUp`, `signIn`, `signOut`, `resetPassword`, `recoverKey`) |
| `src/lib/vaultSync.ts` | `pushVault` / `pullVault` (client-side encryption) |
| `src/lib/storage.ts` | `VaultStorage` class wrapping IndexedDB (local/offline vault) |
| `src/hooks/useVault.ts` | React hook — MUST integrate with `VaultStorage` |
| `src/utils/pwa.ts` | Mode detection utilities |
| `src/components/*` | UI components |
| `supabase/migrations/*.sql` | Database schema + RLS |
| `supabase/functions/vault-key/index.ts` | Edge function: recovery-key setup + password-reset re-wrapping |

## Supabase schema
- `profiles` — one row per `auth.users` entry; holds key-wrapping material (RLS: own rows only).
- `vault_data` — one encrypted blob per user (RLS: own rows only).
- Edge function `vault-key` uses the service-role key (bypasses RLS) for recovery reads.

## Deployment
- Hosted on Vercel (client build exposes `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` via
  `vite.config.ts` `define`).
- Supabase hosts Auth, Postgres, and the `vault-key` edge function.
  - Apply migrations with `supabase db push` (or run `supabase/migrations/0001_init.sql` in
    the SQL editor).
  - Deploy the edge function with `supabase functions deploy vault-key` (set `SUPABASE_URL`
    and `SUPABASE_SECRET_KEY` as function secrets).
- Embedded into Wix Headless via iframe or JS SDK.

## Owner/infra settings to confirm
- Supabase Auth **email confirmation**: `signUp` requires a session to call the recovery
  setup step. Either disable "Confirm email" for instant sign-in, or have the client run the
  recovery-key setup on first authenticated load after confirmation.
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` must be set in Vercel (build + runtime), and
  `SUPABASE_SECRET_KEY` set as a secret on the `vault-key` edge function.
