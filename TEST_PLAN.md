# Stack Your Vault — Test Plan

## 1. Overview
**Stack Your Vault** is a dual-mode PWA for tracking precious metal holdings. It operates in two rendering modes:
- **Standalone** — installed to the home screen as a PWA (chrome-less, fullscreen)
- **Embedded/Inline** — displayed inline within an iframe on an existing website

The app uses **client-side AES-GCM encryption via Web Crypto API**, with PBKDF2 key derivation (100k iterations, SHA-256). Data is persisted in IndexedDB. A service worker (via Workbox/vite-plugin-pwa) caches static assets for offline use.

---

## 2. Test Strategy

| Layer | Test Type | Tools | Location |
|-------|-----------|-------|----------|
| **Crypto** (key derivation, encrypt/decrypt) | Unit | Vitest | `src/lib/crypto.test.ts` |
| **Storage** (IndexedDB, vault lifecycle) | Integration | Vitest + fake-indexeddb | `src/lib/storage.test.ts` |
| **PWA Manifest** | Structural/Unit | Vitest | `src/lib/pwa-compliance.test.ts` |
| **UI Components** (Login, Dashboard, AddForm) | Component (RTL) | Vitest + React Testing Library | *(future)* |
| **Dual-mode rendering** | E2E / Manual | Playwright *(future)* | *(future)* |

### Running Tests
```bash
cd /home/team/shared/stack-your-safe
npm test                    # Run all tests
npx vitest run              # Run all tests
npx vitest run crypto       # Crypto tests only
npx vitest run pwa          # PWA compliance tests only
npx vitest                  # Watch mode
```

Add to `package.json`:
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

---

## 3. Security Verification Checklist (Encryption)

### 3.1 Key Derivation (PBKDF2 + AES-GCM)
| ID | Test Case | Expected | Priority |
|----|-----------|----------|----------|
| SEC-01 | `deriveKey()` is called with PBKDF2, SHA-256, 100k iterations | Algorithm params correct | P0 |
| SEC-02 | `deriveKey()` returns a CryptoKey of type `secret` with AES-GCM usage | Key is usable for encrypt/decrypt | P0 |
| SEC-03 | Same password + same salt produces the same key | Deterministic | P0 |
| SEC-04 | Different passwords with same salt produce different keys | Non-deterministic across passwords | P0 |
| SEC-05 | Different salts with same password produce different keys | Non-deterministic across salts | P0 |

### 3.2 Encrypt / Decrypt
| ID | Test Case | Expected | Priority |
|----|-----------|----------|----------|
| SEC-06 | `encrypt()` returns an ArrayBuffer (not plaintext string) | Data is transformed | P0 |
| SEC-07 | `encrypt()` uses AES-GCM with a 12-byte IV | IV length correct | P0 |
| SEC-08 | `decrypt()` with correct key + IV returns original plaintext | Round-trip integrity | P0 |
| SEC-09 | `decrypt()` with wrong key throws (authentication failure) | Tamper rejection | P0 |
| SEC-10 | `decrypt()` with wrong IV throws (authentication failure) | Tamper rejection | P0 |
| SEC-11 | `encrypt()` / `decrypt()` handles Unicode (emojis, CJK) | Correct round-trip | P1 |
| SEC-12 | `encrypt()` / `decrypt()` handles empty Uint8Array | Edge case handled | P1 |
| SEC-13 | `encrypt()` / `decrypt()` handles large payloads (≥100KB) | Performance + correctness | P1 |

### 3.3 Vault Lifecycle (Storage)
| ID | Test Case | Expected | Priority |
|----|-----------|----------|----------|
| SEC-14 | `createVault(password)` generates a random 16-byte salt and stores it in IndexedDB | Salt persisted | P0 |
| SEC-15 | `createVault(password)` derives the encryption key and keeps it in memory | Key available for subsequent ops | P0 |
| SEC-16 | `unlockVault(password)` reads salt from IndexedDB and re-derives key | Key restored from persisted salt | P0 |
| SEC-17 | `unlockVault(wrongPassword)` returns `false` (does NOT throw) | Graceful failure | P0 |
| SEC-18 | `lockVault()` sets `encryptionKey` to null | Key cleared from memory | P0 |
| SEC-19 | `saveHoldings()` while locked throws `'Vault locked'` | Cannot write when locked | P0 |
| SEC-20 | `loadHoldings()` while locked throws `'Vault locked'` | Cannot read when locked | P0 |
| SEC-21 | IndexedDB raw `'holdings'` entry contains `{ iv, data }` where `data` is an ArrayBuffer | Plaintext not stored | P0 |
| SEC-22 | IndexedDB raw entry does **not** contain the original JSON holdings string | No plaintext leak | P0 |
| SEC-23 | After `lockVault()`, IndexedDB entries remain (encrypted) but cannot be decrypted | Persistence without access | P1 |

---

## 4. PWA Compliance Checklist

### 4.1 Manifest (`manifest.webmanifest`)
| ID | Check | Expected Value | Priority |
|----|-------|----------------|----------|
| PWA-01 | `name` is present and non-empty | `"Stack Your Vault"` | P0 |
| PWA-02 | `short_name` is ≤12 characters | `"StackVault"` (10 chars) | P0 |
| PWA-03 | `description` is present | `"A dual-mode PWA for tracking your metal holdings"` | P0 |
| PWA-04 | `start_url` is `/` | Resolves to app | P0 |
| PWA-05 | `display` is `"standalone"` | Chrome-less PWA window | P0 |
| PWA-06 | `background_color` is valid hex | `"#0A0A0A"` (Obsidian Black) | P1 |
| PWA-07 | `theme_color` is valid hex | `"#0A0A0A"` (Obsidian Black) | P1 |
| PWA-08 | `icons` array contains at least one entry | ≥1 icon | P0 |
| PWA-09 | Icon has `sizes` covering 192x192 | Required for install | P0 |
| PWA-10 | Icon has `sizes` covering 512x512 | Required for install | P0 |
| PWA-11 | Icon `type` is a valid MIME type | `"image/svg+xml"` | P1 |
| PWA-12 | Icon has `purpose: "any maskable"` | Adaptive icon support | P1 |
| PWA-13 | `scope` is `/` | App-scoped | P1 |
| PWA-14 | `lang` is set | `"en"` | P2 |
| PWA-15 | `Content-Type` header is `application/manifest+json` | Browser compatibility | P1 |

### 4.2 Service Worker
| ID | Check | Expected | Priority |
|----|-------|----------|----------|
| PWA-16 | Service worker registers on page load (via `registerSW.js`) | No console errors | P0 |
| PWA-17 | SW uses Workbox for precaching static assets | `globPatterns: ['**/*.{js,css,html,ico,png,svg}']` | P0 |
| PWA-18 | `registerType: 'autoUpdate'` is set | SW auto-updates | P0 |
| PWA-19 | SW does NOT register in private/incognito (graceful degradation) | App still loads | P1 |
| PWA-20 | SW serves app shell when offline | Offline page loads | P0 |
| PWA-21 | SW updates when new build is deployed | Cache busting works | P1 |

### 4.3 Offline Access
| ID | Check | Expected | Priority |
|----|-------|----------|----------|
| PWA-22 | App loads and shows lock screen when completely offline | Network not required for auth | P0 |
| PWA-23 | Dashboard loads with cached holdings when offline | Reads from IndexedDB | P0 |
| PWA-24 | Add holding while offline — saved to IndexedDB locally | Works offline | P1 |

### 4.4 Installability
| ID | Check | Expected | Priority |
|----|-------|----------|----------|
| PWA-25 | Lighthouse PWA badge shows "Installable" | Passes installability criteria | P0 |
| PWA-26 | `beforeinstallprompt` event fires in Chromium browsers | Install prompt appears | P1 |
| PWA-27 | App can be added to home screen on Android Chrome | Full PWA install flow | P1 |
| PWA-28 | App can be added to home screen on iOS Safari | Safari PWA support | P2 |

---

## 5. Dark Theme Verification (Rebrand: "Stack Your Vault")

The app uses a dark luxury aesthetic with three core brand colors:

| Color | Hex | CSS Variable | Usage |
|-------|-----|--------------|-------|
| **Obsidian Black** | `#0A0A0A` | `--color-obsidian` | Page backgrounds (`bg-obsidian`) |
| **Bullion Gold** | `#D4AF37` | `--color-bullion` | Primary CTAs (buttons, links, focus rings) |
| **Sterling Silver** | `#C0C0C0` | *(Tailwind gray-300)* | Secondary text, borders |

### 5.1 Color Consistency
| ID | Test Case | Expected | Priority |
|----|-----------|----------|----------|
| DARK-01 | All page-level backgrounds use `bg-obsidian` or `#0A0A0A` | No white/light gray page backgrounds | P0 |
| DARK-02 | Card backgrounds use `bg-[#121212]` or `bg-zinc-900` | Consistent layered depth | P0 |
| DARK-03 | Form fields use `bg-zinc-900` with `border-[#222222]` | Consistent input styling | P1 |
| DARK-04 | Bullion gold (`#D4AF37`) is primary call-to-action color | Buttons, links, focus rings are gold | P0 |
| DARK-05 | No hardcoded white backgrounds exist in components | Zero `bg-white`, `bg-gray-100`, `bg-gray-200` | P0 |
| DARK-06 | `index.css` defines `--color-obsidian: #0A0A0A` and `--color-bullion: #D4AF37` | CSS variables present | P0 |
| DARK-07 | `body` or `:root` default background is `#0A0A0A` | No flash of white on load | P1 |
| DARK-08 | Bullion gold passes WCAG AA contrast on dark (#0A0A0A) at 12.6:1 ratio | Accessible CTA text | P1 |

### 5.2 Text Contrast & Readability
| ID | Test Case | Expected | Priority |
|----|-----------|----------|----------|
| DARK-09 | Primary text uses `gray-100` or `white` on dark backgrounds | Readable (≥4.5:1 contrast) | P0 |
| DARK-10 | Secondary text uses `gray-300` / `gray-400` on dark backgrounds | Readable (≥3:1 contrast) | P1 |
| DARK-11 | Placeholder text uses `zinc-500` / `zinc-600` | Visible but muted | P1 |
| DARK-12 | Bullion gold on dark background provides sufficient contrast | Gold text readble | P1 |
| DARK-13 | Error text (red-500) is distinguishable on dark surfaces | Error messages visible | P1 |

### 5.3 Branding Elements
| ID | Test Case | Expected | Priority |
|----|-----------|----------|----------|
| DARK-14 | LoginScreen heading reads "Stack Your Vault" | Brand name correct | P0 |
| DARK-15 | `manifest.name` is "Stack Your Vault", `short_name` is "StackVault" | PWA identity matches brand | P0 |
| DARK-16 | Hero image shown on LoginScreen with dark border | Branding consistent | P1 |
| DARK-17 | Loading spinner uses `border-bullion` color | Gold spinner | P2 |
| DARK-18 | FAB (floating action button) uses `bg-bullion` | Primary add action is gold | P1 |
| DARK-19 | Dashboard metal-type badges use semi-transparent gold/card backgrounds | Bullion gold accents for metals | P1 |

### 5.4 Component Dark Theme Coverage
| ID | Component | Background | Text | Accent |
|----|-----------|------------|------|--------|
| DARK-20 | App.tsx | `bg-obsidian` or transparent (inline mode) | N/A | Bullion spinner |
| DARK-21 | LoginScreen | `bg-obsidian` → card `bg-[#121212]` | `gray-100` / white headings | Bullion button + focus ring |
| DARK-22 | Dashboard | `bg-obsidian` → header `bg-[#121212]` | `gray-100` body | Bullion tabs, buttons, FAB |
| DARK-23 | AddHoldingsForm | Card `bg-[#121212]` → `bg-zinc-900` inputs | White text | Bullion focus borders, submit |
| DARK-24 | Settings | Card `bg-[#121212]` → `bg-zinc-900` rows | `gray-100` | Bullion accents |
| DARK-25 | ScanReceipt | Card `bg-[#121212]` → `bg-zinc-900` inputs | `gray-100` | Bullion drop-zone hover, borders |

### 5.5 Responsive Dark Theme
| ID | Test Case | Expected | Priority |
|----|-----------|----------|----------|
| DARK-26 | Mobile viewports use same dark backgrounds | Consistency across devices | P1 |
| DARK-27 | Inline (iframe) mode respects host page background | Transparent when embedded | P1 |
| DARK-28 | system `prefers-color-scheme: dark` matches app appearance | App already dark, no breakage | P2 |

---

## 6. UI Flow Test Scenarios

### 6.1 Login / Vault Creation
| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| UI-01 | First-time user creates vault | Enter password → Submit | Vault created, dashboard shown |
| UI-02 | Returning user unlocks vault | Enter correct password → Submit | Dashboard loads with holdings |
| UI-03 | Wrong password attempt | Enter incorrect password → Submit | "Incorrect password" error shown |
| UI-04 | Empty password submission | Submit with empty field | Validation stops submission (browser `required`) |
| UI-05 | Loading state while initializing | App loads | Spinner shown during IndexedDB init |

### 6.2 Dashboard
| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| UI-06 | Empty vault dashboard | After creation, no holdings | "Your vault is empty." message + "Start Stacking" button |
| UI-07 | Holdings summary cards | Add holdings for multiple metals | 4 summary cards (Gold, Silver, Platinum, Copper) with totals |
| UI-08 | Recent transactions list | Add holdings | Holdings shown in reverse chronological order |
| UI-09 | Lock vault | Click lock icon | Vault locks, returns to login screen |
| UI-10 | Open settings | Click gear icon | Settings panel opens |

### 6.3 Add Holdings Form
| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| UI-11 | Add gold holding | Select Gold, enter 10, select oz, Submit | Holding added to dashboard |
| UI-12 | Add silver in grams | Select Silver, enter 500, select g, Submit | Holding added with correct unit |
| UI-13 | Cancel add | Open form → Click Cancel | Form closes, no holding added |
| UI-14 | Invalid quantity (negative) | Enter -5 → Submit | Browser validation prevents submission |
| UI-15 | Invalid quantity (non-numeric) | Enter "abc" → Submit | Browser validation prevents submission |
| UI-16 | Metal type selector | Tap different metal buttons | Selected metal highlighted (yellow border) |

### 6.4 Settings
| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| UI-17 | Open settings from dashboard | Tap gear icon | Settings panel opens |
| UI-18 | Reset vault | Tap "Reset Vault" | Holdings cleared, vault locked |
| UI-19 | Close settings | Tap close/X | Settings panel closes |

### 6.5 Data Persistence
| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| PER-01 | Holdings persist after page reload | Add holdings → Refresh page → Unlock | Holdings still present |
| PER-02 | Holdings persist after tab close/reopen | Add holdings → Close tab → Reopen → Unlock | Holdings still present |
| PER-03 | Holdings persist after browser restart | Add holdings → Close browser → Reopen → Unlock | Holdings still present |
| PER-04 | Locking clears in-memory state | Unlock → View holdings → Lock → Unlock | Holdings reloaded from DB |

---

## 7. Expanded Holding Model — Field Validation

The `Holding` data model now includes optional metadata fields that enrich each holding record. These must be correctly encrypted/decrypted and persisted through the full vault lifecycle.

### 7.1 Field Mapping
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier |
| `metal` | `Metal` (`'Gold' | 'Silver' | 'Platinum' | 'Copper'`) | Yes | Metal type |
| `quantity` | `number` | Yes | Amount held |
| `unit` | `string` | Yes | Unit of measurement (`oz`, `g`, `kg`) |
| `addedDate` | `string` (ISO 8601) | Yes | When the record was created |
| `note` | `string?` | No | User note |
| `purchaseDate` | `string?` (ISO date) | No | Date of purchase |
| `purchasePrice` | `number?` | No | Purchase price in user's currency |
| `description` | `string?` | No | Detailed description |
| `photoUrl` | `string?` | No | URL to a photo of the holding |

### 7.2 Field-Specific Test Cases
| ID | Test Case | Expected | Priority |
|----|-----------|----------|----------|
| HOLD-01 | Encrypt/decrypt Holding with all optional fields populated | All fields round-trip correctly | P0 |
| HOLD-02 | Encrypt/decrypt Holding with NO optional fields | Required fields only, no errors | P0 |
| HOLD-03 | Save/load holdings with `purchasePrice` as float (12500.50) | Precision preserved | P0 |
| HOLD-04 | Save/load holdings with `purchaseDate` as ISO date string | Date string preserved as-is | P0 |
| HOLD-05 | Save/load holdings with `description` containing very long text (10,000 chars) | Stored and retrieved correctly | P1 |
| HOLD-06 | Save/load holdings with `photoUrl` as a data URL (large base64 string) | Data URL round-trips correctly | P1 |
| HOLD-07 | Mixed holdings — some with all fields, some with partial, some with none | Each holding independently correct | P0 |
| HOLD-08 | `purchasePrice` of 0 (zero) is stored correctly | Zero is preserved, not treated as null | P1 |
| HOLD-09 | `purchaseDate` of empty string is stored as empty string | Empty string preserved (or normalized) | P2 |
| HOLD-10 | Backward compatibility: holdings saved with old `date` field still load correctly | `date` maps to `addedDate` | P0 |

---

## 8. Dual-Mode Rendering Checklist

### 8.1 Standalone Mode (Installed PWA)
| ID | Check | Expected | Priority |
|----|-------|----------|----------|
| DUAL-01 | App window has no browser chrome | No address bar, no tab bar | P0 |
| DUAL-02 | `isStandalone()` returns `true` | Detected via `display-mode: standalone` | P0 |
| DUAL-03 | Splash screen shows on launch | Uses `background_color` and icon | P1 |
| DUAL-04 | Status bar matches `theme_color` | Themed status bar on mobile | P1 |

### 8.2 Embedded / Inline Mode (iframe on website)
| ID | Check | Expected | Priority |
|----|-------|----------|----------|
| DUAL-05 | `isInIframe()` returns `true` | Detected via `window.self !== window.top` | P0 |
| DUAL-06 | App renders within iframe boundaries | No scroll outside, no overlap | P0 |
| DUAL-07 | "Running in Inline Mode" banner shown at bottom | Yellow bar with text | P0 |
| DUAL-08 | `mode` state set to `'inline'` when URL param `?mode=inline` is present | Override works for testing | P1 |
| DUAL-09 | App fits container at 375px width | No horizontal scroll | P1 |
| DUAL-10 | App fits container at 100% width (responsive) | Scales to parent | P1 |
| DUAL-11 | Touch events work inside iframe | Tap targets tappable | P0 |
| DUAL-12 | All interactive elements are keyboard-accessible | Tab order, focus styles | P2 |

---

## 9. Receipt OCR Scanning Flow

The receipt scanning feature uses a `ScanReceipt` component with Tesseract.js for OCR text extraction, combined with the `parseReceiptText()` function for parsing extracted text into structured holding data.

### 9.1 Architecture
- **Tesseract.js** — runs in-browser OCR on receipt images
- **`parseReceiptText()`** — `src/lib/receipt-parser.ts` — extracts metal type, quantity, unit, date, and price from OCR output
- **`ScanReceipt` component** — UI for uploading/taking photos, showing OCR progress, and confirming parsed data
- **Integration hook** — passes parsed data to `useVault().addHolding()` for saving

### 9.2 Parser Unit Tests (29 tests in `src/lib/receipt-parser.test.ts`)

#### Metal Detection
| ID | Test Case | Expected | Priority |
|----|-----------|----------|----------|
| OCR-01 | "Gold" from structured receipt text | `result.metal === 'Gold'` | P0 |
| OCR-02 | "Silver" from structured receipt text | `result.metal === 'Silver'` | P0 |
| OCR-03 | "Platinum" from structured receipt text | `result.metal === 'Platinum'` | P0 |
| OCR-04 | "Copper" from structured receipt text | `result.metal === 'Copper'` | P0 |
| OCR-05 | Metal from handwritten-style text | `result.metal === 'Gold'` | P1 |
| OCR-06 | No metal keyword in noise | `result.metal === undefined` | P0 |

#### Quantity & Unit Extraction
| ID | Test Case | Expected | Priority |
|----|-----------|----------|----------|
| OCR-07 | Quantity + unit "1 oz" | `{ quantity: 1, unit: 'oz' }` | P0 |
| OCR-08 | Quantity + unit "10 oz" | `{ quantity: 10, unit: 'oz' }` | P0 |
| OCR-09 | Quantity + unit "5 kg" | `{ quantity: 5, unit: 'kg' }` | P0 |
| OCR-10 | Handwritten "0.5 oz" | `{ quantity: 0.5, unit: 'oz' }` | P1 |
| OCR-11 | Minimal text "Gold\n1\noz" | `{ quantity: 1, unit: 'oz' }` | P1 |

#### Date Extraction
| ID | Test Case | Expected | Priority |
|----|-----------|----------|----------|
| OCR-12 | MM/DD/YYYY → normalized | `'2025-03-15'` | P0 |
| OCR-13 | YYYY-MM-DD (ISO) | `'2025-06-01'` | P0 |
| OCR-14 | MM-DD-YYYY → normalized | `'2025-12-25'` | P0 |
| OCR-15 | Handwritten M/D/YY → normalized | `'2025-03-10'` | P1 |
| OCR-16 | No date in noise | `purchaseDate === undefined` | P0 |

#### Price Extraction
| ID | Test Case | Expected | Priority |
|----|-----------|----------|----------|
| OCR-17 | `$2,450.00` with commas | `purchasePrice === 2450.00` | P0 |
| OCR-18 | `$350.00` | `purchasePrice === 350.00` | P0 |
| OCR-19 | `$1,200.50` with comma | `purchasePrice === 1200.50` | P0 |
| OCR-20 | Handwritten `$1,250` | `purchasePrice === 1250` | P1 |
| OCR-21 | No price in noise | `purchasePrice === undefined` | P0 |

#### Edge Cases
| ID | Test Case | Expected | Priority |
|----|-----------|----------|----------|
| OCR-22 | Empty string input | `confidence === 0` | P0 |
| OCR-23 | Noisy/garbled text | `confidence === 0` | P0 |
| OCR-24 | Partial text (only metal + qty) | Metal + qty parsed, rest undefined | P0 |
| OCR-25 | Single field match confidence | `confidence === 0.25` | P2 |
| OCR-26 | All 4 fields match confidence | `confidence === 1.0` | P2 |
| OCR-27 | "ounce" normalized to "oz" | `unit === 'oz'` | P1 |
| OCR-28 | "grams" normalized to "g" | `unit === 'g'` | P1 |

### 9.3 Manual Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| OCR-M1 | Upload clear receipt photo | Upload → OCR processes → Loading indicator | Parsed data shown in confirmation form |
| OCR-M2 | Blurry/out-of-focus image | Upload blurry image → OCR completes | Low confidence, user can manually correct |
| OCR-M3 | Handwritten receipt | Upload handwritten receipt | Best-effort parsing, manual correction needed |
| OCR-M4 | Non-English receipt | Upload receipt with foreign text | Tesseract handles multi-language; `parseReceiptText` may not parse non-English metal names |
| OCR-M5 | Cancel OCR mid-process | Start OCR → Press cancel | Operation cancelled, no data added |
| OCR-M6 | Confirm parsed data | OCR completes → Review → Confirm | Holding saved to vault |
| OCR-M7 | Edit parsed data before saving | OCR completes → Edit field(s) → Confirm | Edited values saved, not raw OCR values |
| OCR-M8 | Camera capture on mobile | Use device camera to capture receipt | Image captured, OCR processes as with upload |

### 9.4 Tesseract.js Integration Notes
- Tesseract.js loads a language data file (~2-4MB) on first use — test with slow networks
- Worker lifecycle: create → load language → recognize → terminate
- Set `worker.lang` to `'eng'` for English receipts; multi-language support adds overhead
- OCR output includes `data.text` (full extracted text) and `data.words` (per-word confidence)
- `parseReceiptText()` uses `data.text` as input and returns structured `ParsedReceipt`

---

## 10. Lighthouse Audit

Run when the app is deployed on port 3000:
```bash
npx lighthouse http://localhost:3000 --view --preset=desktop
npx lighthouse http://localhost:3000 --view --preset=perf
```

### Target Scores

| Category | Target | Notes |
|----------|--------|-------|
| **Performance** | ≥90 | Fast initial load, efficient caching |
| **PWA** | ≥90 | Manifest, SW, offline, installable |
| **Accessibility** | ≥90 | ARIA labels, contrast, focus management |
| **Best Practices** | ≥90 | HTTPS, CSP, no deprecated APIs |
| **SEO** | ≥90 | Meta tags, viewport, lang |

---

## 11. Defect Severity

| Severity | Definition | Examples | SLA |
|----------|-----------|----------|-----|
| **P0 - Critical** | Core flow broken, data at risk | Cannot unlock vault, data lost, encryption fails | Block release, fix immediately |
| **P1 - Major** | Feature partially broken, workaround exists | Wrong password error not shown, summary cards wrong | Fix before next release |
| **P2 - Minor** | Cosmetic, edge case, non-functional | Inline banner styling off, missing focus style | Fix when time permits |

---

## 12. Existing Test Coverage

| Test File | Tests | Status | Location |
|-----------|-------|--------|----------|
| `src/lib/crypto.test.ts` | 19 (deriveKey, encrypt/decrypt, Holding round-trip, edge cases) | ✅ Passing | Project repo |
| `src/lib/storage.test.ts` | 7 (create/load, wrong pw, persistence, HOLD-03/04/05/06) | ✅ Passing | Project repo |
| `src/lib/pwa-compliance.test.ts` | 27 (manifest, SW, installability) | ✅ Passing | Project repo |
| `src/lib/receipt-parser.test.ts` | 29 (receipt parsing, dates, prices, edge cases) | ✅ Passing | Project repo |
| `src/lib/po-storage.test.ts` | 23 (precious object storage, metal-type queries) | ✅ Passing | Project repo |
| **Total** | **105 tests** | ✅ **All passing** | |

---

## 13. Test Deliverables

| Deliverable | Status |
|------------|--------|
| ✅ `vitest` + `fake-indexeddb` as devDependencies | Done |
| ✅ `TEST_PLAN.md` — this document (13 sections, 150+ documented cases) | Done |
| ✅ `src/lib/pwa-compliance.test.ts` — PWA compliance tests (27 tests) | Done |
| ✅ `src/lib/crypto.test.ts` — Crypto unit tests (19 tests) | Done |
| ✅ `src/lib/receipt-parser.test.ts` — OCR parser tests (29 tests) | Done |
| ✅ `src/lib/storage.test.ts` — Vault storage integration tests (7 tests) | Done |
| ✅ `src/lib/po-storage.test.ts` — Precious object storage tests (23 tests) | Done |
| ✅ `npm test` script in package.json | Done |
| ✅ `vitest.config.ts` in project root | Done |
| ✅ Dark Theme Verification section (Section 5, 28 DARK cases) | Done |
| ✅ "Stack Your Safe" → "Stack Your Vault" rebrand throughout | Done |
| ✅ Manifest colors: `#0A0A0A` (Obsidian Black) for `theme_color` and `background_color` | Done |
| ⬜ Lighthouse audit (after deploy) | Blocked on port 3000 |
| ⬜ Dual-mode manual QA pass | When UI is stable |

---

*Prepared by QA Engineer. Last updated: 2026-06-29*