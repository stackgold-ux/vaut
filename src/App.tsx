import { useState, useEffect } from 'react';
import { useVault } from './hooks/useVault';
import { AccountScreen } from './components/AccountScreen';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './components/Dashboard';
import { AddHoldingsForm } from './components/AddHoldingsForm';
import { Settings } from './components/Settings';
import { isStandalone, isInIframe } from './utils/pwa';

function App() {
  const vault = useVault();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [localOnly, setLocalOnly] = useState(false);
  const [mode, setMode] = useState<'standalone' | 'inline'>('inline');

  useEffect(() => {
    // Detect mode
    const checkMode = () => {
      if (isStandalone() || !isInIframe()) {
        setMode('standalone');
      } else {
        setMode('inline');
      }
    };

    checkMode();
    // Also check if URL param 'mode=inline' is present (useful for testing)
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'inline') {
      setMode('inline');
    }
  }, []);

  if (!vault.isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-obsidian">
        <div className="animate-spin h-8 w-8 border-4 border-bullion border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (vault.isLocked) {
    // Local-only users (no account) keep the original password gate.
    if (localOnly) {
      return (
        <LoginScreen
          onUnlock={vault.unlock}
          onCreate={vault.create}
          isFirstTime={vault.vaultExists === false}
          onBackToAccount={() => setLocalOnly(false)}
        />
      );
    }

    return (
      <AccountScreen
        initialMode={vault.recoveryPending ? 'recover' : 'signin'}
        prefilledEmail={vault.account?.email}
        recoveryPending={vault.recoveryPending}
        busy={vault.accountBusy}
        onSignIn={vault.signIn}
        onSignUp={vault.signUp}
        onResetPassword={vault.resetPassword}
        onRecoverKey={vault.recoverKey}
        onContinueLocal={() => setLocalOnly(true)}
      />
    );
  }

  return (
    <div className={`min-h-screen ${mode === 'inline' ? 'bg-transparent' : 'bg-obsidian'}`}>
      {vault.syncError && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-2rem)] max-w-xl">
          <div
            role="alert"
            className="bg-red-950/40 backdrop-blur border border-red-800/60 text-red-300 text-sm font-medium rounded-xl px-4 py-3 shadow-2xl flex items-center justify-between gap-3"
          >
            <span>{vault.syncError}</span>
            <button
              onClick={vault.clearSyncError}
              className="p-1 text-red-400/80 hover:text-red-200 flex-shrink-0"
              aria-label="Dismiss sync error"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <Dashboard
        holdings={vault.holdings}
        onAddClick={() => setShowAddForm(true)}
        onSettingsClick={() => setShowSettings(true)}
        onLock={vault.lock}
        onRemove={vault.removeHolding}
      />

      {showAddForm && (
        <AddHoldingsForm
          onAdd={(metal, quantity, unit, purchaseDate, purchasePrice, description, photoUrl) => {
            vault.addHolding(metal, quantity, unit, purchaseDate, purchasePrice, description, photoUrl);
            setShowAddForm(false);
          }}
          onClose={() => setShowAddForm(false)}
        />
      )}

      {showSettings && (
        <Settings
          onChangePassword={vault.changePassword}
          onResetVault={vault.resetVault}
          onSignOut={vault.signOut}
          accountEmail={vault.account?.email ?? null}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;