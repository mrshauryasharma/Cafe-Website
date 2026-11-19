import React, { useEffect, useState } from 'react';
import {
  Search,
  Radio,
  Coins,
  CreditCard,
  User,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Receipt,
  X,
  UserPlus,
  MessageSquare,
  Gift,
  Smartphone,
  RefreshCw,
} from 'lucide-react';
import { User as AuthUser } from '../../types';
import { MenuItem } from '../../../functions/api/owner/menu';
import { CafeSettingsRow } from '../../../functions/api/owner/settings';
import { CardScanResult } from '../../../functions/api/counter/scan/[card_uid]';
import { CheckoutReceipt } from '../../../functions/api/counter/checkout';
import { AddCustomerModal } from '../customers/AddCustomerModal';
import { CustomerProfileView } from '../customers/CustomerProfileView';
import { detectNfcCapabilities, normalizeCardInput } from '../../utils/nfcPlatform';

interface CounterTerminalProps {
  currentUser: AuthUser;
  initialCardUid?: string;
  isOnline?: boolean;
}

interface CartItem {
  menu_item_id?: string;
  item_name: string;
  quantity: number;
  unit_price: number;
}

export const CounterTerminal: React.FC<CounterTerminalProps> = ({
  currentUser,
  initialCardUid,
  isOnline = true,
}) => {
  // Settings & Menu Items cache
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [settings, setSettings] = useState<CafeSettingsRow | null>(null);
  const [loadingInit, setLoadingInit] = useState(true);

  // Scan & Customer State
  const [scannedCardUid, setScannedCardUid] = useState(initialCardUid || '');
  const [scanResult, setScanResult] = useState<CardScanResult | null>(null);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Cross-platform NFC
  const nfcCaps = detectNfcCapabilities();
  const [nfcListening, setNfcListening] = useState(false);

  // Cart & Billing State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [redeemPointsToggle, setRedeemPointsToggle] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  // Custom Item Modal
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');

  // Modals & Sub-views
  const [receipt, setReceipt] = useState<CheckoutReceipt | null>(null);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [selectedProfileCustomerId, setSelectedProfileCustomerId] = useState<string | null>(null);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [bonusPoints, setBonusPoints] = useState('');
  const [bonusReason, setBonusReason] = useState('');
  const [submittingBonus, setSubmittingBonus] = useState(false);

  // Link / Replace Card Modal for Unassigned Card Tag
  const [showLinkExistingModal, setShowLinkExistingModal] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [linkSearchResults, setLinkSearchResults] = useState<any[]>([]);
  const [selectedCustomerForLink, setSelectedCustomerForLink] = useState<any | null>(null);
  const [linkReason, setLinkReason] = useState('Card replacement / re-linked at counter');
  const [submittingLink, setSubmittingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Feedback
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 1. Initial Load of Menu & Settings
  useEffect(() => {
    const initCounter = async () => {
      try {
        setLoadingInit(true);
        const res = await fetch('/api/counter/init');
        if (!res.ok) throw new Error('Failed to load menu & settings');
        const data = (await res.json()) as { menu_items: MenuItem[]; settings: CafeSettingsRow };
        setMenuItems(data.menu_items || []);
        setSettings(data.settings || null);
      } catch (err: any) {
        setError(err.message || 'Counter init failed');
      } finally {
        setLoadingInit(false);
      }
    };

    initCounter();
  }, []);

  // 2. Auto-scan if initialCardUid is provided
  useEffect(() => {
    if (initialCardUid) {
      handleLookupCard(initialCardUid);
    }
  }, [initialCardUid]);

  // Lookup Card UID
  const handleLookupCard = async (uid: string) => {
    const clean = normalizeCardInput(uid);
    if (!clean) return;

    setError(null);
    setSearchingCustomer(true);

    try {
      const res = await fetch(`/api/counter/scan/${encodeURIComponent(clean)}`);
      if (!res.ok) throw new Error('Failed to query card');
      const data = (await res.json()) as CardScanResult;
      setScannedCardUid(clean);
      setScanResult(data);

      if (data.menu_items && data.menu_items.length > 0) {
        setMenuItems(data.menu_items);
      }
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (err: any) {
      setError(err.message || 'Card lookup error');
    } finally {
      setSearchingCustomer(false);
    }
  };

  // Web NFC Reader
  const startNfcReader = async () => {
    if (!('NDEFReader' in window)) {
      alert(
        nfcCaps.isIos
          ? 'On iPhone: Hold your membership card to the top edge of your iPhone to scan.'
          : 'Web NFC is available on supported Android devices with Chrome.'
      );
      return;
    }

    try {
      // @ts-ignore
      const ndef = new NDEFReader();
      await ndef.scan();
      setNfcListening(true);

      // @ts-ignore
      ndef.addEventListener('reading', ({ serialNumber }: any) => {
        if (serialNumber) {
          const uid = normalizeCardInput(serialNumber.replace(/:/g, ''));
          handleLookupCard(uid);
          setNfcListening(false);
        }
      });
    } catch (err: any) {
      console.error('NFC error:', err);
      alert(`NFC error: ${err.message || 'Permission denied or NFC disabled'}`);
      setNfcListening(false);
    }
  };

  // Quick Customer Search by name, phone, or card UID / shorthand
  const handleSearchCustomer = async (q: string) => {
    setCustomerSearchQuery(q);
    const trimmed = q.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }

    try {
      const normalizedCard = normalizeCardInput(trimmed);
      const effectiveSearch =
        normalizedCard && normalizedCard.startsWith('GROVE-') ? normalizedCard : trimmed;

      const res = await fetch(`/api/customers?search=${encodeURIComponent(effectiveSearch)}`);
      if (res.ok) {
        const data = (await res.json()) as any[];
        setSearchResults(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Search existing customer for linking unassigned card
  const handleSearchForLink = async (q: string) => {
    setLinkSearchQuery(q);
    const trimmed = q.trim();
    if (!trimmed) {
      setLinkSearchResults([]);
      return;
    }

    try {
      const normalizedCard = normalizeCardInput(trimmed);
      const effectiveSearch =
        normalizedCard && normalizedCard.startsWith('GROVE-') ? normalizedCard : trimmed;
      const res = await fetch(`/api/customers?search=${encodeURIComponent(effectiveSearch)}`);
      if (res.ok) {
        const data = (await res.json()) as any[];
        setLinkSearchResults(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Confirm linking unassigned card to existing customer
  const handleConfirmLinkCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerForLink || !scanResult?.card_uid) return;

    setSubmittingLink(true);
    setLinkError(null);

    try {
      const res = await fetch(`/api/customers/${selectedCustomerForLink.id}/replace-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_card_uid: scanResult.card_uid,
          reason: linkReason.trim() || 'Card replacement via counter terminal',
        }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to link card');

      setSuccess(`Card ${scanResult.card_uid} linked to ${selectedCustomerForLink.name}!`);
      setShowLinkExistingModal(false);
      setSelectedCustomerForLink(null);
      setLinkSearchQuery('');
      setLinkSearchResults([]);

      await handleLookupCard(scanResult.card_uid);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setLinkError(err.message || 'Card linking failed');
    } finally {
      setSubmittingLink(false);
    }
  };

  const selectCustomerFromSearch = async (cust: any) => {
    setSearchResults([]);
    setCustomerSearchQuery('');
    if (cust.card_uid) {
      handleLookupCard(cust.card_uid);
    } else {
      try {
        setSearchingCustomer(true);
        const res = await fetch(`/api/customers/${cust.id}`);
        if (!res.ok) throw new Error('Failed to load profile');
        const data = (await res.json()) as { customer: any; metrics: any };
        setScanResult({
          cardStatus: 'active',
          card_uid: 'UNLINKED',
          customer: data.customer,
          crm: data.metrics,
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setSearchingCustomer(false);
      }
    }
  };

  // Cart operations
  const addToCart = (item: { id?: string; name: string; price: number }) => {
    setCart((prev) => {
      const existing = prev.find(
        (i) => (item.id && i.menu_item_id === item.id) || i.item_name === item.name
      );
      if (existing) {
        return prev.map((i) =>
          ((item.id && i.menu_item_id === item.id) || i.item_name === item.name)
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [
        ...prev,
        {
          menu_item_id: item.id,
          item_name: item.name,
          quantity: 1,
          unit_price: item.price,
        },
      ];
    });
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const target = prev[index];
      if (!target) return prev;
      const newQ = target.quantity + delta;
      if (newQ <= 0) {
        return prev.filter((_, idx) => idx !== index);
      }
      return prev.map((i, idx) => (idx === index ? { ...i, quantity: newQ } : i));
    });
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customPrice) return;
    addToCart({ name: customName.trim(), price: Number(customPrice) });
    setCustomName('');
    setCustomPrice('');
    setShowCustomItemModal(false);
  };

  // Billing Calculations
  const subtotal = cart.reduce((acc, it) => acc + it.quantity * it.unit_price, 0);
  const pointRedeemValue = settings?.point_redeem_value ?? 1.0;
  const earnSpendUnit = settings?.earn_spend_unit ?? 100;
  const earnPointsPerUnit = settings?.earn_points_per_unit ?? 10;
  const minBillForRedeem = settings?.min_bill_for_redeem ?? 0;
  const maxRedeemPercent = settings?.max_redeem_percent ?? 100;

  const currentCustomer = scanResult?.cardStatus === 'active' ? scanResult.customer : null;
  const customerBalance = currentCustomer?.points_balance ?? 0;

  const canRedeem =
    redeemPointsToggle &&
    customerBalance > 0 &&
    subtotal >= minBillForRedeem;

  const maxDiscountRupees = subtotal * (maxRedeemPercent / 100);
  const maxPointsPossible = Math.floor(maxDiscountRupees / pointRedeemValue);
  const pointsToRedeem = canRedeem ? Math.min(customerBalance, maxPointsPossible) : 0;
  const discountAmount = Math.round(pointsToRedeem * pointRedeemValue * 100) / 100;

  const finalAmount = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
  const pointsToEarn =
    earnSpendUnit > 0
      ? Math.floor((finalAmount / earnSpendUnit) * earnPointsPerUnit)
      : 0;

  // Checkout Handler
  const handleCheckout = async () => {
    if (!currentCustomer) {
      alert('Please select or scan a customer before completing the bill.');
      return;
    }
    if (cart.length === 0 || subtotal <= 0) {
      alert('Cart is empty.');
      return;
    }

    setCheckingOut(true);
    setError(null);

    const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await fetch('/api/counter/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: currentCustomer.id,
          items: cart,
          redeem_points: redeemPointsToggle,
          custom_redeem_points: pointsToRedeem,
          idempotency_key: idempotencyKey,
        }),
      });

      const data = (await res.json()) as { success?: boolean; receipt?: CheckoutReceipt; error?: string };
      if (!res.ok) throw new Error(data.error || 'Checkout failed');

      if (data.receipt) {
        setReceipt(data.receipt);
        setScanResult((prev) =>
          prev && prev.customer
            ? {
                ...prev,
                customer: {
                  ...prev.customer,
                  points_balance: data.receipt!.new_balance,
                  total_visits: prev.customer.total_visits + 1,
                  total_spent: prev.customer.total_spent + data.receipt!.final_amount,
                },
              }
            : prev
        );
      }
    } catch (err: any) {
      setError(err.message || 'Error completing bill');
    } finally {
      setCheckingOut(false);
    }
  };

  const handleNextCustomer = () => {
    setReceipt(null);
    setCart([]);
    setRedeemPointsToggle(false);
    setScanResult(null);
    setScannedCardUid('');
  };

  // Bonus points grant from CRM strip
  const handleQuickBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCustomer || !bonusPoints || !bonusReason.trim()) return;
    setSubmittingBonus(true);
    try {
      const res = await fetch(`/api/customers/${currentCustomer.id}/bonus-points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          points: Number(bonusPoints),
          reason: bonusReason.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string; points_balance: number };
      if (!res.ok) throw new Error(data.error || 'Failed to grant points');

      setScanResult((prev) =>
        prev && prev.customer
          ? {
              ...prev,
              customer: { ...prev.customer, points_balance: data.points_balance },
            }
          : prev
      );
      setShowBonusModal(false);
      setBonusPoints('');
      setBonusReason('');
      setSuccess('Bonus points added successfully!');
      setTimeout(() => setSuccess(null), 2500);
    } catch (err: any) {
      alert(err.message || 'Error granting bonus');
    } finally {
      setSubmittingBonus(false);
    }
  };

  if (selectedProfileCustomerId) {
    return (
      <CustomerProfileView
        customerId={selectedProfileCustomerId}
        currentUser={currentUser}
        onBack={() => {
          setSelectedProfileCustomerId(null);
          if (scannedCardUid) handleLookupCard(scannedCardUid);
        }}
      />
    );
  }

  const categories = Array.from(new Set(['All', ...menuItems.map((i) => i.category)]));
  const filteredMenuItems = menuItems.filter((i) => {
    const matchesCat = selectedCategory === 'All' || i.category === selectedCategory;
    const matchesSearch =
      i.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
      i.category.toLowerCase().includes(menuSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-4">
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

      {/* 1. TOP SCAN & LOOKUP BAR */}
      <div className="bg-white border border-[#E6E2DA] rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            {/* NFC Tap Button / Platform Badge */}
            {nfcCaps.hasWebNfc ? (
              <button
                type="button"
                onClick={startNfcReader}
                title="Tap physical NFC tag to phone"
                className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap cursor-pointer shadow-xs ${
                  nfcListening
                    ? 'bg-[#111111] text-white animate-pulse'
                    : 'bg-[#111111] hover:bg-[#262626] text-white'
                }`}
              >
                <Radio className={`w-4 h-4 ${nfcListening ? 'animate-spin' : ''}`} />
                <span>{nfcListening ? 'Listening for Tag...' : 'Tap NFC Card'}</span>
              </button>
            ) : nfcCaps.isIos ? (
              <div
                title="iPhone native background NFC reading is active"
                className="min-h-[44px] px-3.5 py-2 bg-[#F3EFEA] border border-[#E6E2DA] rounded-xl flex items-center gap-2 text-xs text-[#111111] flex-shrink-0"
              >
                <Smartphone className="w-4 h-4 text-[#111111] flex-shrink-0" />
                <span className="hidden sm:inline font-serif">
                  <strong>iPhone NFC Ready:</strong> Tap card to top edge.
                </span>
                <span className="sm:hidden font-serif font-bold text-[11px]">
                  iPhone NFC Active
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={startNfcReader}
                title="Web NFC or Card ID Entry"
                className="min-h-[44px] px-3.5 py-2 bg-[#F3EFEA] hover:bg-[#E6E2DA] border border-[#E6E2DA] rounded-xl flex items-center gap-2 text-xs font-bold text-[#111111] transition-colors cursor-pointer flex-shrink-0"
              >
                <CreditCard className="w-4 h-4" />
                <span>Tap NFC Card</span>
              </button>
            )}

            {/* Quick Customer Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[#71717A]" />
              <input
                type="text"
                placeholder="Search Customer Name, Phone, or Card UID (e.g. 001)..."
                value={customerSearchQuery}
                onChange={(e) => handleSearchCustomer(e.target.value)}
                className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl pl-9 pr-3 py-2 text-sm text-[#111111] placeholder-[#71717A] focus:outline-none focus:border-[#111111] focus:bg-white transition-colors"
              />

              {/* Autocomplete Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-12 bg-white border border-[#E6E2DA] rounded-xl shadow-lg z-40 max-h-56 overflow-y-auto divide-y divide-[#E6E2DA]">
                  {searchResults.map((cust) => (
                    <div
                      key={cust.id}
                      onClick={() => selectCustomerFromSearch(cust)}
                      className="p-3 hover:bg-[#F3EFEA] cursor-pointer flex items-center justify-between text-xs transition-colors"
                    >
                      <div>
                        <p className="font-bold text-[#111111] text-sm">{cust.name}</p>
                        <p className="text-[12px] text-[#52525B] font-mono tabular-nums">{cust.phone}</p>
                        {cust.card_uid && (
                          <p className="text-[11px] text-[#71717A] font-mono mt-0.5">Card: {cust.card_uid}</p>
                        )}
                      </div>
                      <span className="font-mono text-[#166534] font-bold tabular-nums bg-[#ECFDF5] border border-[#BBF7D0] px-2 py-0.5 rounded-md">
                        {cust.points_balance} pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Direct UID Lookup */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLookupCard(scannedCardUid);
            }}
            className="flex items-center gap-1.5"
          >
            <input
              type="text"
              placeholder="Card UID (e.g. 001)"
              value={scannedCardUid}
              onChange={(e) => setScannedCardUid(e.target.value)}
              onBlur={() => {
                if (scannedCardUid.trim()) {
                  setScannedCardUid(normalizeCardInput(scannedCardUid));
                }
              }}
              className="w-36 min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-2 text-xs text-[#111111] font-mono uppercase focus:outline-none focus:border-[#111111] focus:bg-white tabular-nums"
            />
            <button
              type="submit"
              disabled={searchingCustomer}
              className="min-h-[44px] px-4 py-2 bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] rounded-xl text-xs font-bold border border-[#E6E2DA] transition-colors cursor-pointer"
            >
              {searchingCustomer ? '...' : 'Scan'}
            </button>
          </form>
        </div>

        {/* iPhone NFC Helper banner */}
        {nfcCaps.isIos && (
          <div className="mt-2.5 pt-2 border-t border-[#E6E2DA] flex items-center gap-2 text-[11px] text-[#52525B]">
            <Smartphone className="w-3.5 h-3.5 text-[#111111] flex-shrink-0" />
            <span>
              <strong>iPhone NFC Ready:</strong> Hold card near the top edge of your iPhone &amp; tap the Safari banner to scan.
            </span>
          </div>
        )}
      </div>

      {/* 2. CARD STATE BANNERS */}
      {scanResult?.cardStatus === 'blocked' && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[#991B1B]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FEE2E2] rounded-xl flex items-center justify-center text-[#991B1B] flex-shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-sm text-[#991B1B]">
                SECURITY ALERT: Card <span className="tabular-nums font-mono">{scanResult.card_uid}</span> is BLOCKED
              </p>
              <p className="text-xs text-[#991B1B]/80 mt-0.5">
                Reason: {scanResult.blocked_reason || 'Lost or damaged card reported'}.
                {scanResult.customer && ` Registered to: ${scanResult.customer.name}`}
              </p>
            </div>
          </div>
          {scanResult.customer && (
            <button
              onClick={() => setSelectedProfileCustomerId(scanResult.customer!.id)}
              className="min-h-[38px] px-3.5 py-1.5 bg-[#991B1B] hover:bg-[#7F1D1D] text-white rounded-xl text-xs font-bold transition-colors whitespace-nowrap self-end sm:self-auto cursor-pointer"
            >
              Issue Replacement Card
            </button>
          )}
        </div>
      )}

      {scanResult?.cardStatus === 'unassigned' && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-[#92400E]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FEF3C7] rounded-xl flex items-center justify-center text-[#92400E] flex-shrink-0">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-sm text-[#92400E]">
                Unassigned Card Tag: <span className="tabular-nums font-mono">{scanResult.card_uid}</span>
              </p>
              <p className="text-xs text-[#92400E]/80 mt-0.5">
                This physical NFC tag is blank and not yet linked to any customer account.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
            <button
              onClick={() => setShowAddCustomerModal(true)}
              className="min-h-[38px] px-3.5 py-2 bg-[#92400E] hover:bg-[#78350F] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Register New Customer</span>
            </button>
            <button
              onClick={() => {
                setShowLinkExistingModal(true);
                setSelectedCustomerForLink(null);
                setLinkSearchQuery('');
                setLinkSearchResults([]);
                setLinkError(null);
              }}
              className="min-h-[38px] px-3.5 py-2 bg-white hover:bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Link / Replace for Existing</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. LOADED CUSTOMER CRM STRIP */}
      {currentCustomer ? (
        <div className="bg-white border border-[#E6E2DA] rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E6E2DA]">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#F3EFEA] text-[#111111] border border-[#E6E2DA] flex items-center justify-center font-bold">
                <User className="w-5 h-5 text-[#111111]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[#111111] text-base font-serif">{currentCustomer.name}</h3>
                  <span className="text-xs font-mono text-[#52525B] tabular-nums">{currentCustomer.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#71717A] mt-0.5">
                  <span className="font-mono text-[#111111] bg-[#F3EFEA] border border-[#E6E2DA] px-1.5 py-0.5 rounded text-[11px] tabular-nums">
                    {scanResult?.card_uid || 'No Card'}
                  </span>
                  <span>&bull;</span>
                  <span className="tabular-nums">{currentCustomer.total_visits} visits</span>
                </div>
              </div>
            </div>

            {/* Points Balance Pill & CRM actions */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <div className="bg-[#FAF9F6] border border-[#E6E2DA] px-3.5 py-1.5 rounded-xl text-right">
                <p className="text-[10px] text-[#71717A] uppercase font-bold tracking-wider">Balance</p>
                <p className="text-sm font-mono font-bold text-[#166534] tabular-nums">
                  {currentCustomer.points_balance} pts{' '}
                  <span className="text-[11px] text-[#52525B]">
                    (₹{(currentCustomer.points_balance * pointRedeemValue).toFixed(1)})
                  </span>
                </p>
              </div>

              <button
                onClick={() => {
                  setShowBonusModal(true);
                  setBonusPoints('');
                  setBonusReason('');
                }}
                title="Give courtesy points"
                className="min-h-[38px] min-w-[38px] p-2 bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] rounded-xl border border-[#E6E2DA] transition-colors cursor-pointer flex items-center justify-center"
              >
                <Gift className="w-4 h-4" />
              </button>

              <button
                onClick={() => setSelectedProfileCustomerId(currentCustomer.id)}
                className="min-h-[38px] px-3.5 py-2 bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] rounded-xl text-xs font-bold border border-[#E6E2DA] transition-colors cursor-pointer"
              >
                Full Profile
              </button>
            </div>
          </div>

          {/* CRM Insights summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {/* Last Order Preview */}
            <div className="bg-[#FAF9F6] p-2.5 rounded-xl border border-[#E6E2DA] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#52525B] flex-shrink-0" />
                <span className="text-[#71717A] uppercase text-[11px] font-bold">Last Order:</span>
                <span className="font-semibold text-[#111111] truncate max-w-[180px]">
                  {scanResult?.crm?.last_order
                    ? scanResult.crm.last_order.items.map((i) => `${i.quantity}x ${i.item_name}`).join(', ')
                    : 'First-time customer'}
                </span>
              </div>
              {scanResult?.crm?.last_order && (
                <span className="font-mono text-[#111111] font-bold tabular-nums">
                  ₹{scanResult.crm.last_order.final_amount}
                </span>
              )}
            </div>

            {/* Top Favorites */}
            <div className="bg-[#FAF9F6] p-2.5 rounded-xl border border-[#E6E2DA] flex items-center gap-2 overflow-x-auto">
              <Sparkles className="w-3.5 h-3.5 text-[#166534] flex-shrink-0" />
              <span className="text-[#71717A] uppercase text-[11px] font-bold whitespace-nowrap">Favorites:</span>
              {scanResult?.crm?.most_ordered_items && scanResult.crm.most_ordered_items.length > 0 ? (
                scanResult.crm.most_ordered_items.map((fav) => (
                  <span
                    key={fav.item_name}
                    className="bg-white border border-[#E6E2DA] text-[11px] font-semibold text-[#111111] px-2 py-0.5 rounded-md whitespace-nowrap shadow-2xs"
                  >
                    {fav.item_name}
                  </span>
                ))
              ) : (
                <span className="text-[#71717A] italic">No favorites yet</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#E6E2DA] border-dashed rounded-2xl p-4 text-center text-xs text-[#52525B]">
          <p>
            No customer selected. Tap an NFC card, search a phone/name above, or{' '}
            <button
              onClick={() => setShowAddCustomerModal(true)}
              className="text-[#111111] font-bold underline cursor-pointer hover:text-[#52525B]"
            >
              register a walk-in customer
            </button>
            .
          </p>
        </div>
      )}

      {/* 4. 10-SECOND ITEMIZE MENU BILLING PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Menu Catalog (2 cols on large screen) */}
        <div className="lg:col-span-2 bg-white border border-[#E6E2DA] rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#71717A]" />
              <input
                type="text"
                placeholder="Search menu catalog..."
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                className="w-full min-h-[40px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#111111] placeholder-[#71717A] focus:outline-none focus:border-[#111111] focus:bg-white transition-colors"
              />
            </div>

            <button
              onClick={() => setShowCustomItemModal(true)}
              className="min-h-[40px] px-3.5 py-1.5 bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] rounded-xl text-xs font-bold border border-[#E6E2DA] flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Custom Item</span>
            </button>
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`min-h-[34px] px-3 py-1 rounded-lg font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#111111] text-white shadow-xs'
                    : 'bg-[#F3EFEA] text-[#52525B] hover:text-[#111111] border border-[#E6E2DA]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Menu Items Grid */}
          {loadingInit ? (
            <div className="p-8 text-center text-[#71717A] text-xs">Loading menu items...</div>
          ) : filteredMenuItems.length === 0 ? (
            <div className="p-8 text-center text-[#71717A] text-xs italic">
              No matching menu items found.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
              {filteredMenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addToCart({ id: item.id, name: item.name, price: item.price })}
                  className="min-h-[72px] bg-[#FAF9F6] hover:bg-white border border-[#E6E2DA] hover:border-[#111111] rounded-xl p-3 text-left transition-all flex flex-col justify-between group shadow-2xs cursor-pointer"
                >
                  <div>
                    <h4 className="font-semibold text-[#111111] text-xs line-clamp-2 leading-tight group-hover:text-[#111111]">
                      {item.name}
                    </h4>
                    <span className="text-[10px] text-[#71717A] uppercase tracking-wider">{item.category}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-[#E6E2DA]">
                    <span className="font-mono font-bold text-[#111111] text-xs tabular-nums">
                      ₹{item.price}
                    </span>
                    <span className="w-5 h-5 rounded-md bg-[#E6E2DA] text-[#111111] group-hover:bg-[#111111] group-hover:text-white flex items-center justify-center text-xs font-bold transition-colors">
                      +
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Live Cart & Checkout (1 col) */}
        <div className="bg-white border border-[#E6E2DA] rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#E6E2DA]">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#111111]" />
                <h3 className="font-bold text-[#111111] text-sm font-serif">Active Order Cart</h3>
              </div>
              <span className="text-xs bg-[#F3EFEA] border border-[#E6E2DA] text-[#111111] px-2 py-0.5 rounded-full font-mono font-bold tabular-nums">
                {cart.reduce((a, b) => a + b.quantity, 0)} items
              </span>
            </div>

            {/* Cart Line Items */}
            <div className="divide-y divide-[#E6E2DA] max-h-56 overflow-y-auto my-2">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-[#71717A] text-xs italic">
                  Tap menu items to add to order
                </div>
              ) : (
                cart.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex-1 pr-2">
                      <p className="font-semibold text-[#111111] truncate">{item.item_name}</p>
                      <p className="font-mono text-[#52525B] text-[11px] tabular-nums">
                        ₹{item.unit_price} x {item.quantity} = ₹{item.unit_price * item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQuantity(idx, -1)}
                        className="w-7 h-7 rounded-lg bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] flex items-center justify-center font-bold border border-[#E6E2DA] cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono font-bold text-[#111111] w-4 text-center tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(idx, 1)}
                        className="w-7 h-7 rounded-lg bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] flex items-center justify-center font-bold border border-[#E6E2DA] cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pricing & Checkout Summary Box */}
          <div className="bg-[#FAF9F6] p-3.5 rounded-xl border border-[#E6E2DA] space-y-2.5">
            <div className="flex justify-between text-xs text-[#52525B]">
              <span>Subtotal:</span>
              <span className="font-mono text-[#111111] font-bold tabular-nums">₹{subtotal}</span>
            </div>

            {/* Points Redemption Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-[#E6E2DA]">
              <div>
                <p className="text-xs font-semibold text-[#111111] flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-[#166534]" />
                  <span>Redeem Points</span>
                </p>
                <p className="text-[10px] text-[#71717A] tabular-nums">
                  {customerBalance > 0
                    ? `Avail: ${customerBalance} pts (max ₹${maxDiscountRupees.toFixed(0)})`
                    : 'No points available'}
                </p>
              </div>

              <input
                type="checkbox"
                disabled={!currentCustomer || customerBalance <= 0 || subtotal < minBillForRedeem}
                checked={redeemPointsToggle}
                onChange={(e) => setRedeemPointsToggle(e.target.checked)}
                className="w-4 h-4 rounded text-[#111111] accent-[#111111] border-[#E6E2DA] cursor-pointer"
              />
            </div>

            {redeemPointsToggle && discountAmount > 0 && (
              <div className="flex justify-between text-xs text-[#166534] font-semibold">
                <span>Loyalty Discount ({pointsToRedeem} pts):</span>
                <span className="font-mono tabular-nums">-₹{discountAmount.toFixed(1)}</span>
              </div>
            )}

            <div className="flex justify-between items-baseline pt-2 border-t border-[#E6E2DA]">
              <span className="text-sm font-bold text-[#111111] font-serif">Final Amount:</span>
              <span className="text-xl font-bold font-mono text-[#111111] tabular-nums">₹{finalAmount}</span>
            </div>

            <div className="flex justify-between items-center text-[11px] text-[#166534] bg-[#ECFDF5] px-2.5 py-1 rounded-lg border border-[#BBF7D0]">
              <span>Points to Earn:</span>
              <span className="font-mono font-bold tabular-nums">+{pointsToEarn} pts</span>
            </div>

            {/* Complete Bill Action */}
            <button
              onClick={handleCheckout}
              disabled={!isOnline || checkingOut || cart.length === 0 || !currentCustomer}
              className="w-full min-h-[46px] mt-2 bg-[#111111] hover:bg-[#262626] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {!isOnline
                  ? 'Offline Mode — Billing Disabled'
                  : checkingOut
                  ? 'Processing Checkout...'
                  : 'Confirm & Complete Bill'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 5. ORDER RECEIPT MODAL */}
      {receipt && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#E6E2DA] rounded-2xl p-6 shadow-xl text-center space-y-4">
            <div className="w-14 h-14 bg-[#ECFDF5] text-[#166534] rounded-2xl flex items-center justify-center mx-auto border border-[#BBF7D0]">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-[#111111] font-serif">Bill Completed Successfully!</h3>
              <p className="text-xs font-mono text-[#71717A] mt-0.5 tabular-nums">Order #{receipt.order_number}</p>
            </div>

            {/* Receipt Summary Card */}
            <div className="bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl p-4 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#52525B]">Customer:</span>
                <span className="font-bold text-[#111111]">{receipt.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#52525B]">Items Ordered:</span>
                <span className="text-[#111111] font-medium">
                  {receipt.items.map((i) => `${i.quantity}x ${i.item_name}`).join(', ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#52525B]">Subtotal:</span>
                <span className="font-mono text-[#111111] tabular-nums">₹{receipt.subtotal}</span>
              </div>
              {receipt.discount_amount > 0 && (
                <div className="flex justify-between text-[#991B1B]">
                  <span>Points Redeemed:</span>
                  <span className="font-mono tabular-nums">
                    -{receipt.points_redeemed} pts (-₹{receipt.discount_amount})
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-[#111111] pt-2 border-t border-[#E6E2DA]">
                <span>Total Paid:</span>
                <span className="text-[#111111] font-mono tabular-nums">₹{receipt.final_amount}</span>
              </div>
              <div className="flex justify-between text-[#166534] pt-1">
                <span>Points Earned:</span>
                <span className="font-mono font-bold tabular-nums">+{receipt.points_earned} pts</span>
              </div>
              <div className="flex justify-between text-[#52525B] pt-1 border-t border-[#E6E2DA]">
                <span>Updated Balance:</span>
                <span className="font-mono font-bold text-[#111111] tabular-nums">{receipt.new_balance} pts</span>
              </div>
            </div>

            {/* SMS Preview / Status banner */}
            <div className="bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl p-3 text-left">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#111111] mb-1">
                <MessageSquare className="w-3.5 h-3.5 text-[#52525B]" />
                <span>
                  SMS Status:{' '}
                  {receipt.sms.status === 'sent'
                    ? 'Dispatched to Customer'
                    : receipt.sms.status === 'preview_only'
                    ? 'Preview Generated (No API Key)'
                    : receipt.sms.status === 'disabled'
                    ? 'Disabled'
                    : 'Failed'}
                </span>
              </div>
              <p className="text-[11px] text-[#52525B] italic font-mono leading-relaxed">
                "{receipt.sms.message}"
              </p>
            </div>

            <button
              onClick={handleNextCustomer}
              className="w-full min-h-[44px] bg-[#111111] hover:bg-[#262626] text-white font-bold py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              Next Customer
            </button>
          </div>
        </div>
      )}

      {/* Custom Item Modal */}
      {showCustomItemModal && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-xs w-full bg-white border border-[#E6E2DA] rounded-2xl p-5 shadow-xl space-y-3">
            <h4 className="font-bold text-[#111111] text-sm font-serif">Add Custom Item</h4>
            <form onSubmit={handleAddCustomItem} className="space-y-3">
              <input
                type="text"
                required
                placeholder="Item Name (e.g. Extra Cookie)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full min-h-[40px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-2 text-xs text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
              />
              <input
                type="number"
                required
                min="1"
                placeholder="Price (₹)"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className="w-full min-h-[40px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-2 text-xs text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white font-mono tabular-nums"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCustomItemModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#52525B] hover:text-[#111111] bg-[#F3EFEA] hover:bg-[#E6E2DA] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#111111] hover:bg-[#262626] text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Add to Cart
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bonus Points Quick Modal */}
      {showBonusModal && currentCustomer && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-xs w-full bg-white border border-[#E6E2DA] rounded-2xl p-5 shadow-xl space-y-3">
            <h4 className="font-bold text-[#111111] text-sm font-serif">Grant Courtesy Bonus Points</h4>
            <form onSubmit={handleQuickBonus} className="space-y-3">
              <input
                type="number"
                required
                min="1"
                max={currentUser.role === 'staff' ? settings?.staff_max_bonus_points : undefined}
                placeholder={`Points (max ${settings?.staff_max_bonus_points || 50} pts)`}
                value={bonusPoints}
                onChange={(e) => setBonusPoints(e.target.value)}
                className="w-full min-h-[40px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-2 text-xs text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white font-mono tabular-nums"
              />
              <input
                type="text"
                required
                placeholder="Reason (e.g. Wait apology)"
                value={bonusReason}
                onChange={(e) => setBonusReason(e.target.value)}
                className="w-full min-h-[40px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-2 text-xs text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowBonusModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#52525B] hover:text-[#111111] bg-[#F3EFEA] hover:bg-[#E6E2DA] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBonus}
                  className="px-3 py-1.5 bg-[#111111] hover:bg-[#262626] text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  {submittingBonus ? '...' : 'Add Points'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link / Replace Unassigned Card Modal */}
      {showLinkExistingModal && scanResult?.card_uid && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#E6E2DA] rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E6E2DA]">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#111111]" />
                <h3 className="font-bold text-[#111111] text-base font-serif">
                  Link Card <span className="font-mono text-[#92400E]">{scanResult.card_uid}</span>
                </h3>
              </div>
              <button
                onClick={() => setShowLinkExistingModal(false)}
                className="text-[#71717A] hover:text-[#111111] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {linkError && (
              <div className="mb-4 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-[#991B1B] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="font-semibold">{linkError}</span>
              </div>
            )}

            <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-[#92400E] text-xs leading-relaxed mb-4">
              <strong>Seamless Card Linking:</strong> Select an existing customer below. Linking <strong>{scanResult.card_uid}</strong> will automatically preserve their loyalty points, visit history, and block any previous lost card.
            </div>

            {!selectedCustomerForLink ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
                    Search Existing Customer
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-[#71717A]" />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Type name, phone number, or old card..."
                      value={linkSearchQuery}
                      onChange={(e) => handleSearchForLink(e.target.value)}
                      className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl pl-9 pr-3 py-2 text-sm text-[#111111] placeholder-[#71717A] focus:outline-none focus:border-[#111111] focus:bg-white transition-colors"
                    />
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-[#E6E2DA] border border-[#E6E2DA] rounded-xl">
                  {linkSearchResults.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#71717A] italic">
                      {linkSearchQuery.trim()
                        ? 'No matching customer found.'
                        : 'Search by customer name or phone number.'}
                    </div>
                  ) : (
                    linkSearchResults.map((cust) => (
                      <div
                        key={cust.id}
                        onClick={() => setSelectedCustomerForLink(cust)}
                        className="p-3 hover:bg-[#F3EFEA] cursor-pointer flex items-center justify-between text-xs transition-colors"
                      >
                        <div>
                          <p className="font-bold text-[#111111] text-sm">{cust.name}</p>
                          <p className="text-[12px] text-[#52525B] font-mono tabular-nums">{cust.phone}</p>
                          {cust.card_uid && (
                            <p className="text-[11px] text-[#71717A] font-mono mt-0.5">
                              Current Card: {cust.card_uid}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-[#166534] font-bold tabular-nums bg-[#ECFDF5] border border-[#BBF7D0] px-2 py-0.5 rounded-md inline-block">
                            {cust.points_balance} pts
                          </span>
                          <p className="text-[10px] text-[#52525B] mt-1 font-semibold">Select &rarr;</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmLinkCard} className="space-y-4">
                <div className="p-3 bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#71717A]">Selected Customer:</span>
                    <button
                      type="button"
                      onClick={() => setSelectedCustomerForLink(null)}
                      className="text-xs text-[#111111] font-semibold underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                  <p className="font-bold text-sm text-[#111111]">{selectedCustomerForLink.name}</p>
                  <p className="text-xs font-mono text-[#52525B] tabular-nums">{selectedCustomerForLink.phone}</p>
                  <div className="pt-1 text-xs text-[#166534] font-semibold">
                    Current Points Balance: {selectedCustomerForLink.points_balance} pts
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
                    Reason for Linking / Replacement
                  </label>
                  <input
                    type="text"
                    required
                    value={linkReason}
                    onChange={(e) => setLinkReason(e.target.value)}
                    placeholder="e.g. Card replacement at counter"
                    className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white transition-colors"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCustomerForLink(null)}
                    className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-[#52525B] hover:text-[#111111] bg-[#F3EFEA] hover:bg-[#E6E2DA] border border-[#E6E2DA] cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submittingLink}
                    className="min-h-[44px] bg-[#111111] hover:bg-[#262626] disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-sm cursor-pointer flex items-center gap-1.5"
                  >
                    {submittingLink ? (
                      'Linking Card...'
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm &amp; Link {scanResult.card_uid}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomerModal && (
        <AddCustomerModal
          initialCardUid={scanResult?.cardStatus === 'unassigned' ? scanResult.card_uid : undefined}
          onClose={() => setShowAddCustomerModal(false)}
          onCustomerAdded={(newCust) => {
            setShowAddCustomerModal(false);
            if (newCust.card_uid) {
              handleLookupCard(newCust.card_uid);
            } else {
              selectCustomerFromSearch(newCust);
            }
          }}
        />
      )}
    </div>
  );
};
