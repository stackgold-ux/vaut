/**
 * recoveryLink.test.ts — unit tests for the password-recovery flow helpers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isRecoveryPending,
  markRecoveryPending,
  clearRecoveryPending,
  hasRecoveryLinkInUrl,
  watchRecoveryLink,
} from './recoveryLink';
import { setSupabaseForTesting, resetSupabaseForTesting } from './supabase';

interface FakeAuth {
  _emit: (event: string, session: unknown) => void;
  onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
    data: { subscription: { unsubscribe: () => void } };
  };
}

interface FakeSupabase {
  auth: FakeAuth;
}

function createFakeAuth(): FakeAuth {
  let listeners: Array<(event: string, session: unknown) => void> = [];
  return {
    onAuthStateChange: (cb) => {
      listeners.push(cb);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              listeners = listeners.filter((l) => l !== cb);
            },
          },
        },
      };
    },
    _emit: (event, session) => {
      listeners.forEach((l) => l(event, session));
    },
  };
}

function createFakeSupabase(): FakeSupabase {
  return { auth: createFakeAuth() };
}

// Minimal sessionStorage shim (node env has none) so the pending flag helpers work.
const storageShim = new Map<string, string>();
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => storageShim.get(k) ?? null,
    setItem: (k: string, v: string) => void storageShim.set(k, v),
    removeItem: (k: string) => void storageShim.delete(k),
  },
});

beforeEach(() => {
  storageShim.clear();
});

afterEach(() => {
  resetSupabaseForTesting();
  delete (globalThis as Record<string, unknown>).window;
});

describe('recovery-link pending flag', () => {
  it('is not pending by default', () => {
    expect(isRecoveryPending()).toBe(false);
  });

  it('mark + clear round-trips', () => {
    markRecoveryPending();
    expect(isRecoveryPending()).toBe(true);
    clearRecoveryPending();
    expect(isRecoveryPending()).toBe(false);
  });

  it('detects a recovery link in the URL hash', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { location: { hash: '#access_token=abc&type=recovery' } },
    });
    expect(hasRecoveryLinkInUrl()).toBe(true);

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { location: { hash: '' } },
    });
    expect(hasRecoveryLinkInUrl()).toBe(false);
  });
});

describe('watchRecoveryLink', () => {
  it('calls back and flags the session when PASSWORD_RECOVERY fires', () => {
    const fake = createFakeSupabase();
    setSupabaseForTesting(fake as unknown as SupabaseClient);

    const onRecovery = vi.fn();
    const unsubscribe = watchRecoveryLink(onRecovery);

    fake.auth._emit('PASSWORD_RECOVERY', { user: { id: 'u1' } });
    expect(onRecovery).toHaveBeenCalledTimes(1);
    expect(isRecoveryPending()).toBe(true);

    // Unsubscribing stops future notifications.
    unsubscribe();
    fake.auth._emit('PASSWORD_RECOVERY', { user: { id: 'u2' } });
    expect(onRecovery).toHaveBeenCalledTimes(1);
  });

  it('ignores non-recovery auth events', () => {
    const fake = createFakeSupabase();
    setSupabaseForTesting(fake as unknown as SupabaseClient);

    const onRecovery = vi.fn();
    watchRecoveryLink(onRecovery);

    fake.auth._emit('SIGNED_IN', { user: { id: 'u1' } });
    fake.auth._emit('TOKEN_REFRESHED', { user: { id: 'u1' } });
    expect(onRecovery).not.toHaveBeenCalled();
    expect(isRecoveryPending()).toBe(false);
  });
});