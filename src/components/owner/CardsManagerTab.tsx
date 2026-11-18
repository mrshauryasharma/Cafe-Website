import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  Upload,
  Search,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Radio,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';
import { CardRow } from '../../../functions/api/owner/cards';

interface CardCounts {
  total: number;
  unassigned: number;
  active: number;
  blocked: number;
}

export const CardsManagerTab: React.FC = () => {
  const [cards, setCards] = useState<CardRow[]>([]);
  const [counts, setCounts] = useState<CardCounts>({ total: 0, unassigned: 0, active: 0, blocked: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unassigned' | 'active' | 'blocked'>('all');

  // Bulk Upload Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [submittingBulk, setSubmittingBulk] = useState(false);

  // Block Modal
  const [blockingCard, setBlockingCard] = useState<CardRow | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [submittingBlock, setSubmittingBlock] = useState(false);

  // Web NFC Reader State
  const [nfcScanning, setNfcScanning] = useState(false);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [scannedUids, setScannedUids] = useState<string[]>([]);

  useEffect(() => {
    setNfcSupported('NDEFReader' in window);
  }, []);

  const fetchCards = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/owner/cards?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch cards');
      const data = (await res.json()) as { counts: CardCounts; cards: CardRow[] };

      setCounts(data.counts);
      setCards(data.cards);
    } catch (err: any) {
      setError(err.message || 'Error fetching cards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCards();
  };

  const handleBulkUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedFromInput = bulkInput
      .split(/[\r\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const combined = Array.from(new Set([...parsedFromInput, ...scannedUids]));

    if (combined.length === 0) {
      setError('Please provide at least one Card UID.');
      return;
    }

    setSubmittingBulk(true);

    try {
      const res = await fetch('/api/owner/cards/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: combined }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        insertedCount?: number;
        duplicateCount?: number;
        error?: string;
      };

      if (!res.ok) throw new Error(data.error || 'Failed to upload cards');

      setSuccess(
        `Bulk Import Complete: ${data.insertedCount} new cards added (${data.duplicateCount} existing skipped).`
      );
      setShowBulkModal(false);
      setBulkInput('');
      setScannedUids([]);
      fetchCards();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Bulk upload failed');
    } finally {
      setSubmittingBulk(false);
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setBulkInput((prev) => (prev ? `${prev}\n${text}` : text));
      }
    };
    reader.readAsText(file);
  };

  const startWebNfcScan = async () => {
    if (!('NDEFReader' in window)) {
      alert('Web NFC is not supported on this browser or platform (Supported on Android Chrome).');
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
          const uid = serialNumber.replace(/:/g, '').toUpperCase();
          setScannedUids((prev) => Array.from(new Set([...prev, uid])));
        }
      });
    } catch (err: any) {
      console.error('NFC error:', err);
      alert(`NFC Scan error: ${err.message || 'Permission denied or unsupported'}`);
      setNfcScanning(false);
    }
  };

  const handleBlockCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockingCard) return;
    setError(null);
    setSubmittingBlock(true);

    try {
      const res = await fetch(`/api/owner/cards/${blockingCard.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'block', blocked_reason: blockReason.trim() }),
      });

      const data = (await res.json()) as CardRow & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to block card');

      setCards((prev) => prev.map((c) => (c.id === blockingCard.id ? data : c)));
      setBlockingCard(null);
      setBlockReason('');
      fetchCards();
      setSuccess(`Card ${data.card_uid} has been blocked.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error blocking card');
    } finally {
      setSubmittingBlock(false);
    }
  };

  const handleUnblockCard = async (card: CardRow) => {
    setError(null);
    try {
      const res = await fetch(`/api/owner/cards/${card.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unblock' }),
      });

      const data = (await res.json()) as CardRow & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to unblock card');

      setCards((prev) => prev.map((c) => (c.id === card.id ? data : c)));
      fetchCards();
      setSuccess(`Card ${data.card_uid} is unblocked (${data.status}).`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error unblocking card');
    }
  };

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

      {/* 1. 4 KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-[#E6E2DA] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[#52525B] text-xs font-bold uppercase mb-1">
            <CreditCard className="w-4 h-4 text-[#111111]" />
            <span>Total Cards</span>
          </div>
          <p className="text-2xl font-bold text-[#111111] font-mono tabular-nums">{counts.total}</p>
          <p className="text-[11px] text-[#71717A] mt-0.5">Provisioned inventory</p>
        </div>

        <div className="bg-white border border-[#E6E2DA] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[#52525B] text-xs font-bold uppercase mb-1">
            <FileText className="w-4 h-4 text-[#111111]" />
            <span>Unassigned</span>
          </div>
          <p className="text-2xl font-bold text-[#111111] font-mono tabular-nums">{counts.unassigned}</p>
          <p className="text-[11px] text-[#71717A] mt-0.5">Blank tags in drawer</p>
        </div>

        <div className="bg-white border border-[#E6E2DA] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[#166534] text-xs font-bold uppercase mb-1">
            <UserCheck className="w-4 h-4" />
            <span>Active Linked</span>
          </div>
          <p className="text-2xl font-bold text-[#166534] font-mono tabular-nums">{counts.active}</p>
          <p className="text-[11px] text-[#71717A] mt-0.5">In customer wallets</p>
        </div>

        <div className="bg-white border border-[#E6E2DA] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[#991B1B] text-xs font-bold uppercase mb-1">
            <ShieldAlert className="w-4 h-4" />
            <span>Blocked</span>
          </div>
          <p className="text-2xl font-bold text-[#991B1B] font-mono tabular-nums">{counts.blocked}</p>
          <p className="text-[11px] text-[#71717A] mt-0.5">Reported lost/chipped</p>
        </div>
      </div>

      {/* 2. Controls & Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#71717A]" />
          <input
            type="text"
            placeholder="Search by Card UID, Customer Name, or Phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-[44px] bg-white border border-[#E6E2DA] rounded-xl pl-10 pr-4 py-2 text-sm text-[#111111] placeholder-[#71717A] focus:outline-none focus:border-[#111111] shadow-2xs transition-colors"
          />
        </form>

        <button
          onClick={() => setShowBulkModal(true)}
          className="min-h-[44px] bg-[#111111] hover:bg-[#262626] text-white font-semibold px-5 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-xs transition-all whitespace-nowrap cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>Bulk Import Cards</span>
        </button>
      </div>

      {/* Status Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {(['all', 'unassigned', 'active', 'blocked'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-xl font-semibold capitalize transition-all whitespace-nowrap cursor-pointer ${
              statusFilter === filter
                ? 'bg-[#111111] text-white shadow-xs'
                : 'bg-white text-[#52525B] hover:text-[#111111] border border-[#E6E2DA]'
            }`}
          >
            {filter} ({filter === 'all' ? counts.total : counts[filter]})
          </button>
        ))}
      </div>

      {/* Cards Table */}
      {loading ? (
        <div className="p-16 text-center text-[#52525B]">
          <div className="w-8 h-8 border-2 border-[#111111] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm font-medium">Loading cards inventory...</p>
        </div>
      ) : cards.length === 0 ? (
        <div className="bg-white border border-[#E6E2DA] rounded-2xl p-10 text-center text-[#52525B] shadow-sm">
          <CreditCard className="w-10 h-10 mx-auto text-[#71717A] mb-2" />
          <p className="text-base font-semibold text-[#111111] font-serif">No NFC cards found</p>
          <p className="text-xs text-[#71717A] mt-1 max-w-sm mx-auto">
            {search
              ? 'No cards match your query.'
              : 'Bulk import your first pack of blank NFC tags to get started.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#E6E2DA] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F3EFEA] text-[#52525B] uppercase tracking-wider border-b border-[#E6E2DA] font-bold text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Card UID</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Linked Customer</th>
                  <th className="px-5 py-3.5">Phone</th>
                  <th className="px-5 py-3.5">Assigned Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E2DA]">
                {cards.map((card) => (
                  <tr key={card.id} className="hover:bg-[#FAF9F6] transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-[#111111] text-xs tabular-nums">
                      {card.card_uid}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          card.status === 'active'
                            ? 'bg-[#ECFDF5] text-[#166534] border border-[#BBF7D0]'
                            : card.status === 'unassigned'
                            ? 'bg-[#F3EFEA] text-[#111111] border border-[#E6E2DA]'
                            : 'bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]'
                        }`}
                      >
                        {card.status}
                      </span>
                      {card.blocked_reason && (
                        <p className="text-[10px] text-[#991B1B] mt-0.5 italic">{card.blocked_reason}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-[#111111] font-medium font-serif">
                      {card.customer_name || <span className="text-[#71717A] italic text-xs font-sans">Unassigned</span>}
                    </td>
                    <td className="px-5 py-4 font-mono text-[#52525B] tabular-nums">
                      {card.customer_phone || '—'}
                    </td>
                    <td className="px-5 py-4 text-[#71717A] font-mono text-[11px] tabular-nums">
                      {card.assigned_at ? new Date(card.assigned_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {card.status === 'blocked' ? (
                        <button
                          type="button"
                          onClick={() => handleUnblockCard(card)}
                          className="px-3 py-1 bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] rounded-lg text-xs font-semibold inline-flex items-center gap-1 border border-[#E6E2DA] transition-colors cursor-pointer"
                        >
                          <Unlock className="w-3 h-3 text-[#166534]" />
                          <span>Unblock</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setBlockingCard(card);
                            setBlockReason('');
                          }}
                          className="px-3 py-1 bg-white hover:bg-[#FEF2F2] text-[#71717A] hover:text-[#991B1B] rounded-lg text-xs font-semibold inline-flex items-center gap-1 border border-[#E6E2DA] hover:border-[#FECACA] transition-colors cursor-pointer"
                        >
                          <Lock className="w-3 h-3" />
                          <span>Block</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white border border-[#E6E2DA] rounded-2xl p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E2DA]">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#111111]" />
                <h3 className="font-bold text-[#111111] text-base font-serif">Bulk Provision NFC Cards</h3>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="text-[#71717A] hover:text-[#111111] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1.5">
                  Paste Card UIDs (One per line or comma-separated)
                </label>
                <textarea
                  rows={5}
                  required={scannedUids.length === 0}
                  placeholder={`04A1B2C3D4\n04E5F6G7H8\n0411223344`}
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl p-3 text-xs text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white font-mono uppercase tabular-nums resize-none"
                />
              </div>

              {/* CSV Upload & Web NFC Tap Helper */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl text-center">
                  <p className="text-xs font-semibold text-[#111111] mb-1">Import from CSV / TXT</p>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleCsvFileUpload}
                    className="hidden"
                    id="csv-file-upload"
                  />
                  <label
                    htmlFor="csv-file-upload"
                    className="inline-block mt-1 px-3 py-1.5 bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] text-xs font-semibold rounded-lg cursor-pointer transition-colors border border-[#E6E2DA]"
                  >
                    Browse File
                  </label>
                </div>

                <div className="p-3 bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl text-center flex flex-col items-center justify-between">
                  <p className="text-xs font-semibold text-[#111111]">Rapid Web NFC Tap</p>
                  {nfcSupported ? (
                    <button
                      type="button"
                      onClick={startWebNfcScan}
                      className="mt-1 px-3 py-1.5 bg-[#111111] hover:bg-[#262626] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <Radio className={`w-3.5 h-3.5 ${nfcScanning ? 'animate-spin' : ''}`} />
                      <span>{nfcScanning ? 'Listening...' : 'Tap Physical Tags'}</span>
                    </button>
                  ) : (
                    <p className="text-[11px] text-[#71717A] mt-1">Available on Android Chrome</p>
                  )}
                </div>
              </div>

              {/* Scanned UIDs chips preview */}
              {scannedUids.length > 0 && (
                <div className="p-3 bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-[#166534]">
                      {scannedUids.length} Tags Tapped:
                    </span>
                    <button
                      type="button"
                      onClick={() => setScannedUids([])}
                      className="text-[11px] text-[#991B1B] hover:underline cursor-pointer"
                    >
                      Clear Tapped
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                    {scannedUids.map((uid) => (
                      <span
                        key={uid}
                        className="bg-white border border-[#E6E2DA] text-[11px] font-mono px-2 py-0.5 rounded text-[#111111] tabular-nums"
                      >
                        {uid}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-[#52525B] hover:text-[#111111] bg-[#F3EFEA] hover:bg-[#E6E2DA] border border-[#E6E2DA] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBulk}
                  className="min-h-[44px] bg-[#111111] hover:bg-[#262626] disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-xl text-xs shadow-sm cursor-pointer"
                >
                  {submittingBulk ? 'Provisioning...' : 'Provision Cards'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Block Card Modal */}
      {blockingCard && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#E6E2DA] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E6E2DA]">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#991B1B]" />
                <h3 className="font-bold text-[#111111] text-base font-serif">
                  Block NFC Tag {blockingCard.card_uid}
                </h3>
              </div>
              <button
                onClick={() => setBlockingCard(null)}
                className="text-[#71717A] hover:text-[#111111] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBlockCard} className="space-y-4">
              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-[#991B1B] text-xs leading-relaxed">
                <strong>Security Impact:</strong> This card will immediately be rejected at counter terminals. Any linked customer profile and loyalty points remain intact.
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
                  Reason for Blocking (Required)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Reported lost by customer, chipped tag"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBlockingCard(null)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-[#52525B] hover:text-[#111111] bg-[#F3EFEA] hover:bg-[#E6E2DA] border border-[#E6E2DA] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBlock}
                  className="min-h-[44px] bg-[#991B1B] hover:bg-[#7F1D1D] disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-xl text-xs shadow-sm cursor-pointer"
                >
                  {submittingBlock ? 'Blocking...' : 'Confirm Block'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
