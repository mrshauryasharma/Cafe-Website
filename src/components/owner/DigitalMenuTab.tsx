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
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Edit Item Modal
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPrice, setEditPrice] = useState('');
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
        }),
      });

      const data = (await res.json()) as MenuItem & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to add item');

      setItems((prev) => [...prev, data]);
      setShowAddModal(false);
      setNewItemName('');
      setNewItemPrice('');
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

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#71717A]" />
          <input
            type="text"
            placeholder="Search item or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-[44px] bg-white border border-[#E6E2DA] rounded-xl pl-10 pr-4 py-2 text-sm text-[#111111] placeholder-[#71717A] focus:outline-none focus:border-[#111111] shadow-2xs transition-colors"
          />
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="min-h-[44px] bg-[#111111] hover:bg-[#262626] text-white font-semibold px-5 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-xs transition-all whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Menu Item</span>
        </button>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap cursor-pointer ${
              selectedCategory === cat
                ? 'bg-[#111111] text-white shadow-xs'
                : 'bg-white text-[#52525B] hover:text-[#111111] border border-[#E6E2DA]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      {loading ? (
        <div className="p-16 text-center text-[#52525B]">
          <div className="w-8 h-8 border-2 border-[#111111] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm font-medium">Loading digital menu...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white border border-[#E6E2DA] rounded-2xl p-10 text-center text-[#52525B] shadow-sm">
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
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`bg-white border rounded-2xl p-4 flex flex-col justify-between transition-all ${
                item.is_available === 1
                  ? 'border-[#E6E2DA] shadow-sm hover:border-[#111111]'
                  : 'border-[#E6E2DA]/60 opacity-60 bg-[#FAF9F6]'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="font-semibold text-[#111111] text-sm line-clamp-1 font-serif">{item.name}</h4>
                  <span className="text-xs font-mono font-bold text-[#111111] bg-[#F3EFEA] border border-[#E6E2DA] px-2.5 py-0.5 rounded-md tabular-nums">
                    ₹{item.price}
                  </span>
                </div>
                <span className="inline-block text-[11px] font-semibold text-[#52525B] uppercase tracking-wider bg-[#FAF9F6] border border-[#E6E2DA] px-2 py-0.5 rounded-md mb-3">
                  {item.category}
                </span>
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
                  <span className="font-semibold">{item.is_available === 1 ? 'In Stock' : 'Out of Stock'}</span>
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
          ))}
        </div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#E6E2DA] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E6E2DA]">
              <h3 className="font-bold text-[#111111] text-base font-serif">Add New Menu Item</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#71717A] hover:text-[#111111] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hazelnut Cappuccino"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                >
                  {DEFAULT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
                  Price (₹)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="1"
                  placeholder="e.g. 180"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white font-mono tabular-nums"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-[#52525B] hover:text-[#111111] bg-[#F3EFEA] hover:bg-[#E6E2DA] border border-[#E6E2DA] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="min-h-[44px] bg-[#111111] hover:bg-[#262626] disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-xl text-xs shadow-sm cursor-pointer"
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
          <div className="max-w-md w-full bg-white border border-[#E6E2DA] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E6E2DA]">
              <h3 className="font-bold text-[#111111] text-base font-serif">Edit Menu Item</h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-[#71717A] hover:text-[#111111] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
                  Category
                </label>
                <input
                  type="text"
                  required
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
                  Price (₹)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="1"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white font-mono tabular-nums"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editAvailable"
                  checked={editAvailable}
                  onChange={(e) => setEditAvailable(e.target.checked)}
                  className="w-4 h-4 rounded text-[#111111] accent-[#111111] border-[#E6E2DA]"
                />
                <label htmlFor="editAvailable" className="text-xs font-semibold text-[#111111] cursor-pointer">
                  Available in stock for counter ordering
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-[#52525B] hover:text-[#111111] bg-[#F3EFEA] hover:bg-[#E6E2DA] border border-[#E6E2DA] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="min-h-[44px] bg-[#111111] hover:bg-[#262626] disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-xl text-xs shadow-sm cursor-pointer"
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
