import React, { useEffect, useState } from 'react';
import {
  UserPlus,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  X,
  ToggleLeft,
  ToggleRight,
  Clock,
} from 'lucide-react';
import { UserSummary } from '../../../functions/api/owner/staff';

export const StaffAccountsTab: React.FC = () => {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add staff state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Reset password state
  const [resettingUser, setResettingUser] = useState<UserSummary | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [submittingReset, setSubmittingReset] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/owner/staff');
      if (!res.ok) throw new Error('Failed to fetch staff members');
      const data = (await res.json()) as UserSummary[];
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching staff accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newUsername.trim() || !newPassword) return;
    setError(null);
    setSubmittingAdd(true);

    try {
      const res = await fetch('/api/owner/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          username: newUsername.trim(),
          password: newPassword,
        }),
      });

      const data = (await res.json()) as UserSummary & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to create staff account');

      setUsers((prev) => [...prev, data]);
      setShowAddModal(false);
      setNewName('');
      setNewUsername('');
      setNewPassword('');
      setSuccess(`Created staff account for ${data.name} (@${data.username})`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Error creating staff');
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleToggleActive = async (user: UserSummary) => {
    const nextActive = user.is_active === 1 ? 0 : 1;
    setError(null);

    try {
      const res = await fetch(`/api/owner/staff/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextActive }),
      });

      const data = (await res.json()) as UserSummary & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to toggle account status');

      setUsers((prev) => prev.map((u) => (u.id === user.id ? data : u)));
      setSuccess(`${user.name} is now ${nextActive === 1 ? 'Active' : 'Deactivated'}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update user');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser || !resetPassword) return;
    setError(null);
    setSubmittingReset(true);

    try {
      const res = await fetch(`/api/owner/staff/${resettingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: resetPassword }),
      });

      const data = (await res.json()) as UserSummary & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');

      setResettingUser(null);
      setResetPassword('');
      setSuccess(`Password updated for ${resettingUser.name}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setSubmittingReset(false);
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

      {/* Header and Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-[#111111] text-base font-serif">Authorized Staff & Owners</h3>
          <p className="text-xs text-[#52525B]">Manage counter terminal access and billing privileges</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="min-h-[44px] bg-[#111111] hover:bg-[#262626] text-white font-semibold px-5 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Staff Account</span>
        </button>
      </div>

      {/* Users List */}
      {loading ? (
        <div className="p-16 text-center text-[#52525B]">
          <div className="w-8 h-8 border-2 border-[#111111] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm font-medium">Loading staff directory...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <div
              key={u.id}
              className={`bg-white border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                u.is_active === 1
                  ? 'border-[#E6E2DA] shadow-sm'
                  : 'border-[#E6E2DA]/60 opacity-60 bg-[#FAF9F6]'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm ${
                    u.role === 'owner'
                      ? 'bg-[#111111] text-white'
                      : 'bg-[#ECFDF5] text-[#166534] border border-[#BBF7D0]'
                  }`}
                >
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-[#111111] text-base font-serif">{u.name}</h4>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        u.role === 'owner'
                          ? 'bg-[#111111] text-white'
                          : 'bg-[#ECFDF5] text-[#166534] border border-[#BBF7D0]'
                      }`}
                    >
                      {u.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#52525B] mt-1">
                    <span className="font-mono text-[#111111] font-semibold">@{u.username}</span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1 text-[11px] text-[#71717A] tabular-nums">
                      <Clock className="w-3 h-3" />
                      {new Date(u.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center">
                {/* Active / Deactivated Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleActive(u)}
                  className={`flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    u.is_active === 1
                      ? 'text-[#166534] hover:text-[#14532D]'
                      : 'text-[#71717A] hover:text-[#111111]'
                  }`}
                >
                  {u.is_active === 1 ? (
                    <ToggleRight className="w-5 h-5 text-[#166534]" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-[#71717A]" />
                  )}
                  <span>{u.is_active === 1 ? 'Active' : 'Disabled'}</span>
                </button>

                {/* Reset Password */}
                <button
                  type="button"
                  onClick={() => {
                    setResettingUser(u);
                    setResetPassword('');
                  }}
                  className="min-h-[38px] px-3.5 py-1.5 bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] rounded-xl text-xs font-bold flex items-center gap-1.5 border border-[#E6E2DA] transition-colors cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-[#52525B]" />
                  <span>Reset Password</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#E6E2DA] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E6E2DA]">
              <h3 className="font-bold text-[#111111] text-base font-serif">Create Staff Account</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#71717A] hover:text-[#111111] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Verma"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="e.g. rahul_counter"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white lowercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
                  Initial Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-[#52525B] hover:text-[#111111] bg-[#F3EFEA] hover:bg-[#E6E2DA] border border-[#E6E2DA] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="min-h-[44px] bg-[#111111] hover:bg-[#262626] disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-xl text-xs shadow-sm cursor-pointer"
                >
                  {submittingAdd ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#E6E2DA] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E6E2DA]">
              <h3 className="font-bold text-[#111111] text-base font-serif">
                Reset Password for {resettingUser.name}
              </h3>
              <button
                onClick={() => setResettingUser(null)}
                className="text-[#71717A] hover:text-[#111111] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Enter new master or staff password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResettingUser(null)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-[#52525B] hover:text-[#111111] bg-[#F3EFEA] hover:bg-[#E6E2DA] border border-[#E6E2DA] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReset}
                  className="min-h-[44px] bg-[#111111] hover:bg-[#262626] disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-xl text-xs shadow-sm cursor-pointer"
                >
                  {submittingReset ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
