import React, { useEffect, useState, useMemo } from 'react';
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
  Sparkles,
  X,
  UserPlus,
  MessageSquare,
  Gift,
  Smartphone,
  RefreshCw,
  Printer,
  Trash2,
  Utensils,
  Coffee,
  ShoppingBag,
  Truck,
  Edit3,
  BookmarkCheck,
  Layers,
  Percent,
} from 'lucide-react';
import { User as AuthUser } from '../../types';
import { MenuItem } from '../../../functions/api/owner/menu';
import { CafeSettingsRow } from '../../../functions/api/owner/settings';
import { CardScanResult } from '../../../functions/api/counter/scan/[card_uid]';
import { CheckoutReceipt, CheckoutLineItem } from '../../../functions/api/counter/checkout';
import { DraftOrderRow } from '../../../functions/api/counter/drafts';
import { AddCustomerModal } from '../customers/AddCustomerModal';
import { CustomerProfileView } from '../customers/CustomerProfileView';
import { detectNfcCapabilities, normalizeCardInput } from '../../utils/nfcPlatform';

interface CounterTerminalProps {
  currentUser: AuthUser;
  initialCardUid?: string;
  initialTableId?: string;
  isOnline?: boolean;
}

interface CartItem extends CheckoutLineItem {
  notes?: string;
}

interface KotTicket {
  order_number: string;
  dining_type: string;
  table_number: string | null;
  server_name: string;
  items: CartItem[];
  created_at: string;
}

export const CounterTerminal: React.FC<CounterTerminalProps> = ({
  currentUser,
  initialCardUid,
  initialTableId,
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
  const nfcCaps = useMemo(() => detectNfcCapabilities(), []);
  const [nfcListening, setNfcListening] = useState(false);

  // Cart & POS Terminal State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [diningType, setDiningType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [tableNumber, setTableNumber] = useState(initialTableId || 'Table 1');
  const [availableTables, setAvailableTables] = useState<{ id: string; table_number: string; table_name: string; section: string }[]>([]);
  const [extraDiscount, setExtraDiscount] = useState('');
  const [packagingChargeInput, setPackagingChargeInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'split'>('cash');
  const [splitCash, setSplitCash] = useState('');
  const [splitUpi, setSplitUpi] = useState('');
  const [splitCard, setSplitCard] = useState('');
  const [redeemPointsToggle, setRedeemPointsToggle] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [expandedNoteIndex, setExpandedNoteIndex] = useState<number | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  // Drafts Management
  const [draftsList, setDraftsList] = useState<DraftOrderRow[]>([]);
  const [showDraftsDrawer, setShowDraftsDrawer] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(false);

  // Custom Item Modal
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');

  // Modals & Sub-views
  const [receipt, setReceipt] = useState<CheckoutReceipt | null>(null);
  const [kotTicket, setKotTicket] = useState<KotTicket | null>(null);
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

  // 1. Initial Load of Menu, Settings & Active Drafts
  const fetchDrafts = async () => {
    try {
      setLoadingDrafts(true);
      const res = await fetch('/api/counter/drafts');
      if (res.ok) {
        const data = (await res.json()) as DraftOrderRow[];
        setDraftsList(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch drafts', err);
    } finally {
      setLoadingDrafts(false);
    }
  };

  useEffect(() => {
    const initCounter = async () => {
      try {
        setLoadingInit(true);
        const [counterRes, tablesRes] = await Promise.all([
          fetch('/api/counter/init'),
          fetch('/api/tables'),
        ]);

        if (!counterRes.ok) throw new Error('Failed to load menu & settings');
        const data = (await counterRes.json()) as { menu_items: MenuItem[]; settings: CafeSettingsRow };
        setMenuItems(data.menu_items || []);
        setSettings(data.settings || null);

        if (tablesRes.ok) {
          const tablesData = (await tablesRes.json()) as any[];
          if (Array.isArray(tablesData) && tablesData.length > 0) {
            setAvailableTables(tablesData);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Counter init failed');
      } finally {
        setLoadingInit(false);
      }
    };

    initCounter();
    fetchDrafts();
  }, []);

  useEffect(() => {
    if (initialTableId && draftsList.length > 0) {
      const matchingDraft = draftsList.find(
        (d) =>
          d.table_id === initialTableId ||
          d.table_number?.toLowerCase() === initialTableId.toLowerCase()
      );
      if (matchingDraft && activeDraftId !== matchingDraft.id) {
        handleResumeDraft(matchingDraft);
      } else if (!matchingDraft && !activeDraftId) {
        setTableNumber(initialTableId);
        setDiningType('dine_in');
      }
    } else if (initialTableId) {
      setTableNumber(initialTableId);
      setDiningType('dine_in');
    }
  }, [initialTableId, draftsList]);

  // Sync default packaging charge when dining mode is Takeaway or Delivery
  useEffect(() => {
    if (diningType === 'takeaway' || diningType === 'delivery') {
      if (packagingChargeInput === '' && settings?.packaging_charge) {
        setPackagingChargeInput(String(settings.packaging_charge));
      }
    } else {
      if (packagingChargeInput !== '') {
        setPackagingChargeInput('');
      }
    }
  }, [diningType, settings?.packaging_charge]);

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
        normalizedCard && (normalizedCard.startsWith('KIMMO-') || normalizedCard.startsWith('GROVE-')) ? normalizedCard : trimmed;

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
        normalizedCard && (normalizedCard.startsWith('KIMMO-') || normalizedCard.startsWith('GROVE-')) ? normalizedCard : trimmed;
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

  // Cart Operations
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
          notes: '',
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

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, idx) => idx !== index));
    if (expandedNoteIndex === index) setExpandedNoteIndex(null);
  };

  const updateItemNotes = (index: number, notes: string) => {
    setCart((prev) =>
      prev.map((i, idx) => (idx === index ? { ...i, notes } : i))
    );
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
  const extraDiscountNum = Math.max(0, Number(extraDiscount) || 0);
  const subtotalAfterExtra = Math.max(0, subtotal - extraDiscountNum);

  const packagingAmountNum =
    diningType === 'takeaway' || diningType === 'delivery'
      ? Math.max(0, Number(packagingChargeInput) || (settings?.packaging_charge ?? 0))
      : 0;

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
    subtotalAfterExtra >= minBillForRedeem;

  const maxDiscountRupees = subtotalAfterExtra * (maxRedeemPercent / 100);
  const maxPointsPossible = Math.floor(maxDiscountRupees / pointRedeemValue);
  const pointsToRedeem = canRedeem ? Math.min(customerBalance, maxPointsPossible) : 0;
  const pointsDiscountAmount = Math.round(pointsToRedeem * pointRedeemValue * 100) / 100;

  // Taxable base includes packaging and excludes points redemption discount
  const taxableBase = Math.max(0, subtotalAfterExtra - pointsDiscountAmount + packagingAmountNum);
  const gstRate = settings?.gst_enabled === 1 && (settings?.gst_rate ?? 0) > 0 ? (settings?.gst_rate ?? 0) : 0;
  const totalTax = gstRate > 0 ? Math.round((taxableBase * (gstRate / 100)) * 100) / 100 : 0;
  const cgstAmount = Math.round((totalTax / 2) * 100) / 100;
  const sgstAmount = Math.round((totalTax - cgstAmount) * 100) / 100;

  const finalAmount = Math.max(0, Math.round((taxableBase + totalTax) * 100) / 100);
  const pointsToEarn =
    earnSpendUnit > 0
      ? Math.floor((finalAmount / earnSpendUnit) * earnPointsPerUnit)
      : 0;

  // Split payment validation
  const splitCashNum = Math.max(0, Number(splitCash) || 0);
  const splitUpiNum = Math.max(0, Number(splitUpi) || 0);
  const splitCardNum = Math.max(0, Number(splitCard) || 0);
  const splitSum = Math.round((splitCashNum + splitUpiNum + splitCardNum) * 100) / 100;
  const splitRemaining = Math.max(0, Math.round((finalAmount - splitSum) * 100) / 100);
  const isSplitValid = paymentMethod !== 'split' || Math.abs(splitSum - finalAmount) <= 0.05;

  // Save Draft (Hold Table Order)
  const handleSaveDraft = async () => {
    if (cart.length === 0) {
      alert('Cannot save an empty order to drafts.');
      return;
    }

    setSavingDraft(true);
    setError(null);

    try {
      const res = await fetch('/api/counter/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeDraftId || undefined,
          table_number: diningType === 'dine_in' ? tableNumber : diningType === 'takeaway' ? 'Takeaway' : 'Delivery',
          dining_type: diningType,
          customer_id: currentCustomer?.id || null,
          items: cart,
          notes: null,
        }),
      });

      const data = (await res.json()) as { success?: boolean; draft?: DraftOrderRow; error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to save draft order');

      if (data.draft) {
        setActiveDraftId(data.draft.id);
        setSuccess(`Order saved as Draft #${data.draft.draft_number} (${data.draft.table_number || diningType})!`);
        setTimeout(() => setSuccess(null), 3000);
      }
      await fetchDrafts();
    } catch (err: any) {
      setError(err.message || 'Failed to save draft order');
    } finally {
      setSavingDraft(false);
    }
  };

  // Resume Draft into Active Terminal
  const handleResumeDraft = (draft: DraftOrderRow) => {
    setCart(draft.items || []);
    setDiningType((draft.dining_type as any) || 'dine_in');
    if (draft.table_number) setTableNumber(draft.table_number);
    setActiveDraftId(draft.id);
    setShowDraftsDrawer(false);

    if (draft.customer_id) {
      // Lookup customer
      fetch(`/api/customers/${draft.customer_id}`)
        .then((r) => r.json())
        .then((data: any) => {
          if (data.customer) {
            setScanResult({
              cardStatus: 'active',
              card_uid: data.customer.card_uid || 'SAVED-DRAFT',
              customer: data.customer,
              crm: data.metrics,
            });
          }
        })
        .catch(console.error);
    }

    setSuccess(`Loaded Draft #${draft.draft_number} into Active Order.`);
    setTimeout(() => setSuccess(null), 3000);
  };

  // Delete Draft
  const handleDeleteDraft = async (draftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to cancel and delete this draft order?')) return;

    try {
      const res = await fetch(`/api/counter/drafts/${draftId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete draft');
      if (activeDraftId === draftId) setActiveDraftId(null);
      await fetchDrafts();
    } catch (err: any) {
      alert(err.message || 'Failed to delete draft');
    }
  };

  // Kitchen Order Ticket (KOT) Generator
  const handleOpenKotModal = () => {
    if (cart.length === 0) {
      alert('Cart is empty. Add items before generating KOT.');
      return;
    }

    setKotTicket({
      order_number: activeDraftId
        ? `DRAFT-${activeDraftId.slice(0, 6).toUpperCase()}`
        : `KOT-${Date.now().toString().slice(-4)}`,
      dining_type: diningType,
      table_number: diningType === 'dine_in' ? tableNumber : null,
      server_name: currentUser.name || currentUser.username,
      items: [...cart],
      created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  };

  // Trigger Print for KOT or Bill
  const handlePrint = () => {
    window.print();
  };

  // Checkout Handler
  const handleCheckout = async () => {
    if (!currentCustomer) {
      alert('Please select, search, or scan a customer membership card before completing the bill.');
      return;
    }
    if (cart.length === 0 || subtotal <= 0) {
      alert('Cart is empty.');
      return;
    }
    if (paymentMethod === 'split' && !isSplitValid) {
      alert(
        `Split payment total (₹${splitSum}) does not match Net Payable (₹${finalAmount}). Remaining to allocate: ₹${splitRemaining}`
      );
      return;
    }

    setCheckingOut(true);
    setError(null);

    const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const matchingTableObj = availableTables.find(
      (t) => t.table_number === tableNumber || t.id === tableNumber
    );

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
          dining_type: diningType,
          table_number: diningType === 'dine_in' ? tableNumber : undefined,
          table_id: diningType === 'dine_in' && matchingTableObj ? matchingTableObj.id : undefined,
          extra_discount: extraDiscountNum,
          packaging_amount: packagingAmountNum,
          tax_amount: totalTax,
          payment_method: paymentMethod,
          split_details:
            paymentMethod === 'split'
              ? {
                  cash: splitCashNum,
                  upi: splitUpiNum,
                  card: splitCardNum,
                }
              : undefined,
          draft_id: activeDraftId || undefined,
        }),
      });

      const data = (await res.json()) as { success?: boolean; receipt?: CheckoutReceipt; error?: string };
      if (!res.ok) throw new Error(data.error || 'Checkout failed');

      if (data.receipt) {
        setReceipt(data.receipt);
        setActiveDraftId(null);
        await fetchDrafts();
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
    setExtraDiscount('');
    setPackagingChargeInput('');
    setRedeemPointsToggle(false);
    setScanResult(null);
    setScannedCardUid('');
    setActiveDraftId(null);
    setPaymentMethod('cash');
    setSplitCash('');
    setSplitUpi('');
    setSplitCard('');
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

  const lowStockAlertCount = useMemo(() => {
    return menuItems.filter((i) => {
      const qty = i.stock_qty ?? 100;
      const threshold = i.low_stock_alert ?? 10;
      return qty <= threshold;
    }).length;
  }, [menuItems]);

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

      {/* 1. TOP SCAN & NFC CARD LOOKUP BAR */}
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
                  <strong>iPhone NFC:</strong> Tap card to top edge.
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

      {/* 2. CARD STATE BANNERS (BLOCKED OR UNASSIGNED) */}
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

      {/* SMART NFC RUNNING-TABLE AUTO-MATCH BANNER */}
      {scanResult?.active_table && activeDraftId !== scanResult.active_table.draft_id && (
        <div className="bg-[#ECFDF5] border border-[#BBF7D0] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[#166534]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#D1FAE5] rounded-xl flex items-center justify-center text-[#166534] flex-shrink-0">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-[#166534]">
                Active Running Table: {scanResult.active_table.table_name} ({scanResult.active_table.table_number})
              </p>
              <p className="text-xs text-[#166534]/80 mt-0.5">
                {scanResult.customer?.name} has a running order with {scanResult.active_table.item_count} items (₹{scanResult.active_table.subtotal}).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const matchedDraft = draftsList.find((d) => d.id === scanResult.active_table?.draft_id);
              if (matchedDraft) {
                handleResumeDraft(matchedDraft);
              } else {
                fetchDrafts().then(() => {
                  const retryDraft = draftsList.find((d) => d.id === scanResult.active_table?.draft_id);
                  if (retryDraft) handleResumeDraft(retryDraft);
                });
              }
            }}
            className="min-h-[38px] px-4 py-2 bg-[#166534] hover:bg-[#14532D] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer shadow-xs self-end sm:self-auto"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Load Table &amp; Settle Bill</span>
          </button>
        </div>
      )}

      {/* OCCUPIED TABLES QUICK BAR */}
      {draftsList.some(
        (d) => d.table_number && d.table_number !== 'Takeaway' && d.table_number !== 'Delivery'
      ) && (
        <div className="bg-white border border-[#E6E2DA] rounded-2xl p-3 shadow-2xs flex items-center gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#52525B] font-serif uppercase tracking-wider whitespace-nowrap pl-1">
            <Utensils className="w-3.5 h-3.5 text-[#111111]" />
            <span>Occupied Tables:</span>
          </div>
          <div className="flex items-center gap-2 flex-nowrap">
            {draftsList
              .filter(
                (d) => d.table_number && d.table_number !== 'Takeaway' && d.table_number !== 'Delivery'
              )
              .map((d) => {
                const isCurrent = activeDraftId === d.id;
                const draftSubtotal =
                  d.items?.reduce((sum, it) => sum + it.quantity * it.unit_price, 0) || 0;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => handleResumeDraft(d)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                      isCurrent
                        ? 'bg-[#111111] text-white shadow-xs'
                        : 'bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] border border-[#E6E2DA]'
                    }`}
                  >
                    <span className="font-serif">{d.table_number}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums font-mono ${
                        isCurrent ? 'bg-white/20 text-white' : 'bg-[#E6E2DA] text-[#52525B]'
                      }`}
                    >
                      {d.items?.length || 0} items &bull; ₹{draftSubtotal}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* 3. SPLIT-PANE FULL POINT OF SALE (POS) TERMINAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: VISUAL PRODUCT CATALOG (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-[#E6E2DA] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
          {/* Top Bar: Search, Drafts Badge & Custom Item */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[#71717A]" />
              <input
                type="text"
                placeholder="Search menu items or categories..."
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                className="w-full min-h-[42px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl pl-9 pr-3 py-2 text-xs text-[#111111] placeholder-[#71717A] focus:outline-none focus:border-[#111111] focus:bg-white transition-colors"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Live Low Stock Indicator Pill */}
              {lowStockAlertCount > 0 && (
                <div
                  title="Items in catalog running low or out of stock"
                  className="min-h-[42px] px-3 py-1.5 bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-[#D97706] flex-shrink-0" />
                  <span>{lowStockAlertCount} Low Stock</span>
                </div>
              )}

              {/* Drafts Drawer Trigger Button */}
              <button
                type="button"
                onClick={() => {
                  fetchDrafts();
                  setShowDraftsDrawer(true);
                }}
                className="min-h-[42px] px-3.5 py-2 bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] rounded-xl text-xs font-bold border border-[#E6E2DA] flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
              >
                <Layers className="w-4 h-4 text-[#111111]" />
                <span>Drafts</span>
                {draftsList.length > 0 && (
                  <span className="bg-[#111111] text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono tabular-nums">
                    {draftsList.length}
                  </span>
                )}
              </button>

              {/* Custom Item Button */}
              <button
                type="button"
                onClick={() => setShowCustomItemModal(true)}
                className="min-h-[42px] px-3.5 py-2 bg-[#111111] hover:bg-[#262626] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Custom Item</span>
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`min-h-[34px] px-3.5 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#111111] text-white shadow-xs'
                    : 'bg-[#F3EFEA] text-[#52525B] hover:text-[#111111] border border-[#E6E2DA]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Product Cards Grid */}
          {loadingInit ? (
            <div className="py-20 text-center text-[#71717A] text-xs font-serif">
              Loading menu catalog...
            </div>
          ) : filteredMenuItems.length === 0 ? (
            <div className="py-20 text-center text-[#71717A] text-xs italic font-serif">
              No matching items found in "{selectedCategory}".
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[560px] overflow-y-auto pr-1">
              {filteredMenuItems.map((item) => {
                const stockQty = item.stock_qty ?? 100;
                const lowAlert = item.low_stock_alert ?? 10;
                const isOutOfStock = stockQty <= 0;
                const isLowStock = !isOutOfStock && stockQty <= lowAlert;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (!isOutOfStock) {
                        addToCart({ id: item.id, name: item.name, price: item.price });
                      }
                    }}
                    className={`group bg-[#FAF9F6] border border-[#E6E2DA] hover:border-[#111111] rounded-2xl p-3 flex flex-col justify-between transition-all shadow-2xs text-left cursor-pointer ${
                      isOutOfStock ? 'opacity-60 cursor-not-allowed bg-[#F4F4F5]' : 'hover:bg-white hover:shadow-xs'
                    }`}
                  >
                    <div>
                      {/* Product Visual / Placeholder */}
                      <div className="w-full h-24 mb-2.5 rounded-xl bg-[#F3EFEA] border border-[#E6E2DA] overflow-hidden flex items-center justify-center relative">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              // Fallback on broken image
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Coffee className="w-8 h-8 text-[#71717A]/40 group-hover:text-[#111111]/70 transition-colors" />
                        )}

                        {/* Stock Tag Overlay */}
                        <div className="absolute top-1.5 right-1.5">
                          {isOutOfStock ? (
                            <span className="text-[10px] bg-[#FEE2E2] text-[#991B1B] font-bold px-1.5 py-0.5 rounded-md border border-[#FECACA]">
                              Out of stock
                            </span>
                          ) : isLowStock ? (
                            <span className="text-[10px] bg-[#FEF3C7] text-[#92400E] font-bold px-1.5 py-0.5 rounded-md border border-[#FDE68A] tabular-nums">
                              Low: {stockQty}
                            </span>
                          ) : (
                            <span className="text-[9px] bg-white/90 text-[#166534] font-semibold px-1.5 py-0.5 rounded-md border border-[#E6E2DA] tabular-nums">
                              {stockQty} in stock
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Name & Category */}
                      <h4 className="font-bold text-[#111111] text-xs leading-snug line-clamp-2 font-serif group-hover:text-[#111111]">
                        {item.name}
                      </h4>
                      <p className="text-[10px] text-[#71717A] uppercase tracking-wider mt-0.5">
                        {item.category}
                      </p>
                    </div>

                    {/* Price & Quick Add Button */}
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#E6E2DA]">
                      <span className="font-mono font-bold text-[#111111] text-sm tabular-nums">
                        ₹{item.price}
                      </span>
                      <button
                        type="button"
                        disabled={isOutOfStock}
                        className="w-7 h-7 rounded-lg bg-[#F3EFEA] text-[#111111] group-hover:bg-[#111111] group-hover:text-white flex items-center justify-center text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: ACTIVE ORDER, CRM & BILLING SUMMARY (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Customer CRM Strip (Compact) */}
          {currentCustomer ? (
            <div className="bg-white border border-[#E6E2DA] rounded-2xl p-4 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-[#E6E2DA]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#F3EFEA] text-[#111111] border border-[#E6E2DA] flex items-center justify-center font-bold">
                    <User className="w-4 h-4 text-[#111111]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#111111] text-sm font-serif leading-tight">
                      {currentCustomer.name}
                    </h3>
                    <p className="text-[11px] font-mono text-[#52525B] tabular-nums mt-0.5">
                      {currentCustomer.phone} &bull; Card:{' '}
                      <span className="text-[#111111] font-semibold">{scanResult?.card_uid || 'NONE'}</span>
                    </p>
                  </div>
                </div>

                {/* Points Pill */}
                <div className="bg-[#FAF9F6] border border-[#E6E2DA] px-2.5 py-1 rounded-xl text-right">
                  <p className="text-[9px] text-[#71717A] uppercase font-bold tracking-wider">Points</p>
                  <p className="text-xs font-mono font-bold text-[#166534] tabular-nums">
                    {currentCustomer.points_balance} pts
                  </p>
                </div>
              </div>

              {/* CRM Insights & Quick Actions */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-[11px] text-[#52525B] truncate">
                  <Sparkles className="w-3.5 h-3.5 text-[#166534] flex-shrink-0" />
                  <span className="truncate">
                    {scanResult?.crm?.most_ordered_items?.[0]
                      ? `Fav: ${scanResult.crm.most_ordered_items[0].item_name}`
                      : `${currentCustomer.total_visits} total visits`}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBonusModal(true);
                      setBonusPoints('');
                      setBonusReason('');
                    }}
                    title="Give courtesy points"
                    className="p-1.5 bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] rounded-lg border border-[#E6E2DA] transition-colors cursor-pointer"
                  >
                    <Gift className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedProfileCustomerId(currentCustomer.id)}
                    className="px-2 py-1 bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] rounded-lg text-[11px] font-bold border border-[#E6E2DA] transition-colors cursor-pointer"
                  >
                    Profile
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setScanResult(null);
                      setScannedCardUid('');
                    }}
                    title="Unlink current customer from this order"
                    className="p-1.5 text-[#71717A] hover:text-[#991B1B] hover:bg-[#FEE2E2] rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#E6E2DA] border-dashed rounded-2xl p-3.5 text-center text-xs text-[#52525B] flex items-center justify-between gap-2 shadow-2xs">
              <span className="font-serif">No customer attached. Tap card or search above.</span>
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(true)}
                className="px-2.5 py-1.5 bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] rounded-xl text-xs font-bold border border-[#E6E2DA] flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Register</span>
              </button>
            </div>
          )}

          {/* Main Active Order Card */}
          <div className="bg-white border border-[#E6E2DA] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
            {/* Dining Type & Table Selector */}
            <div className="space-y-2 pb-3 border-b border-[#E6E2DA]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#52525B] uppercase tracking-wider font-serif">
                  Dining Mode
                </span>
                {activeDraftId && (
                  <span className="text-[10px] bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A] px-2 py-0.5 rounded-full font-mono font-bold">
                    Editing Draft #{activeDraftId.slice(0, 6)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setDiningType('dine_in')}
                  className={`min-h-[36px] py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    diningType === 'dine_in'
                      ? 'bg-[#111111] text-white shadow-xs'
                      : 'bg-[#F3EFEA] text-[#52525B] hover:text-[#111111] border border-[#E6E2DA]'
                  }`}
                >
                  <Utensils className="w-3.5 h-3.5" />
                  <span>Dine-In</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDiningType('takeaway')}
                  className={`min-h-[36px] py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    diningType === 'takeaway'
                      ? 'bg-[#111111] text-white shadow-xs'
                      : 'bg-[#F3EFEA] text-[#52525B] hover:text-[#111111] border border-[#E6E2DA]'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Takeaway</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDiningType('delivery')}
                  className={`min-h-[36px] py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    diningType === 'delivery'
                      ? 'bg-[#111111] text-white shadow-xs'
                      : 'bg-[#F3EFEA] text-[#52525B] hover:text-[#111111] border border-[#E6E2DA]'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Delivery</span>
                </button>
              </div>

              {/* Table Selector Dropdown (Shown for Dine-In) */}
              {diningType === 'dine_in' && (
                <div className="flex items-center gap-2 pt-1">
                  <label className="text-xs font-semibold text-[#52525B] whitespace-nowrap">
                    Table:
                  </label>
                  <select
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    className="flex-1 min-h-[36px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-1 text-xs text-[#111111] font-serif focus:outline-none focus:border-[#111111] focus:bg-white"
                  >
                    {availableTables.length > 0 ? (
                      availableTables.map((t) => (
                        <option key={t.id} value={t.table_number}>
                          {t.table_name} ({t.table_number}) — {t.section}
                        </option>
                      ))
                    ) : (
                      [
                        'Table 1',
                        'Table 2',
                        'Table 3',
                        'Table 4',
                        'Table 5',
                        'Table 6',
                        'Table 7',
                        'Table 8',
                        'Table 9',
                        'Table 10',
                        'Table 11',
                        'Table 12',
                        'Balcony 1',
                        'Balcony 2',
                        'Garden Patio',
                        'Bar Counter',
                      ].map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}
            </div>

            {/* Cart Line Items List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#52525B] uppercase tracking-wider font-serif">
                  Order Items ({cart.reduce((a, b) => a + b.quantity, 0)})
                </span>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Clear entire cart?')) setCart([]);
                    }}
                    className="text-[11px] text-[#71717A] hover:text-[#991B1B] font-semibold cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="divide-y divide-[#E6E2DA] max-h-56 overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <div className="py-10 text-center text-[#71717A] text-xs italic font-serif">
                    Tap items from catalog to build order
                  </div>
                ) : (
                  cart.map((item, idx) => (
                    <div key={idx} className="py-2.5 space-y-1 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 pr-1">
                          <p className="font-bold text-[#111111] font-serif leading-tight">
                            {item.item_name}
                          </p>
                          <p className="font-mono text-[#52525B] text-[11px] tabular-nums mt-0.5">
                            ₹{item.unit_price} &times; {item.quantity} ={' '}
                            <span className="font-bold text-[#111111]">
                              ₹{item.unit_price * item.quantity}
                            </span>
                          </p>
                        </div>

                        {/* Stepper & Delete */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => updateQuantity(idx, -1)}
                            className="w-7 h-7 rounded-lg bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] flex items-center justify-center font-bold border border-[#E6E2DA] cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-mono font-bold text-[#111111] w-5 text-center tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(idx, 1)}
                            className="w-7 h-7 rounded-lg bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] flex items-center justify-center font-bold border border-[#E6E2DA] cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFromCart(idx)}
                            className="w-7 h-7 rounded-lg text-[#71717A] hover:text-[#991B1B] hover:bg-[#FEE2E2] flex items-center justify-center cursor-pointer ml-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Note Toggle & Input */}
                      <div>
                        {expandedNoteIndex === idx ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <input
                              type="text"
                              value={item.notes || ''}
                              onChange={(e) => updateItemNotes(idx, e.target.value)}
                              placeholder="Special note (e.g. Less sugar, extra hot)..."
                              className="w-full text-xs bg-[#FAF9F6] border border-[#E6E2DA] rounded-lg px-2.5 py-1 text-[#111111] focus:outline-none focus:border-[#111111]"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => setExpandedNoteIndex(null)}
                              className="text-[11px] font-bold text-[#111111] bg-[#F3EFEA] border border-[#E6E2DA] px-2 py-1 rounded-lg cursor-pointer"
                            >
                              Done
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setExpandedNoteIndex(idx)}
                            className="text-[11px] text-[#71717A] hover:text-[#111111] flex items-center gap-1 cursor-pointer font-serif"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>
                              {item.notes ? (
                                <strong className="text-[#111111]">Note: {item.notes}</strong>
                              ) : (
                                '+ Add item instruction / note'
                              )}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bill Summary & Calculations Box */}
            <div className="bg-[#FAF9F6] p-3.5 rounded-xl border border-[#E6E2DA] space-y-2 text-xs">
              {/* Subtotal */}
              <div className="flex justify-between text-[#52525B]">
                <span>Subtotal:</span>
                <span className="font-mono text-[#111111] font-bold tabular-nums">₹{subtotal}</span>
              </div>

              {/* Extra Custom Discount Row */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[#52525B] flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-[#52525B]" />
                  <span>Extra Discount:</span>
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[#71717A] font-mono">₹</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={extraDiscount}
                    onChange={(e) => setExtraDiscount(e.target.value)}
                    className="w-16 bg-white border border-[#E6E2DA] rounded-lg px-2 py-0.5 text-xs text-right font-mono tabular-nums focus:outline-none focus:border-[#111111]"
                  />
                </div>
              </div>

              {/* Takeaway / Delivery Packaging Charge */}
              {(diningType === 'takeaway' || diningType === 'delivery') && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[#52525B] flex items-center gap-1">
                    <ShoppingBag className="w-3.5 h-3.5 text-[#52525B]" />
                    <span>Packaging Charge:</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[#71717A] font-mono">₹</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={packagingChargeInput}
                      onChange={(e) => setPackagingChargeInput(e.target.value)}
                      className="w-16 bg-white border border-[#E6E2DA] rounded-lg px-2 py-0.5 text-xs text-right font-mono tabular-nums focus:outline-none focus:border-[#111111]"
                    />
                  </div>
                </div>
              )}

              {/* Loyalty Points Redemption Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-[#E6E2DA]">
                <div>
                  <p className="font-bold text-[#111111] flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-[#166534]" />
                    <span>Redeem Loyalty Points</span>
                  </p>
                  <p className="text-[10px] text-[#71717A] tabular-nums">
                    {customerBalance > 0
                      ? `Avail: ${customerBalance} pts (max ₹${maxDiscountRupees.toFixed(0)})`
                      : 'No customer points available'}
                  </p>
                </div>

                <input
                  type="checkbox"
                  disabled={!currentCustomer || customerBalance <= 0 || subtotalAfterExtra < minBillForRedeem}
                  checked={redeemPointsToggle}
                  onChange={(e) => setRedeemPointsToggle(e.target.checked)}
                  className="w-4 h-4 rounded text-[#111111] accent-[#111111] border-[#E6E2DA] cursor-pointer"
                />
              </div>

              {redeemPointsToggle && pointsDiscountAmount > 0 && (
                <div className="flex justify-between text-[#166534] font-semibold">
                  <span>Loyalty Discount ({pointsToRedeem} pts):</span>
                  <span className="font-mono tabular-nums">-₹{pointsDiscountAmount.toFixed(1)}</span>
                </div>
              )}

              {/* Optional GST Calculation Breakdown */}
              {settings?.gst_enabled === 1 && (settings?.gst_rate ?? 0) > 0 && (
                <div className="space-y-1 pt-2 border-t border-[#E6E2DA] text-[#52525B]">
                  <div className="flex justify-between font-semibold text-[#111111]">
                    <span>GST ({settings.gst_rate}%):</span>
                    <span className="font-mono tabular-nums">₹{totalTax}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-[#71717A] pl-2 font-mono tabular-nums">
                    <span>CGST ({(settings.gst_rate / 2).toFixed(1)}%): ₹{cgstAmount}</span>
                    <span>SGST ({(settings.gst_rate / 2).toFixed(1)}%): ₹{sgstAmount}</span>
                  </div>
                </div>
              )}

              {/* Payment Method Selector */}
              <div className="pt-2 border-t border-[#E6E2DA] space-y-1">
                <span className="text-[11px] font-bold text-[#52525B] uppercase tracking-wider">
                  Payment Method
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      paymentMethod === 'cash'
                        ? 'bg-[#111111] text-white shadow-xs'
                        : 'bg-white text-[#52525B] hover:text-[#111111] border border-[#E6E2DA]'
                    }`}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('upi')}
                    className={`py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      paymentMethod === 'upi'
                        ? 'bg-[#111111] text-white shadow-xs'
                        : 'bg-white text-[#52525B] hover:text-[#111111] border border-[#E6E2DA]'
                    }`}
                  >
                    UPI / QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      paymentMethod === 'card'
                        ? 'bg-[#111111] text-white shadow-xs'
                        : 'bg-white text-[#52525B] hover:text-[#111111] border border-[#E6E2DA]'
                    }`}
                  >
                    Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('split')}
                    className={`py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      paymentMethod === 'split'
                        ? 'bg-[#111111] text-white shadow-xs'
                        : 'bg-white text-[#52525B] hover:text-[#111111] border border-[#E6E2DA]'
                    }`}
                  >
                    Split
                  </button>
                </div>

                {/* Split Payment Controls */}
                {paymentMethod === 'split' && (
                  <div className="p-2.5 bg-white border border-[#E6E2DA] rounded-xl space-y-2 mt-2">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-[#52525B]">Split Amounts:</span>
                      <span
                        className={`font-mono tabular-nums ${
                          isSplitValid ? 'text-[#166534]' : 'text-[#991B1B]'
                        }`}
                      >
                        Total: ₹{splitSum} / ₹{finalAmount}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      {/* Cash Split */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-[#52525B]">
                          <span>Cash (₹)</span>
                          {splitRemaining > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setSplitCash(
                                  String(Math.round((splitCashNum + splitRemaining) * 100) / 100)
                                )
                              }
                              className="text-[#166534] font-bold underline cursor-pointer hover:text-[#14532D]"
                            >
                              Fill Rem.
                            </button>
                          )}
                        </div>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={splitCash}
                          onChange={(e) => setSplitCash(e.target.value)}
                          className="w-full bg-[#FAF9F6] border border-[#E6E2DA] rounded-lg px-2 py-1 text-xs font-mono tabular-nums text-[#111111] focus:outline-none focus:border-[#111111]"
                        />
                      </div>

                      {/* UPI Split */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-[#52525B]">
                          <span>UPI / QR (₹)</span>
                          {splitRemaining > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setSplitUpi(
                                  String(Math.round((splitUpiNum + splitRemaining) * 100) / 100)
                                )
                              }
                              className="text-[#166534] font-bold underline cursor-pointer hover:text-[#14532D]"
                            >
                              Fill Rem.
                            </button>
                          )}
                        </div>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={splitUpi}
                          onChange={(e) => setSplitUpi(e.target.value)}
                          className="w-full bg-[#FAF9F6] border border-[#E6E2DA] rounded-lg px-2 py-1 text-xs font-mono tabular-nums text-[#111111] focus:outline-none focus:border-[#111111]"
                        />
                      </div>

                      {/* Card Split */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-[#52525B]">
                          <span>Card (₹)</span>
                          {splitRemaining > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setSplitCard(
                                  String(Math.round((splitCardNum + splitRemaining) * 100) / 100)
                                )
                              }
                              className="text-[#166534] font-bold underline cursor-pointer hover:text-[#14532D]"
                            >
                              Fill Rem.
                            </button>
                          )}
                        </div>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={splitCard}
                          onChange={(e) => setSplitCard(e.target.value)}
                          className="w-full bg-[#FAF9F6] border border-[#E6E2DA] rounded-lg px-2 py-1 text-xs font-mono tabular-nums text-[#111111] focus:outline-none focus:border-[#111111]"
                        />
                      </div>
                    </div>

                    {!isSplitValid && (
                      <p className="text-[10px] text-[#991B1B] font-semibold">
                        Allocated ₹{splitSum} of ₹{finalAmount}. Difference: ₹
                        {Math.abs(Math.round((finalAmount - splitSum) * 100) / 100)}.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Grand Total */}
              <div className="flex justify-between items-baseline pt-2 border-t border-[#E6E2DA]">
                <span className="text-sm font-bold text-[#111111] font-serif">Net Payable:</span>
                <span className="text-xl font-bold font-mono text-[#111111] tabular-nums">
                  ₹{finalAmount}
                </span>
              </div>

              {/* Points to Earn Badge */}
              <div className="flex justify-between items-center text-[11px] text-[#166534] bg-[#ECFDF5] px-2.5 py-1 rounded-lg border border-[#BBF7D0]">
                <span>Points to Earn on Bill:</span>
                <span className="font-mono font-bold tabular-nums">+{pointsToEarn} pts</span>
              </div>
            </div>

            {/* Action Buttons: Hold Draft, KOT & Print, Confirm & Bill */}
            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-2 gap-2">
                {/* Hold / Draft Button */}
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={savingDraft || cart.length === 0}
                  className="min-h-[42px] px-3 py-2 bg-[#F3EFEA] hover:bg-[#E6E2DA] disabled:opacity-50 text-[#111111] rounded-xl text-xs font-bold border border-[#E6E2DA] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <BookmarkCheck className="w-4 h-4 text-[#111111]" />
                  <span>{savingDraft ? 'Saving...' : 'Hold / Draft'}</span>
                </button>

                {/* KOT & Print Button */}
                <button
                  type="button"
                  onClick={handleOpenKotModal}
                  disabled={cart.length === 0}
                  className="min-h-[42px] px-3 py-2 bg-[#F3EFEA] hover:bg-[#E6E2DA] disabled:opacity-50 text-[#111111] rounded-xl text-xs font-bold border border-[#E6E2DA] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-[#111111]" />
                  <span>KOT &amp; Print</span>
                </button>
              </div>

              {/* Complete Bill Action or Waiter Send to Kitchen */}
              {currentUser.role === 'owner' || currentUser.permissions?.can_settle_bills ? (
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={!isOnline || checkingOut || cart.length === 0 || !currentCustomer}
                  className="w-full min-h-[46px] bg-[#111111] hover:bg-[#262626] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {!isOnline
                      ? 'Offline Mode — Billing Disabled'
                      : checkingOut
                      ? 'Processing Checkout...'
                      : !currentCustomer
                      ? 'Scan NFC Card or Select Customer'
                      : `Confirm & Complete Bill (₹${finalAmount})`}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    await handleSaveDraft();
                    handleOpenKotModal();
                  }}
                  disabled={!isOnline || savingDraft || cart.length === 0}
                  className="w-full min-h-[46px] bg-[#111111] hover:bg-[#262626] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <Utensils className="w-4 h-4" />
                  <span>
                    {savingDraft ? 'Saving Order...' : 'Send Order to Kitchen & Print KOT'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. DRAFTS DRAWER / MODAL */}
      {showDraftsDrawer && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white border border-[#E6E2DA] rounded-2xl p-6 shadow-xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E2DA]">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#111111]" />
                <h3 className="font-bold text-[#111111] text-base font-serif">
                  Held Draft Orders &amp; Active Tables
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDraftsDrawer(false)}
                className="text-[#71717A] hover:text-[#111111] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#E6E2DA] pr-1">
              {loadingDrafts ? (
                <div className="py-12 text-center text-xs text-[#71717A]">Loading drafts...</div>
              ) : draftsList.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#71717A] italic font-serif">
                  No active held orders or tables. Use "Hold / Draft" in the terminal to save an order.
                </div>
              ) : (
                draftsList.map((draft) => {
                  const draftSubtotal = (draft.items || []).reduce(
                    (acc, it) => acc + it.quantity * it.unit_price,
                    0
                  );
                  return (
                    <div
                      key={draft.id}
                      onClick={() => handleResumeDraft(draft)}
                      className="py-3.5 hover:bg-[#F3EFEA] rounded-xl px-2.5 cursor-pointer flex items-center justify-between text-xs transition-colors group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#111111] text-sm font-serif">
                            {draft.table_number || draft.dining_type.toUpperCase()}
                          </span>
                          <span className="font-mono text-[10px] bg-white border border-[#E6E2DA] px-1.5 py-0.5 rounded text-[#52525B]">
                            #{draft.draft_number}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#52525B]">
                          {draft.customer_name ? (
                            <strong className="text-[#111111]">{draft.customer_name}</strong>
                          ) : (
                            'Walk-in / Unassigned'
                          )}{' '}
                          &bull; {(draft.items || []).length} items
                        </p>
                        <p className="text-[10px] text-[#71717A] truncate max-w-xs">
                          {(draft.items || []).map((i) => `${i.quantity}x ${i.item_name}`).join(', ')}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-mono font-bold text-[#111111] text-sm tabular-nums">
                            ₹{draftSubtotal}
                          </p>
                          <p className="text-[10px] text-[#166534] font-semibold group-hover:underline">
                            Resume &rarr;
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteDraft(draft.id, e)}
                          title="Delete Draft"
                          className="p-1.5 text-[#71717A] hover:text-[#991B1B] hover:bg-[#FEE2E2] rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-[#E6E2DA] flex justify-end">
              <button
                type="button"
                onClick={() => setShowDraftsDrawer(false)}
                className="px-4 py-2 bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] font-bold rounded-xl text-xs border border-[#E6E2DA] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. KITCHEN ORDER TICKET (KOT) MODAL (80mm Thermal Ready) */}
      {kotTicket && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-white border border-[#E6E2DA] rounded-2xl p-6 shadow-xl space-y-4">
            {/* Screen Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[#E6E2DA] no-print">
              <div className="flex items-center gap-2">
                <Utensils className="w-5 h-5 text-[#111111]" />
                <h3 className="font-bold text-[#111111] text-sm font-serif">
                  Kitchen Order Ticket (KOT)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setKotTicket(null)}
                className="text-[#71717A] hover:text-[#111111] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable 80mm KOT Section */}
            <div className="printable-receipt bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl p-4 text-xs font-mono space-y-2 text-[#111111]">
              <div className="text-center border-b border-dashed border-[#111111] pb-2">
                <h2 className="text-base font-bold font-serif uppercase tracking-wider">
                  {settings?.cafe_name || 'Kimmo’s Kitchen'}
                </h2>
                <p className="text-[11px] font-bold uppercase mt-0.5">Kitchen Order Ticket</p>
                <p className="text-[10px] text-[#52525B]">Ticket #{kotTicket.order_number}</p>
              </div>

              <div className="grid grid-cols-2 gap-1 text-[11px] py-1 border-b border-dashed border-[#111111]">
                <div>
                  <span className="text-[#52525B]">Type:</span>{' '}
                  <strong className="uppercase">{kotTicket.dining_type}</strong>
                </div>
                <div className="text-right">
                  <span className="text-[#52525B]">Table:</span>{' '}
                  <strong>{kotTicket.table_number || 'N/A'}</strong>
                </div>
                <div>
                  <span className="text-[#52525B]">Server:</span> {kotTicket.server_name}
                </div>
                <div className="text-right">
                  <span className="text-[#52525B]">Time:</span> {kotTicket.created_at}
                </div>
              </div>

              {/* Items List */}
              <div className="py-2 border-b border-dashed border-[#111111] space-y-2">
                <div className="flex justify-between font-bold text-[11px] uppercase border-b border-[#E6E2DA] pb-1">
                  <span>Item</span>
                  <span>Qty</span>
                </div>
                {kotTicket.items.map((it, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex justify-between font-bold text-xs">
                      <span>{it.item_name}</span>
                      <span className="tabular-nums">&times; {it.quantity}</span>
                    </div>
                    {it.notes && (
                      <p className="text-[10px] text-[#991B1B] italic font-serif">
                        &gt;&gt; Instruction: {it.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="text-center pt-1 text-[10px] text-[#52525B] italic">
                -- End of Kitchen Ticket --
              </div>
            </div>

            {/* Screen Actions */}
            <div className="flex items-center gap-2 pt-2 no-print">
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 min-h-[44px] bg-[#111111] hover:bg-[#262626] text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Print 80mm KOT</span>
              </button>
              <button
                type="button"
                onClick={() => setKotTicket(null)}
                className="min-h-[44px] px-4 py-2 bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] font-bold rounded-xl text-xs border border-[#E6E2DA] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. ORDER RECEIPT MODAL (80mm Thermal Ready) */}
      {receipt && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#E6E2DA] rounded-2xl p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Screen Header */}
            <div className="text-center space-y-1 no-print">
              <div className="w-12 h-12 bg-[#ECFDF5] text-[#166534] rounded-2xl flex items-center justify-center mx-auto border border-[#BBF7D0]">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-[#111111] font-serif">
                Bill Completed Successfully!
              </h3>
              <p className="text-xs font-mono text-[#71717A] tabular-nums">
                Order #{receipt.order_number}
              </p>
            </div>

            {/* Printable 80mm Receipt Section */}
            <div className="printable-receipt bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl p-4 text-xs font-mono space-y-2 text-[#111111]">
              <div className="text-center border-b border-dashed border-[#111111] pb-2">
                <h2 className="text-base font-bold font-serif uppercase tracking-wider">
                  {settings?.cafe_name || 'Kimmo’s Kitchen'}
                </h2>
                <p className="text-[10px] text-[#52525B]">Tax Invoice / Customer Receipt</p>
                {receipt.gstin && (
                  <p className="text-[10px] text-[#52525B] font-mono mt-0.5">GSTIN: {receipt.gstin}</p>
                )}
                <p className="text-[10px] text-[#52525B] mt-0.5">Order #{receipt.order_number}</p>
                <p className="text-[9px] text-[#71717A]">{receipt.created_at || new Date().toLocaleString()}</p>
              </div>

              {/* Customer & Dining Meta */}
              <div className="grid grid-cols-2 gap-1 text-[11px] py-1 border-b border-dashed border-[#111111]">
                <div>
                  <span className="text-[#52525B]">Customer:</span>{' '}
                  <strong className="font-serif">{receipt.customer_name}</strong>
                </div>
                <div className="text-right">
                  <span className="text-[#52525B]">Phone:</span> {receipt.customer_phone}
                </div>
                <div>
                  <span className="text-[#52525B]">Type:</span>{' '}
                  <strong className="uppercase">{receipt.dining_type}</strong>
                </div>
                <div className="text-right">
                  <span className="text-[#52525B]">Table:</span>{' '}
                  <strong>{receipt.table_number || 'N/A'}</strong>
                </div>
                {receipt.waiter_name && (
                  <div>
                    <span className="text-[#52525B]">Server:</span>{' '}
                    <strong className="font-serif">{receipt.waiter_name}</strong>
                  </div>
                )}
                <div className={receipt.payment_method === 'split' ? 'col-span-2' : ''}>
                  <span className="text-[#52525B]">Pay Mode:</span>{' '}
                  <strong className="uppercase">{receipt.payment_method}</strong>
                  {receipt.payment_method === 'split' && receipt.split_details && (
                    <span className="text-[10px] text-[#52525B] ml-1 font-mono">
                      (Cash ₹{receipt.split_details.cash || 0}, UPI ₹{receipt.split_details.upi || 0}, Card ₹{receipt.split_details.card || 0})
                    </span>
                  )}
                </div>
              </div>

              {/* Items Breakdown */}
              <div className="py-2 border-b border-dashed border-[#111111] space-y-1.5">
                <div className="flex justify-between font-bold text-[11px] uppercase border-b border-[#E6E2DA] pb-1">
                  <span>Item</span>
                  <span>Amount</span>
                </div>
                {receipt.items.map((i, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex justify-between text-xs">
                      <span>
                        {i.quantity} &times; {i.item_name}
                      </span>
                      <span className="tabular-nums">₹{i.quantity * i.unit_price}</span>
                    </div>
                    {i.notes && (
                      <p className="text-[10px] text-[#52525B] italic font-serif">Note: {i.notes}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Amounts & Totals */}
              <div className="space-y-1 pt-1 text-xs">
                <div className="flex justify-between text-[#52525B]">
                  <span>Subtotal:</span>
                  <span className="font-mono tabular-nums">₹{receipt.subtotal}</span>
                </div>
                {receipt.extra_discount > 0 && (
                  <div className="flex justify-between text-[#991B1B]">
                    <span>Extra Discount:</span>
                    <span className="font-mono tabular-nums">-₹{receipt.extra_discount}</span>
                  </div>
                )}
                {receipt.discount_amount > 0 && (
                  <div className="flex justify-between text-[#166534]">
                    <span>Points Redeemed ({receipt.points_redeemed} pts):</span>
                    <span className="font-mono tabular-nums">-₹{receipt.discount_amount}</span>
                  </div>
                )}
                {receipt.packaging_amount > 0 && (
                  <div className="flex justify-between text-[#52525B]">
                    <span>Packaging Charge:</span>
                    <span className="font-mono tabular-nums">₹{receipt.packaging_amount}</span>
                  </div>
                )}
                {receipt.tax_amount > 0 && (
                  <div className="space-y-0.5 pt-0.5 text-[#52525B]">
                    <div className="flex justify-between">
                      <span>GST ({receipt.gst_rate}%):</span>
                      <span className="font-mono tabular-nums">₹{receipt.tax_amount}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-[#71717A] pl-2 font-mono tabular-nums">
                      <span>CGST: ₹{receipt.cgst_amount}</span>
                      <span>SGST: ₹{receipt.sgst_amount}</span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-[#111111] pt-1 border-t border-[#111111]">
                  <span>Total Paid:</span>
                  <span className="font-mono tabular-nums">₹{receipt.final_amount}</span>
                </div>
              </div>

              {/* Loyalty Points Footer */}
              <div className="pt-2 border-t border-dashed border-[#111111] space-y-0.5 text-[11px]">
                <div className="flex justify-between text-[#166534]">
                  <span>Points Earned Today:</span>
                  <strong className="font-mono tabular-nums">+{receipt.points_earned} pts</strong>
                </div>
                <div className="flex justify-between text-[#52525B]">
                  <span>New Loyalty Balance:</span>
                  <strong className="font-mono text-[#111111] tabular-nums">
                    {receipt.new_balance} pts
                  </strong>
                </div>
              </div>

              <div className="text-center pt-2 text-[10px] text-[#52525B] italic">
                Thank you for visiting {settings?.cafe_name || 'Kimmo’s Kitchen'}!
              </div>
            </div>

            {/* SMS Status Banner */}
            <div className="bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl p-3 text-left no-print">
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

            {/* Screen Action Buttons */}
            <div className="space-y-2 no-print">
              <button
                type="button"
                onClick={handlePrint}
                className="w-full min-h-[44px] bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] font-bold py-2 rounded-xl text-xs border border-[#E6E2DA] flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Print 80mm Bill Receipt</span>
              </button>

              <button
                type="button"
                onClick={handleNextCustomer}
                className="w-full min-h-[44px] bg-[#111111] hover:bg-[#262626] text-white font-bold py-2 rounded-xl text-xs shadow-sm transition-all cursor-pointer"
              >
                Next Customer &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. CUSTOM ITEM MODAL */}
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

      {/* 8. COURTESY BONUS POINTS MODAL */}
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

      {/* 9. LINK / REPLACE UNASSIGNED CARD MODAL */}
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
                type="button"
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

      {/* 10. ADD CUSTOMER MODAL */}
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
