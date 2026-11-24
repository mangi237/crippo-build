import React, { useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import type { PredictionMarket, UserProfile } from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import { translations } from '../i18n/translations';
import { executePredictionVote } from '../services/firestoreService';
import { formatXAF } from '../utils/format';

interface PredictionVoteModalProps {
  prediction: PredictionMarket | null;
  initialSide: 'YES' | 'NO';
  user: UserProfile | null;
  lang: AppLang;
  onClose: () => void;
  onRequireAuth: () => void;
}

export const PredictionVoteModal: React.FC<PredictionVoteModalProps> = ({
  prediction,
  initialSide,
  user,
  lang,
  onClose,
  onRequireAuth,
}) => {
  const t = translations[lang];
  const [side, setSide] = useState<'YES' | 'NO'>(initialSide);
  const [shares, setShares] = useState(5);
  const [paymentMethod, setPaymentMethod] = useState<'MTN MoMo' | 'Orange Money' | 'Wallet'>('MTN MoMo');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!prediction) return null;

  const contractPriceXAF =
    side === 'YES' ? prediction.yesProbabilityPct * 10 : prediction.noProbabilityPct * 10;
  const totalCostXAF = shares * contractPriceXAF;
  const maxPayoutXAF = shares * 1000;

  async function handleConfirm() {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!prediction) return;
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await executePredictionVote({
        uid: user.uid,
        prediction,
        side,
        shares,
        paymentMethod,
      });
      setSuccessMsg(
        `Placed ${shares} ${side} contracts (${formatXAF(totalCostXAF)}). Potential payout: ${formatXAF(maxPayoutXAF)}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit prediction order.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-lg bg-white dark:bg-[#180D2B] border border-[#E2E8F0] dark:border-[#2A174A] p-6 space-y-5 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close prediction trade"
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] flex items-center justify-center text-[#64748B] dark:text-[#A99BC8]"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="pr-10 space-y-1">
          <span className="text-xs font-semibold text-[#6C2BD9]">{prediction.category}</span>
          <h2 className="text-lg font-bold text-[#0F172A] dark:text-[#F8F9FC] leading-snug">
            {lang === 'FR' ? prediction.questionFr : prediction.questionEn}
          </h2>
        </div>

        {/* YES / NO Switch */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSide('YES')}
            className={`py-3 rounded-full text-xs font-bold border transition-colors tabular-nums ${
              side === 'YES'
                ? 'bg-[#059669] border-emerald-500 text-white'
                : 'bg-[#F8F9FC] dark:bg-[#0F172A] border-[#E2E8F0] dark:border-[#2A174A] text-[#059669]'
            }`}
          >
            {t.yes} · {prediction.yesProbabilityPct}% ({formatXAF(prediction.yesProbabilityPct * 10)})
          </button>
          <button
            type="button"
            onClick={() => setSide('NO')}
            className={`py-3 rounded-full text-xs font-bold border transition-colors tabular-nums ${
              side === 'NO'
                ? 'bg-[#DC2626] border-red-500 text-white'
                : 'bg-[#F8F9FC] dark:bg-[#0F172A] border-[#E2E8F0] dark:border-[#2A174A] text-[#DC2626]'
            }`}
          >
            {t.no} · {prediction.noProbabilityPct}% ({formatXAF(prediction.noProbabilityPct * 10)})
          </button>
        </div>

        {/* Contract Stepper */}
        <div className="p-3.5 rounded-lg bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-[#0F172A] dark:text-[#F8F9FC]">Contracts</div>
            <div className="text-[11px] text-[#64748B] dark:text-[#A99BC8] tabular-nums">
              Pays {formatXAF(maxPayoutXAF)} if {side}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShares((s) => Math.max(1, s - 1))}
              className="w-9 h-9 rounded-full bg-white dark:bg-[#180D2B] border border-[#E2E8F0] dark:border-[#2A174A] flex items-center justify-center"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center font-display num font-bold tabular-nums">{shares}</span>
            <button
              type="button"
              onClick={() => setShares((s) => s + 1)}
              className="w-9 h-9 rounded-full bg-[#6C2BD9] text-white flex items-center justify-center"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Payment Method */}
        <div className="grid grid-cols-3 gap-2">
          {(['MTN MoMo', 'Orange Money', 'Wallet'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPaymentMethod(m)}
              className={`py-2 rounded-full text-[11px] font-semibold border ${
                paymentMethod === m
                  ? 'bg-[#6C2BD9] border-violet-600 text-white'
                  : 'bg-[#F8F9FC] dark:bg-[#0F172A] border-[#E2E8F0] dark:border-[#2A174A] text-[#64748B] dark:text-[#A99BC8]'
              }`}
            >
              {m === 'Wallet' ? 'Cash Wallet' : m}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-[#DC2626]/10 border border-red-500/30 text-xs text-[#DC2626]">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="p-3 rounded-lg bg-[#059669]/10 border border-emerald-500/30 text-xs text-[#059669]">
            {successMsg}
          </div>
        )}

        <button
          type="button"
          disabled={submitting}
          onClick={handleConfirm}
          className="w-full py-3.5 rounded-full bg-[#6C2BD9] hover:bg-[#6C2BD9] disabled:opacity-50 text-white text-sm font-bold"
        >
          {submitting ? 'Confirming...' : `${side === 'YES' ? t.voteYes : t.voteNo} · ${formatXAF(totalCostXAF)}`}
        </button>
      </div>
    </div>
  );
};
