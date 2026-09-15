/**
 * accountValidation.test.ts — unit tests for the pure account form validation.
 */

import { describe, it, expect } from 'vitest';
import {
  validateAccountForm,
  isAccountFormValid,
  MIN_PASSWORD_LENGTH,
} from './accountValidation';

const empty = { email: '', password: '', confirmPassword: '' };

describe('validateAccountForm', () => {
  it('requires a valid email for signin', () => {
    expect(validateAccountForm('signin', empty).email).toBeTruthy();
    expect(validateAccountForm('signin', { ...empty, email: 'not-an-email' }).email).toBeTruthy();
    expect(validateAccountForm('signin', { ...empty, email: 'user@example.com' }).email).toBeUndefined();
  });

  it('requires a non-empty password for signin', () => {
    const errors = validateAccountForm('signin', { ...empty, email: 'user@example.com' });
    expect(errors.password).toBeTruthy();

    const ok = validateAccountForm('signin', {
      email: 'user@example.com',
      password: 'anything',
      confirmPassword: '',
    });
    expect(ok.password).toBeUndefined();
  });

  it('requires a strong password for signup', () => {
    const short = validateAccountForm('signup', {
      email: 'user@example.com',
      password: 'short',
      confirmPassword: 'short',
    });
    expect(short.password).toContain(`at least ${MIN_PASSWORD_LENGTH}`);

    const ok = validateAccountForm('signup', {
      email: 'user@example.com',
      password: 'long-enough-pass',
      confirmPassword: 'long-enough-pass',
    });
    expect(ok.password).toBeUndefined();
  });

  it('rejects mismatched confirmation passwords for signup', () => {
    const errors = validateAccountForm('signup', {
      email: 'user@example.com',
      password: 'long-enough-pass',
      confirmPassword: 'different-pass',
    });
    expect(errors.confirmPassword).toBeTruthy();
  });

  it('validates recover mode like signup (new password + confirm)', () => {
    const errors = validateAccountForm('recover', {
      email: '',
      password: 'new-password',
      confirmPassword: 'new-password',
    });
    expect(errors.password).toBeUndefined();
    expect(errors.confirmPassword).toBeUndefined();

    const bad = validateAccountForm('recover', {
      email: '',
      password: 'new-password',
      confirmPassword: 'other-password',
    });
    expect(bad.confirmPassword).toBeTruthy();
  });

  it('only requires email for forgot mode', () => {
    const errors = validateAccountForm('forgot', empty);
    expect(errors.email).toBeTruthy();
    expect(errors.password).toBeUndefined();

    const ok = validateAccountForm('forgot', { ...empty, email: 'user@example.com' });
    expect(Object.keys(ok)).toHaveLength(0);
  });

  it('isAccountFormValid reflects the validate result', () => {
    expect(isAccountFormValid('signin', { ...empty, email: 'user@example.com', password: 'x' })).toBe(true);
    expect(isAccountFormValid('signin', { ...empty, email: 'bad', password: 'x' })).toBe(false);
  });
});