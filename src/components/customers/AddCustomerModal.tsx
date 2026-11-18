import React, { useEffect, useState } from 'react';
import { UserPlus, X, Radio, AlertCircle } from 'lucide-react';
import { CustomerSummaryRow } from '../../../functions/api/customers/index';

interface AddCustomerModalProps {
  onClose: () => void;
  onCustomerAdded: (newCustomer: CustomerSummaryRow) => void;
}

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({ onClose, onCustomerAdded }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [notes, setNotes] = useState('');
  const [smsConsent, setSmsConsent] = useState(true);
  const [cardUid, setCardUid] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Web NFC scanner state
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcScanning, setNfcScanning] = useState(false);

  useEffect(() => {
    setNfcSupported('NDEFReader' in window);
  }, []);

  const startNfcScan = async () => {
    if (!('NDEFReader' in window)) {
      alert('Web NFC is only supported on Android Chrome or supported handheld browsers.');
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
          setCardUid(uid);
          setNfcScanning(false);
        }
      });
    } catch (err: any) {
      console.error('NFC Scan failed:', err);
      alert(`NFC Scan error: ${err.message || 'Permission denied or NFC off'}`);
      setNfcScanning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          dob: dob.trim() || undefined,
          notes: notes.trim() || undefined,
          sms_consent: smsConsent ? 1 : 0,
          card_uid: cardUid.trim() || undefined,
        }),
      });

      const data = (await res.json()) as { success?: boolean; customer?: CustomerSummaryRow; error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to create customer');

      if (data.customer) {
        onCustomerAdded(data.customer);
      }
    } catch (err: any) {
      setError(err.message || 'Error registering customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-[#E6E2DA] rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E6E2DA]">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#111111]" />
            <h3 className="font-bold text-[#111111] text-lg font-serif">Register New Customer</h3>
          </div>
          <button onClick={onClose} className="text-[#71717A] hover:text-[#111111] cursor-pointer p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-[#991B1B] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
              Customer Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ananya Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-sm text-[#111111] placeholder-[#71717A] focus:outline-none focus:border-[#111111] focus:bg-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
              Phone Number *
            </label>
            <input
              type="tel"
              required
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-sm text-[#111111] placeholder-[#71717A] focus:outline-none focus:border-[#111111] focus:bg-white font-mono tabular-nums transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[#52525B] uppercase tracking-wider">
                NFC Membership Card UID (Optional)
              </label>
              {nfcSupported && (
                <button
                  type="button"
                  onClick={startNfcScan}
                  className="text-xs text-[#166534] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>{nfcScanning ? 'Listening...' : 'Tap Card Now'}</span>
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder="e.g. 04A1B2C3D4 or scan physical card"
              value={cardUid}
              onChange={(e) => setCardUid(e.target.value)}
              className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-sm text-[#111111] placeholder-[#71717A] font-mono uppercase focus:outline-none focus:border-[#111111] focus:bg-white tabular-nums transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
                Date of Birth (Optional)
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3 py-2 text-xs text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
              />
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-[#111111] font-semibold">
                <input
                  type="checkbox"
                  checked={smsConsent}
                  onChange={(e) => setSmsConsent(e.target.checked)}
                  className="w-4 h-4 rounded text-[#111111] accent-[#111111] border-[#E6E2DA]"
                />
                <span>SMS Notifications Consent</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
              Staff Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Prefers oat milk, regular morning coffee drinker"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2 text-xs text-[#111111] placeholder-[#71717A] focus:outline-none focus:border-[#111111] focus:bg-white resize-none"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#52525B] hover:text-[#111111] font-semibold rounded-xl text-xs transition-colors cursor-pointer border border-[#E6E2DA]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="min-h-[44px] px-5 py-2 bg-[#111111] hover:bg-[#262626] disabled:opacity-50 text-white font-semibold rounded-xl text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>{loading ? 'Registering...' : 'Register Customer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
