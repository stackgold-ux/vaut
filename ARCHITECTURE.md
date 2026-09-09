# Stack Your Vault — Architecture

## Stack
- **Frontend**: Vite + React 19 + TypeScript + Tailwind CSS 4
- **PWA**: vite-plugin-pwa (service worker, manifest, offline caching)
- **Encryption**: Web Crypto API (PBKDF2 + AES-GCM 256-bit)
- **Storage**: IndexedDB (via VaultStorage class)

## Dual-Mode
The app runs identically in two contexts:
- **Standalone**: Installed as a PWA on the user's device
- **Inline**: Embedded as a page on www.stackyourgold.com (Wix Headless → Vercel)

Detected via `src/utils/pwa.ts` — checks display-mode, iframe context, and URL params.

## Data Flow
```
Password → PBKDF2 key derivation (100k iterations)
         → AES-GCM encrypt vault data
         → Store encrypted blob in IndexedDB
         → Decrypt in-memory while unlocked
         → Lock clears the encryption key from memory
```

## Key Modules
| File | Purpose |
|------|---------|
| `src/lib/crypto.ts` | PBKDF2 deriveKey + AES-GCM encrypt/decrypt |
| `src/lib/storage.ts` | VaultStorage class wrapping IndexedDB |
| `src/hooks/useVault.ts` | React hook — MUST integrate with VaultStorage |
| `src/utils/pwa.ts` | Mode detection utilities |
| `src/components/*` | UI components |

## Deployment
- Hosted on Vercel
- Embedded into Wix Headless via iframe or JS SDK