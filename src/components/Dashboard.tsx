import React, { useState } from 'react';
import type { Holding, Metal } from '../types';
import { POInventory } from './POInventory';

interface DashboardProps {
  holdings: Holding[];
  onAddClick: () => void;
  onSettingsClick: () => void;
  onLock: () => void;
  onRemove?: (id: string) => void;
}

// Highly stylized metallic gradients matching the brand redesign
const METAL_GRADIENTS: Record<Metal, string> = {
  Gold: 'bg-gradient-to-br from-[#D4AF37] to-[#AA7C11] text-black',
  Silver: 'bg-gradient-to-br from-[#C0C0C0] to-[#808080] text-black',
  Platinum: 'bg-gradient-to-br from-[#E5E4E2] to-[#999996] text-black',
  Copper: 'bg-gradient-to-br from-[#B87333] to-[#783E06] text-black',
};

// METAL_TAG_COLORS removed

const METAL_COLORS: Record<Metal, string> = {
  Gold: 'bg-bullion',
  Silver: 'bg-sterling',
  Platinum: 'bg-zinc-300',
  Copper: 'bg-[#B87333]',
};

export const Dashboard: React.FC<DashboardProps> = ({
  holdings,
  onAddClick,
  onSettingsClick,
  onLock,
  onRemove,
}) => {
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);
  const [activeTab, setActiveTab] = useState<'safe' | 'po'>('safe');

  const totals = holdings.reduce((acc, h) => {
    acc[h.metal] = (acc[h.metal] || 0) + h.quantity;
    return acc;
  }, {} as Record<Metal, number>);

  const totalValues = holdings.reduce((acc, h) => {
    if (h.purchasePrice) {
      acc[h.metal] = (acc[h.metal] || 0) + h.purchasePrice;
    }
    return acc;
  }, {} as Record<Metal, number>);

  const handleRemove = (id: string) => {
    if (
      confirm(
        'Are you sure you want to remove this holding from your vault? This action cannot be undone.'
      )
    ) {
      onRemove?.(id);
      setSelectedHolding(null);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian text-gray-100 pb-20">
      <header className="bg-[#121212] border-b border-[#222222] px-6 py-3 flex justify-between items-center shadow-md sticky top-0 z-10">
        {/* Tab switch for My Safe / PO Inventory */}
        <div className="flex items-center space-x-1 bg-[#1A1A1A] border border-[#2A2A2A] p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('safe')}
            className={`py-2 px-5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'safe'
                ? 'bg-zinc-800 text-bullion shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            My Safe
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('po')}
            className={`py-2 px-5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'po'
                ? 'bg-zinc-800 text-bullion shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            PO Inventory
          </button>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={onSettingsClick}
            className="p-2 text-gray-400 hover:bg-[#222222] rounded-full transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
          <button
            onClick={onLock}
            className="p-2 text-gray-400 hover:bg-[#222222] rounded-full transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </button>
        </div>
      </header>

      <main className="p-6 max-w-4xl mx-auto">
        {activeTab === 'safe' ? (
          <>
            {/* Metal summary cards */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-in fade-in duration-200">
              {(['Gold', 'Silver', 'Platinum', 'Copper'] as Metal[]).map((metal) => (
                <div
                  key={metal}
                  className={`${METAL_GRADIENTS[metal]} p-5 rounded-2xl shadow-lg flex flex-col justify-between h-32 relative overflow-hidden group hover:scale-[1.02] transition-transform`}
                >
                  <div className="z-10">
                    <h3 className="text-xs font-bold uppercase tracking-widest opacity-80">{metal}</h3>
                    <p className="text-2xl font-black mt-1">
                      {totals[metal] || 0}{' '}
                      <span className="text-xs font-normal opacity-85">units</span>
                    </p>
                  </div>
                  <div className="mt-2 pt-1 border-t border-black/10 z-10">
                    <p className="text-[9px] uppercase font-bold opacity-75">
                      Total Value
                    </p>
                    <p className="text-base font-black truncate">
                      $
                      {(totalValues[metal] || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="absolute right-[-10px] bottom-[-10px] opacity-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/>
                    </svg>
                  </div>
                </div>
              ))}
            </section>

            {/* Transaction List */}
            <section className="animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Recent Transactions
                </h2>
                <button
                  onClick={onAddClick}
                  className="text-bullion font-bold text-sm hover:brightness-110 flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Add New
                </button>
              </div>

              <div className="space-y-3">
                {holdings.length === 0 ? (
                  <div className="text-center py-12 bg-[#121212] border-2 border-dashed border-[#222222] rounded-2xl">
                    <p className="text-gray-500 font-medium">Your vault is currently empty.</p>
                    <button
                      onClick={onAddClick}
                      className="mt-2 text-bullion font-bold hover:brightness-110 text-sm"
                    >
                      Start Stacking
                    </button>
                  </div>
                ) : (
                  holdings
                    .slice()
                    .reverse()
                    .map((holding) => (
                      <div
                        key={holding.id}
                        onClick={() => setSelectedHolding(holding)}
                        className="bg-[#121212] border border-[#222222] p-4 rounded-2xl flex items-center justify-between hover:border-bullion/40 cursor-pointer transition-all animate-in fade-in duration-200"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div
                            className={`w-10 h-10 ${
                              METAL_COLORS[holding.metal]
                            } rounded-full flex items-center justify-center font-black text-black text-xs flex-shrink-0 shadow-sm`}
                          >
                            {holding.metal[0]}
                          </div>

                          <div className="min-w-0">
                            <p className="font-bold text-white flex items-center gap-1.5">
                              <span>{holding.metal}</span>
                            </p>
                            <p className="text-xs text-gray-400 flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1.5">
                              <span className="font-medium text-gray-500">
                                Purchased: {new Date(holding.purchaseDate || holding.addedDate).toLocaleDateString()}
                              </span>
                              {holding.description && (
                                <>
                                  <span className="hidden sm:inline text-gray-600">•</span>
                                  <span className="text-gray-400 truncate max-w-[150px] sm:max-w-[200px]" title={holding.description}>
                                    {holding.description}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 flex-shrink-0 ml-4">
                          <div className="text-right">
                            <p className="font-bold text-white">
                              +{holding.quantity} {holding.unit}
                            </p>
                            {holding.purchasePrice !== undefined && (
                              <p className="text-xs font-bold px-2 py-0.5 rounded-md inline-block text-bullion bg-bullion/10 border border-bullion/20">
                                $
                                {holding.purchasePrice.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </p>
                            )}
                          </div>

                          {holding.photoUrl && (
                            <img
                              src={holding.photoUrl}
                              alt="Thumbnail"
                              className="w-10 h-10 object-cover rounded-xl border border-[#222222] flex-shrink-0 shadow-sm"
                            />
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </section>
          </>
        ) : (
          <POInventory />
        )}
      </main>

      {/* Detail View Modal */}
      {selectedHolding && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#121212] border border-[#222222] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-8 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">
                Holding Details
              </h2>
              <button
                onClick={() => setSelectedHolding(null)}
                className="p-2 text-gray-400 hover:bg-[#222222] rounded-full transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {selectedHolding.photoUrl && (
              <div className="mb-6 rounded-2xl overflow-hidden border border-[#222222] bg-zinc-950 flex items-center justify-center max-h-60 shadow-inner">
                <img
                  src={selectedHolding.photoUrl}
                  alt="Holding preview"
                  className="w-full max-h-60 object-contain"
                />
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
                <span className="text-sm font-medium text-gray-400">Asset</span>
                <span className="flex items-center gap-2">
                  <span
                    className={`w-3 h-3 ${
                      METAL_COLORS[selectedHolding.metal]
                    } rounded-full`}
                  ></span>
                  <span className="font-bold text-white">
                    {selectedHolding.metal}
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
                <span className="text-sm font-medium text-gray-400">
                  Weight / Quantity
                </span>
                <span className="font-bold text-white">
                  {selectedHolding.quantity} {selectedHolding.unit}
                </span>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
                <span className="text-sm font-medium text-gray-400">
                  Date Purchased
                </span>
                <span className="font-bold text-white">
                  {new Date(selectedHolding.purchaseDate || selectedHolding.addedDate).toLocaleDateString()}
                </span>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
                <span className="text-sm font-medium text-gray-400">
                  Price Purchased
                </span>
                <span className="font-bold text-bullion">
                  {selectedHolding.purchasePrice !== undefined
                    ? `$${selectedHolding.purchasePrice.toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }
                      )}`
                    : 'Not recorded'}
                </span>
              </div>

              <div className="pb-3 border-b border-[#222222]">
                <span className="text-sm font-medium text-gray-400 block mb-1.5">
                  Description
                </span>
                <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed bg-zinc-900/60 p-3 rounded-xl border border-[#222222]">
                  {selectedHolding.description || 'No description provided.'}
                </p>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleRemove(selectedHolding.id)}
                className="py-3 px-4 bg-red-950/20 hover:bg-red-950/40 text-red-400 font-bold rounded-xl border border-red-900/30 transition-colors text-sm"
              >
                Delete Holding
              </button>
              <button
                type="button"
                onClick={() => setSelectedHolding(null)}
                className="py-3 px-4 bg-[#222222] hover:bg-[#333333] text-gray-300 font-bold rounded-xl transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button (only in Safe mode) */}
      {activeTab === 'safe' && (
        <button
          onClick={onAddClick}
          className="fixed bottom-8 right-8 bg-bullion hover:brightness-110 active:brightness-95 text-black p-4 rounded-full shadow-2xl transition-all transform hover:scale-105 active:scale-95 z-20"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      )}
    </div>
  );
};
