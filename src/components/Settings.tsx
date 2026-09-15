import React, { useState } from 'react';

interface SettingsProps {
  /** For account users: sends a password-reset email; resolves with a user-facing message. */
  onChangePassword: () => Promise<string>;
  onResetVault: () => void;
  onSignOut?: () => Promise<void>;
  accountEmail?: string | null;
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  onChangePassword,
  onResetVault,
  onSignOut,
  accountEmail,
  onClose,
}) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);

  const handleChangePassword = async () => {
    setPasswordBusy(true);
    setPasswordMessage(null);
    setPasswordError(null);
    try {
      const message = await onChangePassword();
      setPasswordMessage(message);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : String(err));
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (!onSignOut) return;
    setSignOutBusy(true);
    try {
      await onSignOut();
      // The app re-renders to the account screen; this modal unmounts.
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : String(err));
      setSignOutBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[#121212] border border-[#222222] w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200 text-gray-100 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white tracking-wide">Settings</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-[#222222] rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {accountEmail && (
          <section className="mb-8">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Account</h3>
            <div className="p-4 bg-zinc-900 rounded-xl border border-[#222222] space-y-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-bullion/15 border border-bullion/30 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-bullion" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-sm text-gray-300 font-medium truncate" title={accountEmail}>
                  {accountEmail}
                </span>
              </div>
              <button
                onClick={handleChangePassword}
                disabled={passwordBusy}
                className="w-full py-2.5 rounded-xl bg-[#222222] hover:bg-[#2A2A2A] text-gray-200 font-bold text-sm transition-colors border-0 disabled:opacity-50"
              >
                {passwordBusy ? 'Sending reset link…' : 'Change Password'}
              </button>
              {passwordMessage && (
                <p role="status" className="text-xs text-bullion font-medium leading-relaxed bg-bullion/10 border border-bullion/20 rounded-lg p-2.5">
                  {passwordMessage}
                </p>
              )}
              {passwordError && (
                <p role="alert" className="text-xs text-red-400 font-medium leading-relaxed bg-red-950/20 border border-red-900/40 rounded-lg p-2.5">
                  {passwordError}
                </p>
              )}
              <button
                onClick={handleSignOut}
                disabled={signOutBusy}
                className="w-full py-2.5 rounded-xl bg-red-950/20 hover:bg-red-950/40 text-red-400 font-bold text-sm border border-red-900/30 transition-colors disabled:opacity-50"
              >
                {signOutBusy ? 'Signing out…' : 'Sign Out'}
              </button>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Your vault stays encrypted in the cloud. Sign out clears your encryption key from this device.
              </p>
            </div>
          </section>
        )}

        <section className="mb-8">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Security</h3>
          <div className="p-4 bg-zinc-900 rounded-xl border border-[#222222]">
            <p className="text-sm text-gray-400 leading-relaxed">
              {accountEmail
                ? 'All holdings are encrypted with 256-bit AES-GCM before they leave this device.'
                : 'Your local vault is encrypted with your device password.'}
            </p>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-4">Danger Zone</h3>
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full py-3 rounded-xl bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/30 hover:border-red-800 font-bold transition-all text-sm"
            >
              Reset All Vault Data
            </button>
          ) : (
            <div className="bg-red-950/20 p-4 rounded-2xl border border-red-900/30">
              <p className="text-red-400 text-sm mb-4 leading-relaxed font-medium">
                Are you absolutely sure? This will permanently delete all your holdings{accountEmail ? ' from the cloud and' : ''} this device. This action cannot be undone.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2.5 bg-[#222222] hover:bg-[#333333] text-gray-300 rounded-xl font-bold text-sm transition-colors border-0"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onResetVault();
                    setShowConfirm(false);
                  }}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-red-900/10 border-0"
                >
                  Yes, Reset
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};