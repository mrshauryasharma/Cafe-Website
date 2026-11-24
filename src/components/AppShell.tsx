import React, { useEffect, useMemo } from 'react';
import {
  Coffee,
  LogOut,
  ScanLine,
  Users,
  LayoutDashboard,
  UtensilsCrossed,
  WifiOff,
} from 'lucide-react';
import { User } from '../types';
import { OwnerDashboard } from './owner/OwnerDashboard';
import { CustomersDirectory } from './customers/CustomersDirectory';
import { CounterTerminal } from './counter/CounterTerminal';
import { TablesBoard } from './tables/TablesBoard';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useRouter } from '../utils/router';

interface AppShellProps {
  user: User;
  cafeName: string;
  initialCardUid?: string;
  onLogout: () => void;
  onCafeNameChange: (newName: string) => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  user,
  cafeName,
  initialCardUid,
  onLogout,
  onCafeNameChange,
}) => {
  const { path, navigate } = useRouter();
  const isOnline = useOnlineStatus();
  const perms = user.permissions;

  // Determine user default route
  const defaultRoute = useMemo(() => {
    if (user.role === 'waiter') return '/tables';
    if (user.role === 'staff') return '/pos';
    if (user.role === 'manager') return '/tables';
    return '/owner/reports';
  }, [user.role]);

  // Handle route matching
  const isTables = path.startsWith('/tables');
  const isPos = path.startsWith('/pos') || path.startsWith('/order');
  const isCustomers = path.startsWith('/customers');
  const isOwner = path.startsWith('/owner');

  // If path is root or unknown, navigate to default route
  useEffect(() => {
    if (!isTables && !isPos && !isCustomers && !isOwner) {
      navigate(defaultRoute, true);
    }
  }, [path, isTables, isPos, isCustomers, isOwner, defaultRoute, navigate]);

  // Permissions visibility
  const canSeeTables = user.role === 'owner' || perms?.can_view_tables || perms?.can_take_orders;
  const canSeePos = user.role === 'owner' || perms?.can_take_orders || perms?.can_settle_bills;
  const canSeeCustomers = user.role === 'owner' || user.role === 'manager' || user.role === 'staff';
  const canSeeManagement = user.role === 'owner' || perms?.can_view_reports || perms?.can_manage_menu_stock;

  // Extract table parameter from /order/:table_id or /pos/:table_id
  const tableParam = useMemo(() => {
    if (isPos) {
      const parts = path.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return decodeURIComponent(parts[1]);
      }
    }
    return undefined;
  }, [path, isPos]);

  // Extract owner subtab parameter from /owner/:tab
  const ownerSubtab = useMemo(() => {
    if (isOwner) {
      const parts = path.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return parts[1];
      }
    }
    return 'reports';
  }, [path, isOwner]);

  // Role Badge Styling
  const roleBadgeStyle = () => {
    switch (user.role) {
      case 'owner':
        return 'bg-[#111111] text-white';
      case 'manager':
        return 'bg-[#7C3AED]/10 text-[#6D28D9] border border-[#DDD6FE]';
      case 'staff':
        return 'bg-[#ECFDF5] text-[#166534] border border-[#BBF7D0]';
      case 'waiter':
        return 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]';
      default:
        return 'bg-[#F3EFEA] text-[#111111] border border-[#E6E2DA]';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#111111]">
      {/* Global Offline Warning Banner */}
      {!isOnline && (
        <div className="bg-[#FFFBEB] text-[#92400E] border-b border-[#FDE68A] text-xs font-semibold px-4 py-2.5 flex items-center justify-center gap-2 shadow-sm sticky top-0 z-50">
          <WifiOff className="w-4 h-4 flex-shrink-0 text-[#92400E]" />
          <span>
            Offline Mode — Read-only shell active. New orders, point redemptions, and database mutations are temporarily locked.
          </span>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E6E2DA] px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 bg-[#F3EFEA] border border-[#E6E2DA] text-[#111111] rounded-xl flex items-center justify-center shadow-xs">
            <Coffee className="w-5 h-5 text-[#111111]" />
          </div>
          <div>
            <h1 className="font-bold text-lg sm:text-xl text-[#111111] leading-tight font-serif tracking-tight">
              {cafeName || 'Kimmo’s Kitchen'}
            </h1>
            <p className="text-[11px] uppercase tracking-widest text-[#52525B] font-sans font-medium">
              POS, Floor & Loyalty Terminal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#F3EFEA] px-3.5 py-1.5 rounded-xl border border-[#E6E2DA] text-xs">
            <span className="font-semibold text-[#111111] hidden sm:inline">{user.name}</span>
            <span className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] tracking-wider ${roleBadgeStyle()}`}>
              {user.role}
            </span>
          </div>

          <button
            onClick={onLogout}
            title="Log out"
            className="min-h-[38px] min-w-[38px] p-2 bg-white hover:bg-[#F3EFEA] text-[#52525B] hover:text-[#111111] rounded-xl border border-[#E6E2DA] transition-colors flex items-center justify-center cursor-pointer shadow-2xs"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Clean Navigation Bar */}
      <nav className="bg-white border-b border-[#E6E2DA] px-4 sm:px-6 py-2 flex items-center gap-2 overflow-x-auto">
        {canSeeTables && (
          <button
            onClick={() => navigate('/tables')}
            className={`min-h-[44px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              isTables
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-[#52525B] hover:text-[#111111] hover:bg-[#F3EFEA]'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Floor & Tables</span>
          </button>
        )}

        {canSeePos && (
          <button
            onClick={() => navigate('/pos')}
            className={`min-h-[44px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              isPos
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-[#52525B] hover:text-[#111111] hover:bg-[#F3EFEA]'
            }`}
          >
            <ScanLine className="w-4 h-4" />
            <span>Counter POS & Billing</span>
          </button>
        )}

        {canSeeCustomers && (
          <button
            onClick={() => navigate('/customers')}
            className={`min-h-[44px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              isCustomers
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-[#52525B] hover:text-[#111111] hover:bg-[#F3EFEA]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Customers</span>
          </button>
        )}

        {canSeeManagement && (
          <button
            onClick={() => navigate('/owner/reports')}
            className={`min-h-[44px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              isOwner
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-[#52525B] hover:text-[#111111] hover:bg-[#F3EFEA]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Management</span>
          </button>
        )}
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
        {isTables && (
          <TablesBoard currentUser={user} isOnline={isOnline} />
        )}

        {isPos && (
          <CounterTerminal
            currentUser={user}
            initialCardUid={initialCardUid}
            initialTableId={tableParam}
            isOnline={isOnline}
          />
        )}

        {isCustomers && (
          <CustomersDirectory currentUser={user} isOnline={isOnline} />
        )}

        {isOwner && (
          <OwnerDashboard
            currentUser={user}
            initialTab={ownerSubtab}
            onCafeNameChange={onCafeNameChange}
          />
        )}
      </main>
    </div>
  );
};
