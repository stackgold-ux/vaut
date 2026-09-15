// @vitest-environment jsdom
/**
 * AccountScreen.test.tsx — component tests for the cross-device account screen.
 * Covers mode switching, validation, the forgot-password notice, error surfacing
 * and the recovery flow, with mocked auth callbacks (no network).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { AccountScreen } from './AccountScreen';

vi.mock('../assets/hero.png', () => ({ default: 'hero.png' }));

// Without `globals: true` in the vitest config, @testing-library/react cannot
// auto-register cleanup — do it explicitly so renders don't leak between tests.
afterEach(cleanup);

function makeCallbacks() {
  return {
    onSignIn: vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
    onSignUp: vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
    onResetPassword: vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
    onRecoverKey: vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
    onContinueLocal: vi.fn<() => void>(),
  };
}

const VALID_EMAIL = 'stacker@example.com';
const VALID_PASSWORD = 'long-enough-pass';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AccountScreen — sign in', () => {
  it('renders the sign-in form by default', () => {
    render(<AccountScreen {...makeCallbacks()} />);
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unlock Vault' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Forgot password?' })).toBeTruthy();
  });

  it('pre-fills the email for a restored session', () => {
    render(<AccountScreen {...makeCallbacks()} prefilledEmail={VALID_EMAIL} />);
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe(VALID_EMAIL);
  });

  it('calls onSignIn with the entered credentials', async () => {
    const callbacks = makeCallbacks();
    render(<AccountScreen {...callbacks} />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: VALID_EMAIL } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: VALID_PASSWORD } });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock Vault' }));

    await waitFor(() => expect(callbacks.onSignIn).toHaveBeenCalledWith(VALID_EMAIL, VALID_PASSWORD));
  });

  it('shows an inline validation error for a malformed email', async () => {
    render(<AccountScreen {...makeCallbacks()} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: VALID_PASSWORD } });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock Vault' }));

    expect((await screen.findByRole('alert')).textContent).toContain('valid email');
  });

  it('surfaces friendly auth errors instead of silent failures', async () => {
    const callbacks = makeCallbacks();
    callbacks.onSignIn.mockRejectedValue(new Error('Incorrect email or password. Please try again.'));
    render(<AccountScreen {...callbacks} />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: VALID_EMAIL } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock Vault' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Incorrect email or password.');
  });

  it('switches to sign up and shows the confirm-password field', () => {
    render(<AccountScreen {...makeCallbacks()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));

    expect(screen.getByLabelText('Confirm Password')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeTruthy();
  });
});

describe('AccountScreen — sign up', () => {
  it('calls onSignUp and rejects mismatched confirmation', async () => {
    const callbacks = makeCallbacks();
    render(<AccountScreen {...callbacks} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: VALID_EMAIL } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: VALID_PASSWORD } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'different-pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect((await screen.findByRole('alert')).textContent).toContain('do not match');
    expect(callbacks.onSignUp).not.toHaveBeenCalled();
  });
});

describe('AccountScreen — forgot password', () => {
  it('sends the reset email and shows a check-your-inbox notice', async () => {
    const callbacks = makeCallbacks();
    render(<AccountScreen {...callbacks} />);

    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: VALID_EMAIL } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    await waitFor(() => expect(callbacks.onResetPassword).toHaveBeenCalledWith(VALID_EMAIL));
    expect((await screen.findByRole('status')).textContent).toContain('Reset link sent');
  });
});

describe('AccountScreen — recovery', () => {
  it('renders the recover flow when a recovery session is pending', async () => {
    render(<AccountScreen {...makeCallbacks()} recoveryPending initialMode="signin" />);
    // The screen auto-switches to recover mode once the recovery session is known.
    expect(await screen.findByLabelText('New Password')).toBeTruthy();
    expect(screen.getByLabelText('Confirm Password')).toBeTruthy();
    expect(screen.getByRole('button', { name: /set new password/i })).toBeTruthy();
  });

  it('drives recoverKey with the new password', async () => {
    const callbacks = makeCallbacks();
    render(<AccountScreen {...callbacks} initialMode="recover" />);

    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: VALID_PASSWORD } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: VALID_PASSWORD } });
    fireEvent.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() => expect(callbacks.onRecoverKey).toHaveBeenCalledWith(VALID_PASSWORD));
  });
});

describe('AccountScreen — local fallback', () => {
  it('offers continuing with a local-only vault', () => {
    const callbacks = makeCallbacks();
    render(<AccountScreen {...callbacks} />);
    fireEvent.click(screen.getByRole('button', { name: /continue with a local vault/i }));
    expect(callbacks.onContinueLocal).toHaveBeenCalled();
  });
});