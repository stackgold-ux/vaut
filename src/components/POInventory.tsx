import React, { useState, useMemo } from 'react';
import type { POItem } from '../types';
import { usePO } from '../hooks/usePO';

// High-quality unsplash images for bullion products
const STOCK_IMAGES_POOL = {
  gold_coin: [
    { url: 'https://images.unsplash.com/photo-1610375461246-83df859d8222?w=500&q=80', label: 'Gold American Eagle Coin' },
    { url: 'https://images.unsplash.com/photo-1599690925058-90e1a0b4bfbe?w=500&q=80', label: 'Gold Maple Leaf Coin' },
    { url: 'https://images.unsplash.com/photo-1618042164219-62c820f10723?w=500&q=80', label: 'Gold Bullion Stack' },
    { url: 'https://images.unsplash.com/photo-1589758438368-0ad531db3366?w=500&q=80', label: 'Fine Gold Ingots' }
  ],
  gold_bar: [
    { url: 'https://images.unsplash.com/photo-1618042164219-62c820f10723?w=500&q=80', label: '10 oz Gold Cast Bar' },
    { url: 'https://images.unsplash.com/photo-1589758438368-0ad531db3366?w=500&q=80', label: 'Credit Suisse Gold Bar' },
    { url: 'https://images.unsplash.com/photo-1599690925058-90e1a0b4bfbe?w=500&q=80', label: 'PAMP Suisse Ingot' }
  ],
  silver_coin: [
    { url: 'https://images.unsplash.com/photo-1605792657660-596af9009e82?w=500&q=80', label: 'Silver American Eagle Coin' },
    { url: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=500&q=80', label: 'Silver Round' },
    { url: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=500&q=80', label: 'Uncirculated Silver Stack' }
  ],
  silver_bar: [
    { url: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=500&q=80', label: '10 oz Silver Bar' },
    { url: 'https://images.unsplash.com/photo-1605792657660-596af9009e82?w=500&q=80', label: '100 oz Silver Ingot' }
  ],
  platinum: [
    { url: 'https://images.unsplash.com/photo-1634973357973-f2ed255753e1?w=500&q=80', label: 'Platinum Ingot' },
    { url: 'https://images.unsplash.com/photo-1532187863486-abf9d39d66e8?w=500&q=80', label: 'Fine Platinum Rounds' }
  ],
  copper: [
    { url: 'https://images.unsplash.com/photo-1532187863486-abf9d39d66e8?w=500&q=80', label: 'Copper Ingot' },
    { url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&q=80', label: 'Copper Bullion' }
  ],
  supplies: [
    { url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&q=80', label: 'Coin Capsules / Storage' },
    { url: 'https://images.unsplash.com/photo-1634973357973-f2ed255753e1?w=500&q=80', label: 'Shipping Mailer / Supplies' }
  ]
};

// Simple helper to get stock image suggestions based on product attributes
function getStockSuggestions(description: string, metalType: string, sheet: string) {
  const desc = description.toLowerCase();
  const metal = (metalType || sheet || '').toLowerCase();

  if (metal.includes('gold')) {
    if (desc.includes('bar') || desc.includes('ingot')) {
      return STOCK_IMAGES_POOL.gold_bar;
    }
    return STOCK_IMAGES_POOL.gold_coin;
  }
  if (metal.includes('silver')) {
    if (desc.includes('bar') || desc.includes('ingot')) {
      return STOCK_IMAGES_POOL.silver_bar;
    }
    return STOCK_IMAGES_POOL.silver_coin;
  }
  if (metal.includes('platinum')) {
    return STOCK_IMAGES_POOL.platinum;
  }
  if (metal.includes('copper')) {
    return STOCK_IMAGES_POOL.copper;
  }
  return STOCK_IMAGES_POOL.supplies;
}

export const POInventory: React.FC = () => {
  const { poItems, isInitialized, updateItemPhotoUrl } = usePO();
  
  // State for search and filter options
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMetal, setSelectedMetal] = useState('All');
  const [selectedVendor, setSelectedVendor] = useState('All');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'cost-desc' | 'cost-asc' | 'sku'>('date-desc');
  
  // Selection/Modal states
  const [selectedItem, setSelectedItem] = useState<POItem | null>(null);
  const [searchingItem, setSearchingItem] = useState<POItem | null>(null);
  const [customImageUrl, setCustomImageUrl] = useState('');

  // 1. Compute dynamic summary counters
  const summary = useMemo(() => {
    const counts = { Gold: 0, Silver: 0, Platinum: 0, Copper: 0, Supplies: 0, Other: 0 };
    for (const item of poItems) {
      const metal = (item.metalType || item.sheet || '').toLowerCase();
      if (metal.includes('gold')) counts.Gold++;
      else if (metal.includes('silver')) counts.Silver++;
      else if (metal.includes('platinum')) counts.Platinum++;
      else if (metal.includes('copper')) counts.Copper++;
      else if (item.sheet.toLowerCase() === 'supplies') counts.Supplies++;
      else counts.Other++;
    }
    return counts;
  }, [poItems]);

  // Get unique vendors list dynamically from items
  const vendors = useMemo(() => {
    const list = new Set<string>();
    for (const item of poItems) {
      if (item.vendor) {
        list.add(item.vendor);
      }
    }
    return ['All', ...Array.from(list)];
  }, [poItems]);

  // 2. Search, filter, and sort logic
  const filteredItems = useMemo(() => {
    let result = [...poItems];

    // Filter by search query (SKU, description, vendor)
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.description.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        item.vendor.toLowerCase().includes(query) ||
        item.sygId.toLowerCase().includes(query)
      );
    }

    // Filter by Metal Type / Sheet
    if (selectedMetal !== 'All') {
      result = result.filter(item => {
        const metal = (item.metalType || item.sheet || '').toLowerCase();
        if (selectedMetal === 'Gold') return metal.includes('gold');
        if (selectedMetal === 'Silver') return metal.includes('silver');
        if (selectedMetal === 'Platinum') return metal.includes('platinum');
        if (selectedMetal === 'Copper') return metal.includes('copper');
        if (selectedMetal === 'Supplies') return item.sheet.toLowerCase() === 'supplies';
        return !metal.includes('gold') && !metal.includes('silver') && !metal.includes('platinum') && !metal.includes('copper') && item.sheet.toLowerCase() !== 'supplies';
      });
    }

    // Filter by Vendor
    if (selectedVendor !== 'All') {
      result = result.filter(item => item.vendor === selectedVendor);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'date-desc') {
        return new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime();
      }
      if (sortBy === 'date-asc') {
        return new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime();
      }
      if (sortBy === 'cost-desc') {
        return b.unitCost - a.unitCost;
      }
      if (sortBy === 'cost-asc') {
        return a.unitCost - b.unitCost;
      }
      if (sortBy === 'sku') {
        return a.sku.localeCompare(b.sku);
      }
      return 0;
    });

    return result;
  }, [poItems, searchQuery, selectedMetal, selectedVendor, sortBy]);

  // Custom function to select stock image and save it
  const handleSelectImage = async (url: string) => {
    if (!searchingItem) return;
    const success = await updateItemPhotoUrl(searchingItem.sygId, url);
    if (success) {
      // Update selected item visual reference if open
      if (selectedItem && selectedItem.sygId === searchingItem.sygId) {
        setSelectedItem({ ...selectedItem, photoUrl: url });
      }
      setSearchingItem(null);
      setCustomImageUrl('');
    } else {
      alert('Failed to save the image. Please try again.');
    }
  };

  const handleCustomImageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customImageUrl.trim() === '') return;
    handleSelectImage(customImageUrl.trim());
  };

  if (!isInitialized) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="animate-spin h-10 w-10 border-4 border-bullion border-t-transparent rounded-full"></div>
        <p className="text-gray-400 font-medium">Initializing PO Inventory Database...</p>
      </div>
    );
  }

  // Get stock suggestions for active searching item
  const activeSuggestions = searchingItem 
    ? getStockSuggestions(searchingItem.description, searchingItem.metalType, searchingItem.sheet)
    : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-300 text-gray-100">
      {/* A. Summary Cards Grid with Metallic Bullion Redesign */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Gold', count: summary.Gold, color: 'bg-gradient-to-br from-[#D4AF37] to-[#AA7C11] text-black' },
          { label: 'Silver', count: summary.Silver, color: 'bg-gradient-to-br from-[#C0C0C0] to-[#808080] text-black' },
          { label: 'Platinum', count: summary.Platinum, color: 'bg-gradient-to-br from-[#E5E4E2] to-[#999996] text-black' },
          { label: 'Copper', count: summary.Copper, color: 'bg-gradient-to-br from-[#B87333] to-[#783E06] text-black' },
          { label: 'Supplies', count: summary.Supplies, color: 'bg-gradient-to-br from-[#2E2E2E] to-[#161616] text-gray-300 border border-[#333333]' }
        ].map((c) => (
          <div key={c.label} className={`${c.color} p-5 rounded-3xl shadow-lg flex flex-col justify-between h-28 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300`}>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest opacity-80">{c.label}</span>
              <p className="text-2xl font-black mt-1">{c.count}</p>
            </div>
            <span className="text-[9px] opacity-80 font-bold uppercase tracking-wider">Unique Items</span>
            <div className="absolute right-[-10px] bottom-[-10px] opacity-10">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/>
              </svg>
            </div>
          </div>
        ))}
      </section>

      {/* B. Filter and Search Controls (Dark Redesign) */}
      <section className="bg-[#121212] p-6 rounded-3xl border border-[#222222] space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Box */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search by description, SKU, vendor or SYG #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-zinc-900 border border-[#222222] rounded-2xl focus:border-bullion focus:outline-none transition-all font-medium placeholder-zinc-600 text-white"
            />
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-4 top-4.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Sort selector */}
          <div className="w-full md:w-56">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full py-3.5 px-4 bg-zinc-900 border border-[#222222] rounded-2xl focus:border-bullion focus:outline-none text-white transition-all font-medium"
            >
              <option value="date-desc">Date (Newest First)</option>
              <option value="date-asc">Date (Oldest First)</option>
              <option value="cost-desc">Cost (Highest First)</option>
              <option value="cost-asc">Cost (Lowest First)</option>
              <option value="sku">SKU Code</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-2">
          {/* Quick tab filters for Metal Type */}
          <div className="flex flex-wrap gap-1 bg-[#1A1A1A] p-1 rounded-2xl border border-[#2A2A2A]">
            {['All', 'Gold', 'Silver', 'Platinum', 'Copper', 'Supplies'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedMetal(m)}
                className={`py-1.5 px-4 rounded-xl text-xs font-bold transition-all ${
                  selectedMetal === m
                    ? 'bg-zinc-800 text-bullion shadow-sm border border-bullion/20'
                    : 'text-gray-400 hover:text-gray-200 border border-transparent'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Vendor Quick Filter */}
          <div className="flex items-center space-x-2 text-xs font-bold text-gray-500 ml-auto">
            <span>Vendor:</span>
            <select
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              className="p-2 bg-[#1A1A1A] border border-[#222222] rounded-xl focus:outline-none focus:border-bullion font-bold text-gray-300"
            >
              {vendors.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* C. Interactive PO Inventory list */}
      <section className="space-y-4">
        <div className="flex justify-between items-center px-2">
          <p className="text-sm font-semibold text-gray-400">
            Showing {filteredItems.length} of {poItems.length} records
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.length === 0 ? (
            <div className="col-span-full text-center py-20 bg-[#121212] border-2 border-dashed border-[#222222] rounded-3xl">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v4m16 0h-1.5a2.5 2.5 0 00-5 0H12m0 0H7.5a2.5 2.5 0 00-5 0H2" />
              </svg>
              <p className="text-gray-500 font-medium">No inventory items matched your criteria.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedMetal('All');
                  setSelectedVendor('All');
                }}
                className="mt-3 text-sm text-bullion font-bold hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            filteredItems.map((item) => {
              const hasPhoto = !!item.photoUrl;
              return (
                <div
                  key={item.sygId}
                  className="bg-[#121212] p-5 rounded-3xl border border-[#222222] hover:border-bullion/40 transition-all duration-300 flex gap-4 cursor-pointer relative group shadow-sm hover:shadow-xl"
                  onClick={() => setSelectedItem(item)}
                >
                  {/* Photo or Metal representation */}
                  <div className="w-20 h-20 rounded-2xl bg-zinc-950 border border-[#222222] overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                    {hasPhoto ? (
                      <img src={item.photoUrl} alt="Product" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-1">
                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-600 block mb-1 truncate max-w-[70px]">
                          {item.metalType || item.sheet}
                        </span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-zinc-700 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Text details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-zinc-500 font-bold font-mono">{item.sygId}</span>
                        <span className="text-[10px] text-gray-300 bg-zinc-900 border border-[#222222] px-2 py-0.5 rounded-full font-bold">{item.vendor}</span>
                      </div>
                      <h4 className="font-bold text-gray-200 text-sm truncate mt-1 group-hover:text-bullion transition-colors" title={item.description}>
                        {item.description}
                      </h4>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">SKU: {item.sku}</p>
                    </div>

                    <div className="flex items-end justify-between mt-2 pt-2 border-t border-[#222222]">
                      <div>
                        <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Unit Cost</span>
                        <p className="text-sm font-black text-bullion">
                          ${item.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Qty Shipped</span>
                        <p className="text-xs font-bold text-gray-300">
                          {item.qtyShipped} / {item.qtyOrdered}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Stock Search Overlay / Floating Button on Hover */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation(); // Avoid opening details modal
                      setSearchingItem(item);
                    }}
                    className="absolute right-4 top-4 bg-bullion hover:brightness-110 text-black p-2 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all z-10"
                    title="Find Stock Image"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* D. Product Detail View Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#121212] border border-[#222222] w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-8 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white tracking-wide">Inventory Item Details</h2>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-2 text-gray-400 hover:bg-[#222222] rounded-full transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Photo Section */}
            <div className="mb-6 rounded-2xl overflow-hidden border border-[#222222] bg-zinc-950 flex items-center justify-center h-52 relative group">
              {selectedItem.photoUrl ? (
                <img src={selectedItem.photoUrl} alt="Product details" className="w-full h-full object-contain" />
              ) : (
                <div className="text-center py-10">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-zinc-700 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs text-gray-500 font-medium">No stock image saved</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => setSearchingItem(selectedItem)}
                className="absolute bottom-3 right-3 bg-bullion text-black py-1.5 px-3 rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5 transition-colors hover:brightness-110 active:brightness-95 border-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Find Stock Image
              </button>
            </div>

            {/* Information Grid */}
            <div className="space-y-4 text-sm font-medium">
              <div className="flex justify-between pb-3 border-b border-[#222222]">
                <span className="text-gray-400">SYG ID</span>
                <span className="font-mono text-white font-bold">{selectedItem.sygId}</span>
              </div>
              <div className="flex justify-between pb-3 border-b border-[#222222]">
                <span className="text-gray-400">Order Number / Date</span>
                <span className="text-white">{selectedItem.orderNum || 'N/A'} ({selectedItem.orderDate || 'N/A'})</span>
              </div>
              <div className="pb-3 border-b border-[#222222]">
                <span className="text-gray-400 block mb-1">Product Description</span>
                <p className="text-white font-bold leading-relaxed">{selectedItem.description}</p>
              </div>
              <div className="flex justify-between pb-3 border-b border-[#222222]">
                <span className="text-gray-400">SKU</span>
                <span className="font-mono text-white font-bold">{selectedItem.sku || 'N/A'}</span>
              </div>
              <div className="flex justify-between pb-3 border-b border-[#222222]">
                <span className="text-gray-400">Vendor</span>
                <span className="text-white font-bold">{selectedItem.vendor}</span>
              </div>
              <div className="flex justify-between pb-3 border-b border-[#222222]">
                <span className="text-gray-400">Metal Type / Sheet</span>
                <span className="text-white font-bold">{selectedItem.metalType || 'Supplies'} ({selectedItem.sheet})</span>
              </div>
              <div className="flex justify-between pb-3 border-b border-[#222222]">
                <span className="text-gray-400">Unit Cost</span>
                <span className="text-bullion font-black">${selectedItem.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between pb-3 border-b border-[#222222]">
                <span className="text-gray-400">Quantity Ordered / Shipped</span>
                <span className="text-white">{selectedItem.qtyOrdered} Ordered / {selectedItem.qtyShipped} Shipped</span>
              </div>
              <div className="flex justify-between pb-3 border-b border-[#222222]">
                <span className="text-gray-400">Line Subtotal</span>
                <span className="text-white font-black">${selectedItem.lineSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              
              {selectedItem.notes && (
                <div className="pb-3">
                  <span className="text-gray-400 block mb-1.5">Notes</span>
                  <p className="text-xs text-amber-400 bg-amber-950/20 border border-amber-900/30 p-3 rounded-xl leading-relaxed whitespace-pre-wrap font-medium">
                    {selectedItem.notes}
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className="mt-6 w-full py-4 bg-[#222222] hover:bg-[#333333] text-gray-300 font-bold rounded-2xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* E. Find Stock Image Search Modal */}
      {searchingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-[#121212] border border-[#222222] w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-8 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto text-gray-100">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-white tracking-wide">Find Stock Image</h3>
                <p className="text-xs text-gray-400 font-medium mt-0.5">SKU: {searchingItem.sku}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchingItem(null);
                  setCustomImageUrl('');
                }}
                className="p-2 text-gray-400 hover:bg-[#222222] rounded-full transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* Product description info */}
              <div className="bg-bullion/5 border border-bullion/20 p-4 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-bullion tracking-wider">Search terms</span>
                <p className="text-sm text-gray-300 font-bold leading-normal mt-0.5">{searchingItem.description}</p>
              </div>

              {/* Suggestions results */}
              <div>
                <span className="text-xs uppercase font-bold text-gray-400 tracking-widest block mb-3">Matching Stock Results</span>
                <div className="grid grid-cols-2 gap-3">
                  {activeSuggestions.map((s, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectImage(s.url)}
                      className="group border border-[#222222] hover:border-bullion rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-all duration-300 relative bg-zinc-900/50 flex flex-col justify-between"
                    >
                      <div className="h-28 w-full bg-[#1A1A1A] flex items-center justify-center overflow-hidden border-b border-[#222222]">
                        <img src={s.url} alt={s.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                      <div className="p-2.5 bg-zinc-950 text-center">
                        <p className="text-xs font-bold text-gray-300 truncate">{s.label}</p>
                      </div>
                      {/* Checkmark overlay if it is the current photoUrl */}
                      {searchingItem.photoUrl === s.url && (
                        <div className="absolute top-2 left-2 bg-green-600 text-white p-1 rounded-full shadow-md">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Image URL search box */}
              <form onSubmit={handleCustomImageSubmit} className="pt-2 border-t border-[#222222]">
                <label className="block text-xs uppercase font-bold text-gray-400 tracking-widest mb-2">Custom Image URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://example.com/image.jpg..."
                    value={customImageUrl}
                    onChange={(e) => setCustomImageUrl(e.target.value)}
                    required
                    className="flex-1 px-4 py-3 bg-zinc-900 border border-[#222222] rounded-xl focus:outline-none focus:border-bullion focus:bg-[#1A1A1A] text-white text-sm font-medium"
                  />
                  <button
                    type="submit"
                    className="bg-bullion hover:brightness-110 active:brightness-95 text-black font-bold px-4 rounded-xl shadow-md transition-colors text-sm border-0"
                  >
                    Save Custom
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
