import React, { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';
import type { Metal } from '../types';
import { parseReceiptText } from '../lib/receipt-parser';

interface ScanReceiptProps {
  onApply: (data: {
    metal: Metal;
    quantity: number;
    unit: string;
    purchaseDate: string;
    purchasePrice?: number;
    description: string;
    photoUrl: string;
  }) => void;
  onClose: () => void;
}

export const ScanReceipt: React.FC<ScanReceiptProps> = ({ onApply, onClose }) => {
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [rawText, setRawText] = useState('');
  
  // Parsed fields state
  const [metal, setMetal] = useState<Metal>('Gold');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('oz');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [description, setDescription] = useState('');
  
  const [showRawText, setShowRawText] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image file size must be less than 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Url = reader.result as string;
        setImage(base64Url);
        runOCR(base64Url);
      };
      reader.readAsDataURL(file);
    }
  };

  const runOCR = async (imageSrc: string) => {
    setIsProcessing(true);
    setProgress(0);
    setProgressStatus('Initializing OCR engine...');
    
    try {
      const result = await Tesseract.recognize(
        imageSrc,
        'eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 100));
              setProgressStatus(`Reading receipt... ${Math.round(m.progress * 100)}%`);
            } else {
              setProgressStatus(m.status);
            }
          }
        }
      );

      const text = result.data.text;
      setRawText(text);
      
      // Apply the helper parser
      const parsed = parseReceiptText(text);
      if (parsed.metal) setMetal(parsed.metal);
      if (parsed.quantity) setQuantity(parsed.quantity.toString());
      if (parsed.unit) setUnit(parsed.unit);
      if (parsed.purchaseDate) setPurchaseDate(parsed.purchaseDate);
      if (parsed.purchasePrice) setPurchasePrice(parsed.purchasePrice.toString());

      // Beautiful line description extraction
      let extractedDesc = '';
      const lines = text.split('\n');
      const metalLine = lines.find(line => {
        const l = line.toLowerCase();
        return l.includes('gold') || l.includes('silver') || l.includes('platinum') || l.includes('copper');
      });
      
      if (metalLine) {
        extractedDesc = metalLine.trim().replace(/\s+/g, ' ');
        if (extractedDesc.length > 80) {
          extractedDesc = extractedDesc.substring(0, 77) + '...';
        }
      } else {
        extractedDesc = `Scanned ${parsed.metal || 'Gold'} bullion receipt`;
      }
      setDescription(extractedDesc);

      setProgressStatus('Completed!');
    } catch (error) {
      console.error('OCR Error:', error);
      alert('Failed to process the receipt. Please try another photo or enter values manually.');
      setProgressStatus('Failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    const q = parseFloat(quantity);
    if (isNaN(q) || q <= 0) {
      alert('Please enter a valid quantity.');
      return;
    }
    if (!purchaseDate) {
      alert('Please enter a valid date.');
      return;
    }

    onApply({
      metal,
      quantity: q,
      unit,
      purchaseDate,
      purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
      description: description || `Scanned ${metal} receipt`,
      photoUrl: image || '',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[#121212] border border-[#222222] w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-8 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto text-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white tracking-wide">Scan Bullion Receipt</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-[#222222] rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!image ? (
          <div className="space-y-6">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-3 border-dashed border-[#222222] hover:border-bullion rounded-3xl p-12 text-center cursor-pointer transition-all bg-zinc-900/50 hover:bg-bullion/5 group"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-500 group-hover:text-bullion transition-colors mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-bold text-gray-300 group-hover:text-bullion transition-colors">Upload receipt image</p>
              <p className="text-sm text-gray-500 mt-1">PNG, JPG or WEBP up to 5MB</p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-4 bg-[#222222] hover:bg-[#333333] text-gray-300 font-bold rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {isProcessing ? (
              <div className="text-center py-12 space-y-4">
                <div className="relative w-20 h-20 mx-auto">
                  <div className="absolute inset-0 border-4 border-bullion/20 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-bullion border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div>
                  <h4 className="font-bold text-white text-lg">{progressStatus}</h4>
                  <p className="text-sm text-gray-500 mt-1">This will only take a moment...</p>
                </div>
                <div className="w-full bg-[#1A1A1A] rounded-full h-2.5 max-w-xs mx-auto overflow-hidden">
                  <div className="bg-bullion h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex gap-4 items-center bg-zinc-900/60 p-3 rounded-2xl border border-[#222222]">
                  <img src={image} alt="Receipt preview" className="w-16 h-16 object-cover rounded-xl border border-[#222222] flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold text-gray-300 text-sm truncate">Receipt Uploaded</p>
                    <button 
                      onClick={() => {
                        setImage(null);
                        setRawText('');
                      }} 
                      className="text-xs text-red-400 font-bold hover:underline"
                    >
                      Remove & scan another
                    </button>
                  </div>
                </div>

                <div className="bg-bullion/5 border border-bullion/20 p-4 rounded-2xl">
                  <p className="text-xs font-semibold text-bullion flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-bullion" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Review extracted information
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Please check and correct any field that might be inaccurate.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Precious Metal</label>
                    <select
                      value={metal}
                      onChange={(e) => setMetal(e.target.value as Metal)}
                      className="w-full p-3 bg-zinc-900 border border-[#222222] text-white rounded-xl focus:border-bullion focus:outline-none font-medium"
                    >
                      <option value="Gold">Gold</option>
                      <option value="Silver">Silver</option>
                      <option value="Platinum">Platinum</option>
                      <option value="Copper">Copper</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Qty</label>
                      <input
                        type="number"
                        step="any"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="0.00"
                        className="w-full p-3 bg-zinc-900 border border-[#222222] text-white rounded-xl focus:border-bullion focus:outline-none font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">Unit</label>
                      <select
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="w-full p-3 bg-zinc-900 border border-[#222222] text-white rounded-xl focus:border-bullion focus:outline-none font-medium"
                      >
                        <option value="oz">oz</option>
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Date Purchased</label>
                    <input
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="w-full p-3 bg-zinc-900 border border-[#222222] text-white rounded-xl focus:border-bullion focus:outline-none font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Price Paid ($)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full p-3 bg-zinc-900 border border-[#222222] text-white rounded-xl focus:border-bullion focus:outline-none font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Bullion details"
                    className="w-full p-3 bg-zinc-900 border border-[#222222] text-white rounded-xl focus:border-bullion focus:outline-none font-medium"
                  />
                </div>

                {/* Collapsible raw text segment */}
                <div className="border border-[#222222] rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowRawText(!showRawText)}
                    className="w-full flex justify-between items-center bg-zinc-900/50 p-4 text-sm font-semibold text-gray-300 hover:bg-zinc-900 transition-colors border-0"
                  >
                    <span>View raw scanned text</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transform transition-transform ${showRawText ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showRawText && (
                    <div className="p-4 border-t border-[#222222] bg-zinc-950">
                      <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed">
                        {rawText || 'No text extracted.'}
                      </pre>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setImage(null);
                      setRawText('');
                    }}
                    className="py-4 bg-[#222222] hover:bg-[#333333] text-gray-300 font-bold rounded-xl transition-colors text-sm"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    className="py-4 bg-bullion hover:brightness-110 active:brightness-95 text-black font-bold rounded-xl shadow-lg shadow-bullion/10 transition-all text-sm transform active:scale-95 border-0"
                  >
                    Apply to Form
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
