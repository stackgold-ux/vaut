import React, { useState } from 'react';
import heroImage from '../assets/hero.png';

interface LoginScreenProps {
  onUnlock: (password: string) => Promise<boolean>;
  onCreate?: (password: string) => Promise<boolean>;
  isFirstTime?: boolean;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onUnlock, onCreate, isFirstTime = false }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    
    try {
      let success = false;
      if (isFirstTime && onCreate) {
        success = await onCreate(password);
      } else {
        success = await onUnlock(password);
      }
      
      if (!success) {
        setError(true);
      }
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-obsidian p-4 text-gray-100">
      <div className="bg-[#121212] border border-[#222222] p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <img 
            src={heroImage} 
            alt="Stack Your Vault Hero" 
            className="w-32 h-32 mx-auto mb-4 rounded-2xl shadow-lg object-cover border border-[#333333]" 
          />
          <h1 className="text-2xl font-bold text-white tracking-wide">Stack Your Vault</h1>
          <p className="text-gray-400 mt-1 text-sm">
            {isFirstTime ? 'Create your secure vault password' : 'Enter password to unlock your vault'}
          </p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className={`w-full px-4 py-3 rounded-xl border bg-zinc-900 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-bullion focus:border-transparent transition-all ${error ? 'border-red-500' : 'border-[#333333]'}`}
              placeholder="••••••••"
              autoFocus
            />
            {error && (
              <p className="text-red-500 text-sm mt-2 font-medium">
                {isFirstTime ? 'Failed to create vault.' : 'Incorrect password. Please try again.'}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-bullion hover:brightness-110 active:brightness-95 text-black font-bold py-3 rounded-xl transition-all shadow-lg shadow-bullion/10 flex justify-center items-center"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              isFirstTime ? 'Create Vault' : 'Unlock Vault'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
