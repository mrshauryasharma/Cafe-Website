import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Gift,
  Coins,
  ShieldAlert,
} from 'lucide-react';
import { CafeSettingsRow } from '../../../functions/api/owner/settings';

interface BrandingRulesTabProps {
  onCafeNameChange: (newName: string) => void;
}

export const BrandingRulesTab: React.FC<BrandingRulesTabProps> = ({ onCafeNameChange }) => {
  const [settings, setSettings] = useState<CafeSettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/owner/settings');
      if (!res.ok) throw new Error('Failed to load café settings');
      const data = (await res.json()) as CafeSettingsRow;
      setSettings(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const res = await fetch('/api/owner/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = (await res.json()) as { success?: boolean; settings?: CafeSettingsRow; error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      if (data.settings) {
        setSettings(data.settings);
        onCafeNameChange(data.settings.cafe_name);
      }
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const insertVariableChip = (variable: string) => {
    if (!settings) return;
    const current = settings.sms_template || '';
    setSettings({
      ...settings,
      sms_template: current ? `${current} ${variable}` : variable,
    });
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-[#52525B]">
        <div className="w-8 h-8 border-2 border-[#111111] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm">Loading café settings...</p>
      </div>
    );
  }

  if (!settings) return null;

  // Live simulation calculation
  const sampleBill = 500;
  const calculatedPoints =
    settings.earn_spend_unit > 0
      ? Math.floor((sampleBill / settings.earn_spend_unit) * settings.earn_points_per_unit)
      : 0;
  const sampleRedeemValue = calculatedPoints * settings.point_redeem_value;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-2xl text-[#991B1B] text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-[#ECFDF5] border border-[#BBF7D0] rounded-2xl text-[#166534] text-sm flex items-center gap-2 font-semibold">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* 1. Dynamic Branding */}
      <div className="bg-white border border-[#E6E2DA] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#E6E2DA]">
          <Sparkles className="w-5 h-5 text-[#111111]" />
          <h3 className="font-bold text-[#111111] text-base font-serif">Dynamic Café Branding</h3>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1.5">
            Café Brand Name
          </label>
          <input
            type="text"
            required
            value={settings.cafe_name}
            onChange={(e) => setSettings({ ...settings, cafe_name: e.target.value })}
            placeholder="The Grove Cafe"
            className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-4 py-2.5 text-[#111111] placeholder-[#71717A] focus:outline-none focus:border-[#111111] focus:bg-white transition-colors text-sm"
          />
          <p className="text-xs text-[#71717A] mt-1.5 leading-relaxed">
            Displayed across terminal headers, customer NFC scan screens, digital bills, and SMS notifications.
          </p>
        </div>
      </div>

      {/* 2. Loyalty Rules & Live Calculator */}
      <div className="bg-white border border-[#E6E2DA] rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#E6E2DA]">
          <Coins className="w-5 h-5 text-[#111111]" />
          <h3 className="font-bold text-[#111111] text-base font-serif">Loyalty Program Engine</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1.5">
              Earn Points Amount
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={settings.earn_points_per_unit}
              onChange={(e) =>
                setSettings({ ...settings, earn_points_per_unit: Number(e.target.value) })
              }
              className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-4 py-2.5 text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white text-sm font-mono tabular-nums"
            />
            <p className="text-[11px] text-[#71717A] mt-1">Points awarded</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1.5">
              Per Spend of (₹)
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={settings.earn_spend_unit}
              onChange={(e) =>
                setSettings({ ...settings, earn_spend_unit: Number(e.target.value) })
              }
              className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-4 py-2.5 text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white text-sm font-mono tabular-nums"
            />
            <p className="text-[11px] text-[#71717A] mt-1">Spend threshold</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1.5">
              Redeem Value per Point (₹)
            </label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={settings.point_redeem_value}
              onChange={(e) =>
                setSettings({ ...settings, point_redeem_value: Number(e.target.value) })
              }
              className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-4 py-2.5 text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white text-sm font-mono tabular-nums"
            />
            <p className="text-[11px] text-[#71717A] mt-1">₹ value of 1 point</p>
          </div>
        </div>

        {/* Live Simulation Preview Card */}
        <div className="bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-[#E6E2DA] text-[#111111] flex items-center justify-center font-bold">
              ₹
            </div>
            <div>
              <p className="text-xs text-[#71717A] uppercase font-bold tracking-wider">Live Customer Simulation</p>
              <p className="text-sm font-semibold text-[#111111] tabular-nums mt-0.5">
                ₹{sampleBill} Bill &rarr; <span className="text-[#166534] font-bold">+{calculatedPoints} Points</span> &rarr; Value <span className="text-[#111111] font-bold">₹{sampleRedeemValue.toFixed(1)} Discount</span>
              </p>
            </div>
          </div>
          <span className="text-xs bg-white border border-[#E6E2DA] text-[#52525B] px-3.5 py-1 rounded-full font-mono font-semibold tabular-nums">
            1 pt = ₹{settings.point_redeem_value}
          </span>
        </div>
      </div>

      {/* 3. Safety Guardrails & Staff Limits */}
      <div className="bg-white border border-[#E6E2DA] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#E6E2DA]">
          <Gift className="w-5 h-5 text-[#111111]" />
          <h3 className="font-bold text-[#111111] text-base font-serif">Redemption Guardrails & Staff Limits</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1.5">
              Min Bill For Redemption (₹)
            </label>
            <input
              type="number"
              min="0"
              value={settings.min_bill_for_redeem}
              onChange={(e) =>
                setSettings({ ...settings, min_bill_for_redeem: Number(e.target.value) })
              }
              className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-4 py-2.5 text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white text-sm font-mono tabular-nums"
            />
            <p className="text-[11px] text-[#71717A] mt-1">0 = no minimum required</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1.5">
              Max Bill Redeem (%)
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={settings.max_redeem_percent}
              onChange={(e) =>
                setSettings({ ...settings, max_redeem_percent: Number(e.target.value) })
              }
              className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-4 py-2.5 text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white text-sm font-mono tabular-nums"
            />
            <p className="text-[11px] text-[#71717A] mt-1">E.g., 50% max points coverage</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1.5">
              Staff Max Bonus Points
            </label>
            <input
              type="number"
              min="0"
              value={settings.staff_max_bonus_points}
              onChange={(e) =>
                setSettings({ ...settings, staff_max_bonus_points: Number(e.target.value) })
              }
              className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-4 py-2.5 text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white text-sm font-mono tabular-nums"
            />
            <p className="text-[11px] text-[#71717A] mt-1">Max manual points staff can grant</p>
          </div>
        </div>
      </div>

      {/* 4. SMS Webhook / Gateway Settings */}
      <div className="bg-white border border-[#E6E2DA] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E6E2DA]">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5 text-[#111111]" />
            <h3 className="font-bold text-[#111111] text-base font-serif">SMS Notification Gateway</h3>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.sms_enabled === 1}
              onChange={(e) =>
                setSettings({ ...settings, sms_enabled: e.target.checked ? 1 : 0 })
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-[#E6E2DA] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#E6E2DA] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#111111]"></div>
          </label>
        </div>

        {settings.sms_enabled === 1 ? (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1.5">
                  SMS Gateway API Key
                </label>
                <input
                  type="password"
                  value={settings.sms_api_key || ''}
                  onChange={(e) => setSettings({ ...settings, sms_api_key: e.target.value })}
                  placeholder="Enter SMS Provider Secret / Key"
                  className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-4 py-2.5 text-[#111111] text-sm focus:outline-none focus:border-[#111111] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1.5">
                  Sender ID / Header
                </label>
                <input
                  type="text"
                  value={settings.sms_sender_id || ''}
                  onChange={(e) => setSettings({ ...settings, sms_sender_id: e.target.value })}
                  placeholder="e.g. GROVEC"
                  className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-4 py-2.5 text-[#111111] text-sm focus:outline-none focus:border-[#111111] focus:bg-white uppercase font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1.5">
                Post-Bill SMS Template
              </label>
              <textarea
                rows={3}
                value={
                  settings.sms_template ||
                  'Thank you for visiting {{cafe_name}}! Bill: ₹{{bill_amount}}. You earned {{points_earned}} points! Current Balance: {{points_balance}} pts.'
                }
                onChange={(e) => setSettings({ ...settings, sms_template: e.target.value })}
                className="w-full bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-4 py-2.5 text-[#111111] text-sm focus:outline-none focus:border-[#111111] focus:bg-white font-mono"
              />

              {/* Clickable variable chips */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-xs text-[#52525B] mr-1">Insert variable:</span>
                {[
                  '{{cafe_name}}',
                  '{{bill_amount}}',
                  '{{points_earned}}',
                  '{{points_balance}}',
                  '{{customer_name}}',
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => insertVariableChip(chip)}
                    className="text-xs bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] border border-[#E6E2DA] rounded-lg px-2.5 py-1 transition-colors font-mono cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-[#71717A] py-1 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#71717A]" />
            SMS notifications disabled. Toggle on to configure automatic post-checkout customer SMS.
          </p>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] bg-[#111111] hover:bg-[#262626] disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-2 text-sm cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>
    </form>
  );
};
