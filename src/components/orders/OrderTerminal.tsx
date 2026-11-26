import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  UtensilsCrossed,
  Search,
  Plus,
  Minus,
  Trash2,
  Send,
  AlertCircle,
  CheckCircle2,
  Printer,
  X,
  ArrowRightLeft,
  ShoppingBag,
  Sparkles,
  Phone,
  User as UserIcon,
  Ban,
} from 'lucide-react';
import { User, CafeTable, KotItem, KotTicket } from '../../types';
import { MenuItem } from '../../../functions/api/owner/menu';
import { useRouter } from '../../utils/router';

interface OrderTerminalProps {
  currentUser: User;
  initialTableId?: string;
  isOnline?: boolean;
}

interface TableWithDraft extends CafeTable {
  active_draft_id?: string | null;
  active_draft_number?: string | null;
  active_draft_items_count?: number;
  active_draft_total?: number;
  active_draft_created_at?: string | null;
}

interface CartItem extends KotItem {
  notes?: string;
}

export const OrderTerminal: React.FC<OrderTerminalProps> = ({
  currentUser,
  initialTableId,
  isOnline = true,
}) => {
  const { navigate } = useRouter();
  const perms = currentUser.permissions;

  // Tables & Menu State
  const [tables, setTables] = useState<TableWithDraft[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [settledNotice, setSettledNotice] = useState<string | null>(null);

  const wasOccupiedMapRef = useRef<Record<string, boolean>>({});
  const suppressSettledNoticeRef = useRef<boolean>(false);

  // Selected Table
  const [selectedTableId, setSelectedTableId] = useState<string>(initialTableId || '');
  const selectedTableIdRef = useRef<string>(selectedTableId);

  useEffect(() => {
    selectedTableIdRef.current = selectedTableId;
  }, [selectedTableId]);

  // Customer Details
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [matchedCustomer, setMatchedCustomer] = useState<{
    id: string;
    name: string;
    phone: string;
    points_balance: number;
    total_visits: number;
  } | null>(null);

  // Cart for new items being ordered right now
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Menu Search & Category
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Running Draft Items (already sent to kitchen)
  const [runningDraft, setRunningDraft] = useState<{
    id: string;
    draft_number: string;
    items: KotItem[];
    customer_name?: string | null;
    customer_phone?: string | null;
    created_at: string;
  } | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(false);

  // Modals
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftTargetTableId, setShiftTargetTableId] = useState('');
  const [shifting, setShifting] = useState(false);

  // Item Cancellation Modal
  const [cancellingItem, setCancellingItem] = useState<{ item: KotItem; index: number } | null>(null);
  const [cancelQty, setCancelQty] = useState(1);
  const [cancelReason, setCancelReason] = useState('Customer changed mind');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Success Dual KOT Modal
  const [lastPlacedKot, setLastPlacedKot] = useState<KotTicket | null>(null);

  // Quick Kitchen Notes Suggestions
  const noteSuggestions = ['Less spicy', 'Extra hot', 'No onion/garlic', 'No sugar', 'Less ice', 'Serve first'];
  const cancelReasons = [
    'Customer changed mind',
    'Ordered by mistake',
    'Item unavailable in kitchen',
    'Customer left table',
    'Kitchen delay / Long wait',
  ];

  // Fetch initial data & light poll for live floor sync
  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [tablesRes, initRes] = await Promise.all([
        fetch('/api/tables'),
        silent ? Promise.resolve(null) : fetch('/api/counter/init'),
      ]);

      if (tablesRes.ok) {
        const tablesData = (await tablesRes.json()) as TableWithDraft[];
        const activeId = selectedTableIdRef.current;

        if (activeId && !suppressSettledNoticeRef.current) {
          const activeTableNow = tablesData.find(
            (t) => t.id === activeId || t.table_number.toLowerCase() === activeId.toLowerCase()
          );
          if (
            activeTableNow &&
            wasOccupiedMapRef.current[activeTableNow.id] === true &&
            activeTableNow.status === 'vacant'
          ) {
            setRunningDraft(null);
            setCart([]);
            setOrderNotes('');
            setCustomerPhone('');
            setCustomerName('');
            setMatchedCustomer(null);
            setSettledNotice('Table bill was settled at Counter — table is now Vacant');
          }
        }
        suppressSettledNoticeRef.current = false;

        tablesData.forEach((t) => {
          wasOccupiedMapRef.current[t.id] = t.status === 'occupied';
        });

        setTables(tablesData || []);

        // If no table selected or invalid, select initial or first table
        if (tablesData.length > 0 && !silent) {
          if (initialTableId) {
            const matched = tablesData.find(
              (t) => t.id === initialTableId || t.table_number.toLowerCase() === initialTableId.toLowerCase()
            );
            if (matched) {
              setSelectedTableId(matched.id);
            } else if (!activeId) {
              setSelectedTableId(tablesData[0].id);
            }
          } else if (!activeId) {
            const firstT = tablesData.find((t) => t.table_number.startsWith('T-')) || tablesData[0];
            setSelectedTableId(firstT.id);
          }
        }
      }

      if (initRes && initRes.ok) {
        const initData = (await initRes.json()) as { menu_items?: MenuItem[] };
        setMenuItems(initData.menu_items || []);
      }
    } catch (err: any) {
      if (!silent) {
        console.error('Failed to load order terminal data:', err);
        setError('Failed to load menu & table layout.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [initialTableId]);

  useEffect(() => {
    fetchData(false);

    const handleVisibilityOrFocus = () => {
      if (!document.hidden) {
        fetchData(true);
      }
    };

    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchData(true);
      }
    }, 5000);

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [fetchData]);

  // Update selected table if initialTableId changes
  useEffect(() => {
    if (initialTableId && tables.length > 0) {
      const match = tables.find(
        (t) => t.id === initialTableId || t.table_number.toLowerCase() === initialTableId.toLowerCase()
      );
      if (match && match.id !== selectedTableId) {
        setSelectedTableId(match.id);
        setSettledNotice(null);
      }
    }
  }, [initialTableId, tables, selectedTableId]);

  // Selected table object
  const currentTable = useMemo(() => {
    return (
      tables.find(
        (t) => t.id === selectedTableId || t.table_number.toLowerCase() === selectedTableId.toLowerCase()
      ) || null
    );
  }, [tables, selectedTableId]);

  // Load Running Draft when table is occupied
  const fetchRunningDraft = async (table: TableWithDraft, silent = false) => {
    const draftRefId = table.active_draft_id || table.active_order_id;
    if (table.status !== 'occupied' || !draftRefId) {
      setRunningDraft(null);
      return;
    }

    try {
      if (!silent) setLoadingDraft(true);
      const res = await fetch('/api/counter/drafts');
      if (res.ok) {
        const drafts = (await res.json()) as any[];
        const match = drafts.find(
          (d) =>
            d.id === draftRefId ||
            (d.table_id && d.table_id === table.id) ||
            d.table_number === table.table_number
        );
        if (match) {
          setRunningDraft({
            id: match.id,
            draft_number: match.draft_number,
            items: (match.items || []).map((it: any) => ({
              ...it,
              name: it.name || it.item_name || 'Menu Item',
            })),
            customer_name: match.customer_name,
            customer_phone: match.customer_phone,
            created_at: match.created_at,
          });

          // Prefill customer info if present on draft
          if (match.customer_phone && !customerPhone) {
            setCustomerPhone(match.customer_phone);
          }
          if (match.customer_name && !customerName) {
            setCustomerName(match.customer_name);
          }
        } else {
          setRunningDraft(null);
        }
      }
    } catch (err) {
      console.warn('Error loading running draft:', err);
    } finally {
      if (!silent) setLoadingDraft(false);
    }
  };

  useEffect(() => {
    if (currentTable) {
      fetchRunningDraft(currentTable, false);
    } else {
      setRunningDraft(null);
    }
  }, [currentTable?.id, currentTable?.status, currentTable?.active_draft_id, currentTable?.active_draft_items_count]);

  // Debounced Customer Phone Search
  useEffect(() => {
    const cleanPhone = customerPhone.trim();
    if (cleanPhone.length >= 10) {
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/customers?search=${encodeURIComponent(cleanPhone)}`);
          if (res.ok) {
            const data = (await res.json()) as any[];
            if (data && data.length > 0) {
              const exact = data.find((c) => c.phone === cleanPhone) || data[0];
              setMatchedCustomer(exact);
              if (!customerName || customerName === 'Walk-in Customer') {
                setCustomerName(exact.name);
              }
            } else {
              setMatchedCustomer(null);
            }
          }
        } catch {
          setMatchedCustomer(null);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setMatchedCustomer(null);
    }
  }, [customerPhone]);

  // Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return ['All', ...Array.from(set).sort()];
  }, [menuItems]);

  // Filtered Menu Items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesCat = item.category.toLowerCase().includes(q);
        if (!matchesName && !matchesCat) return false;
      }
      return true;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  // Cart operations
  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.menu_item_id === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.menu_item_id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [
        ...prev,
        {
          menu_item_id: item.id,
          name: item.name,
          unit_price: item.price,
          quantity: 1,
          notes: '',
        },
      ];
    });
  };

  const updateCartQty = (idx: number, delta: number) => {
    setCart((prev) => {
      const next = [...prev];
      const nextQty = next[idx].quantity + delta;
      if (nextQty <= 0) {
        next.splice(idx, 1);
      } else {
        next[idx] = { ...next[idx], quantity: nextQty };
      }
      return next;
    });
  };

  const updateItemNotes = (idx: number, notes: string) => {
    setCart((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], notes };
      return next;
    });
  };

  const removeCartItem = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  }, [cart]);

  // Submit Order & Send KOT
  const handlePlaceOrder = async () => {
    if (!currentTable) {
      setError('Please select a valid table first');
      return;
    }

    if (cart.length === 0) {
      setError('Please add at least one item to send to kitchen');
      return;
    }

    if (!isOnline) {
      setError('Offline mode: placing orders is temporarily locked');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/orders/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: currentTable.id,
          customer_name: customerName.trim() || undefined,
          customer_phone: customerPhone.trim() || undefined,
          customer_id: matchedCustomer?.id,
          items: cart,
          order_notes: orderNotes.trim() || undefined,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        throw new Error(data.error || 'Failed to place order');
      }

      setSuccess(`Order sent to kitchen! ${data.kot_number} generated.`);
      setCart([]);
      setOrderNotes('');

      // Show Dual KOT confirmation slip
      setLastPlacedKot({
        id: data.kot_id,
        kot_number: data.kot_number,
        draft_id: data.draft_id,
        table_id: data.table_id,
        table_number: data.table_number,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        waiter_name: data.waiter_name,
        ticket_type: data.ticket_type,
        items_json: JSON.stringify(data.items),
        items: data.items,
        status: 'pending',
        created_at: data.created_at,
      });

      // Refresh table state
      suppressSettledNoticeRef.current = true;
      setSettledNotice(null);
      await fetchData(true);
    } catch (err: any) {
      setError(err.message || 'Error placing order');
    } finally {
      setSubmitting(false);
    }
  };

  // Shift / Merge Table Submit
  const handleShiftTable = async () => {
    if (!currentTable || !shiftTargetTableId) return;

    setShifting(true);
    setError(null);

    try {
      const res = await fetch('/api/tables/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_table_id: currentTable.id,
          target_table_id: shiftTargetTableId,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || 'Failed to shift table');

      setSuccess(data.message || 'Table shifted successfully');
      setShowShiftModal(false);
      suppressSettledNoticeRef.current = true;
      setSelectedTableId(shiftTargetTableId);
      await fetchData(true);
    } catch (err: any) {
      setError(err.message || 'Error shifting table');
    } finally {
      setShifting(false);
    }
  };

  // Submit Item Cancellation
  const handleCancelItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!runningDraft || !cancellingItem || !cancelReason.trim()) return;

    setSubmittingCancel(true);
    setError(null);

    try {
      const res = await fetch('/api/orders/cancel-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft_id: runningDraft.id,
          item_index: cancellingItem.index,
          cancel_qty: cancelQty,
          reason: cancelReason.trim(),
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || 'Failed to cancel item');

      setSuccess(`Cancelled ${cancelQty}x ${cancellingItem.item.name}. Cancellation KOT issued.`);
      setCancellingItem(null);
      suppressSettledNoticeRef.current = true;
      await fetchData(true);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel item');
    } finally {
      setSubmittingCancel(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-[#71717A] flex flex-col items-center justify-center">
        <UtensilsCrossed className="w-8 h-8 animate-pulse text-[#111111] mb-2" />
        <p className="font-serif font-bold text-sm text-[#111111]">Loading Menu & Table Floor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-24">
      {/* Alerts */}
      {error && (
        <div className="p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-[#991B1B] text-xs sm:text-sm flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-3.5 bg-[#ECFDF5] border border-[#BBF7D0] rounded-xl text-[#166534] text-xs sm:text-sm flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {settledNotice && (
        <div className="p-3.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-[#92400E] text-xs sm:text-sm flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-[#D97706]" />
            <span className="font-semibold">{settledNotice}</span>
          </div>
          <button onClick={() => setSettledNotice(null)} className="p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header Card: Table Selector & Customer Info */}
      <div className="bg-white border border-[#E6E2DA] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* Table Selector & Status */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#E6E2DA] pb-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-10 h-10 bg-[#F3EFEA] border border-[#E6E2DA] rounded-xl flex items-center justify-center flex-shrink-0">
              <UtensilsCrossed className="w-5 h-5 text-[#111111]" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-[#71717A] block">
                Dining Table
              </label>
              <select
                value={selectedTableId}
                onChange={(e) => {
                  setSelectedTableId(e.target.value);
                  setSettledNotice(null);
                  setCustomerPhone('');
                  setCustomerName('');
                  setMatchedCustomer(null);
                  navigate(`/order/${encodeURIComponent(e.target.value)}`);
                }}
                className="font-serif font-bold text-base sm:text-lg text-[#111111] bg-transparent border-0 p-0 focus:ring-0 cursor-pointer"
              >
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.table_number} — {t.table_name} ({t.section}) [{t.status.toUpperCase()}]
                  </option>
                ))}
              </select>
            </div>
          </div>

          {currentTable && (
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  currentTable.status === 'occupied'
                    ? 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]'
                    : 'bg-[#ECFDF5] text-[#166534] border border-[#BBF7D0]'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    currentTable.status === 'occupied' ? 'bg-[#D97706]' : 'bg-[#16A34A]'
                  }`}
                />
                {currentTable.status === 'occupied' ? 'Occupied' : 'Vacant'}
              </span>

              {currentTable.status === 'occupied' && (
                <button
                  onClick={() => setShowShiftModal(true)}
                  className="px-2.5 py-1 bg-white hover:bg-[#F3EFEA] text-[#111111] border border-[#E6E2DA] rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Shift / Merge</span>
                </button>
              )}

              {perms?.can_settle_bills && currentTable.status === 'occupied' && (
                <button
                  onClick={() => navigate(`/pos/${currentTable.id}`)}
                  className="px-2.5 py-1 bg-[#111111] hover:bg-[#27272A] text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                >
                  <span>Settle Bill</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Customer Details & Instant Loyalty Match */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-[#71717A] flex items-center gap-1 mb-1">
              <Phone className="w-3 h-3" />
              Customer Mobile Number
            </label>
            <input
              type="tel"
              placeholder="e.g. 9876543210 (Auto-matches points)"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
              className="w-full bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-2 text-xs sm:text-sm font-sans focus:outline-hidden focus:border-[#111111]"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-[#71717A] flex items-center gap-1 mb-1">
              <UserIcon className="w-3 h-3" />
              Customer Name
            </label>
            <input
              type="text"
              placeholder="e.g. John Doe / Walk-in"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-2 text-xs sm:text-sm font-serif focus:outline-hidden focus:border-[#111111]"
            />
          </div>
        </div>

        {/* Loyalty Match Highlight Pill */}
        {matchedCustomer && (
          <div className="p-3 bg-[#ECFDF5] border border-[#BBF7D0] rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#166534]" />
              <span className="font-semibold text-[#166534]">
                Loyalty Member: {matchedCustomer.name}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-[#166534] tabular-nums">
                {matchedCustomer.points_balance} Points Available
              </span>
              <span className="text-[11px] text-[#15803D]">
                {matchedCustomer.total_visits} Visits
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Running Draft Section (Items already sent to kitchen on this table) */}
      {currentTable?.status === 'occupied' && runningDraft && (
        <div className="bg-white border border-[#E6E2DA] rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-[#E6E2DA] pb-2">
            <div>
              <h3 className="font-bold text-sm font-serif text-[#111111] flex items-center gap-2">
                <span>Running Order ({runningDraft.draft_number})</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A] rounded uppercase font-bold">
                  Sent to Kitchen
                </span>
              </h3>
              <p className="text-[11px] text-[#71717A]">
                {loadingDraft
                  ? 'Updating table draft...'
                  : `Ordered ${new Date(runningDraft.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              </p>
            </div>
            <span className="text-sm font-bold font-serif text-[#111111] tabular-nums">
              Total: ₹{runningDraft.items.reduce((s, it) => s + it.quantity * it.unit_price, 0).toFixed(2)}
            </span>
          </div>

          {/* Running Items List */}
          <div className="space-y-2">
            {runningDraft.items.map((item, idx) => (
              <div
                key={idx}
                className="p-2.5 bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold font-mono text-[#111111] text-xs px-2 py-0.5 bg-white border border-[#E6E2DA] rounded">
                    {item.quantity}x
                  </span>
                  <div>
                    <span className="font-semibold text-[#111111]">{item.name}</span>
                    {item.notes && <p className="text-[10px] text-[#71717A] italic">Note: {item.notes}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-medium tabular-nums text-[#111111]">
                    ₹{(item.quantity * item.unit_price).toFixed(2)}
                  </span>
                  {(perms?.can_apply_discounts || currentUser.role === 'owner') && (
                    <button
                      onClick={() => {
                        setCancellingItem({ item, index: idx });
                        setCancelQty(item.quantity);
                      }}
                      className="px-2 py-1 text-[11px] text-[#991B1B] hover:bg-[#FEF2F2] border border-[#FECACA] rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Ban className="w-3 h-3" />
                      <span>Cancel</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Ordering Section: Category Chips & Menu Grid */}
      <div className="bg-white border border-[#E6E2DA] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* Search & Filter Header */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search food, coffee, beverages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm font-sans focus:outline-hidden focus:border-[#111111]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#111111]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                selectedCategory === cat
                  ? 'bg-[#111111] text-white shadow-xs'
                  : 'bg-[#F3EFEA] text-[#52525B] hover:text-[#111111]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Menu Items Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
          {filteredMenuItems.map((item) => {
            const inCart = cart.find((ci) => ci.menu_item_id === item.id);
            return (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer relative shadow-2xs ${
                  inCart
                    ? 'bg-[#FFFBEB] border-[#FDE68A] ring-1 ring-[#F59E0B]/30'
                    : 'bg-white hover:bg-[#FAF9F6] border-[#E6E2DA]'
                }`}
              >
                {inCart && (
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-[#111111] text-white rounded-md text-[10px] font-bold font-mono">
                    {inCart.quantity}
                  </span>
                )}
                <div>
                  <h4 className="font-serif font-bold text-xs sm:text-sm text-[#111111] line-clamp-2">
                    {item.name}
                  </h4>
                  <p className="text-[10px] text-[#71717A] uppercase tracking-wider mt-0.5">
                    {item.category}
                  </p>
                </div>
                <div className="mt-2.5 flex items-center justify-between pt-1 border-t border-[#E6E2DA]">
                  <span className="font-serif font-bold text-xs sm:text-sm text-[#111111] tabular-nums">
                    ₹{item.price}
                  </span>
                  <span className="w-6 h-6 rounded-lg bg-[#F3EFEA] text-[#111111] flex items-center justify-center text-xs">
                    <Plus className="w-3.5 h-3.5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cart Summary & Action Drawer */}
      {cart.length > 0 && (
        <div className="bg-white border-2 border-[#111111] rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-[#E6E2DA] pb-2">
            <h3 className="font-bold text-sm font-serif text-[#111111] flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              <span>
                {currentTable?.status === 'occupied' ? 'New Add-On Items' : 'New Order Items'} ({cart.length})
              </span>
            </h3>
            <button
              onClick={() => setCart([])}
              className="text-xs text-[#991B1B] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>

          {/* Cart Item Cards with Note Input */}
          <div className="space-y-3">
            {cart.map((item, idx) => (
              <div key={idx} className="p-3 bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-xs sm:text-sm text-[#111111] font-serif">{item.name}</h5>
                    <p className="text-[11px] text-[#71717A] tabular-nums">
                      ₹{item.unit_price} × {item.quantity} = ₹{(item.quantity * item.unit_price).toFixed(2)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-1 bg-white border border-[#E6E2DA] rounded-xl p-0.5">
                      <button
                        onClick={() => updateCartQty(idx, -1)}
                        className="w-7 h-7 flex items-center justify-center text-[#52525B] hover:text-[#111111] rounded-lg cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center font-bold text-xs tabular-nums">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQty(idx, 1)}
                        className="w-7 h-7 flex items-center justify-center text-[#52525B] hover:text-[#111111] rounded-lg cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCartItem(idx)}
                      title="Remove item"
                      className="w-7 h-7 flex items-center justify-center text-[#71717A] hover:text-[#991B1B] rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Kitchen Notes */}
                <div className="space-y-1">
                  <input
                    type="text"
                    placeholder="Add special kitchen note for chef..."
                    value={item.notes || ''}
                    onChange={(e) => updateItemNotes(idx, e.target.value)}
                    className="w-full bg-white border border-[#E6E2DA] rounded-lg px-2.5 py-1 text-xs focus:outline-hidden focus:border-[#111111]"
                  />
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                    {noteSuggestions.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => updateItemNotes(idx, sug)}
                        className="text-[10px] bg-white hover:bg-[#F3EFEA] text-[#52525B] px-1.5 py-0.5 border border-[#E6E2DA] rounded whitespace-nowrap cursor-pointer"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Overall Order Notes */}
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-[#71717A] block mb-1">
              Table / Service Note
            </label>
            <input
              type="text"
              placeholder="e.g. Bring extra glasses, baby chair required..."
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              className="w-full bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-[#111111]"
            />
          </div>

          {/* Primary Action Button */}
          <div className="flex items-center justify-between pt-2 border-t border-[#E6E2DA]">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#71717A]">New Cart Total</p>
              <p className="font-serif font-bold text-lg text-[#111111] tabular-nums">
                ₹{cartTotal.toFixed(2)}
              </p>
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={submitting}
              className="px-6 py-3 bg-[#111111] hover:bg-[#27272A] text-white font-semibold text-sm rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-sm disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>
                {currentTable?.status === 'occupied'
                  ? 'Send Add-On KOT to Kitchen'
                  : 'Place Order & Send KOT'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Shift / Merge Table Modal */}
      {showShiftModal && currentTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E6E2DA] rounded-2xl w-full max-w-md p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6E2DA] pb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-[#111111]" />
                <h3 className="font-bold text-base font-serif text-[#111111]">
                  Shift / Merge {currentTable.table_name}
                </h3>
              </div>
              <button onClick={() => setShowShiftModal(false)} className="p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#52525B]">
              Select target table. If target is vacant, order moves over. If target is occupied, both running orders merge into one!
            </p>

            <div>
              <label className="text-xs font-semibold text-[#111111] block mb-1">
                Select Destination Table
              </label>
              <select
                value={shiftTargetTableId}
                onChange={(e) => setShiftTargetTableId(e.target.value)}
                className="w-full bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-2 text-sm font-serif"
              >
                <option value="">-- Choose destination table --</option>
                {tables
                  .filter((t) => t.id !== currentTable.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.table_number} — {t.table_name} ({t.section}) [{t.status.toUpperCase()}]
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowShiftModal(false)}
                className="px-4 py-2 border border-[#E6E2DA] rounded-xl text-xs font-semibold text-[#52525B] hover:bg-[#F3EFEA] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleShiftTable}
                disabled={shifting || !shiftTargetTableId}
                className="px-4 py-2 bg-[#111111] text-white rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {shifting ? 'Shifting...' : 'Confirm Shift / Merge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Item Modal */}
      {cancellingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCancelItemSubmit}
            className="bg-white border border-[#E6E2DA] rounded-2xl w-full max-w-md p-5 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#E6E2DA] pb-3">
              <div className="flex items-center gap-2 text-[#991B1B]">
                <Ban className="w-5 h-5" />
                <h3 className="font-bold text-base font-serif">Cancel Kitchen Item</h3>
              </div>
              <button onClick={() => setCancellingItem(null)} className="p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl text-xs">
              <p className="font-bold text-[#111111]">{cancellingItem.item.name}</p>
              <p className="text-[#71717A]">
                Quantity ordered: {cancellingItem.item.quantity}x • Rate: ₹{cancellingItem.item.unit_price}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#111111] block mb-1">
                Quantity to Cancel
              </label>
              <input
                type="number"
                min="1"
                max={cancellingItem.item.quantity}
                value={cancelQty}
                onChange={(e) => setCancelQty(Math.max(1, Math.min(cancellingItem.item.quantity, Number(e.target.value))))}
                className="w-full bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-2 text-sm font-sans"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#111111] block mb-1">
                Mandatory Reason for Kitchen
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-2 text-xs font-sans mb-1.5"
              >
                {cancelReasons.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Or specify custom reason..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-2 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancellingItem(null)}
                className="px-4 py-2 border border-[#E6E2DA] rounded-xl text-xs font-semibold text-[#52525B] hover:bg-[#F3EFEA] cursor-pointer"
              >
                Keep Item
              </button>
              <button
                type="submit"
                disabled={submittingCancel || !cancelReason.trim()}
                className="px-4 py-2 bg-[#991B1B] text-white rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {submittingCancel ? 'Issuing...' : 'Issue Cancellation KOT'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Dual KOT Confirmation Slip Modal */}
      {lastPlacedKot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E6E2DA] rounded-2xl w-full max-w-sm p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6E2DA] pb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#166534]" />
                <h3 className="font-bold text-base font-serif text-[#111111]">KOT Sent to Kitchen</h3>
              </div>
              <button onClick={() => setLastPlacedKot(null)} className="p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Slip Preview */}
            <div className="p-4 bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl text-xs font-mono space-y-2">
              <div className="text-center font-bold font-serif text-sm border-b border-dashed border-[#E6E2DA] pb-1">
                KIMMO’S KITCHEN
                <div className="text-[10px] text-[#71717A] uppercase font-mono">
                  {lastPlacedKot.ticket_type === 'add_on' ? 'ADD-ON KOT' : 'NEW ORDER KOT'}
                </div>
              </div>

              <div className="flex justify-between text-[11px]">
                <span>TABLE: {lastPlacedKot.table_number}</span>
                <span>{lastPlacedKot.kot_number}</span>
              </div>
              <div className="flex justify-between text-[10px] text-[#71717A]">
                <span>WAITER: {lastPlacedKot.waiter_name}</span>
                <span>{new Date(lastPlacedKot.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              <div className="border-t border-dashed border-[#E6E2DA] pt-1 space-y-1">
                {lastPlacedKot.items?.map((it, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{it.quantity}x {it.name}</span>
                    <span>₹{it.quantity * it.unit_price}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-[#E6E2DA] pt-1 text-right font-bold">
                Total: ₹{lastPlacedKot.items?.reduce((s, it) => s + it.quantity * it.unit_price, 0).toFixed(2)}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => window.print()}
                className="px-3.5 py-2 bg-white hover:bg-[#F3EFEA] border border-[#E6E2DA] text-[#111111] text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Slip
              </button>
              <button
                onClick={() => setLastPlacedKot(null)}
                className="px-4 py-2 bg-[#111111] text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close & Next Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
