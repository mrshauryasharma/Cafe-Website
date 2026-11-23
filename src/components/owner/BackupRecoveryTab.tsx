import React, { useEffect, useState } from 'react';
import {
  DownloadCloud,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Database,
  Calendar,
  X,
} from 'lucide-react';
import { CafeSettingsRow } from '../../../functions/api/owner/settings';

export const BackupRecoveryTab: React.FC = () => {
  const [settings, setSettings] = useState<CafeSettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // File restore state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [backupPreview, setBackupPreview] = useState<{
    version?: string;
    exported_at?: string;
    counts: {
      users: number;
      menu_items: number;
      customers: number;
      nfc_cards: number;
      orders: number;
    };
    rawPayload: any;
  } | null>(null);

  const [showConfirmRestoreModal, setShowConfirmRestoreModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/owner/settings');
      if (!res.ok) throw new Error('Failed to load backup status');
      const data = (await res.json()) as CafeSettingsRow;
      setSettings(data);
    } catch (err: any) {
      setError(err.message || 'Error loading settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Compute days since last backup
  let daysSinceBackup: number | null = null;
  let isBackupOverdue = true;

  if (settings?.last_backup_at) {
    const lastDate = new Date(settings.last_backup_at).getTime();
    const diffMs = Date.now() - lastDate;
    daysSinceBackup = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    isBackupOverdue = daysSinceBackup >= 30;
  }

  const handleExportBackup = async () => {
    setError(null);
    setExporting(true);

    try {
      const res = await fetch('/api/owner/backup/export');
      if (!res.ok) {
        const errData = (await res.json()) as { error?: string };
        throw new Error(errData.error || 'Failed to export backup');
      }

      const blob = await res.blob();
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `kimmos-kitchen-backup-${dateStr}.json`;

      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setSuccess('Monthly backup downloaded successfully!');
      fetchSettings();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Error downloading backup');
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setError('Please select a valid .json backup file.');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.data) {
          throw new Error('Missing "data" object in backup file');
        }

        setBackupPreview({
          version: parsed.version || '1.0',
          exported_at: parsed.exported_at,
          counts: {
            users: parsed.data.users?.length || 0,
            menu_items: parsed.data.menu_items?.length || 0,
            customers: parsed.data.customers?.length || 0,
            nfc_cards: parsed.data.nfc_cards?.length || 0,
            orders: parsed.data.orders?.length || 0,
          },
          rawPayload: parsed,
        });
      } catch (err: any) {
        setError(`Corrupt or invalid backup file: ${err.message}`);
        setSelectedFile(null);
        setBackupPreview(null);
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreSubmit = async () => {
    if (!backupPreview?.rawPayload) return;
    setError(null);
    setRestoring(true);

    try {
      const res = await fetch('/api/owner/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backupPreview.rawPayload),
      });

      const data = (await res.json()) as { error?: string; success?: boolean; message?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to restore database');

      setShowConfirmRestoreModal(false);
      setSelectedFile(null);
      setBackupPreview(null);
      setConfirmInput('');
      setSuccess('Database successfully restored from backup! Refreshing system...');

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Error restoring database');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback Alerts */}
      {error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-2xl text-[#991B1B] text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
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

      {/* 1. Monthly Backup Status Card */}
      <div className="bg-white border border-[#E6E2DA] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold ${
                isBackupOverdue
                  ? 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]'
                  : 'bg-[#ECFDF5] text-[#166534] border border-[#BBF7D0]'
              }`}
            >
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-[#111111] font-serif">Monthly Disaster Recovery Backup</h3>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                    isBackupOverdue
                      ? 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]'
                      : 'bg-[#ECFDF5] text-[#166534] border border-[#BBF7D0]'
                  }`}
                >
                  {isBackupOverdue ? 'Backup Due' : 'Up-to-Date'}
                </span>
              </div>
              <p className="text-xs text-[#52525B] mt-1 flex items-center gap-1.5 tabular-nums">
                <Clock className="w-3.5 h-3.5 text-[#71717A]" />
                <span>
                  {settings?.last_backup_at
                    ? `Last backed up: ${new Date(settings.last_backup_at).toLocaleString()} (${daysSinceBackup} days ago)`
                    : 'No backup downloaded yet.'}
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={handleExportBackup}
            disabled={exporting || loading}
            className="min-h-[44px] bg-[#111111] hover:bg-[#262626] disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all whitespace-nowrap self-start sm:self-auto cursor-pointer"
          >
            <DownloadCloud className="w-4 h-4" />
            <span>{exporting ? 'Generating JSON...' : 'Download Monthly Backup (.json)'}</span>
          </button>
        </div>

        {isBackupOverdue && (
          <div className="p-3.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-[#92400E] text-xs flex items-start gap-2.5 leading-relaxed">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Recommendation:</strong> Download your monthly snapshot to a secure local folder or external drive. It bundles all café settings, customer loyalty records, orders, cards, and staff accounts.
            </span>
          </div>
        )}
      </div>

      {/* 2. In-Place Disaster Recovery Restore Card */}
      <div className="bg-white border border-[#E6E2DA] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#E6E2DA]">
          <UploadCloud className="w-5 h-5 text-[#111111]" />
          <div>
            <h3 className="font-bold text-[#111111] text-base font-serif">In-Place Database Recovery & Restore</h3>
            <p className="text-xs text-[#52525B]">
              Restore an exported backup bundle to replace all active records atomically
            </p>
          </div>
        </div>

        {/* File Dropzone / Picker */}
        <div className="border-2 border-dashed border-[#E6E2DA] hover:border-[#111111] rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors text-center bg-[#FAF9F6]">
          <Database className="w-10 h-10 text-[#71717A] mb-2" />
          <p className="text-sm font-semibold text-[#111111]">
            {selectedFile ? selectedFile.name : 'Select or drop backup file (.json)'}
          </p>
          <p className="text-xs text-[#71717A] mt-1 tabular-nums">
            {selectedFile
              ? `${(selectedFile.size / 1024).toFixed(1)} KB`
              : 'Owner backup exported from this or previous installation'}
          </p>
          <input
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
            id="restore-file-input"
          />
          <label
            htmlFor="restore-file-input"
            className="mt-3 inline-block min-h-[44px] leading-[44px] px-5 bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] text-xs font-semibold rounded-xl cursor-pointer transition-colors border border-[#E6E2DA]"
          >
            Browse File
          </label>
        </div>

        {/* File Inspection / Preview Panel */}
        {backupPreview && (
          <div className="p-4 bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[#52525B] pb-2 border-b border-[#E6E2DA] gap-1">
              <span>Format: Version {backupPreview.version}</span>
              <span className="flex items-center gap-1 font-mono tabular-nums">
                <Calendar className="w-3.5 h-3.5 text-[#71717A]" />
                Exported: {backupPreview.exported_at ? new Date(backupPreview.exported_at).toLocaleString() : 'Unknown'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-[#E6E2DA]">
                <p className="text-[10px] text-[#71717A] uppercase font-bold">Users</p>
                <p className="font-mono font-bold text-[#111111] text-sm tabular-nums">{backupPreview.counts.users}</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-[#E6E2DA]">
                <p className="text-[10px] text-[#71717A] uppercase font-bold">Menu</p>
                <p className="font-mono font-bold text-[#111111] text-sm tabular-nums">{backupPreview.counts.menu_items}</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-[#E6E2DA]">
                <p className="text-[10px] text-[#71717A] uppercase font-bold">Customers</p>
                <p className="font-mono font-bold text-[#111111] text-sm tabular-nums">{backupPreview.counts.customers}</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-[#E6E2DA]">
                <p className="text-[10px] text-[#71717A] uppercase font-bold">Cards</p>
                <p className="font-mono font-bold text-[#111111] text-sm tabular-nums">{backupPreview.counts.nfc_cards}</p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-[#E6E2DA] col-span-2 sm:col-span-1">
                <p className="text-[10px] text-[#71717A] uppercase font-bold">Orders</p>
                <p className="font-mono font-bold text-[#111111] text-sm tabular-nums">{backupPreview.counts.orders}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setConfirmInput('');
                setShowConfirmRestoreModal(true);
              }}
              className="w-full min-h-[44px] mt-2 bg-[#991B1B] hover:bg-[#7F1D1D] text-white font-semibold py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Review & Restore Database</span>
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Safety Modal */}
      {showConfirmRestoreModal && backupPreview && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#E6E2DA] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E2DA]">
              <div className="flex items-center gap-2 text-[#991B1B]">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <h3 className="font-bold text-base font-serif">Confirm Destructive Restore</h3>
              </div>
              <button
                onClick={() => setShowConfirmRestoreModal(false)}
                className="text-[#71717A] hover:text-[#111111] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#52525B] leading-relaxed">
              This operation will purge the existing local database and atomically re-populate all 8 tables with records from the chosen backup snapshot.
            </p>

            <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-[#991B1B] text-xs">
              To confirm this action, please type <strong>RESTORE</strong> below:
            </div>

            <input
              type="text"
              placeholder="RESTORE"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#991B1B] font-mono tracking-widest text-center"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmRestoreModal(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-[#52525B] hover:text-[#111111] bg-[#F3EFEA] hover:bg-[#E6E2DA] border border-[#E6E2DA] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmInput !== 'RESTORE' || restoring}
                onClick={handleRestoreSubmit}
                className="min-h-[44px] bg-[#991B1B] hover:bg-[#7F1D1D] disabled:opacity-40 text-white font-semibold px-5 py-2 rounded-xl text-xs shadow-xs transition-all cursor-pointer"
              >
                {restoring ? 'Restoring Database...' : 'Execute Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
