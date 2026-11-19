import React, { useEffect, useState, useMemo } from 'react';
import {
  Boxes,
  AlertTriangle,
  XCircle,
  Plus,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Coffee,
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
  History,
} from 'lucide-react';
import { InventoryItem, InventoryKpis, InventoryLog, InventoryResponse } from '../../../functions/api/owner/inventory';

export const InventoryTab: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [kpis, setKpis] = useState<InventoryKpis>({
    total_items: 0,
    healthy_count: 0,
    low_stock_count: 0,
    out_of_stock_count: 0,
    total_units_in_stock: 0,
  });
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out' | 'healthy'>('all');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Adjust / Restock Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustType, setAdjustType] = useState<'restock' | 'wastage' | 'adjustment'>('restock');
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustMaxStock, setAdjustMaxStock] = useState('');
  const [adjustLowAlert, setAdjustLowAlert] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  // Fetch Inventory Data
  const fetchInventory = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/owner/inventory');
      if (!res.ok) throw new Error('Failed to load inventory data');
      const data = (await res.json()) as InventoryResponse;
      setItems(data.items || []);
      setKpis(data.kpis);
      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err.message || 'Error fetching inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // Open Adjust Modal for a specific item
  const openAdjustModal = (
    item: InventoryItem,
    type: 'restock' | 'wastage' | 'adjustment' = 'restock'
  ) => {
    setSelectedItem(item);
    setAdjustType(type);
    setAdjustQuantity(type === 'adjustment' ? String(item.stock_qty ?? 0) : '');
    setAdjustMaxStock(String(item.max_stock ?? 100));
    setAdjustLowAlert(String(item.low_stock_alert ?? 10));
    setAdjustNotes('');
    setShowAdjustModal(true);
  };

  // Submit Inventory Adjustment
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const qty = Number(adjustQuantity);
    if (isNaN(qty) || qty < 0) {
      alert('Please enter a valid positive quantity.');
      return;
    }
    if ((adjustType === 'restock' || adjustType === 'wastage') && qty === 0) {
      alert('Quantity must be greater than 0.');
      return;
    }

    setSubmittingAdjust(true);
    setError(null);

    try {
      const res = await fetch('/api/owner/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_item_id: selectedItem.id,
          change_type: adjustType,
          quantity: qty,
          max_stock: adjustMaxStock ? Number(adjustMaxStock) : undefined,
          low_stock_alert: adjustLowAlert ? Number(adjustLowAlert) : undefined,
          notes: adjustNotes.trim() || undefined,
        }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string; stock_qty?: number };
      if (!res.ok) throw new Error(data.error || 'Adjustment failed');

      setSuccess(
        `Successfully recorded ${adjustType} for ${selectedItem.name}! New stock: ${data.stock_qty}`
      );
      setShowAdjustModal(false);
      setTimeout(() => setSuccess(null), 3500);
      await fetchInventory();
    } catch (err: any) {
      setError(err.message || 'Failed to adjust stock');
    } finally {
      setSubmittingAdjust(false);
    }
  };

  // Categories list
  const categories = useMemo(() => {
    return Array.from(new Set(['All', ...items.map((i) => i.category)]));
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.category.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;

      const qty = item.stock_qty ?? 0;
      const threshold = item.low_stock_alert ?? 10;
      let matchesStatus = true;
      if (statusFilter === 'out') matchesStatus = qty <= 0;
      else if (statusFilter === 'low') matchesStatus = qty > 0 && qty <= threshold;
      else if (statusFilter === 'healthy') matchesStatus = qty > threshold;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, search, categoryFilter, statusFilter]);

  // Projected stock preview in modal
  const previewStock = useMemo(() => {
    if (!selectedItem) return 0;
    const current = selectedItem.stock_qty ?? 0;
    const inputVal = Number(adjustQuantity) || 0;
    if (adjustType === 'restock') return current + inputVal;
    if (adjustType === 'wastage') return Math.max(0, current - inputVal);
    if (adjustType === 'adjustment') return Math.max(0, inputVal);
    return current;
  }, [selectedItem, adjustType, adjustQuantity]);

  return (
    <div className="space-y-6">
      {/* Feedback Alerts */}
      {error && (
        <div className="p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-[#991B1B] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-[#991B1B] hover:text-[#111111] p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-3.5 bg-[#ECFDF5] border border-[#BBF7D0] rounded-xl text-[#166534] text-xs flex items-center gap-2 font-semibold">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* 1. 4 KPI STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Items */}
        <div className="bg-white border border-[#E6E2DA] rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#52525B]">
            <span className="text-xs font-bold uppercase tracking-wider font-serif">Menu Catalog</span>
            <Boxes className="w-4 h-4 text-[#111111]" />
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-bold font-mono text-[#111111] tabular-nums">
              {kpis.total_items}
            </p>
            <p className="text-[11px] text-[#71717A] mt-0.5 tabular-nums">
              {kpis.total_units_in_stock} total units in stock
            </p>
          </div>
        </div>

        {/* Healthy Stock */}
        <div className="bg-white border border-[#E6E2DA] rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#166534]">
            <span className="text-xs font-bold uppercase tracking-wider font-serif">Healthy Stock</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]"></span>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-bold font-mono text-[#166534] tabular-nums">
              {kpis.healthy_count}
            </p>
            <p className="text-[11px] text-[#166534] mt-0.5">Above low-stock alert</p>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'low' ? 'all' : 'low')}
          className={`border rounded-2xl p-4 shadow-sm flex flex-col justify-between cursor-pointer transition-all ${
            kpis.low_stock_count > 0
              ? 'bg-[#FFFBEB] border-[#FDE68A] hover:border-[#D97706]'
              : 'bg-white border-[#E6E2DA]'
          }`}
        >
          <div className="flex items-center justify-between text-[#92400E]">
            <span className="text-xs font-bold uppercase tracking-wider font-serif">Low Stock</span>
            <AlertTriangle className="w-4 h-4 text-[#D97706]" />
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-bold font-mono text-[#92400E] tabular-nums">
              {kpis.low_stock_count}
            </p>
            <p className="text-[11px] text-[#92400E] mt-0.5">Need restock soon</p>
          </div>
        </div>

        {/* Out of Stock */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'out' ? 'all' : 'out')}
          className={`border rounded-2xl p-4 shadow-sm flex flex-col justify-between cursor-pointer transition-all ${
            kpis.out_of_stock_count > 0
              ? 'bg-[#FEF2F2] border-[#FECACA] hover:border-[#DC2626]'
              : 'bg-white border-[#E6E2DA]'
          }`}
        >
          <div className="flex items-center justify-between text-[#991B1B]">
            <span className="text-xs font-bold uppercase tracking-wider font-serif">Out of Stock</span>
            <XCircle className="w-4 h-4 text-[#DC2626]" />
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-bold font-mono text-[#991B1B] tabular-nums">
              {kpis.out_of_stock_count}
            </p>
            <p className="text-[11px] text-[#991B1B] mt-0.5">0 units available</p>
          </div>
        </div>
      </div>

      {/* 2. MENU PERFORMANCE & STOCK METERS SECTION */}
      <div className="bg-white border border-[#E6E2DA] rounded-2xl p-5 shadow-sm space-y-4">
        {/* Header with Search and Filter Pills */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#111111] font-serif">
              Live Stock Meters &amp; Sales Performance
            </h3>
            <p className="text-xs text-[#52525B]">
              Track real-time inventory levels, capacity meters, and fast-moving menu favorites.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchInventory}
            disabled={loading}
            className="self-end md:self-auto px-3 py-1.5 bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] border border-[#E6E2DA] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-[#E6E2DA]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-[#71717A]" />
            <input
              type="text"
              placeholder="Search dishes or beverages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full min-h-[40px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#111111] placeholder-[#71717A] focus:outline-none focus:border-[#111111] focus:bg-white transition-colors"
            />
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`min-h-[36px] px-3 py-1 rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-[#111111] text-white shadow-xs'
                  : 'bg-[#F3EFEA] text-[#52525B] hover:text-[#111111] border border-[#E6E2DA]'
              }`}
            >
              All Items ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('low')}
              className={`min-h-[36px] px-3 py-1 rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'low'
                  ? 'bg-[#D97706] text-white shadow-xs'
                  : 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]'
              }`}
            >
              Low Stock ({kpis.low_stock_count})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('out')}
              className={`min-h-[36px] px-3 py-1 rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'out'
                  ? 'bg-[#DC2626] text-white shadow-xs'
                  : 'bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]'
              }`}
            >
              Out of Stock ({kpis.out_of_stock_count})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('healthy')}
              className={`min-h-[36px] px-3 py-1 rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'healthy'
                  ? 'bg-[#166534] text-white shadow-xs'
                  : 'bg-[#ECFDF5] text-[#166534] border border-[#BBF7D0]'
              }`}
            >
              Healthy ({kpis.healthy_count})
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`min-h-[32px] px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                categoryFilter === cat
                  ? 'bg-[#111111] text-white'
                  : 'bg-[#FAF9F6] text-[#52525B] hover:text-[#111111] border border-[#E6E2DA]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Stock Items Table / Cards */}
        {loading ? (
          <div className="py-16 text-center text-xs text-[#71717A] font-serif">
            Loading stock metrics and menu logs...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#71717A] italic font-serif">
            No items matching your current filters.
          </div>
        ) : (
          <div className="divide-y divide-[#E6E2DA] border border-[#E6E2DA] rounded-2xl overflow-hidden">
            {filteredItems.map((item) => {
              const qty = item.stock_qty ?? 0;
              const max = item.max_stock ?? 100;
              const alertThreshold = item.low_stock_alert ?? 10;
              const percent = max > 0 ? Math.min(100, Math.round((qty / max) * 100)) : 0;

              const isOutOfStock = qty <= 0;
              const isLowStock = !isOutOfStock && qty <= alertThreshold;

              const meterColor = isOutOfStock
                ? 'bg-[#EF4444]'
                : isLowStock
                ? 'bg-[#F59E0B]'
                : 'bg-[#10B981]';

              return (
                <div
                  key={item.id}
                  className="p-4 hover:bg-[#FAF9F6] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left: Thumbnail & Info */}
                  <div className="flex items-center gap-3.5 flex-1 min-w-[240px]">
                    <div className="w-12 h-12 rounded-xl bg-[#F3EFEA] border border-[#E6E2DA] overflow-hidden flex items-center justify-center flex-shrink-0">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Coffee className="w-6 h-6 text-[#71717A]/50" />
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-[#111111] text-sm font-serif">{item.name}</h4>
                        <span className="text-[10px] uppercase font-bold text-[#71717A] bg-[#F3EFEA] border border-[#E6E2DA] px-1.5 py-0.2 rounded">
                          {item.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#52525B]">
                        <span className="font-mono font-bold text-[#111111]">₹{item.price}</span>
                        <span>&bull;</span>
                        <span className="font-semibold text-[#166534] bg-[#ECFDF5] px-1.5 py-0.2 rounded border border-[#BBF7D0] tabular-nums">
                          {item.total_sold} units sold
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Visual Capacity Meter */}
                  <div className="flex-1 min-w-[200px] max-w-sm space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#52525B] font-serif">
                        Stock:{' '}
                        <strong className="font-mono text-[#111111] tabular-nums">
                          {qty}
                        </strong>{' '}
                        / {max} units
                      </span>
                      {isOutOfStock ? (
                        <span className="text-[10px] font-bold text-[#991B1B] bg-[#FEE2E2] px-1.5 py-0.5 rounded border border-[#FECACA]">
                          Out of Stock
                        </span>
                      ) : isLowStock ? (
                        <span className="text-[10px] font-bold text-[#92400E] bg-[#FEF3C7] px-1.5 py-0.5 rounded border border-[#FDE68A]">
                          Low Stock Alert
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-[#166534] tabular-nums">
                          {percent}% full
                        </span>
                      )}
                    </div>

                    {/* Progress Bar Track */}
                    <div className="w-full h-2 bg-[#E6E2DA] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${meterColor} transition-all duration-300 rounded-full`}
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Right: Quick Restock & Adjust Buttons */}
                  <div className="flex items-center gap-2 self-end md:self-auto">
                    <button
                      type="button"
                      onClick={() => openAdjustModal(item, 'restock')}
                      className="min-h-[38px] px-3 py-1.5 bg-[#111111] hover:bg-[#262626] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Restock</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openAdjustModal(item, 'wastage')}
                      className="min-h-[38px] px-3 py-1.5 bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] border border-[#E6E2DA] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Adjust / Wastage</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. RECENT STOCK MOVEMENTS AUDIT LOG */}
      <div className="bg-white border border-[#E6E2DA] rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#E6E2DA]">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#111111]" />
            <h3 className="font-bold text-[#111111] text-sm font-serif">
              Recent Inventory Audit Trail (Last 50 Events)
            </h3>
          </div>
          <span className="text-xs text-[#71717A] font-mono tabular-nums">
            {logs.length} logged movements
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="py-10 text-center text-xs text-[#71717A] italic font-serif">
            No stock movements recorded yet. Restocks, sales, and adjustments will appear here automatically.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E6E2DA] text-[#52525B] uppercase font-bold text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Date &amp; Time</th>
                  <th className="py-2.5 px-3">Menu Item</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3 text-right">Change</th>
                  <th className="py-2.5 px-3 text-right">Stock After</th>
                  <th className="py-2.5 px-3">Notes / Context</th>
                  <th className="py-2.5 px-3">Performed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E2DA]">
                {logs.map((log) => {
                  const isPositive = log.quantity_change > 0;
                  const isNegative = log.quantity_change < 0;

                  return (
                    <tr key={log.id} className="hover:bg-[#FAF9F6] transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[#52525B] text-[11px] whitespace-nowrap tabular-nums">
                        {new Date(log.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="py-2.5 px-3 font-bold text-[#111111] font-serif">
                        {log.item_name}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {log.change_type === 'restock' && (
                          <span className="text-[10px] font-bold text-[#166534] bg-[#ECFDF5] border border-[#BBF7D0] px-2 py-0.5 rounded-md uppercase">
                            Restock
                          </span>
                        )}
                        {log.change_type === 'wastage' && (
                          <span className="text-[10px] font-bold text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] px-2 py-0.5 rounded-md uppercase">
                            Wastage
                          </span>
                        )}
                        {log.change_type === 'adjustment' && (
                          <span className="text-[10px] font-bold text-[#1E40AF] bg-[#EFF6FF] border border-[#BFDBFE] px-2 py-0.5 rounded-md uppercase">
                            Adjustment
                          </span>
                        )}
                        {log.change_type === 'sale' && (
                          <span className="text-[10px] font-bold text-[#854D0E] bg-[#FEF9C3] border border-[#FEF08A] px-2 py-0.5 rounded-md uppercase">
                            POS Sale
                          </span>
                        )}
                      </td>

                      <td
                        className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums ${
                          isPositive
                            ? 'text-[#166534]'
                            : isNegative
                            ? 'text-[#991B1B]'
                            : 'text-[#52525B]'
                        }`}
                      >
                        {isPositive ? `+${log.quantity_change}` : log.quantity_change}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#111111] tabular-nums">
                        {log.stock_after}
                      </td>

                      <td className="py-2.5 px-3 text-[#52525B] italic max-w-xs truncate">
                        {log.notes || '—'}
                      </td>

                      <td className="py-2.5 px-3 text-[#52525B] whitespace-nowrap font-serif text-[11px]">
                        {log.performed_by}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. STOCK ADJUST / RESTOCK MODAL */}
      {showAdjustModal && selectedItem && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#E6E2DA] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E2DA]">
              <div>
                <h3 className="font-bold text-[#111111] text-base font-serif">
                  Stock Adjustment &bull; {selectedItem.name}
                </h3>
                <p className="text-xs text-[#52525B]">
                  Current Stock:{' '}
                  <strong className="text-[#111111] font-mono tabular-nums">
                    {selectedItem.stock_qty ?? 0}
                  </strong>{' '}
                  units
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="text-[#71717A] hover:text-[#111111] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
              {/* Change Type Tabs */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-[#52525B] uppercase tracking-wider">
                  Adjustment Type
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType('restock');
                      setAdjustQuantity('');
                    }}
                    className={`min-h-[38px] py-1 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      adjustType === 'restock'
                        ? 'bg-[#111111] text-white shadow-xs'
                        : 'bg-[#F3EFEA] text-[#52525B] hover:text-[#111111] border border-[#E6E2DA]'
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#10B981]" />
                    <span>Restock</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType('wastage');
                      setAdjustQuantity('');
                    }}
                    className={`min-h-[38px] py-1 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      adjustType === 'wastage'
                        ? 'bg-[#111111] text-white shadow-xs'
                        : 'bg-[#F3EFEA] text-[#52525B] hover:text-[#111111] border border-[#E6E2DA]'
                    }`}
                  >
                    <ArrowDownRight className="w-3.5 h-3.5 text-[#EF4444]" />
                    <span>Wastage</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType('adjustment');
                      setAdjustQuantity(String(selectedItem.stock_qty ?? 0));
                    }}
                    className={`min-h-[38px] py-1 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      adjustType === 'adjustment'
                        ? 'bg-[#111111] text-white shadow-xs'
                        : 'bg-[#F3EFEA] text-[#52525B] hover:text-[#111111] border border-[#E6E2DA]'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5 text-[#3B82F6]" />
                    <span>Audit Set</span>
                  </button>
                </div>
              </div>

              {/* Quantity Input */}
              <div>
                <label className="block text-[11px] font-bold text-[#52525B] uppercase tracking-wider mb-1">
                  {adjustType === 'restock'
                    ? 'Incoming Units to Add (+)'
                    : adjustType === 'wastage'
                    ? 'Units Wasted / Expired (-)'
                    : 'New Exact Physical Count'}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder={adjustType === 'adjustment' ? '0' : 'e.g. 50'}
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(e.target.value)}
                  className="w-full min-h-[42px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-2 text-sm text-[#111111] font-mono tabular-nums focus:outline-none focus:border-[#111111] focus:bg-white"
                  autoFocus
                />
              </div>

              {/* Thresholds (Max Capacity & Low Alert) */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-[#52525B] uppercase tracking-wider mb-1">
                    Max Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="100"
                    value={adjustMaxStock}
                    onChange={(e) => setAdjustMaxStock(e.target.value)}
                    className="w-full min-h-[38px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-1.5 text-xs text-[#111111] font-mono tabular-nums focus:outline-none focus:border-[#111111] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#52525B] uppercase tracking-wider mb-1">
                    Low Stock Alert At
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="10"
                    value={adjustLowAlert}
                    onChange={(e) => setAdjustLowAlert(e.target.value)}
                    className="w-full min-h-[38px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-1.5 text-xs text-[#111111] font-mono tabular-nums focus:outline-none focus:border-[#111111] focus:bg-white"
                  />
                </div>
              </div>

              {/* Notes / Reason */}
              <div>
                <label className="block text-[11px] font-bold text-[#52525B] uppercase tracking-wider mb-1">
                  Reason / Reference Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Vendor delivery invoice #88, milk carton damaged..."
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl p-2.5 text-xs text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white resize-none"
                />
              </div>

              {/* Live Preview Box */}
              <div className="p-3 bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl flex items-center justify-between text-xs font-serif">
                <span className="text-[#52525B]">Projected Stock:</span>
                <span className="font-mono text-sm font-bold text-[#111111] tabular-nums">
                  {selectedItem.stock_qty ?? 0} &rarr;{' '}
                  <span
                    className={
                      previewStock <= 0
                        ? 'text-[#991B1B]'
                        : previewStock <= (selectedItem.low_stock_alert ?? 10)
                        ? 'text-[#92400E]'
                        : 'text-[#166534]'
                    }
                  >
                    {previewStock} units
                  </span>
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-[#E6E2DA]">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="min-h-[42px] px-4 py-2 bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] font-bold rounded-xl text-xs border border-[#E6E2DA] cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submittingAdjust}
                  className="min-h-[42px] px-5 py-2 bg-[#111111] hover:bg-[#262626] disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{submittingAdjust ? 'Saving...' : 'Confirm Stock Adjustment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
