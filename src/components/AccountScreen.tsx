import React, { useEffect, useMemo, useState } from 'react';
import heroImage from '../assets/hero.png';
import {
  validateAccountForm,
  type AccountFormMode,
} from '../lib/accountValidation';
import { describeAuthError } from '../lib/accountErrors';

export type AccountScreenMode = 'signin' | 'signup' | 'forgot' | 'recover';

interface AccountScreenProps {
  /** Which screen to show on first render. */
  initialMode?: AccountScreenMode;
  /** Email to pre-fill (e.g. restored session where only the password is needed). */
  prefilledEmail?: string | null;
  /** True when a password-recovery session is active — shows the "set new password" flow. */
  recoveryPending?: boolean;
  /** True while any auth call is in flight (disables the form). */
  busy?: boolean;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onRecoverKey: (newPassword: string) => Promise<void>;
  /** Lets existing local-only users keep using their device vault without an account. */
  onContinueLocal?: () => void;
}

const TAGLINES: Partial<Record<AccountScreenMode, string>> = {
  signin: 'Sign in to unlock your encrypted vault',
  signup: 'Create your account — encrypted on your device',
  forgot: 'We will email you a secure reset link',
  recover: 'Set a new password to recover your vault',
};

const PRIMARY_BUTTON_LABEL: Partial<Record<AccountScreenMode, string>> = {
  signin: 'Unlock Vault',
  signup: 'Create Account',
  forgot: 'Send Reset Link',
  recover: 'Set New Password & Recover',
};

const Spinner: React.FC = () => (
  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const inputClass =
  'w-full px-4 py-3 rounded-xl border bg-zinc-900 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-bullion focus:border-transparent transition-all border-[#333333]';

const inputErrorClass =
  'w-full px-4 py-3 rounded-xl border bg-zinc-900 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all border-red-500/70 focus:ring-red-500/50';

export const AccountScreen: React.FC<AccountScreenProps> = ({
  initialMode = 'signin',
  prefilledEmail,
  recoveryPending = false,
  busy = false,
  onSignIn,
  onSignUp,
  onResetPassword,
  onRecoverKey,
  onContinueLocal,
}) => {
  const [mode, setMode] = useState<AccountScreenMode>(initialMode);
  const [email, setEmail] = useState(prefilledEmail ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // A recovery session (e.g. the user opened the app from a reset email) always
  // drives the "set new password" flow.
  useEffect(() => {
    if (recoveryPending) {
      setMode('recover');
      setError(null);
    }
  }, [recoveryPending]);

  const values = useMemo(
    () => ({ email, password, confirmPassword }),
    [email, password, confirmPassword]
  );

  const switchMode = (next: AccountScreenMode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setFieldErrors({});
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const formMode = mode === 'recover' ? 'recover' : mode;
    const errors = validateAccountForm(formMode as AccountFormMode, values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      switch (mode) {
        case 'signin':
          await onSignIn(email.trim(), password);
          break;
        case 'signup':
          await onSignUp(email.trim(), password);
          break;
        case 'forgot':
          await onResetPassword(email.trim());
          setNotice('Reset link sent — check your email inbox (and spam folder), then follow the link to set a new password.');
          break;
        case 'recover':
          await onRecoverKey(password);
          break;
      }
      // Clear the password fields after any successful auth transition.
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const isBusy = busy || submitting;
  const showConfirm = mode === 'signup' || mode === 'recover';
  const showLocalOption = mode === 'signin' || mode === 'signup' || mode === 'forgot';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-obsidian p-4 text-gray-100">
      <div className="bg-[#121212] border border-[#222222] p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src={heroImage}
            alt=""
            className="w-24 h-24 mx-auto mb-4 rounded-2xl shadow-lg object-cover border border-[#333333]"
          />
          <h1 className="text-2xl font-bold text-white tracking-wide">Stack Your Vault</h1>
          <p className="text-gray-400 mt-1 text-sm">{TAGLINES[mode] ?? TAGLINES.signin}</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* Email */}
          {mode !== 'recover' && (
            <div className="mb-4">
              <label htmlFor="account-email" className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                Email
              </label>
              <input
                id="account-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isBusy}
                aria-invalid={Boolean(fieldErrors.email)}
                className={fieldErrors.email ? inputErrorClass : inputClass}
                placeholder="you@example.com"
                autoFocus
              />
              {fieldErrors.email && (
                <p role="alert" className="text-red-500 text-sm mt-2 font-medium">
                  {fieldErrors.email}
                </p>
              )}
            </div>
          )}

          {/* Password */}
          <div className={mode === 'recover' ? '' : 'mb-4'}>
            <label htmlFor="account-password" className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
              {mode === 'recover' ? 'New Password' : 'Password'}
            </label>
            <input
              id="account-password"
              type="password"
              autoComplete={mode === 'signup' || mode === 'recover' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isBusy}
              aria-invalid={Boolean(fieldErrors.password)}
              className={fieldErrors.password ? inputErrorClass : inputClass}
              placeholder={mode === 'recover' || mode === 'signup' ? 'At least 8 characters' : '••••••••'}
            />
            {fieldErrors.password && (
              <p role="alert" className="text-red-500 text-sm mt-2 font-medium">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Confirm password (signup + recover) */}
          {showConfirm && (
            <div className="mb-4">
              <label htmlFor="account-confirm" className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                Confirm Password
              </label>
              <input
                id="account-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isBusy}
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                className={fieldErrors.confirmPassword ? inputErrorClass : inputClass}
                placeholder="Repeat your password"
              />
              {fieldErrors.confirmPassword && (
                <p role="alert" className="text-red-500 text-sm mt-2 font-medium">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>
          )}

          {/* Forgot password link */}
          {mode === 'signin' && (
            <div className="text-right mb-4 -mt-1">
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                disabled={isBusy}
                className={`text-sm font-semibold text-bullion hover:brightness-110 transition-colors ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* Global error / notice */}
          {error && (
            <div role="alert" className="mb-4 p-3 rounded-xl bg-red-950/20 border border-red-900/40 text-red-400 text-sm font-medium leading-relaxed">
              {error}
            </div>
          )}
          {notice && (
            <div role="status" className="mb-4 p-3 rounded-xl bg-bullion/10 border border-bullion/25 text-bullion text-sm font-medium leading-relaxed">
              {notice}
            </div>
          )}

          <button
            type="submit"
            disabled={isBusy}
            aria-busy={isBusy}
            className="w-full bg-bullion hover:brightness-110 active:brightness-95 text-black font-bold py-3 rounded-xl transition-all shadow-lg shadow-bullion/10 flex justify-center items-center disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isBusy ? <Spinner /> : PRIMARY_BUTTON_LABEL[mode]}
          </button>
        </form>

        {/* Mode switcher */}
        <div className="mt-6 space-y-2 text-center">
          {mode === 'signin' && (
            <p className="text-sm text-gray-400">
              New here?{' '}
              <button type="button" onClick={() => switchMode('signup')} disabled={isBusy} className="font-bold text-bullion hover:brightness-110 transition-colors">
                Create an account
              </button>
            </p>
          )}
          {mode === 'signup' && (
            <p className="text-sm text-gray-400">
              Already have an account?{' '}
              <button type="button" onClick={() => switchMode('signin')} disabled={isBusy} className="font-bold text-bullion hover:brightness-110 transition-colors">
                Sign in
              </button>
            </p>
          )}
          {mode === 'forgot' && (
            <button type="button" onClick={() => switchMode('signin')} disabled={isBusy} className="text-sm font-bold text-bullion hover:brightness-110 transition-colors">
              Back to sign in
            </button>
          )}
          {mode === 'recover' && !recoveryPending && (
            <p className="text-sm text-gray-400">
              Remembered it?{' '}
              <button type="button" onClick={() => switchMode('signin')} disabled={isBusy} className="font-bold text-bullion hover:brightness-110 transition-colors">
                Sign in
              </button>
            </p>
          )}

          {showLocalOption && onContinueLocal && (
            <div className="pt-3 mt-2 border-t border-[#222222]">
              <button
                type="button"
                onClick={onContinueLocal}
                disabled={isBusy}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors font-medium"
              >
                Skip for now — continue with a local vault on this device
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-gray-600 mt-6 leading-relaxed">
          Your vault is encrypted with 256-bit AES-GCM. Your password never leaves this device.
        </p>
      </div>
    </div>
  );
};

export default AccountScreen;