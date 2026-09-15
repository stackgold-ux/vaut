/**
 * recoveryLink.ts — detect and track the password-recovery flow.
 *
 * Supabase emits a `PASSWORD_RECOVERY` auth event when the app session is
 * created from a "reset password" email link (the URL hash carries an
 * `access_token` with `type=recovery`). Because the event is not re-emitted on
 * later app loads (the session is then restored from local storage), we also
 * persist a short-lived flag in sessionStorage so the app keeps showing the
 * "set a new password" screen until the recovery completes or the session ends.
 */

import { getSupabase } from './supabase';

const RECOVERY_PENDING_KEY = 'suv.recovery-pending';

/** True when a recovery-link session was detected on this tab/session. */
export function isRecoveryPending(): boolean {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(RECOVERY_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function markRecoveryPending(): void {
  try {
    sessionStorage.setItem(RECOVERY_PENDING_KEY, '1');
  } catch {
    /* sessionStorage unavailable (private mode) — recovery still proceeds via the auth event */
  }
}

export function clearRecoveryPending(): void {
  try {
    sessionStorage.removeItem(RECOVERY_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

/** True when the current URL looks like a password-recovery link. */
export function hasRecoveryLinkInUrl(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hash.includes('type=recovery');
}

/**
 * Subscribe to `PASSWORD_RECOVERY` auth events. Returns an unsubscribe function.
 * Fires whenever a recovery-session becomes active (e.g. the user opened the app
 * from a password-reset email), even if the app was already open.
 */
export function watchRecoveryLink(onRecovery: () => void): () => void {
  const { data } = getSupabase().auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      markRecoveryPending();
      onRecovery();
    }
  });
  return () => data.subscription.unsubscribe();
}