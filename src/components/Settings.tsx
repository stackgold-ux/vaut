import React, { useState } from 'react';

interface SettingsProps {
  onChangePassword: (newPass: string) => void;
  onResetVault: () => void;
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onResetVault, onClose }) => {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[#121212] border border-[#222222] w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200 text-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white tracking-wide">Settings</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-[#222222] rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <section className="mb-8">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Security</h3>
          <div className="p-4 bg-zinc-900 rounded-xl border border-[#222222]">
            <p className="text-sm text-gray-400 leading-relaxed">
              Password change is disabled in this version to protect your highly secure encrypted local data.
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
                Are you absolutely sure? This will permanently delete all your holdings and local vault files. This action cannot be undone.
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
