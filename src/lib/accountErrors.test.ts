/**
 * accountErrors.test.ts — unit tests for auth/sync error normalization.
 */

import { describe, it, expect } from 'vitest';
import { describeAuthError, describeSyncError } from './accountErrors';

describe('describeAuthError', () => {
  it('maps Supabase auth error codes to plain language', () => {
    expect(describeAuthError({ code: 'invalid_credentials', status: 400 })).toBe(
      'Incorrect email or password. Please try again.'
    );
    expect(describeAuthError({ code: 'user_already_exists' })).toContain('already exists');
    expect(describeAuthError({ code: 'email_not_confirmed' })).toContain('confirm your email');
    expect(describeAuthError({ code: 'user_not_found' })).toContain('No account found');
    expect(describeAuthError({ code: 'over_email_send_rate_limit' })).toContain('wait a few minutes');
    expect(describeAuthError({ code: 'otp_expired' })).toContain('expired');
  });

  it('maps generic unknown errors without leaking raw objects', () => {
    const message = describeAuthError(new Error('Something exploded'));
    expect(message).toBe('Something exploded');
    expect(describeAuthError({ random: 'object' })).toBe('Something went wrong. Please try again.');
    expect(describeAuthError(null)).toBe('Something went wrong. Please try again.');
  });

  it('maps network failures', () => {
    expect(describeAuthError(new TypeError('Failed to fetch'))).toContain('Network error');
    expect(describeAuthError(new Error('load failed'))).toContain('Network error');
  });

  it('maps edge-function recovery-setup failures to an actionable hint', () => {
    expect(describeAuthError(new Error('Recovery setup failed: Edge Function returned a non-2xx status code: 401'))).toContain(
      'vault keys'
    );
  });
});

describe('describeSyncError', () => {
  it('maps network failures', () => {
    expect(describeSyncError(new TypeError('Failed to fetch'))).toContain('sync server');
  });

  it('handles signed-out pushes', () => {
    expect(describeSyncError(new Error('Not signed in.'))).toContain('no longer signed in');
  });

  it('passes through unknown messages', () => {
    expect(describeSyncError(new Error('row-level security denies'))).toBe('row-level security denies');
  });
});