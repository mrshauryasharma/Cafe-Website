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
import { User } from '../../types';
import { useRouter } from '../../utils/router';

export type OwnerTabType = 'reports' | 'inventory' | 'menu' | 'branding' | 'staff' | 'cards' | 'backup';

interface OwnerDashboardProps {
  currentUser?: User;
  initialTab?: string;
  onCafeNameChange: (newName: string) => void;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({
  currentUser,
  initialTab,
  onCafeNameChange,
}) => {
  const { navigate } = useRouter();
  const perms = currentUser?.permissions;
  const isOwner = currentUser?.role === 'owner';

  // Determine valid initial tab
  const getValidTab = (tab?: string): OwnerTabType => {
    if (tab === 'inventory' || tab === 'menu' || tab === 'branding' || tab === 'staff' || tab === 'cards' || tab === 'backup') {
      return tab;
    }
    return 'reports';
  };

  const [activeTab, setActiveTab] = useState<OwnerTabType>(getValidTab(initialTab));
  const [lowStockAlertCount, setLowStockAlertCount] = useState<number>(0);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(getValidTab(initialTab));
    }
  }, [initialTab]);

  const handleTabChange = (tab: OwnerTabType) => {
    setActiveTab(tab);
    navigate(`/owner/${tab}`, true);
  };

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

  // Tab visibility based on role & permissions
  const showReports = isOwner || perms?.can_view_reports;
  const showInventory = isOwner || perms?.can_manage_menu_stock;
  const showMenu = isOwner || perms?.can_manage_menu_stock;
  const showBranding = isOwner;
  const showStaff = isOwner || (currentUser?.role === 'manager' && perms?.can_view_reports);
  const showCards = isOwner;
  const showBackup = isOwner;

  return (
    <div className="space-y-6">
      {/* Dashboard Subnav */}
      <div className="flex items-center justify-between border-b border-[#E6E2DA] pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F3EFEA] border border-[#E6E2DA] text-[#111111] flex items-center justify-center shadow-2xs">
            <Shield className="w-5 h-5 text-[#111111]" />
          </div>
          <div>
            <h2 className="font-bold text-[#111111] text-lg sm:text-xl font-serif">
              {isOwner ? 'Owner Management Console' : 'Management & Operations'}
            </h2>
            <p className="text-xs text-[#52525B]">
              Executive reports, live inventory, menu catalog, staff accounts &amp; backup safety
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex items-center gap-1.5 p-1.5 bg-[#F3EFEA] border border-[#E6E2DA] rounded-2xl overflow-x-auto">
        {showReports && (
          <button
            type="button"
            onClick={() => handleTabChange('reports')}
            className={`min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'reports'
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-[#52525B] hover:text-[#111111]'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Reports &amp; Analytics</span>
          </button>
        )}

        {showInventory && (
          <button
            type="button"
            onClick={() => handleTabChange('inventory')}
            className={`min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer relative whitespace-nowrap ${
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
        )}

        {showMenu && (
          <button
            type="button"
            onClick={() => handleTabChange('menu')}
            className={`min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'menu'
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-[#52525B] hover:text-[#111111]'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Digital Menu</span>
          </button>
        )}

        {showBranding && (
          <button
            type="button"
            onClick={() => handleTabChange('branding')}
            className={`min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'branding'
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-[#52525B] hover:text-[#111111]'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Branding</span>
          </button>
        )}

        {showStaff && (
          <button
            type="button"
            onClick={() => handleTabChange('staff')}
            className={`min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'staff'
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-[#52525B] hover:text-[#111111]'
            }`}
          >
            <Users2 className="w-4 h-4" />
            <span>Staff &amp; Permissions</span>
          </button>
        )}

        {showCards && (
          <button
            type="button"
            onClick={() => handleTabChange('cards')}
            className={`min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'cards'
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-[#52525B] hover:text-[#111111]'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>NFC Cards</span>
          </button>
        )}

        {showBackup && (
          <button
            type="button"
            onClick={() => handleTabChange('backup')}
            className={`min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'backup'
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-[#52525B] hover:text-[#111111]'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Backup</span>
          </button>
        )}
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'reports' && showReports && <AnalyticsReportsTab />}
        {activeTab === 'inventory' && showInventory && <InventoryTab />}
        {activeTab === 'menu' && showMenu && <DigitalMenuTab />}
        {activeTab === 'branding' && showBranding && (
          <BrandingRulesTab onCafeNameChange={onCafeNameChange} />
        )}
        {activeTab === 'staff' && showStaff && <StaffAccountsTab />}
        {activeTab === 'cards' && showCards && <CardsManagerTab />}
        {activeTab === 'backup' && showBackup && <BackupRecoveryTab />}
      </div>
    </div>
  );
};
