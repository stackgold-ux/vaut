import React, { useState } from 'react';
import type { Metal } from '../types';
import { ScanReceipt } from './ScanReceipt';

interface AddHoldingsFormProps {
  onAdd: (
    metal: Metal,
    quantity: number,
    unit: string,
    purchaseDate?: string,
    purchasePrice?: number,
    description?: string,
    photoUrl?: string
  ) => void;
  onClose: () => void;
}

export const AddHoldingsForm: React.FC<AddHoldingsFormProps> = ({ onAdd, onClose }) => {
  const [metal, setMetal] = useState<Metal>('Gold');
  const [quantity, setQuantity] = useState<string>('');
  const [unit, setUnit] = useState<string>('oz');
  const [purchaseDate, setPurchaseDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [showScanner, setShowScanner] = useState(false);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Image file size must be less than 2MB.');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseFloat(quantity);
    if (!isNaN(q) && q > 0) {
      const price = purchasePrice ? parseFloat(purchasePrice) : undefined;
      onAdd(
        metal,
        q,
        unit,
        purchaseDate,
        price,
        description.trim() || undefined,
        photoUrl || undefined
      );
      onClose();
    }
  };

  const handleScanApply = (data: {
    metal: Metal;
    quantity: number;
    unit: string;
    purchaseDate: string;
    purchasePrice?: number;
    description: string;
    photoUrl: string;
  }) => {
    setMetal(data.metal);
    setQuantity(data.quantity.toString());
    setUnit(data.unit);
    setPurchaseDate(data.purchaseDate);
    if (data.purchasePrice !== undefined) {
      setPurchasePrice(data.purchasePrice.toString());
    } else {
      setPurchasePrice('');
    }
    setDescription(data.description);
    if (data.photoUrl) {
      setPhotoUrl(data.photoUrl);
    }
    setShowScanner(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[#121212] border border-[#222222] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-8 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white tracking-wide">Add Holding</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-[#222222] rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scan Receipt Button Option */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-bullion/10 hover:bg-bullion/20 border-2 border-dashed border-bullion/30 hover:border-bullion/50 rounded-xl text-sm font-bold text-bullion transition-all shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-bullion" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Auto-fill with Scan Receipt
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Precious Metal</label>
            <div className="grid grid-cols-2 gap-3">
              {(['Gold', 'Silver', 'Platinum', 'Copper'] as Metal[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetal(m)}
                  className={`py-3 px-4 rounded-xl text-sm font-bold border-2 transition-all ${
                    metal === m
                      ? 'border-bullion bg-bullion/10 text-bullion'
                      : 'border-[#222222] bg-zinc-900 text-gray-400 hover:border-[#333333]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Quantity</label>
              <input
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.00"
                required
                className="w-full p-4 bg-zinc-900 border-2 border-[#222222] rounded-xl text-white placeholder-zinc-600 focus:border-bullion focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Unit</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full p-4 bg-zinc-900 border-2 border-[#222222] rounded-xl text-white focus:border-bullion focus:outline-none transition-colors appearance-none font-medium"
              >
                <option value="oz">oz (Troy)</option>
                <option value="g">grams</option>
                <option value="kg">kilograms</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Date Purchased</label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              required
              className="w-full p-4 bg-zinc-900 border-2 border-[#222222] rounded-xl text-white focus:border-bullion focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Price Purchased ($)</label>
            <input
              type="number"
              step="any"
              min="0"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="0.00 (optional)"
              className="w-full p-4 bg-zinc-900 border-2 border-[#222222] rounded-xl text-white placeholder-zinc-600 focus:border-bullion focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 1oz PAMP Suisse gold bar"
              rows={3}
              className="w-full p-4 bg-zinc-900 border-2 border-[#222222] rounded-xl text-white placeholder-zinc-600 focus:border-bullion focus:outline-none transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Optional Photo / Receipt Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="w-full text-sm text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-bullion/10 file:text-bullion hover:file:bg-bullion/20 cursor-pointer"
            />
            {photoUrl && (
              <div className="mt-3 relative inline-block">
                <img src={photoUrl} alt="Preview" className="h-20 w-20 object-cover rounded-xl border border-[#333333] shadow-md" />
                <button
                  type="button"
                  onClick={() => setPhotoUrl('')}
                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow hover:bg-red-700 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-bullion hover:brightness-110 active:brightness-95 text-black font-bold rounded-xl shadow-lg shadow-bullion/10 transition-all transform active:scale-[0.98] mt-2"
          >
            Add to Vault
          </button>
        </form>
      </div>

      {showScanner && (
        <ScanReceipt
          onApply={handleScanApply}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
};
