/**
 * accountErrors.ts — normalize auth / sync errors into clear, user-facing messages.
 *
 * Supabase errors arrive as `AuthApiError` / `PostgrestError` / edge-function
 * failures with machine codes; we map the common ones to plain language so the UI
 * never shows a raw `{ code, message, status }` object or a cryptic status code.
 */

/** Friendly message for an auth-flow failure (sign in, sign up, reset, recover). */
export function describeAuthError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { code?: string; name?: string; message?: string; status?: number };
    switch (e.code) {
      case 'invalid_credentials':
        return 'Incorrect email or password. Please try again.';
      case 'user_already_exists':
        return 'An account with this email already exists. Try signing in instead.';
      case 'email_not_confirmed':
        return 'Please confirm your email address before signing in. Check your inbox for the confirmation link.';
      case 'user_not_found':
        return 'No account found for this email address.';
      case 'weak_password':
        return 'That password is too weak. Use at least 8 characters.';
      case 'over_email_send_rate_limit':
        return 'We just sent an email — please wait a few minutes before requesting another.';
      case 'otp_expired':
        return 'That reset link has expired. Request a new one below.';
      case 'access_denied':
      case 'refresh_token_not_found':
      case 'session_expired':
        return 'Your session has expired. Please sign in again.';
      case 'same_password':
        return 'The new password must be different from your current one.';
    }
  }

  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'object' &&
          err !== null &&
          typeof (err as { message?: unknown }).message === 'string'
        ? ((err as { message: string }).message)
        : '';

  // Edge-function / recovery-setup failures (e.g. email confirmation still pending
  // so there is no session for the vault-key setup call).
  if (/recovery setup failed/i.test(message) || /non-2xx status code/i.test(message)) {
    return 'We could not finish setting up your vault keys. If your account needs email confirmation, confirm it first, then sign in. Otherwise please try again.';
  }

  // Network-level failures (fetch throws TypeError('Failed to fetch') etc.).
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return 'Network error — check your connection and try again.';
  }

  return message || 'Something went wrong. Please try again.';
}

/** Friendly message for a vault sync failure (push/pull of encrypted holdings). */
export function describeSyncError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? '');

  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return 'Could not reach the sync server — check your connection and try again.';
  }
  if (/not signed in/i.test(message)) {
    return 'You are no longer signed in. Sign in again to sync your vault.';
  }
  return message || 'Failed to sync your vault. Please try again.';
}
