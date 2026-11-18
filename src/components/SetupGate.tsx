import React, { useState } from 'react';
import { Coffee, ShieldCheck, UploadCloud, AlertCircle, CheckCircle2 } from 'lucide-react';
import { User } from '../types';

interface SetupGateProps {
  onSetupComplete: (user: User, cafeName: string) => void;
  onRestoreComplete: () => void;
}

export const SetupGate: React.FC<SetupGateProps> = ({ onSetupComplete, onRestoreComplete }) => {
  const [activeTab, setActiveTab] = useState<'fresh' | 'restore'>('fresh');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fresh setup state prefilled with "The Grove Cafe"
  const [cafeName, setCafeName] = useState('The Grove Cafe');
  const [ownerName, setOwnerName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Restore state
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupContent, setBackupContent] = useState<string | null>(null);

  const handleFreshSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/setup/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cafe_name: cafeName.trim() || 'The Grove Cafe',
          name: ownerName.trim(),
          username: username.trim(),
          password,
        }),
      });

      const data = (await res.json()) as { error?: string; user?: User; cafe_name?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize system');
      }

      if (!data.user) {
        throw new Error('User record missing in response');
      }

      onSetupComplete(data.user, data.cafe_name || 'The Grove Cafe');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setError('Please select a valid JSON backup file.');
      return;
    }

    setBackupFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setBackupContent(event.target?.result as string);
    };
    reader.onerror = () => {
      setError('Failed to read file content.');
    };
    reader.readAsText(file);
  };

  const handleRestoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupContent) {
      setError('Please select a backup file first.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      let parsed;
      try {
        parsed = JSON.parse(backupContent);
      } catch {
        throw new Error('Invalid JSON file format.');
      }

      const res = await fetch('/api/setup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Failed to restore backup');
      }

      setSuccessMessage(data.message || 'Database restored successfully! Loading login screen...');
      setTimeout(() => {
        onRestoreComplete();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Restore failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#FAF9F6]">
      <div className="max-w-md w-full bg-white border border-[#E6E2DA] rounded-2xl p-6 sm:p-8 shadow-sm">
        {/* Branding Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-14 h-14 bg-[#F3EFEA] border border-[#E6E2DA] text-[#111111] rounded-2xl flex items-center justify-center mb-3">
            <Coffee className="w-7 h-7 text-[#111111]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight font-serif">
            The Grove Cafe
          </h1>
          <p className="text-xs uppercase tracking-widest text-[#52525B] mt-1 font-sans font-medium">
            System Initialization & Master Gate
          </p>
          <p className="text-sm text-[#71717A] mt-2">
            Configure your master owner credentials to launch your private counter terminal.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-[#F3EFEA] rounded-xl mb-6 border border-[#E6E2DA]">
          <button
            type="button"
            onClick={() => {
              setActiveTab('fresh');
              setError(null);
            }}
            className={`min-h-[44px] py-2 px-3 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'fresh'
                ? 'bg-[#111111] text-white shadow-sm'
                : 'text-[#52525B] hover:text-[#111111] hover:bg-white/60'
            }`}
          >
            <span>Fresh Setup</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('restore');
              setError(null);
            }}
            className={`min-h-[44px] py-2 px-3 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'restore'
                ? 'bg-[#111111] text-white shadow-sm'
                : 'text-[#52525B] hover:text-[#111111] hover:bg-white/60'
            }`}
          >
            <span>Restore Backup</span>
          </button>
        </div>

        {/* Error / Success Feedback */}
        {error && (
          <div className="mb-4 p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-[#991B1B] text-sm flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3.5 bg-[#ECFDF5] border border-[#BBF7D0] rounded-xl text-[#166534] text-sm flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {/* Fresh Setup Tab */}
        {activeTab === 'fresh' && (
          <form onSubmit={handleFreshSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1.5">
                Café Brand Name
              </label>
              <input
                type="text"
                required
                placeholder="The Grove Cafe"
                value={cafeName}
                onChange={(e) => setCafeName(e.target.value)}
                className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-base text-[#111111] placeholder-[#71717A] focus:outline-none focus:border-[#111111] focus:bg-white transition-colors"
              />
              <p className="text-[12px] text-[#71717A] mt-1">
                Editable anytime from the Owner Settings dashboard.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1.5">
                Owner Full Name
              </label>
              <input
                type="text"
                required
                placeholder="Enter your full name"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-base text-[#111111] placeholder-[#71717A] focus:outline-none focus:border-[#111111] focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1.5">
                Owner Username
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                placeholder="e.g. owner or grove_admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-base text-[#111111] placeholder-[#71717A] focus:outline-none focus:border-[#111111] focus:bg-white transition-colors lowercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1.5">
                Master Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-base text-[#111111] placeholder-[#71717A] focus:outline-none focus:border-[#111111] focus:bg-white transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] mt-3 bg-[#111111] hover:bg-[#262626] disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-5 h-5" />
              <span>{loading ? 'Initializing Terminal...' : 'Create Owner Account'}</span>
            </button>
          </form>
        )}

        {/* Restore Backup Tab */}
        {activeTab === 'restore' && (
          <form onSubmit={handleRestoreSubmit} className="space-y-4">
            <div className="border-2 border-dashed border-[#E6E2DA] hover:border-[#111111] rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors text-center bg-[#FAF9F6]">
              <UploadCloud className="w-10 h-10 text-[#52525B] mb-2" />
              <p className="text-sm font-semibold text-[#111111]">
                {backupFile ? backupFile.name : 'Upload disaster recovery backup (.json)'}
              </p>
              <p className="text-xs text-[#71717A] mt-1 tabular-nums">
                {backupFile
                  ? `${(backupFile.size / 1024).toFixed(1)} KB`
                  : 'Select an owner-exported monthly backup file'}
              </p>
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
                id="backup-file-input"
              />
              <label
                htmlFor="backup-file-input"
                className="mt-3 inline-block min-h-[44px] leading-[44px] px-5 bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] text-xs font-semibold rounded-xl cursor-pointer transition-colors border border-[#E6E2DA]"
              >
                Browse File
              </label>
            </div>

            <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-[#92400E] text-xs leading-relaxed">
              <strong>Notice:</strong> Restoring will atomically populate café settings, menu items, customers, cards, and staff accounts.
            </div>

            <button
              type="submit"
              disabled={loading || !backupFile}
              className="w-full min-h-[44px] mt-2 bg-[#111111] hover:bg-[#262626] disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <UploadCloud className="w-5 h-5" />
              <span>{loading ? 'Restoring Database...' : 'Restore Full Database'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
