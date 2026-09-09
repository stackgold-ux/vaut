import { useState, useEffect } from 'react';
import { useVault } from './hooks/useVault';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './components/Dashboard';
import { AddHoldingsForm } from './components/AddHoldingsForm';
import { Settings } from './components/Settings';
import { isStandalone, isInIframe } from './utils/pwa';

function App() {
  const vault = useVault();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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
    return (
      <LoginScreen 
        onUnlock={vault.unlock} 
        onCreate={vault.create}
        isFirstTime={vault.vaultExists === false}
      />
    );
  }

  return (
    <div className={`min-h-screen ${mode === 'inline' ? 'bg-transparent' : 'bg-obsidian'}`}>
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
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
