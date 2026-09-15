/**
 * accountValidation.ts — pure form validation for the account screen.
 *
 * Kept as a pure module (no React) so the rules are unit-testable in the node
 * test environment and reusable by any future form surface (e.g. an inline
 * embed on stackyourgold.com).
 */

export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface AccountFormValues {
  email: string;
  password: string;
  confirmPassword: string;
}

export type AccountFormMode = 'signin' | 'signup' | 'forgot' | 'recover';

export type AccountFormErrors = Partial<Record<'email' | 'password' | 'confirmPassword', string>>;

/**
 * Validate the account form for the given mode.
 * `signin` / `forgot` only need a valid email (signin also a non-empty password);
 * `signup` / `recover` require a strong password that matches its confirmation.
 */
export function validateAccountForm(
  mode: AccountFormMode,
  values: AccountFormValues
): AccountFormErrors {
  const errors: AccountFormErrors = {};
  const email = values.email.trim();

  if (mode === 'signup' || mode === 'signin' || mode === 'forgot') {
    if (!email) {
      errors.email = 'Please enter your email address.';
    } else if (!EMAIL_RE.test(email)) {
      errors.email = 'Please enter a valid email address.';
    }
  }

  if (mode === 'signin') {
    if (!values.password) {
      errors.password = 'Please enter your password.';
    }
  }

  if (mode === 'signup' || mode === 'recover') {
    if (!values.password) {
      errors.password = 'Please choose a password.';
    } else if (values.password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (values.confirmPassword !== values.password) {
      errors.confirmPassword = 'Passwords do not match.';
    }
  }

  return errors;
}

/** True when {@link validateAccountForm} returns no errors. */
export function isAccountFormValid(mode: AccountFormMode, values: AccountFormValues): boolean {
  return Object.keys(validateAccountForm(mode, values)).length === 0;
}
