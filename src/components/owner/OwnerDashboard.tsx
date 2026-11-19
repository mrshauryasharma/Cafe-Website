import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Sparkles,
  UtensilsCrossed,
  Boxes,
  Users2,
  CreditCard,
  Shield,
  Database,
} from 'lucide-react';
import { AnalyticsReportsTab } from './AnalyticsReportsTab';
import { BrandingRulesTab } from './BrandingRulesTab';
import { DigitalMenuTab } from './DigitalMenuTab';
import { InventoryTab } from './InventoryTab';
import { StaffAccountsTab } from './StaffAccountsTab';
import { CardsManagerTab } from './CardsManagerTab';
import { BackupRecoveryTab } from './BackupRecoveryTab';

interface OwnerDashboardProps {
  onCafeNameChange: (newName: string) => void;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({ onCafeNameChange }) => {
  const [activeTab, setActiveTab] = useState<'reports' | 'inventory' | 'menu' | 'branding' | 'staff' | 'cards' | 'backup'>('reports');
  const [lowStockAlertCount, setLowStockAlertCount] = useState<number>(0);

  // Check low stock alert count for tab badge
  useEffect(() => {
    fetch('/api/owner/inventory')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: any) => {
        if (data?.kpis) {
          const totalAlerts = (data.kpis.low_stock_count || 0) + (data.kpis.out_of_stock_count || 0);
          setLowStockAlertCount(totalAlerts);
        }
      })
      .catch(() => {});
  }, [activeTab]);

  return (
    <div className="space-y-6">
      {/* Dashboard Subnav */}
      <div className="flex items-center justify-between border-b border-[#E6E2DA] pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F3EFEA] border border-[#E6E2DA] text-[#111111] flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#111111]" />
          </div>
          <div>
            <h2 className="font-bold text-[#111111] text-lg sm:text-xl font-serif">Owner Management Console</h2>
            <p className="text-xs text-[#52525B]">Executive reports, live inventory, menu catalog, staff accounts &amp; backup safety</p>
          </div>
        </div>
      </div>

      {/* 7 Tabs Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 p-1.5 bg-[#F3EFEA] border border-[#E6E2DA] rounded-2xl">
        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          className={`min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'reports'
              ? 'bg-[#111111] text-white shadow-xs'
              : 'text-[#52525B] hover:text-[#111111]'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Reports &amp; Analytics</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={`min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer relative ${
            activeTab === 'inventory'
              ? 'bg-[#111111] text-white shadow-xs'
              : 'text-[#52525B] hover:text-[#111111]'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Inventory</span>
          {lowStockAlertCount > 0 && (
            <span className="bg-[#DC2626] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full tabular-nums">
              {lowStockAlertCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('menu')}
          className={`min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'menu'
              ? 'bg-[#111111] text-white shadow-xs'
              : 'text-[#52525B] hover:text-[#111111]'
          }`}
        >
          <UtensilsCrossed className="w-4 h-4" />
          <span>Digital Menu</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('branding')}
          className={`min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'branding'
              ? 'bg-[#111111] text-white shadow-xs'
              : 'text-[#52525B] hover:text-[#111111]'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Branding</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('staff')}
          className={`min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'staff'
              ? 'bg-[#111111] text-white shadow-xs'
              : 'text-[#52525B] hover:text-[#111111]'
          }`}
        >
          <Users2 className="w-4 h-4" />
          <span>Staff</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cards')}
          className={`min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'cards'
              ? 'bg-[#111111] text-white shadow-xs'
              : 'text-[#52525B] hover:text-[#111111]'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>NFC Cards</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('backup')}
          className={`min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer col-span-2 sm:col-span-2 lg:col-span-1 ${
            activeTab === 'backup'
              ? 'bg-[#111111] text-white shadow-xs'
              : 'text-[#52525B] hover:text-[#111111]'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Backup</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'reports' && <AnalyticsReportsTab />}
        {activeTab === 'inventory' && <InventoryTab />}
        {activeTab === 'menu' && <DigitalMenuTab />}
        {activeTab === 'branding' && <BrandingRulesTab onCafeNameChange={onCafeNameChange} />}
        {activeTab === 'staff' && <StaffAccountsTab />}
        {activeTab === 'cards' && <CardsManagerTab />}
        {activeTab === 'backup' && <BackupRecoveryTab />}
      </div>
    </div>
  );
};
