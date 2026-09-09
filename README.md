# Stack Your Vault

"Stack Your Vault" is a password-encrypted precious metals vault tracker. It allows you to securely track your holdings of Gold, Silver, Platinum, and Copper with industry-standard encryption.

## Features

- **Secure Encryption**: All data is encrypted using AES-GCM 256-bit encryption before being stored.
- **Offline Capable**: Works offline as a Progressive Web App (PWA).
- **Dual-Mode**:
  - **Standalone**: Full-screen experience when installed on your device.
  - **Inline**: Minimalist interface for embedding on other websites via iframe.
- **Metal Tracking**: Track totals and transaction history for Gold, Silver, Platinum, and Copper.

## Tech Stack

- **Frontend**: React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **Build Tool**: Vite 8
- **PWA**: `vite-plugin-pwa` (Service Workers + Manifest)
- **Storage**: IndexedDB (via `VaultStorage`)
- **Security**: Web Crypto API (PBKDF2 for key derivation, AES-GCM for encryption)

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Development

To start the development server:

```bash
npm run dev
```

### Build

To create a production build (including PWA assets):

```bash
npm run build
```

The output will be in the `dist/` directory.

### Preview

To preview the production build locally:

```bash
npm run preview
```

## PWA Installation

### Desktop (Chrome/Edge)
1. Click the **Install** icon in the address bar.
2. Follow the prompts to add "Stack Your Vault" to your applications.

### Mobile (iOS/Android)
1. Open the app in your mobile browser.
2. Tap **Share** (iOS) or the **Menu** (Android).
3. Select **Add to Home Screen**.

## Dual-Mode Configuration

The app automatically detects its environment:
- If running standalone or as the top-level page, it uses the **Standalone** layout.
- If running inside an iframe, it switches to **Inline** mode with a minimalist design.
- You can force inline mode by appending `?mode=inline` to the URL.
