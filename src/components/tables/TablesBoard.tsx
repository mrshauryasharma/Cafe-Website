import React, { useEffect, useState, useMemo } from 'react';
import {
  UtensilsCrossed,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Users,
  ShoppingBag,
  CreditCard,
  Trash2,
  Edit2,
  X,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { User, CafeTable } from '../../types';
import { useRouter } from '../../utils/router';

interface TablesBoardProps {
  currentUser: User;
  isOnline?: boolean;
}

interface TableWithDraft extends CafeTable {
  active_draft_id?: string | null;
  active_draft_number?: string | null;
  active_draft_items_count?: number;
  active_draft_total?: number;
  active_draft_created_at?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  waiter_id?: string | null;
  waiter_name?: string | null;
}

export const TablesBoard: React.FC<TablesBoardProps> = ({ currentUser, isOnline = true }) => {
  const { navigate } = useRouter();
  const permissions = currentUser.permissions || {
    can_take_orders: false,
    can_view_tables: true,
    can_manage_tables: false,
    can_settle_bills: false,
    can_apply_discounts: false,
    can_manage_menu_stock: false,
    can_view_reports: false,
    can_award_bonus_points: false,
  };

  const [tables, setTables] = useState<TableWithDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<'all' | 'vacant' | 'occupied'>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Edit Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTable, setEditingTable] = useState<TableWithDraft | null>(null);
  const [formTableNumber, setFormTableNumber] = useState('');
  const [formTableName, setFormTableName] = useState('');
  const [formSection, setFormSection] = useState('Main Floor');
  const [formCapacity, setFormCapacity] = useState(4);
  const [formSortOrder, setFormSortOrder] = useState(1);
  const [submittingForm, setSubmittingForm] = useState(false);

  const fetchTables = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch('/api/tables');
      if (!res.ok) {
        const errData = (await res.json()) as { error?: string };
        throw new Error(errData.error || 'Failed to load floor tables');
      }
      const data = (await res.json()) as TableWithDraft[];
      setTables(data);
    } catch (err: any) {
      if (!silent) {
        setError(err.message || 'Error loading tables');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables(false);

    const handleVisibilityOrFocus = () => {
      if (!document.hidden) {
        fetchTables(true);
      }
    };

    // Multi-device live sync every 5 seconds when tab is visible
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchTables(true);
      }
    }, 5000);

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, []);

  // Distinct sections
  const sections = useMemo(() => {
    const set = new Set<string>();
    tables.forEach((t) => {
      if (t.section) set.add(t.section);
    });
    return Array.from(set);
  }, [tables]);

  // Filtered tables
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (selectedSection !== 'all' && t.section !== selectedSection) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = t.table_name.toLowerCase().includes(q);
        const matchesNum = t.table_number.toLowerCase().includes(q);
        const matchesSection = t.section.toLowerCase().includes(q);
        if (!matchesName && !matchesNum && !matchesSection) return false;
      }
      return true;
    });
  }, [tables, statusFilter, selectedSection, searchQuery]);

  // Overall Statistics
  const stats = useMemo(() => {
    const total = tables.length;
    const vacant = tables.filter((t) => t.status === 'vacant').length;
    const occupied = tables.filter((t) => t.status === 'occupied').length;
    const totalCapacity = tables.reduce((acc, t) => acc + (t.capacity || 0), 0);
    return { total, vacant, occupied, totalCapacity };
  }, [tables]);

  const handleOpenAddModal = () => {
    setEditingTable(null);
    const nextNum = tables.length + 1;
    setFormTableNumber(`T-${String(nextNum).padStart(2, '0')}`);
    setFormTableName(`Table ${nextNum}`);
    setFormSection('Main Floor');
    setFormCapacity(4);
    setFormSortOrder(nextNum);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (t: TableWithDraft) => {
    setEditingTable(t);
    setFormTableNumber(t.table_number);
    setFormTableName(t.table_name);
    setFormSection(t.section);
    setFormCapacity(t.capacity);
    setFormSortOrder(t.sort_order);
    setShowAddModal(true);
  };

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      setError('Offline mode: table modifications are locked.');
      return;
    }
    if (!formTableNumber.trim()) return;

    setError(null);
    setSubmittingForm(true);

    try {
      if (editingTable) {
        // Edit table
        const res = await fetch(`/api/tables/${editingTable.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table_name: formTableName.trim() || formTableNumber.trim(),
            section: formSection.trim() || 'Main Floor',
            capacity: formCapacity,
            sort_order: formSortOrder,
          }),
        });

        const data = (await res.json()) as TableWithDraft & { error?: string };
        if (!res.ok) throw new Error(data.error || 'Failed to update table');

        setTables((prev) => prev.map((t) => (t.id === editingTable.id ? { ...t, ...data } : t)));
        setSuccess(`Table "${formTableName}" updated successfully.`);
      } else {
        // Create table
        const res = await fetch('/api/tables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table_number: formTableNumber.trim().toUpperCase(),
            table_name: formTableName.trim() || formTableNumber.trim().toUpperCase(),
            section: formSection.trim() || 'Main Floor',
            capacity: formCapacity,
            sort_order: formSortOrder,
          }),
        });

        const data = (await res.json()) as TableWithDraft & { error?: string };
        if (!res.ok) throw new Error(data.error || 'Failed to add table');

        setTables((prev) => [...prev, data]);
        setSuccess(`Table "${data.table_name}" added to ${data.section}.`);
      }

      setShowAddModal(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error saving table');
    } finally {
      setSubmittingForm(false);
    }
  };

  const handleDeleteTable = async (t: TableWithDraft) => {
    if (!isOnline) {
      setError('Offline mode: table modifications are locked.');
      return;
    }
    if (t.status === 'occupied') {
      setError(`Cannot remove "${t.table_name}" while occupied.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to remove ${t.table_name} (${t.table_number})?`)) {
      return;
    }

    setError(null);
    try {
      const res = await fetch(`/api/tables/${t.id}`, { method: 'DELETE' });
      const data = (await res.json()) as { error?: string; success?: boolean };
      if (!res.ok) throw new Error(data.error || 'Failed to delete table');

      setTables((prev) => prev.filter((item) => item.id !== t.id));
      setSuccess(`Table "${t.table_name}" removed.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error removing table');
    }
  };

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-2xl text-[#991B1B] text-sm flex items-center justify-between shadow-xs">
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
        <div className="p-4 bg-[#ECFDF5] border border-[#BBF7D0] rounded-2xl text-[#166534] text-sm flex items-center gap-2 font-semibold shadow-xs">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Floor Overview KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white border border-[#E6E2DA] rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] font-semibold text-[#52525B] uppercase tracking-wider">Total Tables</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-bold font-serif tabular-nums text-[#111111]">
              {stats.total}
            </span>
            <span className="text-xs text-[#71717A]">units</span>
          </div>
        </div>

        <div className="bg-[#ECFDF5] border border-[#BBF7D0] rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] font-semibold text-[#166534] uppercase tracking-wider">Vacant & Ready</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-bold font-serif tabular-nums text-[#166534]">
              {stats.vacant}
            </span>
            <span className="text-xs text-[#166534]/80">tables</span>
          </div>
        </div>

        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] font-semibold text-[#92400E] uppercase tracking-wider">Occupied Dining</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-bold font-serif tabular-nums text-[#92400E]">
              {stats.occupied}
            </span>
            <span className="text-xs text-[#92400E]/80">active</span>
          </div>
        </div>

        <div className="bg-white border border-[#E6E2DA] rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] font-semibold text-[#52525B] uppercase tracking-wider">Guest Capacity</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-bold font-serif tabular-nums text-[#111111]">
              {stats.totalCapacity}
            </span>
            <span className="text-xs text-[#71717A]">seats</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Filters, Refresh, Add Table */}
      <div className="bg-white border border-[#E6E2DA] rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search table number or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl text-sm text-[#111111] placeholder-[#71717A] focus:outline-none focus:border-[#111111] focus:bg-white transition-colors"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchTables(false)}
            title="Refresh floor board"
            className="p-2.5 bg-[#FAF9F6] hover:bg-[#F3EFEA] border border-[#E6E2DA] rounded-xl text-[#52525B] hover:text-[#111111] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {permissions.can_manage_tables && (
            <button
              onClick={handleOpenAddModal}
              className="min-h-[40px] px-4 py-2 bg-[#111111] hover:bg-[#262626] text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Extra Table</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 overflow-x-auto pb-1">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 bg-[#F3EFEA] p-1 rounded-xl border border-[#E6E2DA] w-fit">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-white text-[#111111] shadow-2xs font-bold'
                : 'text-[#52525B] hover:text-[#111111]'
            }`}
          >
            All Tables ({tables.length})
          </button>
          <button
            onClick={() => setStatusFilter('vacant')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'vacant'
                ? 'bg-[#ECFDF5] text-[#166534] border border-[#BBF7D0] shadow-2xs font-bold'
                : 'text-[#52525B] hover:text-[#111111]'
            }`}
          >
            Vacant ({stats.vacant})
          </button>
          <button
            onClick={() => setStatusFilter('occupied')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'occupied'
                ? 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A] shadow-2xs font-bold'
                : 'text-[#52525B] hover:text-[#111111]'
            }`}
          >
            Occupied ({stats.occupied})
          </button>
        </div>

        {/* Section Pills */}
        {sections.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-xs text-[#71717A] uppercase font-semibold tracking-wider mr-1">Section:</span>
            <button
              onClick={() => setSelectedSection('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                selectedSection === 'all'
                  ? 'bg-[#111111] text-white shadow-2xs'
                  : 'bg-white border border-[#E6E2DA] text-[#52525B] hover:text-[#111111]'
              }`}
            >
              All Sections
            </button>
            {sections.map((sec) => (
              <button
                key={sec}
                onClick={() => setSelectedSection(sec)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  selectedSection === sec
                    ? 'bg-[#111111] text-white shadow-2xs'
                    : 'bg-white border border-[#E6E2DA] text-[#52525B] hover:text-[#111111]'
                }`}
              >
                {sec}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tables Grid */}
      {loading && tables.length === 0 ? (
        <div className="p-16 text-center text-[#52525B] bg-white border border-[#E6E2DA] rounded-2xl shadow-xs">
          <div className="w-8 h-8 border-2 border-[#111111] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm font-medium">Loading live floor board...</p>
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="p-12 text-center bg-white border border-[#E6E2DA] rounded-2xl shadow-xs space-y-2">
          <UtensilsCrossed className="w-8 h-8 mx-auto text-[#71717A]" />
          <h4 className="font-semibold text-base text-[#111111] font-serif">No tables found</h4>
          <p className="text-xs text-[#52525B]">Try resetting your search query or status filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTables.map((t) => {
            const isOccupied = t.status === 'occupied';

            return (
              <div
                key={t.id}
                className={`rounded-2xl border p-4 sm:p-5 flex flex-col justify-between transition-all relative ${
                  isOccupied
                    ? 'bg-[#FFFBEB] border-[#FDE68A] shadow-sm'
                    : 'bg-white border-[#E6E2DA] hover:border-[#111111]/40 shadow-xs'
                }`}
              >
                {/* Card Top: Number, Section, Status */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-[#52525B] uppercase tracking-wider">
                          {t.table_number}
                        </span>
                        <span className="text-xs text-[#71717A]">&bull;</span>
                        <span className="text-[11px] text-[#71717A] uppercase font-semibold">
                          {t.section}
                        </span>
                      </div>
                      <h3 className="font-bold text-lg font-serif text-[#111111] mt-0.5 tracking-tight">
                        {t.table_name}
                      </h3>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                        isOccupied
                          ? 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]'
                          : 'bg-[#ECFDF5] text-[#166534] border-[#BBF7D0]'
                      }`}
                    >
                      {isOccupied ? 'Occupied' : 'Vacant'}
                    </span>
                  </div>

                  {/* Table Details: Capacity, Draft preview */}
                  <div className="mt-3 pt-3 border-t border-dashed border-[#E6E2DA] space-y-2">
                    <div className="flex items-center justify-between text-xs text-[#52525B]">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-[#71717A]" />
                        <span>Capacity:</span>
                      </span>
                      <strong className="text-[#111111] tabular-nums font-mono">
                        {t.capacity > 0 ? `${t.capacity} Guests` : 'Counter Only'}
                      </strong>
                    </div>

                    {isOccupied && (
                      <div className="bg-white/80 border border-[#FDE68A] rounded-xl p-2.5 space-y-1 text-xs">
                        <div className="flex items-center justify-between font-semibold text-[#92400E]">
                          <span>Ticket #{t.active_draft_number || 'Active'}</span>
                          <span className="font-mono tabular-nums text-sm font-bold text-[#111111]">
                            ₹{t.active_draft_total || 0}
                          </span>
                        </div>
                        {t.active_draft_items_count !== undefined && t.active_draft_items_count > 0 && (
                          <div className="flex items-center justify-between text-[11px] text-[#52525B]">
                            <span>{t.active_draft_items_count} items placed</span>
                            {t.active_draft_created_at && (
                              <span className="flex items-center gap-1 text-[10px] text-[#71717A]">
                                <Clock className="w-3 h-3" />
                                {new Date(t.active_draft_created_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                        )}
                        {(t.customer_name || t.waiter_name) && (
                          <div className="flex items-center justify-between text-[10px] text-[#71717A] pt-1 border-t border-[#FDE68A]/60 truncate gap-2">
                            <span className="truncate font-serif">
                              {t.customer_name ? `Guest: ${t.customer_name}` : 'Walk-in Guest'}
                            </span>
                            {t.waiter_name && (
                              <span className="truncate font-semibold text-[#92400E]">
                                {t.waiter_name}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-[#E6E2DA] flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Take / Add Order */}
                    <button
                      onClick={() => navigate(`/order/${encodeURIComponent(t.table_number)}`)}
                      className="min-h-[38px] px-3 py-1.5 bg-[#111111] hover:bg-[#262626] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>{isOccupied ? 'Add to Order' : 'Take Order'}</span>
                    </button>

                    {/* Settle Bill (or POS View) */}
                    {permissions.can_settle_bills ? (
                      <button
                        onClick={() => navigate(`/pos/${encodeURIComponent(t.table_number)}`)}
                        className={`min-h-[38px] px-3 py-1.5 border text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs ${
                          isOccupied
                            ? 'bg-[#166534] hover:bg-[#14532D] text-white border-transparent'
                            : 'bg-white hover:bg-[#F3EFEA] text-[#111111] border-[#E6E2DA]'
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>{isOccupied ? 'Settle Bill' : 'Open POS'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate(`/order/${encodeURIComponent(t.table_number)}`)}
                        className="min-h-[38px] px-3 py-1.5 bg-white hover:bg-[#F3EFEA] border border-[#E6E2DA] text-[#52525B] hover:text-[#111111] text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <UtensilsCrossed className="w-3.5 h-3.5" />
                        <span>View Items</span>
                      </button>
                    )}
                  </div>

                  {/* Manager/Owner Table Actions (Edit / Delete) */}
                  {permissions.can_manage_tables && (
                    <div className="flex items-center justify-end gap-1.5 pt-1 text-xs">
                      <button
                        onClick={() => handleOpenEditModal(t)}
                        title="Edit Table Info"
                        className="p-1.5 text-[#52525B] hover:text-[#111111] hover:bg-black/5 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {!isOccupied && (
                        <button
                          onClick={() => handleDeleteTable(t)}
                          title="Remove Table"
                          className="p-1.5 text-[#991B1B] hover:text-[#7F1D1D] hover:bg-[#FEF2F2] rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Table Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E6E2DA] rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E2DA]">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[#F3EFEA] border border-[#E6E2DA] flex items-center justify-center">
                  <UtensilsCrossed className="w-4 h-4 text-[#111111]" />
                </div>
                <h3 className="font-bold text-lg font-serif text-[#111111]">
                  {editingTable ? `Edit ${editingTable.table_name}` : 'Add Extra Dining Table'}
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-[#71717A] hover:text-[#111111] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTable} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
                  Table Number / Code
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingTable)}
                  value={formTableNumber}
                  onChange={(e) => setFormTableNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. T-13 or BAL-01"
                  className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2 text-sm text-[#111111] font-mono uppercase focus:outline-none focus:border-[#111111] focus:bg-white"
                />
                <p className="text-[11px] text-[#71717A] mt-1">Unique identifier printed on the table marker.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
                  Table Display Name
                </label>
                <input
                  type="text"
                  required
                  value={formTableName}
                  onChange={(e) => setFormTableName(e.target.value)}
                  placeholder="e.g. Table 13 or Balcony Corner"
                  className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white font-serif"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
                    Floor Section
                  </label>
                  <input
                    type="text"
                    required
                    value={formSection}
                    onChange={(e) => setFormSection(e.target.value)}
                    placeholder="e.g. Main Floor, Outdoor"
                    className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
                    Seating Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(Number(e.target.value))}
                    className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2 text-sm text-[#111111] font-mono tabular-nums focus:outline-none focus:border-[#111111] focus:bg-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#E6E2DA] text-xs font-semibold text-[#52525B] hover:text-[#111111] hover:bg-[#FAF9F6] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingForm}
                  className="px-5 py-2.5 rounded-xl bg-[#111111] hover:bg-[#262626] text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submittingForm ? 'Saving...' : editingTable ? 'Save Changes' : 'Add Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
