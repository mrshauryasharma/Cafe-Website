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
  Sliders,
  Check,
} from 'lucide-react';
import { UserSummary } from '../../../functions/api/owner/staff';
import { UserRole, UserPermissions } from '../../types';
import {
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  ROLE_PRESETS,
  resolveUserPermissions,
} from '../../utils/permissions';

export const StaffAccountsTab: React.FC = () => {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal State (Add or Edit)
  const [showModal, setShowModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('staff');
  const [formPermissions, setFormPermissions] = useState<UserPermissions>({
    ...ROLE_PRESETS.staff,
  });
  const [submittingForm, setSubmittingForm] = useState(false);

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

  const handleOpenAddModal = () => {
    setEditingUserId(null);
    setFormName('');
    setFormUsername('');
    setFormPassword('');
    setFormRole('staff');
    setFormPermissions({ ...ROLE_PRESETS.staff });
    setShowModal(true);
  };

  const handleOpenEditModal = (u: UserSummary) => {
    setEditingUserId(u.id);
    setFormName(u.name);
    setFormUsername(u.username);
    setFormPassword('');
    setFormRole(u.role);
    setFormPermissions(u.permissions || resolveUserPermissions(u.role, u.permissions_json));
    setShowModal(true);
  };

  const handleApplyPreset = (presetRole: UserRole) => {
    setFormRole(presetRole);
    setFormPermissions({ ...ROLE_PRESETS[presetRole] });
  };

  const handleTogglePermission = (key: keyof UserPermissions) => {
    setFormPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    if (!editingUserId && (!formUsername.trim() || !formPassword)) return;

    setError(null);
    setSubmittingForm(true);

    try {
      if (editingUserId) {
        // Edit existing staff
        const res = await fetch(`/api/owner/staff/${editingUserId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            role: formRole,
            permissions: formPermissions,
            new_password: formPassword.trim() || undefined,
          }),
        });

        const data = (await res.json()) as UserSummary & { error?: string };
        if (!res.ok) throw new Error(data.error || 'Failed to update staff account');

        setUsers((prev) => prev.map((u) => (u.id === editingUserId ? data : u)));
        setSuccess(`Updated details & permissions for ${data.name}.`);
      } else {
        // Create new staff
        const res = await fetch('/api/owner/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            username: formUsername.trim().toLowerCase(),
            password: formPassword,
            role: formRole,
            permissions: formPermissions,
          }),
        });

        const data = (await res.json()) as UserSummary & { error?: string };
        if (!res.ok) throw new Error(data.error || 'Failed to create staff account');

        setUsers((prev) => [...prev, data]);
        setSuccess(`Created ${data.role.toUpperCase()} account for ${data.name} (@${data.username}).`);
      }

      setShowModal(false);
      setTimeout(() => setSuccess(null), 3500);
    } catch (err: any) {
      setError(err.message || 'Error saving staff account');
    } finally {
      setSubmittingForm(false);
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
      setSuccess(`${user.name} is now ${nextActive === 1 ? 'Active' : 'Disabled'}`);
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

  const getRoleBadgeClass = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return 'bg-[#111111] text-white';
      case 'manager':
        return 'bg-[#7C3AED]/10 text-[#6D28D9] border border-[#DDD6FE]';
      case 'waiter':
        return 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]';
      case 'staff':
      default:
        return 'bg-[#ECFDF5] text-[#166534] border border-[#BBF7D0]';
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-2xl text-[#991B1B] text-sm flex items-center justify-between shadow-xs">
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
        <div className="p-4 bg-[#ECFDF5] border border-[#BBF7D0] rounded-2xl text-[#166534] text-sm flex items-center gap-2 font-semibold shadow-xs">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Header and Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#E6E2DA] rounded-2xl p-5 shadow-xs">
        <div>
          <h3 className="font-bold text-[#111111] text-lg font-serif">Staff Roles &amp; Granular Permissions</h3>
          <p className="text-xs text-[#52525B]">
            Configure roles (Manager, Counter Staff, Waiter) and granular capability matrices
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="min-h-[44px] bg-[#111111] hover:bg-[#262626] text-white font-semibold px-5 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Staff Account</span>
        </button>
      </div>

      {/* Users List */}
      {loading ? (
        <div className="p-16 text-center text-[#52525B] bg-white border border-[#E6E2DA] rounded-2xl shadow-xs">
          <div className="w-8 h-8 border-2 border-[#111111] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm font-medium">Loading staff directory &amp; permission matrix...</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {users.map((u) => {
            const userPerms = u.permissions || resolveUserPermissions(u.role, u.permissions_json);
            const activePermCount = PERMISSION_KEYS.filter((k) => userPerms[k]).length;

            return (
              <div
                key={u.id}
                className={`bg-white border rounded-2xl p-5 flex flex-col gap-4 transition-all ${
                  u.is_active === 1
                    ? 'border-[#E6E2DA] shadow-xs hover:border-[#111111]/30'
                    : 'border-[#E6E2DA]/60 opacity-60 bg-[#FAF9F6]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm ${getRoleBadgeClass(
                        u.role
                      )}`}
                    >
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-[#111111] text-base font-serif">{u.name}</h4>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md ${getRoleBadgeClass(
                            u.role
                          )}`}
                        >
                          {u.role}
                        </span>
                        {u.role === 'owner' && (
                          <span className="text-[10px] font-semibold text-[#166534] bg-[#ECFDF5] px-2 py-0.5 rounded border border-[#BBF7D0]">
                            Full Superuser Access
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#52525B] mt-1">
                        <span className="font-mono text-[#111111] font-semibold">@{u.username}</span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1 text-[11px] text-[#71717A] tabular-nums">
                          <Clock className="w-3 h-3" />
                          Joined {new Date(u.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-end sm:self-center flex-wrap">
                    {/* Edit Details & Permissions */}
                    {u.role !== 'owner' && (
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(u)}
                        className="min-h-[36px] px-3 py-1.5 bg-[#FAF9F6] hover:bg-[#F3EFEA] text-[#111111] rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-[#E6E2DA] transition-colors cursor-pointer"
                      >
                        <Sliders className="w-3.5 h-3.5 text-[#52525B]" />
                        <span>Permissions</span>
                      </button>
                    )}

                    {/* Reset Password */}
                    <button
                      type="button"
                      onClick={() => {
                        setResettingUser(u);
                        setResetPassword('');
                      }}
                      className="min-h-[36px] px-3 py-1.5 bg-[#FAF9F6] hover:bg-[#F3EFEA] text-[#111111] rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-[#E6E2DA] transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-[#52525B]" />
                      <span>Password</span>
                    </button>

                    {/* Active / Disabled Toggle */}
                    {u.role !== 'owner' && (
                      <button
                        type="button"
                        onClick={() => handleToggleActive(u)}
                        className={`flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ml-1 ${
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
                    )}
                  </div>
                </div>

                {/* Permissions Capabilities Chips */}
                <div className="pt-3 border-t border-dashed border-[#E6E2DA] flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-[#71717A] uppercase mr-1">
                    Permissions ({activePermCount}/{PERMISSION_KEYS.length}):
                  </span>
                  {PERMISSION_KEYS.map((k) => {
                    const hasPerm = userPerms[k];
                    return (
                      <span
                        key={k}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-semibold tracking-wide flex items-center gap-1 ${
                          hasPerm
                            ? 'bg-[#F3EFEA] text-[#111111] border border-[#E6E2DA]'
                            : 'bg-black/5 text-[#A1A1AA] line-through'
                        }`}
                      >
                        {hasPerm && <Check className="w-2.5 h-2.5 text-[#166534]" />}
                        <span>{PERMISSION_LABELS[k].label.split('&')[0].trim()}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#E6E2DA] rounded-2xl w-full max-w-xl p-6 shadow-xl space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E2DA]">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[#F3EFEA] border border-[#E6E2DA] flex items-center justify-center">
                  <Sliders className="w-4 h-4 text-[#111111]" />
                </div>
                <div>
                  <h3 className="font-bold text-lg font-serif text-[#111111]">
                    {editingUserId ? 'Edit Staff & Permission Matrix' : 'Create Staff Member'}
                  </h3>
                  <p className="text-xs text-[#52525B]">Customize access privileges and role assignment</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-[#71717A] hover:text-[#111111] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="space-y-4">
              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
                    Staff Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full min-h-[42px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2 text-sm text-[#111111] font-serif focus:outline-none focus:border-[#111111] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
                    Login Username
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingUserId)}
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value.toLowerCase())}
                    placeholder="e.g. rahul_waiter"
                    className="w-full min-h-[42px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2 text-sm text-[#111111] font-mono lowercase focus:outline-none focus:border-[#111111] focus:bg-white disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1">
                  {editingUserId ? 'New Password (Leave blank to keep unchanged)' : 'Login Password'}
                </label>
                <input
                  type="password"
                  required={!editingUserId}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={editingUserId ? '••••••••' : 'Min 6 characters'}
                  className="w-full min-h-[42px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                />
              </div>

              {/* One-Click Role Presets */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider mb-1.5">
                  Role Quick-Presets
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('waiter')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      formRole === 'waiter'
                        ? 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1D4ED8] ring-1 ring-[#1D4ED8]'
                        : 'bg-white border-[#E6E2DA] text-[#52525B] hover:border-[#111111]/30'
                    }`}
                  >
                    <div className="font-bold text-xs">Waiter Preset</div>
                    <div className="text-[10px] text-[#52525B] mt-0.5">Tables &amp; Orders only</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyPreset('staff')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      formRole === 'staff'
                        ? 'bg-[#ECFDF5] border-[#BBF7D0] text-[#166534] ring-1 ring-[#166534]'
                        : 'bg-white border-[#E6E2DA] text-[#52525B] hover:border-[#111111]/30'
                    }`}
                  >
                    <div className="font-bold text-xs">Counter Staff</div>
                    <div className="text-[10px] text-[#52525B] mt-0.5">POS Billing &amp; Loyalty</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyPreset('manager')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      formRole === 'manager'
                        ? 'bg-[#7C3AED]/10 border-[#DDD6FE] text-[#6D28D9] ring-1 ring-[#6D28D9]'
                        : 'bg-white border-[#E6E2DA] text-[#52525B] hover:border-[#111111]/30'
                    }`}
                  >
                    <div className="font-bold text-xs">Manager Preset</div>
                    <div className="text-[10px] text-[#52525B] mt-0.5">Floor, Stock &amp; Reports</div>
                  </button>
                </div>
              </div>

              {/* Granular Permissions Toggle Matrix */}
              <div className="pt-2 space-y-2">
                <label className="block text-xs font-semibold text-[#52525B] uppercase tracking-wider">
                  Granular Permissions Toggles
                </label>

                <div className="bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl p-3 space-y-2 max-h-60 overflow-y-auto">
                  {PERMISSION_KEYS.map((k) => {
                    const isChecked = formPermissions[k] ?? false;
                    const meta = PERMISSION_LABELS[k];

                    return (
                      <div
                        key={k}
                        onClick={() => handleTogglePermission(k)}
                        className={`flex items-start justify-between gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-white border-[#BBF7D0] shadow-2xs'
                            : 'bg-white/60 border-transparent opacity-75'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-[#111111]">{meta.label}</div>
                          <div className="text-[11px] text-[#52525B]">{meta.desc}</div>
                        </div>

                        <div className="pt-0.5">
                          {isChecked ? (
                            <ToggleRight className="w-5 h-5 text-[#166534]" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-[#71717A]" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#E6E2DA] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#E6E2DA] text-xs font-semibold text-[#52525B] hover:text-[#111111] hover:bg-[#FAF9F6] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingForm}
                  className="px-5 py-2.5 rounded-xl bg-[#111111] hover:bg-[#262626] text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submittingForm ? 'Saving...' : editingUserId ? 'Save Permissions' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E6E2DA] rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E2DA]">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#111111]" />
                <h3 className="font-bold text-base font-serif text-[#111111]">
                  Reset Password for {resettingUser.name}
                </h3>
              </div>
              <button
                onClick={() => setResettingUser(null)}
                className="p-1.5 text-[#71717A] hover:text-[#111111] rounded-lg cursor-pointer"
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
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full min-h-[42px] bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-3.5 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setResettingUser(null)}
                  className="px-4 py-2 rounded-xl border border-[#E6E2DA] text-xs font-semibold text-[#52525B] hover:text-[#111111] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReset}
                  className="px-5 py-2 rounded-xl bg-[#111111] hover:bg-[#262626] text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submittingReset ? 'Updating...' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
