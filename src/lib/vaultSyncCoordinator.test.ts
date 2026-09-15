/**
 * vaultSyncCoordinator.test.ts — unit tests for the account + cloud-sync
 * orchestration, with mocked `account` and `vaultSync` services (no network).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import { VaultSyncCoordinator } from './vaultSyncCoordinator';
import type { Holding } from '../types';

vi.mock('./account', () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  recoverKey: vi.fn(),
  getCurrentUserId: vi.fn(),
}));

vi.mock('./vaultSync', () => ({
  pushVault: vi.fn(),
  pullVault: vi.fn(),
}));

import * as account from './account';
import * as vaultSync from './vaultSync';

if (!globalThis.crypto) {
  // @ts-expect-error node webcrypto
  globalThis.crypto = webcrypto;
}

const sampleHoldings: Holding[] = [
  {
    id: 'h1',
    metal: 'Gold',
    quantity: 1.5,
    unit: 'oz',
    addedDate: '2026-01-01T00:00:00.000Z',
  },
];

async function makeVmk(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

const mockedAccount = vi.mocked(account);
const mockedSync = vi.mocked(vaultSync);

let coordinator: VaultSyncCoordinator;
let vmk: CryptoKey;

beforeEach(async () => {
  vi.clearAllMocks();
  coordinator = new VaultSyncCoordinator();
  vmk = await makeVmk();
});

afterEach(() => {
  vi.resetModules();
});

describe('VaultSyncCoordinator', () => {
  it('starts signed out with no session or holdings', () => {
    expect(coordinator.isSignedIn).toBe(false);
    expect(coordinator.sessionUserId).toBeNull();
    expect(coordinator.sessionHoldings).toEqual([]);
  });

  it('signIn pulls and decrypts the remote vault with the session VMK', async () => {
    mockedAccount.signIn.mockResolvedValue({ userId: 'u1', vmk });
    mockedSync.pullVault.mockResolvedValue(sampleHoldings);

    await coordinator.signIn('user@example.com', 'password123');

    expect(coordinator.isSignedIn).toBe(true);
    expect(coordinator.sessionUserId).toBe('u1');
    expect(coordinator.sessionHoldings).toEqual(sampleHoldings);
    // The VMK used to decrypt is exactly the one returned by signIn (in-memory only).
    expect(mockedSync.pullVault).toHaveBeenCalledWith('u1', vmk);
  });

  it('signUp pulls an (empty) vault after creating the account', async () => {
    mockedAccount.signUp.mockResolvedValue({ userId: 'u2', vmk });
    mockedSync.pullVault.mockResolvedValue([]);

    await coordinator.signUp('new@example.com', 'password123');

    expect(coordinator.isSignedIn).toBe(true);
    expect(coordinator.sessionUserId).toBe('u2');
    expect(coordinator.sessionHoldings).toEqual([]);
    expect(mockedSync.pullVault).toHaveBeenCalledWith('u2', vmk);
  });

  it('recoverKey adopts the session and pulls the original holdings back', async () => {
    mockedAccount.recoverKey.mockResolvedValue({ userId: 'u1', vmk });
    mockedSync.pullVault.mockResolvedValue(sampleHoldings);

    await coordinator.recoverKey('brand-new-password');

    expect(coordinator.isSignedIn).toBe(true);
    expect(coordinator.sessionHoldings).toEqual(sampleHoldings);
  });

  it('pushHoldings encrypts and persists the full list under the VMK', async () => {
    mockedAccount.signIn.mockResolvedValue({ userId: 'u1', vmk });
    mockedSync.pullVault.mockResolvedValue([]);
    mockedSync.pushVault.mockResolvedValue(undefined);

    await coordinator.signIn('user@example.com', 'password123');
    const next = [...sampleHoldings, {
      id: 'h2',
      metal: 'Silver' as const,
      quantity: 10,
      unit: 'oz',
      addedDate: '2026-02-01T00:00:00.000Z',
    }];
    await coordinator.pushHoldings(next);

    expect(mockedSync.pushVault).toHaveBeenCalledWith('u1', next, vmk);
    expect(coordinator.sessionHoldings).toEqual(next);
  });

  it('pushHoldings throws (and does not call the network) when signed out', async () => {
    await expect(coordinator.pushHoldings(sampleHoldings)).rejects.toThrow('Not signed in.');
    expect(mockedSync.pushVault).not.toHaveBeenCalled();
  });

  it('signOut clears the VMK and holdings even when the network call fails', async () => {
    mockedAccount.signIn.mockResolvedValue({ userId: 'u1', vmk });
    mockedSync.pullVault.mockResolvedValue(sampleHoldings);
    await coordinator.signIn('user@example.com', 'password123');

    mockedAccount.signOut.mockRejectedValue(new Error('Failed to fetch'));

    await expect(coordinator.signOut()).rejects.toThrow('Failed to fetch');
    // Key material must be gone regardless of the network failure.
    expect(coordinator.isSignedIn).toBe(false);
    expect(coordinator.sessionUserId).toBeNull();
    expect(coordinator.sessionHoldings).toEqual([]);
    await expect(coordinator.pushHoldings(sampleHoldings)).rejects.toThrow('Not signed in.');
  });

  it('signOut clears state on success', async () => {
    mockedAccount.signIn.mockResolvedValue({ userId: 'u1', vmk });
    mockedSync.pullVault.mockResolvedValue(sampleHoldings);
    await coordinator.signIn('user@example.com', 'password123');
    mockedAccount.signOut.mockResolvedValue(undefined);

    await coordinator.signOut();

    expect(coordinator.isSignedIn).toBe(false);
    expect(coordinator.sessionHoldings).toEqual([]);
  });

  it('signIn rolls back when the remote pull fails (no half-signed-in state)', async () => {
    mockedAccount.signIn.mockResolvedValue({ userId: 'u1', vmk });
    mockedSync.pullVault.mockRejectedValue(new Error('Network error'));

    await expect(coordinator.signIn('user@example.com', 'password123')).rejects.toThrow('Network error');

    expect(coordinator.isSignedIn).toBe(false);
    expect(coordinator.sessionUserId).toBeNull();
    expect(coordinator.sessionHoldings).toEqual([]);
  });
});