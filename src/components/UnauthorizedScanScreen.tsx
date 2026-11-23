import React from 'react';
import { ShieldAlert, Lock, ArrowRight, Coffee } from 'lucide-react';

interface UnauthorizedScanScreenProps {
  cardUid: string;
  cafeName: string;
  onGoToLogin: () => void;
}

export const UnauthorizedScanScreen: React.FC<UnauthorizedScanScreenProps> = ({
  cardUid,
  cafeName,
  onGoToLogin,
}) => {
  const maskedUid = cardUid.length > 4 
    ? `${'•'.repeat(Math.min(cardUid.length - 4, 8))}${cardUid.slice(-4)}`
    : cardUid;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#FAF9F6]">
      <div className="max-w-md w-full bg-white border border-[#E6E2DA] rounded-2xl p-6 sm:p-8 shadow-sm text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] rounded-2xl flex items-center justify-center">
            <ShieldAlert className="w-8 h-8" />
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F3EFEA] border border-[#E6E2DA] rounded-full text-xs text-[#52525B] font-semibold mb-3">
          <Coffee className="w-3.5 h-3.5 text-[#111111]" />
          <span>{cafeName || 'Kimmo’s Kitchen'} Membership Tag</span>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-[#111111] tracking-tight mb-2 font-serif">
          Official Membership Card
        </h1>
        <p className="text-xs font-semibold text-[#92400E] mb-5 uppercase tracking-wider flex items-center justify-center gap-1.5 font-sans">
          <Lock className="w-3.5 h-3.5" />
          <span>Authorized Staff Access Only</span>
        </p>

        <div className="bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl p-4 mb-6 text-left space-y-2.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#71717A] uppercase tracking-wider font-semibold">Security Invariant:</span>
            <span className="text-[#166534] bg-[#ECFDF5] border border-[#BBF7D0] px-2 py-0.5 rounded-md font-semibold">PII Protected</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#71717A] uppercase tracking-wider font-semibold">Card Reference:</span>
            <span className="font-mono text-[#111111] font-bold tabular-nums">{maskedUid}</span>
          </div>
          <div className="pt-2 border-t border-[#E6E2DA] text-xs text-[#52525B] leading-relaxed">
            Customer balance, identity, and loyalty points are encrypted and strictly accessible only through the authenticated counter terminal.
          </div>
        </div>

        <button
          onClick={onGoToLogin}
          className="w-full min-h-[44px] bg-[#111111] hover:bg-[#262626] text-white font-semibold py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Staff / Counter Login</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
