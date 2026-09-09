import { useState, useEffect } from 'react';
import type { POItem } from '../types';
import { POStorage } from '../lib/po-storage';
import poDataRaw from '../data/po-full.json';

const poStorage = new POStorage();

interface RawSheet {
  headers: string[];
  rows: any[][];
}

const typedPoData = poDataRaw as Record<string, RawSheet>;

export const usePO = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [poItems, setPoItems] = useState<POItem[]>([]);

  const loadItems = async () => {
    try {
      const items = await poStorage.getAll();
      setPoItems(items);
    } catch (err) {
      console.error('Failed to load PO items from IndexedDB:', err);
    }
  };

  useEffect(() => {
    const initStorage = async () => {
      try {
        await poStorage.init();
        
        // Dynamic import check and trigger
        const imported = await poStorage.isImported();
        if (!imported) {
          console.log('PO database empty. Executing initial JSON import...');
          await poStorage.importFromJson(typedPoData);
        }

        await loadItems();
        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to initialize PO storage:', err);
      }
    };
    initStorage();
    return () => {
      poStorage.close();
    };
  }, []);

  const updateItemPhotoUrl = async (sygId: string, photoUrl: string) => {
    try {
      const success = await poStorage.updatePhotoUrl(sygId, photoUrl);
      if (success) {
        await loadItems(); // Reload list to reflect changes in UI
      }
      return success;
    } catch (err) {
      console.error(`Failed to update photoUrl for item ${sygId}:`, err);
      return false;
    }
  };

  return {
    isInitialized,
    poItems,
    updateItemPhotoUrl,
    reloadItems: loadItems,
  };
};
