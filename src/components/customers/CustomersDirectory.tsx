import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  UserPlus,
  CreditCard,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { User } from '../../types';
import { CustomerSummaryRow } from '../../../functions/api/customers/index';
import { AddCustomerModal } from './AddCustomerModal';
import { CustomerProfileView } from './CustomerProfileView';

interface CustomersDirectoryProps {
  currentUser: User;
  isOnline?: boolean;
}

export const CustomersDirectory: React.FC<CustomersDirectoryProps> = ({ currentUser, isOnline = true }) => {
  const [customers, setCustomers] = useState<CustomerSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const fetchCustomers = async (query = '') => {
    try {
      setLoading(true);
      const url = query ? `/api/customers?search=${encodeURIComponent(query)}` : '/api/customers';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load customers');
      const data = (await res.json()) as CustomerSummaryRow[];
      setCustomers(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers(search.trim());
  };

  // If a customer is selected, show 360° profile view
  if (selectedCustomerId) {
    return (
      <CustomerProfileView
        customerId={selectedCustomerId}
        currentUser={currentUser}
        isOnline={isOnline}
        onBack={() => {
          setSelectedCustomerId(null);
          fetchCustomers(search.trim());
        }}
        onCustomerDeleted={() => {
          setSelectedCustomerId(null);
          fetchCustomers();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Feedback alerts */}
      {error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-2xl text-[#991B1B] text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-[#991B1B] hover:text-[#111111] cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-[#ECFDF5] border border-[#BBF7D0] rounded-2xl text-[#166534] text-sm flex items-center gap-2 font-semibold">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#71717A]" />
          <input
            type="text"
            placeholder="Search by Name, Phone, or Card UID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-[44px] bg-white border border-[#E6E2DA] rounded-xl pl-10 pr-4 py-2 text-sm text-[#111111] placeholder-[#71717A] focus:outline-none focus:border-[#111111] shadow-2xs transition-colors"
          />
        </form>

        <button
          onClick={() => setShowAddModal(true)}
          className="min-h-[44px] bg-[#111111] hover:bg-[#262626] text-white font-semibold px-5 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-xs transition-all whitespace-nowrap cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Customer</span>
        </button>
      </div>

      {/* Directory List / Table */}
      {loading ? (
        <div className="p-16 text-center text-[#52525B]">
          <div className="w-8 h-8 border-2 border-[#111111] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm font-medium">Loading customer directory...</p>
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white border border-[#E6E2DA] rounded-2xl p-10 text-center text-[#52525B] shadow-sm">
          <Users className="w-10 h-10 mx-auto text-[#71717A] mb-2" />
          <p className="text-base font-semibold text-[#111111] font-serif">No customers found</p>
          <p className="text-xs text-[#71717A] mt-1 max-w-sm mx-auto">
            {search
              ? 'No registered customer matches your search.'
              : 'Register your first customer to begin tracking visits and issuing loyalty cards!'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#E6E2DA] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F3EFEA] text-[#52525B] uppercase tracking-wider border-b border-[#E6E2DA] font-bold text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Phone</th>
                  <th className="px-5 py-3.5">NFC Card</th>
                  <th className="px-5 py-3.5">Points Balance</th>
                  <th className="px-5 py-3.5">Visits</th>
                  <th className="px-5 py-3.5">Last Visit</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E2DA]">
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedCustomerId(c.id)}
                    className="hover:bg-[#FAF9F6] cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-4">
                      <p className="font-bold text-[#111111] text-sm font-serif">{c.name}</p>
                      {c.notes && (
                        <p className="text-[11px] text-[#71717A] truncate max-w-xs">{c.notes}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 font-mono text-[#52525B] font-semibold tabular-nums">
                      {c.phone}
                    </td>
                    <td className="px-5 py-4">
                      {c.card_uid ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-[#ECFDF5] text-[#166534] border border-[#BBF7D0] tabular-nums">
                          <CreditCard className="w-3 h-3" />
                          <span>{c.card_uid}</span>
                        </span>
                      ) : (
                        <span className="text-[#71717A] italic text-[11px]">No Card</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono font-bold text-[#166534] text-sm tabular-nums">
                        {c.points_balance}
                      </span>
                      <span className="text-[11px] text-[#71717A] ml-1">pts</span>
                    </td>
                    <td className="px-5 py-4 text-[#111111] font-mono font-bold tabular-nums">
                      {c.total_visits}
                    </td>
                    <td className="px-5 py-4 text-[#52525B]">
                      {c.last_visit_at ? (
                        <span className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums">
                          <Calendar className="w-3 h-3 text-[#71717A]" />
                          {new Date(c.last_visit_at).toLocaleDateString()}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-4 text-right text-[#71717A]">
                      <ChevronRight className="w-4 h-4 ml-auto text-[#71717A]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <AddCustomerModal
          onClose={() => setShowAddModal(false)}
          onCustomerAdded={(newCust) => {
            setShowAddModal(false);
            setSuccess(`Registered "${newCust.name}" successfully!`);
            fetchCustomers();
            setTimeout(() => setSuccess(null), 3000);
          }}
        />
      )}
    </div>
  );
};
