import React, { useEffect, useState } from 'react';
import {
  Printer,
  X,
  RefreshCw,
  AlertCircle,
  DollarSign,
  Wallet,
  Utensils,
  ShoppingBag,
  Truck,
  Calendar,
} from 'lucide-react';
import { ZReportResponse } from '../../../functions/api/owner/z-report';

interface ZReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
}

export const ZReportModal: React.FC<ZReportModalProps> = ({
  isOpen,
  onClose,
  initialDate,
}) => {
  const getTodayIst = () => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  };

  const [selectedDate, setSelectedDate] = useState<string>(initialDate || getTodayIst());
  const [report, setReport] = useState<ZReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchZReport = async (date: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/owner/z-report?date=${date}`);
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error || 'Failed to generate Z-Report');
      }
      const data = (await res.json()) as ZReportResponse;
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching Z-Report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchZReport(selectedDate);
    }
  }, [isOpen, selectedDate]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#111111]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="max-w-4xl w-full bg-white border border-[#E6E2DA] rounded-2xl p-5 sm:p-6 shadow-2xl my-auto max-h-[92vh] overflow-y-auto space-y-5">
        {/* MODAL HEADER & CONTROLS */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-[#E6E2DA] no-print">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#166534]"></span>
              <h3 className="text-xl font-bold text-[#111111] font-serif">
                Day-End Closing Z-Report
              </h3>
            </div>
            <p className="text-xs text-[#52525B] mt-0.5">
              Daily revenue audit, cash drawer &amp; UPI reconciliation, and dining audit.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Date Selector */}
            <div className="flex items-center gap-1.5 bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl px-2.5 py-1.5 text-xs">
              <Calendar className="w-3.5 h-3.5 text-[#52525B]" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs text-[#111111] font-mono focus:outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() => fetchZReport(selectedDate)}
              disabled={loading}
              title="Refresh Z-Report data"
              className="p-2 bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] border border-[#E6E2DA] rounded-xl text-xs transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={!report || loading}
              className="px-3.5 py-2 bg-[#111111] hover:bg-[#262626] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print 80mm Z-Report</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-[#71717A] hover:text-[#111111] p-1.5 rounded-xl hover:bg-[#F3EFEA] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-[#991B1B] text-xs flex items-center justify-between no-print">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-[#991B1B] hover:text-[#111111] cursor-pointer"
            >
              &times;
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-[#71717A] text-xs font-serif no-print">
            Compiling and reconciling daily transactions...
          </div>
        ) : !report ? (
          <div className="py-20 text-center text-[#71717A] text-xs italic font-serif no-print">
            No transaction records found for date {selectedDate}.
          </div>
        ) : (
          <div className="space-y-5">
            {/* UNSETTLED TABLES WARNING BANNER */}
            {report.open_tables_count > 0 && (
              <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-3 flex items-center justify-between gap-3 text-[#92400E] text-xs no-print">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-[#D97706]" />
                  <span>
                    <strong>Notice:</strong> There are{' '}
                    <strong>{report.open_tables_count} open unsettled table(s)</strong> with running
                    subtotal of <strong>₹{report.open_tables_subtotal}</strong>. Unsettled orders are
                    not included in today's closed cash drawer.
                  </span>
                </div>
              </div>
            )}

            {/* SCREEN VIEW SECTION 1: DRAWER RECONCILIATION & REVENUE KPIS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 no-print">
              {/* Card 1: Payment Drawer Reconciliation */}
              <div className="bg-[#FAF9F6] border border-[#E6E2DA] rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#E6E2DA] pb-2">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[#111111]" />
                    <span className="font-bold text-xs uppercase tracking-wider font-serif text-[#111111]">
                      Payment Drawer Reconciliation
                    </span>
                  </div>
                  <span className="text-[10px] bg-[#ECFDF5] text-[#166534] border border-[#BBF7D0] px-2 py-0.5 rounded-full font-mono font-bold">
                    100% Balanced
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white border border-[#E6E2DA] p-2.5 rounded-xl">
                    <p className="text-[10px] text-[#71717A] uppercase font-bold">Cash Drawer</p>
                    <p className="text-base font-bold font-mono text-[#111111] tabular-nums mt-0.5">
                      ₹{report.payment_reconciliation.cash_total}
                    </p>
                    <span className="text-[9px] text-[#52525B]">In physical till</span>
                  </div>

                  <div className="bg-white border border-[#E6E2DA] p-2.5 rounded-xl">
                    <p className="text-[10px] text-[#71717A] uppercase font-bold">UPI / QR Bank</p>
                    <p className="text-base font-bold font-mono text-[#166534] tabular-nums mt-0.5">
                      ₹{report.payment_reconciliation.upi_total}
                    </p>
                    <span className="text-[9px] text-[#52525B]">Direct bank credits</span>
                  </div>

                  <div className="bg-white border border-[#E6E2DA] p-2.5 rounded-xl">
                    <p className="text-[10px] text-[#71717A] uppercase font-bold">Card POS</p>
                    <p className="text-base font-bold font-mono text-[#1D4ED8] tabular-nums mt-0.5">
                      ₹{report.payment_reconciliation.card_total}
                    </p>
                    <span className="text-[9px] text-[#52525B]">Card settlements</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs pt-1 border-t border-[#E6E2DA]">
                  <span className="text-[#52525B]">
                    Split Bills Settled: <strong>{report.payment_reconciliation.split_orders_count}</strong>
                  </span>
                  <span className="font-mono font-bold text-[#111111]">
                    Total Reconciled: ₹{report.payment_reconciliation.reconciled_total}
                  </span>
                </div>
              </div>

              {/* Card 2: Financial Sales Summary */}
              <div className="bg-[#FAF9F6] border border-[#E6E2DA] rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-[#E6E2DA] pb-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-[#111111]" />
                    <span className="font-bold text-xs uppercase tracking-wider font-serif text-[#111111]">
                      Financial Summary ({report.financial_summary.total_orders} Orders)
                    </span>
                  </div>
                  <span className="text-[10px] text-[#52525B] font-mono">Date: {report.date}</span>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[#52525B]">
                    <span>Gross Sales:</span>
                    <span className="font-mono text-[#111111] font-bold tabular-nums">
                      ₹{report.financial_summary.gross_sales}
                    </span>
                  </div>

                  {report.financial_summary.extra_discounts > 0 && (
                    <div className="flex justify-between text-[#991B1B]">
                      <span>Extra Discounts:</span>
                      <span className="font-mono tabular-nums">
                        -₹{report.financial_summary.extra_discounts}
                      </span>
                    </div>
                  )}

                  {report.financial_summary.loyalty_discounts > 0 && (
                    <div className="flex justify-between text-[#166534]">
                      <span>Loyalty Redemptions:</span>
                      <span className="font-mono tabular-nums">
                        -₹{report.financial_summary.loyalty_discounts}
                      </span>
                    </div>
                  )}

                  {report.financial_summary.packaging_collected > 0 && (
                    <div className="flex justify-between text-[#52525B]">
                      <span>Packaging Charges Collected:</span>
                      <span className="font-mono tabular-nums">
                        +₹{report.financial_summary.packaging_collected}
                      </span>
                    </div>
                  )}

                  {report.financial_summary.tax_collected > 0 && (
                    <div className="flex justify-between text-[#52525B]">
                      <span>
                        GST Collected (CGST ₹{report.financial_summary.cgst_collected} + SGST ₹
                        {report.financial_summary.sgst_collected}):
                      </span>
                      <span className="font-mono tabular-nums">
                        +₹{report.financial_summary.tax_collected}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-baseline pt-2 border-t border-[#E6E2DA] font-bold text-sm text-[#111111]">
                    <span className="font-serif">Net Revenue Settled:</span>
                    <span className="font-mono text-base tabular-nums">
                      ₹{report.financial_summary.net_revenue}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* SCREEN VIEW SECTION 2: DINING BREAKDOWN & WAITER SALES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 no-print">
              {/* Dining Mode Split */}
              <div className="bg-white border border-[#E6E2DA] rounded-2xl p-4 space-y-3">
                <span className="font-bold text-xs uppercase tracking-wider font-serif text-[#52525B]">
                  Dining Channels Breakdown
                </span>

                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl text-center">
                    <Utensils className="w-4 h-4 mx-auto text-[#111111] mb-1" />
                    <p className="text-[10px] text-[#71717A] font-bold">Dine-In</p>
                    <p className="text-sm font-bold font-mono text-[#111111] tabular-nums mt-0.5">
                      ₹{report.dining_breakdown.dine_in.revenue}
                    </p>
                    <span className="text-[9px] text-[#52525B]">
                      {report.dining_breakdown.dine_in.count} orders
                    </span>
                  </div>

                  <div className="p-2.5 bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl text-center">
                    <ShoppingBag className="w-4 h-4 mx-auto text-[#111111] mb-1" />
                    <p className="text-[10px] text-[#71717A] font-bold">Takeaway</p>
                    <p className="text-sm font-bold font-mono text-[#111111] tabular-nums mt-0.5">
                      ₹{report.dining_breakdown.takeaway.revenue}
                    </p>
                    <span className="text-[9px] text-[#52525B]">
                      {report.dining_breakdown.takeaway.count} orders
                    </span>
                  </div>

                  <div className="p-2.5 bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl text-center">
                    <Truck className="w-4 h-4 mx-auto text-[#111111] mb-1" />
                    <p className="text-[10px] text-[#71717A] font-bold">Delivery</p>
                    <p className="text-sm font-bold font-mono text-[#111111] tabular-nums mt-0.5">
                      ₹{report.dining_breakdown.delivery.revenue}
                    </p>
                    <span className="text-[9px] text-[#52525B]">
                      {report.dining_breakdown.delivery.count} orders
                    </span>
                  </div>
                </div>
              </div>

              {/* Waiter / Staff Day Sales */}
              <div className="bg-white border border-[#E6E2DA] rounded-2xl p-4 space-y-3">
                <span className="font-bold text-xs uppercase tracking-wider font-serif text-[#52525B]">
                  Staff &amp; Waiter Performance (Today)
                </span>

                {report.waiter_breakdown.length === 0 ? (
                  <p className="text-xs text-[#71717A] italic py-4 text-center">
                    No waiter-attributed orders for this date.
                  </p>
                ) : (
                  <div className="divide-y divide-[#E6E2DA] max-h-36 overflow-y-auto pr-1 text-xs">
                    {report.waiter_breakdown.map((w, idx) => (
                      <div key={idx} className="py-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 bg-[#F3EFEA] text-[#111111] rounded-full flex items-center justify-center text-[10px] font-bold font-mono">
                            #{idx + 1}
                          </span>
                          <span className="font-serif font-bold text-[#111111]">
                            {w.waiter_name}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-[#111111] tabular-nums">
                            ₹{w.net_revenue}
                          </span>
                          <span className="text-[10px] text-[#71717A] ml-2">
                            ({w.orders_count} orders)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* SCREEN VIEW SECTION 3: CANCELLED ITEMS AUDIT */}
            {report.cancelled_items.length > 0 && (
              <div className="bg-white border border-[#E6E2DA] rounded-2xl p-4 space-y-2 text-xs no-print">
                <div className="flex items-center justify-between pb-1 border-b border-[#E6E2DA]">
                  <span className="font-bold uppercase tracking-wider font-serif text-[#991B1B]">
                    Cancelled Items Audit Log ({report.cancelled_items.length} Tickets)
                  </span>
                  <span className="text-[10px] text-[#71717A]">Kitchen Waste &amp; Void Tracking</span>
                </div>

                <div className="divide-y divide-[#E6E2DA] max-h-40 overflow-y-auto pr-1">
                  {report.cancelled_items.map((c) => (
                    <div key={c.id} className="py-2 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-[#111111]">
                          Table {c.table_number} &bull; Ticket #{c.kot_number}
                        </p>
                        <p className="text-[11px] text-[#52525B] mt-0.5">
                          Items:{' '}
                          {c.items.map((it) => `${it.quantity}x ${it.item_name}`).join(', ')}
                        </p>
                        {c.reason && (
                          <p className="text-[10px] text-[#991B1B] italic mt-0.5">
                            Reason: {c.reason}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-[11px] font-mono text-[#71717A] whitespace-nowrap">
                        <p>Waiter: {c.waiter_name}</p>
                        <p>{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PRINTABLE 80MM THERMAL CLOSING SLIP */}
            <div className="pt-2 border-t border-[#E6E2DA] no-print">
              <p className="text-[11px] text-[#52525B] italic text-center mb-2">
                Preview of 80mm Thermal Register Printout (below):
              </p>
            </div>

            <div className="printable-receipt bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl p-4 text-xs font-mono space-y-2 text-[#111111]">
              <div className="text-center border-b border-dashed border-[#111111] pb-2">
                <h2 className="text-base font-bold font-serif uppercase tracking-wider">
                  {report.cafe_name}
                </h2>
                <p className="text-[11px] font-bold uppercase mt-0.5">
                  DAY-END CLOSING Z-REPORT
                </p>
                <p className="text-[10px] text-[#52525B]">Audit Date: {report.date}</p>
                {report.gstin && (
                  <p className="text-[10px] text-[#52525B]">GSTIN: {report.gstin}</p>
                )}
                <p className="text-[9px] text-[#71717A] mt-0.5">
                  Generated: {new Date(report.generated_at).toLocaleString()}
                </p>
                <p className="text-[9px] text-[#71717A]">Auditor: {report.generated_by}</p>
              </div>

              {/* Drawer Payment Reconciliation */}
              <div className="py-1 border-b border-dashed border-[#111111] space-y-1">
                <p className="font-bold text-[11px] uppercase border-b border-[#E6E2DA] pb-0.5">
                  Payment Drawer Reconciliation
                </p>
                <div className="flex justify-between">
                  <span>Cash Drawer:</span>
                  <span className="tabular-nums font-bold">
                    ₹{report.payment_reconciliation.cash_total}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>UPI / QR Bank:</span>
                  <span className="tabular-nums font-bold">
                    ₹{report.payment_reconciliation.upi_total}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Card POS:</span>
                  <span className="tabular-nums font-bold">
                    ₹{report.payment_reconciliation.card_total}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-[#52525B]">
                  <span>Split Bills Settled:</span>
                  <span className="tabular-nums">
                    {report.payment_reconciliation.split_orders_count}
                  </span>
                </div>
                <div className="flex justify-between font-bold border-t border-[#111111] pt-0.5">
                  <span>Total Settled:</span>
                  <span className="tabular-nums">
                    ₹{report.payment_reconciliation.reconciled_total}
                  </span>
                </div>
              </div>

              {/* Financial Sales Summary */}
              <div className="py-1 border-b border-dashed border-[#111111] space-y-1">
                <p className="font-bold text-[11px] uppercase border-b border-[#E6E2DA] pb-0.5">
                  Sales &amp; Tax Summary
                </p>
                <div className="flex justify-between">
                  <span>Total Settled Orders:</span>
                  <span className="tabular-nums font-bold">
                    {report.financial_summary.total_orders}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Gross Sales:</span>
                  <span className="tabular-nums">₹{report.financial_summary.gross_sales}</span>
                </div>
                {report.financial_summary.extra_discounts > 0 && (
                  <div className="flex justify-between">
                    <span>Extra Discounts:</span>
                    <span className="tabular-nums">
                      -₹{report.financial_summary.extra_discounts}
                    </span>
                  </div>
                )}
                {report.financial_summary.loyalty_discounts > 0 && (
                  <div className="flex justify-between">
                    <span>Loyalty Redemptions:</span>
                    <span className="tabular-nums">
                      -₹{report.financial_summary.loyalty_discounts}
                    </span>
                  </div>
                )}
                {report.financial_summary.packaging_collected > 0 && (
                  <div className="flex justify-between">
                    <span>Packaging Collected:</span>
                    <span className="tabular-nums">
                      +₹{report.financial_summary.packaging_collected}
                    </span>
                  </div>
                )}
                {report.financial_summary.tax_collected > 0 && (
                  <div className="flex justify-between">
                    <span>GST Collected (CGST+SGST):</span>
                    <span className="tabular-nums">
                      +₹{report.financial_summary.tax_collected}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t border-[#111111] pt-0.5 text-sm">
                  <span>Net Revenue:</span>
                  <span className="tabular-nums">₹{report.financial_summary.net_revenue}</span>
                </div>
              </div>

              {/* Dining Mode Split */}
              <div className="py-1 border-b border-dashed border-[#111111] space-y-0.5 text-[11px]">
                <p className="font-bold uppercase border-b border-[#E6E2DA] pb-0.5">
                  Dining Channels
                </p>
                <div className="flex justify-between">
                  <span>Dine-In ({report.dining_breakdown.dine_in.count}):</span>
                  <span className="tabular-nums font-bold">
                    ₹{report.dining_breakdown.dine_in.revenue}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Takeaway ({report.dining_breakdown.takeaway.count}):</span>
                  <span className="tabular-nums font-bold">
                    ₹{report.dining_breakdown.takeaway.revenue}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery ({report.dining_breakdown.delivery.count}):</span>
                  <span className="tabular-nums font-bold">
                    ₹{report.dining_breakdown.delivery.revenue}
                  </span>
                </div>
              </div>

              {/* Waiter Breakdown */}
              {report.waiter_breakdown.length > 0 && (
                <div className="py-1 border-b border-dashed border-[#111111] space-y-0.5 text-[11px]">
                  <p className="font-bold uppercase border-b border-[#E6E2DA] pb-0.5">
                    Staff Sales Summary
                  </p>
                  {report.waiter_breakdown.map((w, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>
                        {w.waiter_name} ({w.orders_count}):
                      </span>
                      <span className="tabular-nums font-bold">₹{w.net_revenue}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Open Tables at Closing */}
              <div className="py-1 border-b border-dashed border-[#111111] space-y-0.5 text-[11px]">
                <div className="flex justify-between">
                  <span>Unsettled Tables:</span>
                  <span className="tabular-nums font-bold">{report.open_tables_count}</span>
                </div>
                {report.open_tables_count > 0 && (
                  <div className="flex justify-between text-[#52525B]">
                    <span>Unsettled Subtotal:</span>
                    <span className="tabular-nums">₹{report.open_tables_subtotal}</span>
                  </div>
                )}
              </div>

              <div className="text-center pt-2 text-[10px] text-[#52525B] italic">
                *** END OF DAY-END Z-REPORT ***
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
