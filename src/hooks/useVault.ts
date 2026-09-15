import { useState, useEffect, useRef } from 'react';
import type { Holding, Metal } from '../types';
import { VaultStorage } from '../lib/storage';
import { VaultSyncCoordinator } from '../lib/vaultSyncCoordinator';
import {
  resetPassword as requestPasswordReset,
  getCurrentUserId,
} from '../lib/account';
import { getSupabase } from '../lib/supabase';
import {
  watchRecoveryLink,
  isRecoveryPending,
  hasRecoveryLinkInUrl,
  clearRecoveryPending,
} from '../lib/recoveryLink';
import { describeAuthError, describeSyncError } from '../lib/accountErrors';

const storage = new VaultStorage();

/** The signed-in account visible to the UI (VMK itself never leaves the coordinator). */
export interface AccountInfo {
  userId: string;
  email: string | null;
}

export const useVault = () => {
  const coordinatorRef = useRef<VaultSyncCoordinator | null>(null);
  if (!coordinatorRef.current) coordinatorRef.current = new VaultSyncCoordinator();

  const [isInitialized, setIsInitialized] = useState(false);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [isLocked, setIsLocked] = useState(true);
  const [vaultExists, setVaultExists] = useState<boolean | null>(null);

  // Cross-device account state.
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribeRecovery: (() => void) | undefined;

    const init = async () => {
      await storage.init();
      if (!cancelled) setVaultExists(await storage.exists());

      // Session persistence: if a Supabase session exists, restore it and prompt
      // for the password (the VMK is unwrapped by signIn) or drive the recovery
      // flow when the session came from a password-reset email.
      try {
        const userId = await getCurrentUserId();
        if (!cancelled && userId) {
          let email: string | null = null;
          try {
            const { data } = await getSupabase().auth.getUser();
            email = data.user?.email ?? null;
          } catch {
            /* email is a nicety — non-fatal */
          }
          setAccount({ userId, email });
          setRecoveryPending(isRecoveryPending() || hasRecoveryLinkInUrl());
        } else if (!cancelled) {
          clearRecoveryPending();
        }
      } catch (err) {
        // Session restore failed (e.g. offline) — show the account screen; the
        // user can still sign in once connectivity returns.
        console.warn('Session restore failed; showing account screen.', err);
      }

      if (!cancelled) setIsInitialized(true);
    };

    // The user may open the app from a password-reset email while it is already
    // running; keep the recovery flow in sync whenever a PASSWORD_RECOVERY
    // session becomes active.
    unsubscribeRecovery = watchRecoveryLink(() => {
      if (cancelled) return;
      setRecoveryPending(true);
      getCurrentUserId()
        .then((uid) => {
          if (!uid || cancelled) return;
          getSupabase()
            .auth.getUser()
            .then(({ data }) => {
              if (!cancelled) {
                setAccount((prev) => prev ?? { userId: uid, email: data.user?.email ?? null });
              }
            })
            .catch(() => undefined);
        })
        .catch(() => undefined);
    });

    init();

    return () => {
      cancelled = true;
      unsubscribeRecovery?.();
      storage.close();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Local-only path (device vault, no account) — preserved for offline use and
  // for users who choose "continue locally". Once signed in, the Supabase vault
  // is authoritative; the local IndexedDB store is intentionally left untouched
  // while a session is active (no cross-key migration in this version).
  // ---------------------------------------------------------------------------

  const unlock = async (password: string) => {
    try {
      const success = await storage.unlockVault(password);
      if (success) {
        const loadedHoldings = await storage.loadHoldings();
        setHoldings(loadedHoldings);
        setIsLocked(false);
        return true;
      }
    } catch (e) {
      console.error('Failed to unlock', e);
    }
    return false;
  };

  const create = async (password: string) => {
    try {
      await storage.createVault(password);
      setHoldings([]);
      setIsLocked(false);
      setVaultExists(true);
      return true;
    } catch (e) {
      console.error('Failed to create vault', e);
      return false;
    }
  };

  // ---------------------------------------------------------------------------
  // Account + sync flows
  // ---------------------------------------------------------------------------

  const signIn = async (email: string, password: string) => {
    setAccountBusy(true);
    try {
      const coordinator = coordinatorRef.current!;
      await coordinator.signIn(email, password);
      setHoldings(coordinator.sessionHoldings);
      setAccount({ userId: coordinator.sessionUserId!, email: email.trim() });
      setSyncError(null);
      clearRecoveryPending();
      setRecoveryPending(false);
      setIsLocked(false);
    } catch (err) {
      throw new Error(describeAuthError(err));
    } finally {
      setAccountBusy(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    setAccountBusy(true);
    try {
      const coordinator = coordinatorRef.current!;
      await coordinator.signUp(email, password);
      setHoldings(coordinator.sessionHoldings);
      setAccount({ userId: coordinator.sessionUserId!, email: email.trim() });
      setSyncError(null);
      clearRecoveryPending();
      setRecoveryPending(false);
      setIsLocked(false);
    } catch (err) {
      throw new Error(describeAuthError(err));
    } finally {
      setAccountBusy(false);
    }
  };

  const resetPassword = async (email: string) => {
    setAccountBusy(true);
    try {
      await requestPasswordReset(email.trim());
    } catch (err) {
      throw new Error(describeAuthError(err));
    } finally {
      setAccountBusy(false);
    }
  };

  const recoverKey = async (newPassword: string) => {
    setAccountBusy(true);
    try {
      const coordinator = coordinatorRef.current!;
      await coordinator.recoverKey(newPassword);
      setHoldings(coordinator.sessionHoldings);
      setAccount({ userId: coordinator.sessionUserId!, email: account?.email ?? null });
      clearRecoveryPending();
      setRecoveryPending(false);
      setIsLocked(false);
    } catch (err) {
      throw new Error(describeAuthError(err));
    } finally {
      setAccountBusy(false);
    }
  };

  const signOut = async () => {
    setAccountBusy(true);
    try {
      await coordinatorRef.current!.signOut();
    } catch (err) {
      throw new Error(describeAuthError(err));
    } finally {
      // VMK is already cleared inside the coordinator; clear all UI state too.
      setAccount(null);
      setRecoveryPending(false);
      clearRecoveryPending();
      setHoldings([]);
      setSyncError(null);
      setIsLocked(true);
      setAccountBusy(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Mutations — push to Supabase when signed in, otherwise local IndexedDB.
  // ---------------------------------------------------------------------------

  /** Optimistic local state + cloud push (when signed in), with a visible error on sync failure. */
  const persistHoldings = async (newHoldings: Holding[]) => {
    const coordinator = coordinatorRef.current!;
    setHoldings(newHoldings);
    if (coordinator.isSignedIn) {
      try {
        await coordinator.pushHoldings(newHoldings);
        setSyncError(null);
      } catch (err) {
        // Keep the change visible; fall back to the local encrypted store so
        // nothing is lost, and surface the sync failure so the user can retry.
        try {
          await storage.saveHoldings(newHoldings);
        } catch {
          /* best-effort offline backup */
        }
        setSyncError(describeSyncError(err));
      }
    } else {
      await storage.saveHoldings(newHoldings);
    }
  };

  const addHolding = async (
    metal: Metal,
    quantity: number,
    unit: string,
    purchaseDate?: string,
    purchasePrice?: number,
    description?: string,
    photoUrl?: string
  ) => {
    const newHolding: Holding = {
      id: crypto.randomUUID(),
      metal,
      quantity,
      unit,
      addedDate: new Date().toISOString(),
      purchaseDate,
      purchasePrice,
      description,
      photoUrl,
    };
    await persistHoldings([...holdings, newHolding]);
  };

  const removeHolding = async (id: string) => {
    await persistHoldings(holdings.filter((h) => h.id !== id));
  };

  const resetVault = async () => {
    const coordinator = coordinatorRef.current!;
    if (coordinator.isSignedIn) {
      try {
        await coordinator.pushHoldings([]);
        setHoldings([]);
        setSyncError(null);
      } catch (err) {
        setSyncError(describeSyncError(err));
      }
    } else {
      await storage.saveHoldings([]);
      setHoldings([]);
      await lock();
    }
  };

  const lock = async () => {
    const coordinator = coordinatorRef.current!;
    if (coordinator.isSignedIn) {
      await signOut();
    } else {
      await storage.lockVault();
      setHoldings([]);
      setIsLocked(true);
    }
  };

  /**
   * Change password. For account users this sends a password-reset email; the
   * user then follows the link and the app drives the recover flow (recoverKey),
   * which re-wraps the VMK under the new password. Returns a user-facing message.
   */
  const changePassword = async (): Promise<string> => {
    if (account?.email) {
      await resetPassword(account.email);
      return 'A password reset link was sent to your email. Follow it to set a new password — your vault stays intact.';
    }
    throw new Error('Password change is only available when signed in to an account.');
  };

  return {
    holdings,
    isLocked,
    isInitialized,
    vaultExists,
    unlock,
    lock,
    create,
    addHolding,
    removeHolding,
    resetVault,
    changePassword,
    // account + sync
    account,
    recoveryPending,
    accountBusy,
    syncError,
    clearSyncError: () => setSyncError(null),
    signIn,
    signUp,
    resetPassword,
    recoverKey,
    signOut,
  };
};
