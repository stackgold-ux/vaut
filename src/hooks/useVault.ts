import { useState, useEffect, useCallback } from 'react';
import type { Holding, Metal } from '../types';
import { VaultStorage } from '../lib/storage';

const storage = new VaultStorage();

export const useVault = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [isLocked, setIsLocked] = useState(true);
  const [vaultExists, setVaultExists] = useState<boolean | null>(null);

  useEffect(() => {
    const initStorage = async () => {
      await storage.init();
      const exists = await storage.exists();
      setVaultExists(exists);
      setIsInitialized(true);
    };
    initStorage();
    return () => {
      storage.close();
    };
  }, []);

  const unlock = async (password: string) => {
    try {
      const success = await storage.unlockVault(password);
      if (success) {
        const loadedHoldings = await storage.loadHoldings();
        setHoldings(loadedHoldings);
        setIsLocked(false);
        return true;
      }
    } catch (e) {
      console.error("Failed to unlock", e);
    }
    return false;
  };

  const create = async (password: string) => {
    try {
      await storage.createVault(password);
      setHoldings([]);
      setIsLocked(false);
      setVaultExists(true);
      return true;
    } catch (e) {
      console.error("Failed to create vault", e);
      return false;
    }
  };

  const lock = useCallback(async () => {
    await storage.lockVault();
    setHoldings([]);
    setIsLocked(true);
  }, []);

  const addHolding = async (
    metal: Metal,
    quantity: number,
    unit: string,
    purchaseDate?: string,
    purchasePrice?: number,
    description?: string,
    photoUrl?: string
  ) => {
    const newHolding: Holding = {
      id: crypto.randomUUID(),
      metal,
      quantity,
      unit,
      addedDate: new Date().toISOString(),
      purchaseDate,
      purchasePrice,
      description,
      photoUrl,
    };
    const newHoldings = [...holdings, newHolding];
    await storage.saveHoldings(newHoldings);
    setHoldings(newHoldings);
  };

  const removeHolding = async (id: string) => {
    const newHoldings = holdings.filter(h => h.id !== id);
    await storage.saveHoldings(newHoldings);
    setHoldings(newHoldings);
  };

  const resetVault = async () => {
    await storage.saveHoldings([]);
    setHoldings([]);
    await lock();
  };

  const changePassword = async (_newPass: string) => {
    // Current storage doesn't support re-keying easily without re-encrypting.
    console.warn("Password change not implemented in storage layer yet.");
  };

  return {
    holdings,
    isLocked,
    isInitialized,
    vaultExists,
    unlock,
    lock,
    create,
    addHolding,
    removeHolding,
    resetVault,
    changePassword,
  };
};
