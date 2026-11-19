import React, { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Coffee,
  X,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { MenuItem } from '../../../functions/api/owner/menu';

const DEFAULT_CATEGORIES = ['Beverages', 'Coffee', 'Snacks', 'Main Course', 'Desserts', 'Specials'];

export const DigitalMenuTab: React.FC = () => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filter & Search
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Add Item Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Beverages');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemImage, setNewItemImage] = useState('');
  const [newItemStock, setNewItemStock] = useState('100');
  const [newItemMaxStock, setNewItemMaxStock] = useState('100');
  const [newItemLowAlert, setNewItemLowAlert] = useState('10');
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Edit Item Modal
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editImage, setEditImage] = useState('');
  const [editStock, setEditStock] = useState('100');
  const [editMaxStock, setEditMaxStock] = useState('100');
  const [editLowAlert, setEditLowAlert] = useState('10');
  const [editAvailable, setEditAvailable] = useState(true);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/owner/menu');
      if (!res.ok) throw new Error('Failed to fetch menu items');
      const data = (await res.json()) as MenuItem[];
      setItems(data);
    } catch (err: any) {
      setError(err.message || 'Error loading menu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemCategory.trim() || !newItemPrice) return;
    setError(null);
    setSubmittingAdd(true);

    try {
      const res = await fetch('/api/owner/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newItemName.trim(),
          category: newItemCategory.trim(),
          price: Number(newItemPrice),
          is_available: 1,
          image_url: newItemImage.trim() || undefined,
          stock_qty: newItemStock ? Number(newItemStock) : 100,
          max_stock: newItemMaxStock ? Number(newItemMaxStock) : 100,
          low_stock_alert: newItemLowAlert ? Number(newItemLowAlert) : 10,
        }),
      });

      const data = (await res.json()) as MenuItem & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to add item');

      setItems((prev) => [...prev, data]);
      setShowAddModal(false);
      setNewItemName('');
      setNewItemPrice('');
      setNewItemImage('');
      setNewItemStock('100');
      setNewItemMaxStock('100');
      setNewItemLowAlert('10');
      setSuccess(`Added "${data.name}" to menu`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error adding menu item');
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleToggleStock = async (item: MenuItem) => {
    const nextStock = item.is_available === 1 ? 0 : 1;
    try {
      const res = await fetch(`/api/owner/menu/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: nextStock }),
      });
      if (!res.ok) throw new Error('Failed to update stock status');

      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_available: nextStock } : i))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to toggle availability');
    }
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditCategory(item.category);
    setEditPrice(String(item.price));
    setEditImage(item.image_url || '');
    setEditStock(String(item.stock_qty ?? 100));
    setEditMaxStock(String(item.max_stock ?? 100));
    setEditLowAlert(String(item.low_stock_alert ?? 10));
    setEditAvailable(item.is_available === 1);
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setError(null);
    setSubmittingEdit(true);

    try {
      const res = await fetch(`/api/owner/menu/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          category: editCategory.trim(),
          price: Number(editPrice),
          is_available: editAvailable ? 1 : 0,
          image_url: editImage.trim() || null,
          stock_qty: editStock ? Number(editStock) : 100,
          max_stock: editMaxStock ? Number(editMaxStock) : 100,
          low_stock_alert: editLowAlert ? Number(editLowAlert) : 10,
        }),
      });

      const data = (await res.json()) as MenuItem & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to update item');

      setItems((prev) => prev.map((i) => (i.id === editingItem.id ? data : i)));
      setEditingItem(null);
      setSuccess(`Updated "${data.name}"`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error updating item');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeleteItem = async (item: MenuItem) => {
    if (!window.confirm(`Are you sure you want to remove "${item.name}" from the menu?`)) {
      return;
    }
    setError(null);

    try {
      const res = await fetch(`/api/owner/menu/${item.id}`, { method: 'DELETE' });
      const data = (await res.json()) as { success?: boolean; error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to delete item');

      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setSuccess(data.message || `Deleted "${item.name}"`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete menu item');
    }
  };

  const categories = Array.from(new Set(['All', ...DEFAULT_CATEGORIES, ...items.map((i) => i.category)]));

  const filteredItems = items.filter((item) => {
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-2xl text-[#991B1B] text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-[#991B1B] hover:text-[#111111] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-[#ECFDF5] border border-[#BBF7D0] rounded-2xl text-[#166534] text-sm flex items-center gap-2 font-semibold">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Top Header & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3.5 text-[#71717A]" />
          <input
            type="text"
            placeholder="Search catalog by name or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-[44px] bg-white border border-[#E6E2DA] rounded-2xl pl-9 pr-3 py-2 text-sm text-[#111111] placeholder-[#71717A] focus:outline-none focus:border-[#111111] transition-colors"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="min-h-[44px] px-5 py-2.5 bg-[#111111] hover:bg-[#262626] text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Add Menu Item</span>
        </button>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap cursor-pointer ${
              selectedCategory === cat
                ? 'bg-[#111111] text-white shadow-xs'
                : 'bg-[#F3EFEA] text-[#52525B] hover:text-[#111111] border border-[#E6E2DA]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Menu Grid */}
      {loading ? (
        <div className="py-16 text-center text-[#71717A] text-xs font-serif">Loading menu items...</div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white border border-[#E6E2DA] rounded-2xl p-10 text-center">
          <Coffee className="w-10 h-10 mx-auto text-[#71717A] mb-2" />
          <p className="text-base font-semibold text-[#111111] font-serif">No menu items found</p>
          <p className="text-xs text-[#71717A] mt-1 max-w-sm mx-auto">
            {search || selectedCategory !== 'All'
              ? 'Try modifying your search or category filter.'
              : 'Add your first coffee or dish to start billing!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredItems.map((item) => {
            const stockQty = item.stock_qty ?? 100;
            const maxStock = item.max_stock ?? 100;
            const lowAlert = item.low_stock_alert ?? 10;
            const isOutOfStock = stockQty <= 0;
            const isLowStock = !isOutOfStock && stockQty <= lowAlert;

            return (
              <div
                key={item.id}
                className={`bg-white border rounded-2xl p-4 flex flex-col justify-between transition-all ${
                  item.is_available === 1
                    ? 'border-[#E6E2DA] shadow-sm hover:border-[#111111]'
                    : 'border-[#E6E2DA]/60 opacity-60 bg-[#FAF9F6]'
                }`}
              >
                <div>
                  {/* Thumbnail & Title */}
                  <div className="flex items-start gap-3 mb-2">
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
                        <Coffee className="w-5 h-5 text-[#71717A]/50" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-semibold text-[#111111] text-sm line-clamp-1 font-serif">
                          {item.name}
                        </h4>
                        <span className="text-xs font-mono font-bold text-[#111111] bg-[#F3EFEA] border border-[#E6E2DA] px-2 py-0.5 rounded-md tabular-nums flex-shrink-0">
                          ₹{item.price}
                        </span>
                      </div>
                      <span className="inline-block text-[10px] font-semibold text-[#52525B] uppercase tracking-wider bg-[#FAF9F6] border border-[#E6E2DA] px-1.5 py-0.2 rounded mt-0.5">
                        {item.category}
                      </span>
                    </div>
                  </div>

                  {/* Stock Level Badge */}
                  <div className="mb-2">
                    {isOutOfStock ? (
                      <span className="text-[10px] font-bold text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] px-2 py-0.5 rounded-md">
                        Out of Stock (0 units)
                      </span>
                    ) : isLowStock ? (
                      <span className="text-[10px] font-bold text-[#92400E] bg-[#FEF3C7] border border-[#FDE68A] px-2 py-0.5 rounded-md tabular-nums">
                        Low Stock: {stockQty} / {maxStock} units
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-[#166534] bg-[#ECFDF5] border border-[#BBF7D0] px-2 py-0.5 rounded-md tabular-nums">
                        In Stock: {stockQty} / {maxStock} units
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#E6E2DA] text-xs">
                  {/* Stock Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleStock(item)}
                    className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                      item.is_available === 1
                        ? 'text-[#166534] hover:text-[#14532D]'
                        : 'text-[#71717A] hover:text-[#111111]'
                    }`}
                  >
                    {item.is_available === 1 ? (
                      <ToggleRight className="w-5 h-5 text-[#166534]" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-[#71717A]" />
                    )}
                    <span className="font-semibold">{item.is_available === 1 ? 'Active' : 'Hidden'}</span>
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(item)}
                      title="Edit item"
                      className="p-1.5 text-[#52525B] hover:text-[#111111] rounded-lg hover:bg-[#F3EFEA] transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item)}
                      title="Delete item"
                      className="p-1.5 text-[#71717A] hover:text-[#991B1B] rounded-lg hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#E6E2DA] rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E6E2DA]">
              <h3 className="font-bold text-[#111111] text-base font-serif">Add New Menu Item</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#71717A] hover:text-[#111111] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#52525B] uppercase tracking-wider mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hazelnut Cappuccino"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full min-h-[42px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#52525B] uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Coffee"
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="w-full min-h-[42px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#52525B] uppercase tracking-wider mb-1">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1"
                    placeholder="250"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    className="w-full min-h-[42px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#52525B] uppercase tracking-wider mb-1">
                  Product Image URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={newItemImage}
                  onChange={(e) => setNewItemImage(e.target.value)}
                  className="w-full min-h-[42px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-2 text-xs text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#E6E2DA]">
                <div>
                  <label className="block text-[10px] font-bold text-[#52525B] uppercase tracking-wider mb-1">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="100"
                    value={newItemStock}
                    onChange={(e) => setNewItemStock(e.target.value)}
                    className="w-full min-h-[38px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-2.5 py-1 text-xs text-[#111111] font-mono tabular-nums focus:outline-none focus:border-[#111111] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#52525B] uppercase tracking-wider mb-1">
                    Max Stock
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="100"
                    value={newItemMaxStock}
                    onChange={(e) => setNewItemMaxStock(e.target.value)}
                    className="w-full min-h-[38px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-2.5 py-1 text-xs text-[#111111] font-mono tabular-nums focus:outline-none focus:border-[#111111] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#52525B] uppercase tracking-wider mb-1">
                    Low Alert
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="10"
                    value={newItemLowAlert}
                    onChange={(e) => setNewItemLowAlert(e.target.value)}
                    className="w-full min-h-[38px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-2.5 py-1 text-xs text-[#111111] font-mono tabular-nums focus:outline-none focus:border-[#111111] focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E6E2DA]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold text-[#52525B] hover:text-[#111111] bg-[#F3EFEA] hover:bg-[#E6E2DA] border border-[#E6E2DA] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="min-h-[42px] bg-[#111111] hover:bg-[#262626] disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-sm cursor-pointer"
                >
                  {submittingAdd ? 'Adding...' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#E6E2DA] rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E6E2DA]">
              <h3 className="font-bold text-[#111111] text-base font-serif">Edit Menu Item</h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-[#71717A] hover:text-[#111111] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateItem} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#52525B] uppercase tracking-wider mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full min-h-[42px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#52525B] uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    required
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full min-h-[42px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#52525B] uppercase tracking-wider mb-1">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full min-h-[42px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#52525B] uppercase tracking-wider mb-1">
                  Product Image URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={editImage}
                  onChange={(e) => setEditImage(e.target.value)}
                  className="w-full min-h-[42px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-2 text-xs text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#E6E2DA]">
                <div>
                  <label className="block text-[10px] font-bold text-[#52525B] uppercase tracking-wider mb-1">
                    Current Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editStock}
                    onChange={(e) => setEditStock(e.target.value)}
                    className="w-full min-h-[38px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-2.5 py-1 text-xs text-[#111111] font-mono tabular-nums focus:outline-none focus:border-[#111111] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#52525B] uppercase tracking-wider mb-1">
                    Max Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editMaxStock}
                    onChange={(e) => setEditMaxStock(e.target.value)}
                    className="w-full min-h-[38px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-2.5 py-1 text-xs text-[#111111] font-mono tabular-nums focus:outline-none focus:border-[#111111] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#52525B] uppercase tracking-wider mb-1">
                    Low Alert
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editLowAlert}
                    onChange={(e) => setEditLowAlert(e.target.value)}
                    className="w-full min-h-[38px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-2.5 py-1 text-xs text-[#111111] font-mono tabular-nums focus:outline-none focus:border-[#111111] focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editAvailable"
                  checked={editAvailable}
                  onChange={(e) => setEditAvailable(e.target.checked)}
                  className="w-4 h-4 rounded text-[#111111] accent-[#111111] border-[#E6E2DA] cursor-pointer"
                />
                <label htmlFor="editAvailable" className="text-xs font-semibold text-[#111111] cursor-pointer">
                  Item is active and visible in catalog
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E6E2DA]">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold text-[#52525B] hover:text-[#111111] bg-[#F3EFEA] hover:bg-[#E6E2DA] border border-[#E6E2DA] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="min-h-[42px] bg-[#111111] hover:bg-[#262626] disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-sm cursor-pointer"
                >
                  {submittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
