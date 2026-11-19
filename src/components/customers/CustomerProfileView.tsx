import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CreditCard,
  Gift,
  Coins,
  Receipt,
  RotateCcw,
  Clock,
  Sparkles,
  ShoppingBag,
  Trash2,
  Edit3,
  X,
  Radio,
  AlertCircle,
  CheckCircle2,
  Save,
} from 'lucide-react';
import { User } from '../../types';
import { CustomerDetailProfile } from '../../../functions/api/customers/[id]';
import { detectNfcCapabilities, normalizeCardInput } from '../../utils/nfcPlatform';

interface CustomerProfileViewProps {
  customerId: string;
  currentUser: User;
  isOnline?: boolean;
  onBack: () => void;
  onCustomerDeleted?: () => void;
}

const PRESET_REASONS = [
  'Birthday Bonus',
  'Order Delay Apology',
  'Special Promotion Offer',
  'Counter Courtesy Treat',
  'Balance Adjustment',
];

export const CustomerProfileView: React.FC<CustomerProfileViewProps> = ({
  customerId,
  currentUser,
  isOnline = true,
  onBack,
  onCustomerDeleted,
}) => {
  const [profile, setProfile] = useState<CustomerDetailProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Tab state: 'insights' | 'orders' | 'ledger'
  const [activeTab, setActiveTab] = useState<'insights' | 'orders' | 'ledger'>('insights');

  // Inline notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Replace Card Modal
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [newCardUid, setNewCardUid] = useState('');
  const [replaceReason, setReplaceReason] = useState('Lost or damaged card');
  const [submittingReplace, setSubmittingReplace] = useState(false);

  // Bonus Points Modal
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [bonusAction, setBonusAction] = useState<'add' | 'deduct'>('add');
  const [bonusPoints, setBonusPoints] = useState('');
  const [bonusReason, setBonusReason] = useState('');
  const [submittingBonus, setSubmittingBonus] = useState(false);

  // Cross-platform NFC for replacement
  const nfcCaps = detectNfcCapabilities();
  const [nfcScanning, setNfcScanning] = useState(false);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/customers/${customerId}`);
      if (!res.ok) throw new Error('Failed to load customer profile');
      const data = (await res.json()) as CustomerDetailProfile;
      setProfile(data);
      setNotesValue(data.customer.notes || '');
    } catch (err: any) {
      setError(err.message || 'Error loading profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [customerId]);

  const handleSaveNotes = async () => {
    if (!profile) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesValue.trim() }),
      });
      if (!res.ok) throw new Error('Failed to update notes');
      setProfile({
        ...profile,
        customer: { ...profile.customer, notes: notesValue.trim() },
      });
      setEditingNotes(false);
      setSuccess('Staff notes saved successfully');
      setTimeout(() => setSuccess(null), 2500);
    } catch (err: any) {
      setError(err.message || 'Error saving notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!profile) return;
    const confirmName = window.prompt(
      `Warning: This will archive customer "${profile.customer.name}" and immediately block any active membership card.\n\nType "CONFIRM" to proceed:`
    );
    if (confirmName !== 'CONFIRM') return;

    try {
      const res = await fetch(`/api/customers/${customerId}`, { method: 'DELETE' });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to remove customer');

      alert('Customer successfully removed and membership card blocked.');
      if (onCustomerDeleted) {
        onCustomerDeleted();
      } else {
        onBack();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove customer');
    }
  };

  const startNfcScan = async () => {
    if (!('NDEFReader' in window)) {
      alert(
        nfcCaps.isIos
          ? 'On iPhone: Hold your membership card to the top edge of your iPhone to scan.'
          : 'Web NFC is available on supported Android devices.'
      );
      return;
    }
    try {
      // @ts-ignore
      const ndef = new NDEFReader();
      await ndef.scan();
      setNfcScanning(true);
      // @ts-ignore
      ndef.addEventListener('reading', ({ serialNumber }: any) => {
        if (serialNumber) {
          const uid = normalizeCardInput(serialNumber.replace(/:/g, ''));
          setNewCardUid(uid);
          setNfcScanning(false);
        }
      });
    } catch (err: any) {
      alert(`NFC Scan error: ${err.message || 'Permission denied'}`);
      setNfcScanning(false);
    }
  };

  const handleReplaceCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUid = normalizeCardInput(newCardUid.trim());
    if (!cleanUid) return;
    setError(null);
    setSubmittingReplace(true);

    try {
      const res = await fetch(`/api/customers/${customerId}/replace-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_card_uid: cleanUid,
          reason: replaceReason.trim(),
        }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to replace card');

      setShowReplaceModal(false);
      setNewCardUid('');
      setSuccess(data.message || 'Card re-linked successfully');
      fetchProfile();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error replacing card');
    } finally {
      setSubmittingReplace(false);
    }
  };

  const handleBonusPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    const pointsNum = Number(bonusPoints);
    if (!bonusPoints || isNaN(pointsNum) || pointsNum <= 0 || !bonusReason.trim()) return;
    setError(null);
    setSubmittingBonus(true);

    try {
      const res = await fetch(`/api/customers/${customerId}/bonus-points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: bonusAction,
          points: pointsNum,
          reason: bonusReason.trim(),
        }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to grant points');

      setShowBonusModal(false);
      setBonusPoints('');
      setBonusReason('');
      setSuccess(data.message || 'Points updated successfully');
      fetchProfile();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error adjusting points');
    } finally {
      setSubmittingBonus(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-[#52525B]">
        <div className="w-8 h-8 border-2 border-[#111111] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm font-medium">Loading 360° customer profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 bg-white border border-[#E6E2DA] rounded-2xl text-center shadow-sm">
        <p className="text-[#991B1B] font-semibold mb-3">{error || 'Customer profile unavailable'}</p>
        <button
          onClick={onBack}
          className="min-h-[44px] px-4 py-2 bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer border border-[#E6E2DA]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Directory</span>
        </button>
      </div>
    );
  }

  const { customer, card, metrics, orders, points_ledger, config } = profile;
  const redeemRupeeValue = customer.points_balance * config.point_redeem_value;

  return (
    <div className="space-y-6">
      {/* Top Bar with Back Button & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="min-h-[44px] inline-flex items-center gap-2 text-xs font-bold text-[#52525B] hover:text-[#111111] bg-white border border-[#E6E2DA] hover:bg-[#F3EFEA] px-4 py-2 rounded-xl transition-colors self-start shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Customers</span>
        </button>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Give Extra Points */}
          <button
            disabled={!isOnline}
            onClick={() => {
              setShowBonusModal(true);
              setBonusAction('add');
              setBonusPoints('');
              setBonusReason('');
            }}
            className="min-h-[44px] bg-[#111111] hover:bg-[#262626] disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Gift className="w-4 h-4" />
            <span>Bonus / Extra Points</span>
          </button>

          {/* Delete Customer (Owner Only) */}
          {currentUser.role === 'owner' && (
            <button
              disabled={!isOnline}
              onClick={handleDeleteCustomer}
              title={isOnline ? 'Remove customer and block membership card' : 'Offline: Deletions disabled'}
              className="min-h-[44px] min-w-[44px] p-2 bg-white hover:bg-[#FEF2F2] disabled:opacity-40 text-[#71717A] hover:text-[#991B1B] border border-[#E6E2DA] hover:border-[#FECACA] rounded-xl transition-colors flex items-center justify-center cursor-pointer shadow-2xs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Feedback alerts */}
      {error && (
        <div className="p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-[#991B1B] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-[#991B1B] hover:text-[#111111] cursor-pointer">
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

      {/* 1. Profile Header & Card Control */}
      <div className="bg-white border border-[#E6E2DA] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[#E6E2DA]">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl sm:text-2xl font-bold text-[#111111] font-serif">{customer.name}</h2>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  customer.sms_consent === 1
                    ? 'bg-[#ECFDF5] text-[#166534] border border-[#BBF7D0]'
                    : 'bg-[#F3EFEA] text-[#71717A] border border-[#E6E2DA]'
                }`}
              >
                {customer.sms_consent === 1 ? 'SMS Active' : 'No SMS'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#52525B] mt-1">
              <span className="font-mono text-[#111111] font-semibold tabular-nums">{customer.phone}</span>
              {customer.dob && (
                <>
                  <span>&bull;</span>
                  <span className="tabular-nums">DOB: {new Date(customer.dob).toLocaleDateString()}</span>
                </>
              )}
              <span>&bull;</span>
              <span className="tabular-nums">Member since {new Date(customer.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Active Card Badge & Re-link Button */}
          <div className="flex items-center gap-2.5 bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl p-2.5">
            <CreditCard className="w-5 h-5 text-[#111111]" />
            <div>
              <p className="text-[10px] uppercase font-bold text-[#71717A] tracking-wider">NFC Membership Tag</p>
              <p className="text-xs font-mono font-bold text-[#111111] tabular-nums">
                {card ? card.card_uid : <span className="text-[#71717A]">No Card Linked</span>}
              </p>
            </div>
            <button
              disabled={!isOnline}
              onClick={() => {
                setShowReplaceModal(true);
                setNewCardUid('');
              }}
              className="ml-2 px-3 py-1 bg-[#F3EFEA] hover:bg-[#E6E2DA] disabled:opacity-40 text-[#111111] rounded-lg text-xs font-bold border border-[#E6E2DA] transition-colors cursor-pointer"
            >
              {card ? 'Replace' : 'Link Card'}
            </button>
          </div>
        </div>

        {/* Staff Notes with Inline Edit */}
        <div className="bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-[#52525B] uppercase tracking-wider">
              Staff Preferences & Notes
            </span>
            {!editingNotes ? (
              <button
                onClick={() => setEditingNotes(true)}
                className="text-xs text-[#52525B] hover:text-[#111111] flex items-center gap-1 font-semibold cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                <span>Edit</span>
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="text-xs text-[#166534] hover:text-[#14532D] flex items-center gap-1 font-bold cursor-pointer"
                >
                  <Save className="w-3 h-3" />
                  <span>{savingNotes ? 'Saving...' : 'Save'}</span>
                </button>
                <button
                  onClick={() => {
                    setEditingNotes(false);
                    setNotesValue(customer.notes || '');
                  }}
                  className="text-xs text-[#71717A] hover:text-[#111111] ml-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
          {editingNotes ? (
            <textarea
              rows={2}
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              placeholder="e.g. Likes extra hot latte, prefers table 4..."
              className="w-full bg-white border border-[#E6E2DA] rounded-lg p-2 text-xs text-[#111111] focus:outline-none focus:border-[#111111] mt-1 resize-none"
            />
          ) : (
            <p className="text-xs text-[#52525B] italic">
              {customer.notes || 'No staff notes added for this customer yet.'}
            </p>
          )}
        </div>
      </div>

      {/* 2. 4 360° KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-[#E6E2DA] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[#166534] text-xs font-bold uppercase mb-1">
            <Coins className="w-4 h-4" />
            <span>Points Balance</span>
          </div>
          <p className="text-2xl font-bold text-[#166534] font-mono tabular-nums">
            {customer.points_balance}
            <span className="text-xs font-normal text-[#52525B] ml-1">pts</span>
          </p>
          <p className="text-[11px] text-[#52525B] mt-0.5 tabular-nums">
            Worth <strong className="text-[#111111]">₹{redeemRupeeValue.toFixed(1)}</strong>
          </p>
        </div>

        <div className="bg-white border border-[#E6E2DA] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[#52525B] text-xs font-bold uppercase mb-1">
            <RotateCcw className="w-4 h-4 text-[#111111]" />
            <span>Total Visits</span>
          </div>
          <p className="text-2xl font-bold text-[#111111] font-mono tabular-nums">{customer.total_visits}</p>
          <p className="text-[11px] text-[#71717A] mt-0.5">Checkouts recorded</p>
        </div>

        <div className="bg-white border border-[#E6E2DA] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[#52525B] text-xs font-bold uppercase mb-1">
            <ShoppingBag className="w-4 h-4 text-[#111111]" />
            <span>Lifetime Spend</span>
          </div>
          <p className="text-2xl font-bold text-[#111111] font-mono tabular-nums">
            ₹{customer.total_spent.toFixed(0)}
          </p>
          <p className="text-[11px] text-[#71717A] mt-0.5">Gross billings</p>
        </div>

        <div className="bg-white border border-[#E6E2DA] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[#52525B] text-xs font-bold uppercase mb-1">
            <Receipt className="w-4 h-4 text-[#111111]" />
            <span>Average Bill</span>
          </div>
          <p className="text-2xl font-bold text-[#111111] font-mono tabular-nums">₹{metrics.average_bill.toFixed(0)}</p>
          <p className="text-[11px] text-[#71717A] mt-0.5">Per visit spend</p>
        </div>
      </div>

      {/* 3. Navigation Tabs: Insights | Orders | Points Ledger */}
      <div className="grid grid-cols-3 gap-2 p-1.5 bg-[#F3EFEA] border border-[#E6E2DA] rounded-2xl">
        <button
          onClick={() => setActiveTab('insights')}
          className={`min-h-[44px] py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'insights'
              ? 'bg-[#111111] text-white shadow-xs'
              : 'text-[#52525B] hover:text-[#111111]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>CRM Insights</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`min-h-[44px] py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'orders'
              ? 'bg-[#111111] text-white shadow-xs'
              : 'text-[#52525B] hover:text-[#111111]'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Order History ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`min-h-[44px] py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'ledger'
              ? 'bg-[#111111] text-white shadow-xs'
              : 'text-[#52525B] hover:text-[#111111]'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>Points Ledger ({points_ledger.length})</span>
        </button>
      </div>

      {/* Tab 1: CRM Insights */}
      {activeTab === 'insights' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Last Order Insight */}
          <div className="bg-white border border-[#E6E2DA] rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#E6E2DA]">
              <Clock className="w-4 h-4 text-[#111111]" />
              <h3 className="font-bold text-[#111111] text-sm font-serif">Most Recent Order</h3>
            </div>

            {metrics.last_order ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-[#111111] tabular-nums">
                    #{metrics.last_order.order_number}
                  </span>
                  <span className="text-[#52525B] tabular-nums">
                    {new Date(metrics.last_order.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="space-y-1.5 bg-[#FAF9F6] p-3 rounded-xl border border-[#E6E2DA]">
                  {metrics.last_order.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-xs">
                      <span className="text-[#111111] font-medium">
                        {item.quantity}x {item.item_name}
                      </span>
                      <span className="font-mono text-[#52525B] tabular-nums">₹{item.total_price}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between text-xs font-bold pt-1 border-t border-[#E6E2DA]">
                  <span className="text-[#52525B]">Total Billed:</span>
                  <span className="text-[#111111] font-mono text-sm tabular-nums">
                    ₹{metrics.last_order.final_amount}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#71717A] py-6 text-center italic">
                No orders recorded yet. Counter terminal orders will appear here.
              </p>
            )}
          </div>

          {/* Most Ordered Items */}
          <div className="bg-white border border-[#E6E2DA] rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#E6E2DA]">
              <ShoppingBag className="w-4 h-4 text-[#111111]" />
              <h3 className="font-bold text-[#111111] text-sm font-serif">Top 3 Customer Favorites</h3>
            </div>

            {metrics.most_ordered_items.length > 0 ? (
              <div className="space-y-2.5">
                {metrics.most_ordered_items.map((fav, index) => (
                  <div
                    key={fav.item_name}
                    className="flex items-center justify-between p-3 bg-[#FAF9F6] rounded-xl border border-[#E6E2DA]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-[#F3EFEA] border border-[#E6E2DA] text-[#111111] font-bold text-xs flex items-center justify-center tabular-nums">
                        #{index + 1}
                      </span>
                      <span className="text-xs font-semibold text-[#111111]">{fav.item_name}</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#52525B] tabular-nums">
                      {fav.total_quantity} orders
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#71717A] py-6 text-center italic">
                Favorite items will automatically aggregate as orders are placed.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Order History */}
      {activeTab === 'orders' && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="bg-white border border-[#E6E2DA] rounded-2xl p-8 text-center text-[#71717A] text-xs italic shadow-sm">
              No orders on file for this customer.
            </div>
          ) : (
            orders.map((ord) => (
              <div
                key={ord.id}
                className="bg-white border border-[#E6E2DA] rounded-2xl p-4 shadow-sm space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#111111] tabular-nums">#{ord.order_number}</span>
                    <span className="text-[#E6E2DA]">&bull;</span>
                    <span className="text-[#52525B] tabular-nums">
                      {new Date(ord.created_at).toLocaleString()}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-[#111111] text-sm tabular-nums">
                    ₹{ord.final_amount}
                  </span>
                </div>

                <div className="bg-[#FAF9F6] p-2.5 rounded-xl border border-[#E6E2DA] space-y-1">
                  {ord.items.map((it) => (
                    <div key={it.id} className="flex justify-between text-xs">
                      <span className="text-[#111111] font-medium">
                        {it.quantity}x {it.item_name}
                      </span>
                      <span className="font-mono text-[#52525B] tabular-nums">₹{it.total_price}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#52525B] pt-1">
                  <div>
                    {ord.points_redeemed > 0 && (
                      <span className="text-[#991B1B] mr-2 tabular-nums">
                        Redeemed: -{ord.points_redeemed} pts (₹{ord.discount_amount} off)
                      </span>
                    )}
                    {ord.points_earned > 0 && (
                      <span className="text-[#166534] font-semibold tabular-nums">Earned: +{ord.points_earned} pts</span>
                    )}
                  </div>
                  <span className="text-[#71717A] font-mono tabular-nums">Subtotal: ₹{ord.subtotal}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Points Ledger */}
      {activeTab === 'ledger' && (
        <div className="bg-white border border-[#E6E2DA] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F3EFEA] text-[#52525B] uppercase tracking-wider border-b border-[#E6E2DA] font-bold text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">Points</th>
                  <th className="px-5 py-3.5">Balance After</th>
                  <th className="px-5 py-3.5">Audit Reason</th>
                  <th className="px-5 py-3.5">Staff / Performed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E2DA]">
                {points_ledger.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-[#71717A] italic">
                      No points transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  points_ledger.map((tx) => (
                    <tr key={tx.id} className="hover:bg-[#FAF9F6] transition-colors">
                      <td className="px-5 py-3.5 text-[#52525B] font-mono tabular-nums">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            tx.change_type === 'earn'
                              ? 'bg-[#ECFDF5] text-[#166534] border border-[#BBF7D0]'
                              : tx.change_type === 'redeem'
                              ? 'bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]'
                              : tx.change_type === 'manual_bonus'
                              ? 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]'
                              : 'bg-[#F3EFEA] text-[#111111] border border-[#E6E2DA]'
                          }`}
                        >
                          {tx.change_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td
                        className={`px-5 py-3.5 font-mono font-bold tabular-nums ${
                          tx.points_change >= 0 ? 'text-[#166534]' : 'text-[#991B1B]'
                        }`}
                      >
                        {tx.points_change >= 0 ? `+${tx.points_change}` : tx.points_change} pts
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold text-[#111111] tabular-nums">
                        {tx.balance_after} pts
                      </td>
                      <td className="px-5 py-3.5 text-[#52525B] max-w-xs truncate">
                        {tx.reason || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-[#71717A] text-[11px]">{tx.performed_by}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Replace Card Modal */}
      {showReplaceModal && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#E6E2DA] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E6E2DA]">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#111111]" />
                <h3 className="font-bold text-[#111111] text-base font-serif">Re-link / Replace NFC Card</h3>
              </div>
              <button
                onClick={() => setShowReplaceModal(false)}
                className="text-[#71717A] hover:text-[#111111] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReplaceCard} className="space-y-4">
              <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-[#92400E] text-xs leading-relaxed">
                <strong>Card Protection Policy:</strong> Linking a new card automatically marks any previous membership tag as <strong>BLOCKED</strong>. Points balance and visit history remain 100% safe.
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[#52525B] uppercase tracking-wider">
                    New Card UID *
                  </label>
                  {nfcCaps.hasWebNfc && (
                    <button
                      type="button"
                      onClick={startNfcScan}
                      className="text-xs text-[#166534] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>{nfcScanning ? 'Tap Tag Now...' : 'Scan NFC'}</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. GROVE-001 or 001"
                  value={newCardUid}
                  onChange={(e) => setNewCardUid(e.target.value)}
                  onBlur={() => {
                    if (newCardUid.trim()) {
                      setNewCardUid(normalizeCardInput(newCardUid));
                    }
                  }}
                  className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white font-mono uppercase tabular-nums"
                />
                {nfcCaps.isIos && (
                  <p className="mt-1.5 text-[11px] text-[#52525B] leading-relaxed">
                    <strong>On iPhone:</strong> Tap the new card to the top edge of your iPhone (outside this screen) to open &amp; link it, or type the Card ID printed on the card (e.g., GROVE-001).
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
                  Reason for Replacement
                </label>
                <input
                  type="text"
                  required
                  value={replaceReason}
                  onChange={(e) => setReplaceReason(e.target.value)}
                  placeholder="e.g. Physical card lost or chipped"
                  className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReplaceModal(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-[#52525B] hover:text-[#111111] bg-[#F3EFEA] hover:bg-[#E6E2DA] border border-[#E6E2DA] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReplace}
                  className="min-h-[44px] bg-[#111111] hover:bg-[#262626] disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-xl text-xs shadow-sm cursor-pointer"
                >
                  {submittingReplace ? 'Linking...' : 'Confirm Re-link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bonus Points Modal */}
      {showBonusModal && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#E6E2DA] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E6E2DA]">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-[#111111]" />
                <h3 className="font-bold text-[#111111] text-base font-serif">Adjust Customer Loyalty Points</h3>
              </div>
              <button
                onClick={() => setShowBonusModal(false)}
                className="text-[#71717A] hover:text-[#111111] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBonusPoints} className="space-y-4">
              {currentUser.role === 'staff' ? (
                <div className="p-3 bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl text-[#52525B] text-xs">
                  <strong>Staff Limit:</strong> Maximum allowance of{' '}
                  <strong className="text-[#111111] tabular-nums">{config.staff_max_bonus_points} points</strong> per adjustment. Deductions require Owner authorization.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 p-1 bg-[#F3EFEA] rounded-xl border border-[#E6E2DA]">
                  <button
                    type="button"
                    onClick={() => setBonusAction('add')}
                    className={`min-h-[38px] py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      bonusAction === 'add'
                        ? 'bg-[#111111] text-white shadow-xs'
                        : 'text-[#52525B] hover:text-[#111111]'
                    }`}
                  >
                    + Add Extra Points
                  </button>
                  <button
                    type="button"
                    onClick={() => setBonusAction('deduct')}
                    className={`min-h-[38px] py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      bonusAction === 'deduct'
                        ? 'bg-[#991B1B] text-white shadow-xs'
                        : 'text-[#52525B] hover:text-[#111111]'
                    }`}
                  >
                    - Deduct Points
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
                  Number of Points *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={currentUser.role === 'staff' ? config.staff_max_bonus_points : undefined}
                  placeholder={`e.g. 50 (Worth ₹${((Number(bonusPoints) || 0) * config.point_redeem_value).toFixed(1)})`}
                  value={bonusPoints}
                  onChange={(e) => setBonusPoints(e.target.value)}
                  className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
                  Audit Reason (Mandatory) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Birthday gift, long wait apology"
                  value={bonusReason}
                  onChange={(e) => setBonusReason(e.target.value)}
                  className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white mb-2"
                />

                {/* Preset Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_REASONS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setBonusReason(chip)}
                      className="text-[11px] bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#52525B] hover:text-[#111111] px-2.5 py-1 rounded-md border border-[#E6E2DA] transition-colors cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBonusModal(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-[#52525B] hover:text-[#111111] bg-[#F3EFEA] hover:bg-[#E6E2DA] border border-[#E6E2DA] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBonus}
                  className="min-h-[44px] bg-[#111111] hover:bg-[#262626] disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-xl text-xs shadow-sm cursor-pointer"
                >
                  {submittingBonus ? 'Applying...' : 'Apply Points'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
