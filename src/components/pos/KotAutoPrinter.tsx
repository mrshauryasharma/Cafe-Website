import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Printer,
  Volume2,
  VolumeX,
  X,
  RefreshCw,
  Bell,
} from 'lucide-react';
import { User, KotTicket } from '../../types';

interface KotAutoPrinterProps {
  currentUser: User;
  isOnline?: boolean;
}

// Web Audio API Dual Bell Chime
const playChimeBell = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playTone(659.25, now, 0.4); // E5
    playTone(880, now + 0.15, 0.6); // A5
  } catch (err) {
    console.warn('Audio chime could not play:', err);
  }
};

export const KotAutoPrinter: React.FC<KotAutoPrinterProps> = ({ currentUser, isOnline = true }) => {
  const [autoPrintEnabled, setAutoPrintEnabled] = useState<boolean>(() => {
    return localStorage.getItem('kimmo_kot_autoprint') === 'true';
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('kimmo_kot_sound') !== 'false';
  });

  const [pendingTickets, setPendingTickets] = useState<KotTicket[]>([]);
  const [recentTickets, setRecentTickets] = useState<KotTicket[]>([]);
  const [showQueueDrawer, setShowQueueDrawer] = useState(false);
  const [activePrintTicket, setActivePrintTicket] = useState<KotTicket | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const isPrintingRef = useRef(false);

  const canSettle = currentUser.role === 'owner' || currentUser.permissions?.can_settle_bills;

  // Toggle handlers
  const toggleAutoPrint = () => {
    const nextVal = !autoPrintEnabled;
    setAutoPrintEnabled(nextVal);
    localStorage.setItem('kimmo_kot_autoprint', String(nextVal));
  };

  const toggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    localStorage.setItem('kimmo_kot_sound', String(nextVal));
  };

  // Fetch KOT Queue
  const fetchQueue = useCallback(async () => {
    if (!canSettle || !isOnline) return;

    try {
      const res = await fetch('/api/kot/pending');
      if (!res.ok) return;
      const data = (await res.json()) as { pending: KotTicket[]; recent: KotTicket[] };

      setPendingTickets(data.pending || []);
      setRecentTickets(data.recent || []);

      // If auto-print is enabled, process oldest pending ticket
      if (autoPrintEnabled && data.pending && data.pending.length > 0 && !isPrintingRef.current) {
        const nextTicket = data.pending[0];
        printTicket(nextTicket, true);
      }
    } catch (err) {
      console.warn('Error polling KOT queue:', err);
    }
  }, [canSettle, isOnline, autoPrintEnabled]);

  // Polling loop
  useEffect(() => {
    if (!canSettle || !isOnline) return;

    fetchQueue();
    const interval = setInterval(fetchQueue, 3500);
    return () => clearInterval(interval);
  }, [canSettle, isOnline, fetchQueue]);

  // Acknowledge ticket
  const ackTicket = async (ticketId: string) => {
    try {
      await fetch(`/api/kot/${ticketId}/ack`, { method: 'POST' });
      setPendingTickets((prev) => prev.filter((t) => t.id !== ticketId));
      fetchQueue();
    } catch (err) {
      console.error('Failed to acknowledge KOT:', err);
    }
  };

  // Trigger Print
  const printTicket = (ticket: KotTicket, isAutomatic = false) => {
    if (isPrintingRef.current) return;
    isPrintingRef.current = true;
    setIsProcessing(true);

    if (soundEnabled) {
      playChimeBell();
    }

    setActivePrintTicket(ticket);

    // Let the DOM update with print markup, then trigger window.print()
    setTimeout(() => {
      window.print();

      // If automatic, acknowledge right after printing
      if (isAutomatic) {
        ackTicket(ticket.id);
      }

      setTimeout(() => {
        isPrintingRef.current = false;
        setIsProcessing(false);
      }, 1000);
    }, 400);
  };

  if (!canSettle) return null;

  return (
    <>
      {/* Top Header Auto-Print Widget */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={toggleAutoPrint}
          title={autoPrintEnabled ? 'Auto-Print KOT is ON' : 'Auto-Print KOT is OFF'}
          className={`min-h-[38px] px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-semibold cursor-pointer transition-all shadow-2xs ${
            autoPrintEnabled
              ? 'bg-[#111111] text-white border-[#111111]'
              : 'bg-white text-[#52525B] border-[#E6E2DA] hover:bg-[#F3EFEA]'
          }`}
        >
          <Printer className={`w-3.5 h-3.5 ${autoPrintEnabled ? 'text-[#ECFDF5]' : 'text-[#71717A]'}`} />
          <span className="hidden md:inline">Auto-Print</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
              autoPrintEnabled ? 'bg-[#ECFDF5] text-[#166534]' : 'bg-[#F4F4F5] text-[#71717A]'
            }`}
          >
            {autoPrintEnabled ? 'ON' : 'OFF'}
          </span>
        </button>

        <button
          onClick={toggleSound}
          title={soundEnabled ? 'Bell Chime ON' : 'Bell Chime Muted'}
          className="min-h-[38px] min-w-[38px] p-2 bg-white hover:bg-[#F3EFEA] text-[#52525B] hover:text-[#111111] rounded-xl border border-[#E6E2DA] transition-colors flex items-center justify-center cursor-pointer shadow-2xs"
        >
          {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-[#111111]" /> : <VolumeX className="w-3.5 h-3.5 text-[#A1A1AA]" />}
        </button>

        <button
          onClick={() => setShowQueueDrawer(true)}
          title="Open Kitchen Ticket Queue"
          className="relative min-h-[38px] px-3 py-1.5 bg-white hover:bg-[#F3EFEA] text-[#111111] rounded-xl border border-[#E6E2DA] transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-2xs"
        >
          <Bell className="w-3.5 h-3.5 text-[#111111]" />
          <span className="hidden sm:inline">KOTs</span>
          {pendingTickets.length > 0 && (
            <span className="px-1.5 py-0.5 bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA] font-bold text-[10px] rounded-full animate-pulse tabular-nums">
              {pendingTickets.length}
            </span>
          )}
        </button>
      </div>

      {/* KOT Queue Drawer / Modal */}
      {showQueueDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E6E2DA] rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-[#E6E2DA] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-[#F3EFEA] text-[#111111] rounded-xl border border-[#E6E2DA] flex items-center justify-center">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#111111] font-serif">Kitchen Ticket Queue</h3>
                  <p className="text-xs text-[#52525B]">Live KOT stream from waiter mobiles</p>
                </div>
              </div>
              <button
                onClick={() => setShowQueueDrawer(false)}
                className="p-2 text-[#71717A] hover:text-[#111111] hover:bg-[#F3EFEA] rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Pending Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-wider font-bold text-[#111111] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#EAB308] animate-ping" />
                    Pending Tickets ({pendingTickets.length})
                  </span>
                  <button
                    onClick={() => fetchQueue()}
                    className="text-xs text-[#52525B] hover:text-[#111111] flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Refresh
                  </button>
                </div>

                {pendingTickets.length === 0 ? (
                  <div className="p-4 text-center border border-dashed border-[#E6E2DA] rounded-xl bg-[#FAF9F6] text-xs text-[#71717A]">
                    No pending kitchen tickets. All orders printed!
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {pendingTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="p-3.5 border border-[#FDE68A] bg-[#FFFBEB] rounded-xl flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold font-serif text-[#111111] text-sm">
                              {ticket.table_number}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                                ticket.ticket_type === 'cancel_item'
                                  ? 'bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]'
                                  : ticket.ticket_type === 'add_on'
                                  ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]'
                                  : 'bg-[#ECFDF5] text-[#166534] border border-[#BBF7D0]'
                              }`}
                            >
                              {ticket.ticket_type === 'cancel_item'
                                ? 'Cancelled'
                                : ticket.ticket_type === 'add_on'
                                ? 'Add-On'
                                : 'New Order'}
                            </span>
                          </div>
                          <p className="text-xs text-[#71717A] mt-0.5">
                            {ticket.kot_number} • Waiter: {ticket.waiter_name}
                          </p>
                          <p className="text-xs font-medium text-[#111111] mt-1">
                            {ticket.items?.map((it) => `${it.quantity}x ${it.name}`).join(', ')}
                          </p>
                          {ticket.reason && (
                            <p className="text-xs text-[#991B1B] italic mt-0.5 font-medium">
                              Reason: {ticket.reason}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => printTicket(ticket, true)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 bg-[#111111] hover:bg-[#27272A] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Print
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Printed Section */}
              <div className="pt-2">
                <span className="text-xs uppercase tracking-wider font-bold text-[#71717A] block mb-2">
                  Recently Printed ({recentTickets.length})
                </span>

                {recentTickets.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#A1A1AA]">No recent tickets yet.</div>
                ) : (
                  <div className="space-y-2">
                    {recentTickets.slice(0, 10).map((ticket) => (
                      <div
                        key={ticket.id}
                        className="p-3 border border-[#E6E2DA] bg-white rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#111111]">{ticket.table_number}</span>
                            <span className="text-[10px] text-[#71717A]">{ticket.kot_number}</span>
                          </div>
                          <p className="text-[#52525B] mt-0.5 truncate max-w-xs">
                            {ticket.items?.map((it) => `${it.quantity}x ${it.name}`).join(', ')}
                          </p>
                        </div>
                        <button
                          onClick={() => printTicket(ticket, false)}
                          className="px-2.5 py-1 text-xs border border-[#E6E2DA] bg-white hover:bg-[#F3EFEA] text-[#111111] rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Printer className="w-3 h-3" />
                          Reprint
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#E6E2DA] bg-[#FAF9F6] rounded-b-2xl flex items-center justify-between text-xs text-[#52525B]">
              <span>Dual 80mm Slip: Kitchen + Customer reference</span>
              <button
                onClick={() => setShowQueueDrawer(false)}
                className="px-4 py-1.5 bg-[#111111] text-white font-medium rounded-lg cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Print Slip Container - Triggered via window.print() */}
      {activePrintTicket && (
        <div id="kot-thermal-print-area" className="hidden print:block print:w-[80mm] print:mx-auto text-black">
          {/* SLIP 1: KITCHEN COPY */}
          <div className="text-center font-serif py-2 border-b-2 border-dashed border-black">
            <h1 className="text-xl font-bold tracking-tight">KITCHEN KOT COPY</h1>
            <p className="text-xs font-mono font-bold mt-0.5">*** KIMMO’S KITCHEN ***</p>

            <div className="mt-2 text-left text-xs space-y-1">
              <div className="flex justify-between font-bold text-sm">
                <span>TABLE: {activePrintTicket.table_number}</span>
                <span>{activePrintTicket.kot_number}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>WAITER: {activePrintTicket.waiter_name}</span>
                <span>{new Date(activePrintTicket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="text-center font-bold uppercase text-xs py-0.5 border border-black my-1">
                {activePrintTicket.ticket_type === 'cancel_item'
                  ? '*** CANCELLED ITEM ***'
                  : activePrintTicket.ticket_type === 'add_on'
                  ? 'ADD-ON ITEMS'
                  : 'NEW ORDER'}
              </div>
            </div>

            {/* Items List - Large Bold Quantities, No Prices */}
            <div className="mt-2 text-left border-t border-black pt-1">
              {activePrintTicket.items?.map((item, idx) => (
                <div key={idx} className="py-1 border-b border-dotted border-gray-400">
                  <div className="flex items-start justify-between">
                    <span className="font-bold text-base font-mono">[ {item.quantity}x ]</span>
                    <span className="font-bold text-sm flex-1 ml-2">{item.name}</span>
                  </div>
                  {item.notes && (
                    <div className="text-xs italic font-bold pl-7 text-black">
                      Note: {item.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {activePrintTicket.reason && (
              <div className="mt-2 p-1 border border-black text-xs font-bold text-left">
                CANCELLATION REASON: {activePrintTicket.reason}
              </div>
            )}
          </div>

          {/* TEAR / CUT SEPARATOR */}
          <div className="text-center font-mono text-[10px] my-4 border-y border-dashed border-black py-1">
            - - - - - - - - TEAR / CUT HERE - - - - - - - -
          </div>

          {/* SLIP 2: CUSTOMER / TABLE REFERENCE COPY */}
          <div className="text-center font-serif py-2">
            <h2 className="text-base font-bold tracking-tight">KIMMO’S KITCHEN</h2>
            <p className="text-[11px] text-gray-700">TABLE ORDER REFERENCE SLIP</p>

            <div className="mt-1 text-left text-xs space-y-0.5">
              <div className="flex justify-between font-bold">
                <span>TABLE: {activePrintTicket.table_number}</span>
                <span>{activePrintTicket.kot_number}</span>
              </div>
              {activePrintTicket.customer_name && (
                <div className="text-[11px]">
                  CUSTOMER: {activePrintTicket.customer_name} {activePrintTicket.customer_phone ? `(${activePrintTicket.customer_phone})` : ''}
                </div>
              )}
              <div className="flex justify-between text-[11px]">
                <span>WAITER: {activePrintTicket.waiter_name}</span>
                <span>{new Date(activePrintTicket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            {/* Items with Rates & Total */}
            <table className="w-full text-left text-xs mt-2 border-t border-black pt-1">
              <thead>
                <tr className="border-b border-black text-[10px] uppercase font-bold">
                  <th className="py-1">Item</th>
                  <th className="text-center py-1">Qty</th>
                  <th className="text-right py-1">Rate</th>
                  <th className="text-right py-1">Amt</th>
                </tr>
              </thead>
              <tbody>
                {activePrintTicket.items?.map((item, idx) => (
                  <tr key={idx} className="border-b border-dotted border-gray-300">
                    <td className="py-1 pr-1 font-medium">{item.name}</td>
                    <td className="text-center py-1 font-bold">{item.quantity}</td>
                    <td className="text-right py-1 tabular-nums">₹{item.unit_price}</td>
                    <td className="text-right py-1 font-bold tabular-nums">₹{item.quantity * item.unit_price}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Subtotal */}
            <div className="mt-2 text-right text-xs font-bold border-t border-black pt-1">
              Running Subtotal: ₹
              {activePrintTicket.items?.reduce((sum, it) => sum + it.quantity * it.unit_price, 0).toFixed(2)}
            </div>

            <p className="text-[9px] text-center mt-3 text-gray-600">
              * This is not a tax invoice. Final settled bill provided at counter. *
            </p>
          </div>
        </div>
      )}
    </>
  );
};
