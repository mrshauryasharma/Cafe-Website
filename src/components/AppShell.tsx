import React, { useState } from 'react';
import {
  Coffee,
  LogOut,
  ScanLine,
  Users,
  LayoutDashboard,
  WifiOff,
} from 'lucide-react';
import { User } from '../types';
import { OwnerDashboard } from './owner/OwnerDashboard';
import { CustomersDirectory } from './customers/CustomersDirectory';
import { CounterTerminal } from './counter/CounterTerminal';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

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
  const [currentTab, setCurrentTab] = useState<'scan' | 'customers' | 'dashboard'>('scan');
  const isOnline = useOnlineStatus();

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#111111]">
      {/* Global Offline Warning Banner */}
      {!isOnline && (
        <div className="bg-[#FFFBEB] text-[#92400E] border-b border-[#FDE68A] text-xs font-semibold px-4 py-2.5 flex items-center justify-center gap-2 shadow-sm sticky top-0 z-50">
          <WifiOff className="w-4 h-4 flex-shrink-0 text-[#92400E]" />
          <span>
            ⚠️ Offline Mode — Read-only shell active. New orders, point redemptions, and database mutations are temporarily locked.
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
              Loyalty & Counter System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#F3EFEA] px-3.5 py-1.5 rounded-xl border border-[#E6E2DA] text-xs">
            <span className="font-semibold text-[#111111] hidden sm:inline">{user.name}</span>
            <span
              className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] tracking-wider ${
                user.role === 'owner'
                  ? 'bg-[#111111] text-white'
                  : 'bg-[#ECFDF5] text-[#166534] border border-[#BBF7D0]'
              }`}
            >
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

      {/* Navigation Bar */}
      <nav className="bg-white border-b border-[#E6E2DA] px-4 sm:px-6 py-2 flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setCurrentTab('scan')}
          className={`min-h-[44px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
            currentTab === 'scan'
              ? 'bg-[#111111] text-white shadow-xs'
              : 'text-[#52525B] hover:text-[#111111] hover:bg-[#F3EFEA]'
          }`}
        >
          <ScanLine className="w-4 h-4" />
          <span>Counter Scan & Billing</span>
        </button>

        <button
          onClick={() => setCurrentTab('customers')}
          className={`min-h-[44px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
            currentTab === 'customers'
              ? 'bg-[#111111] text-white shadow-xs'
              : 'text-[#52525B] hover:text-[#111111] hover:bg-[#F3EFEA]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Customers</span>
        </button>

        {user.role === 'owner' && (
          <button
            onClick={() => setCurrentTab('dashboard')}
            className={`min-h-[44px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              currentTab === 'dashboard'
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-[#52525B] hover:text-[#111111] hover:bg-[#F3EFEA]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Owner Dashboard</span>
          </button>
        )}
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
        {currentTab === 'scan' && (
          <CounterTerminal currentUser={user} initialCardUid={initialCardUid} isOnline={isOnline} />
        )}

        {currentTab === 'customers' && (
          <CustomersDirectory currentUser={user} isOnline={isOnline} />
        )}

        {currentTab === 'dashboard' && user.role === 'owner' && (
          <OwnerDashboard onCafeNameChange={onCafeNameChange} />
        )}
      </main>
    </div>
  );
};
