import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { PredictionMarket, UserProfile } from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import { executePredictionVote } from '../services/firestoreService';
import { formatXAF } from '../utils/format';

interface PredictionSheetProps {
  prediction: PredictionMarket | null;
  initialSide: 'YES' | 'NO';
  user: UserProfile | null;
  lang: AppLang;
  onClose: () => void;
  onRequireAuth: () => void;
}

const SHARE_PRESETS = [1, 5, 10, 25] as const;

/**
 * Prediction vote sheet (Crippo Exchange design, "Cultural Prediction Vote").
 * YES / NO stake in a cultural prediction, paid by MoMo.
 */
export const PredictionSheet: React.FC<PredictionSheetProps> = ({ prediction, initialSide, user, lang, onClose, onRequireAuth }) => {
  const isFr = lang === 'FR';
  const [side, setSide] = useState<'YES' | 'NO'>(initialSide);
  const [shares, setShares] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (!prediction) return null;

  const price = side === 'YES' ? prediction.yesProbabilityPct : 100 - prediction.yesProbabilityPct;
  const unitXAF = Math.max(100, Math.round((price / 100) * 1000));
  const total = unitXAF * shares;

  async function submit() {
    setError(null);
    setDone(null);
    if (!user) {
      onRequireAuth();
      return;
    }
    setBusy(true);
    try {
      await executePredictionVote({ uid: user.uid, prediction: prediction!, side, shares, paymentMethod: 'MTN MoMo' });
      setDone(isFr ? 'Vote enregistré. Validez l’invite MoMo.' : 'Vote placed. Approve the MoMo prompt.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vote failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0F172A]/40">
      <div className="w-full max-w-md bg-[#F8F9FC] rounded-t-[12px] sm:rounded-[12px] p-5 space-y-4 shadow-[0_25px_50px_-12px_rgba(15,23,42,0.18)] max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="label-xs text-[#6C2BD9]">{prediction.category}</p>
            <h2 className="font-display text-base font-semibold mt-1 leading-snug">{isFr ? prediction.questionFr : prediction.questionEn}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="num font-semibold text-[#059669]">{prediction.yesProbabilityPct}% {isFr ? 'OUI' : 'YES'}</span>
            <span className="num font-semibold text-[#DC2626]">{100 - prediction.yesProbabilityPct}% {isFr ? 'NON' : 'NO'}</span>
          </div>
          <div className="h-2 rounded-full bg-[#FEE2E2] overflow-hidden">
            <div className="h-full bg-[#059669]" style={{ width: `${prediction.yesProbabilityPct}%` }} />
          </div>
          <p className="num text-[11px] text-[#64748B]">{formatXAF(prediction.totalVolumeXAF)} {isFr ? 'de volume' : 'volume'}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setSide('YES')} className={`py-3 rounded-[4px] text-xs font-semibold ${side === 'YES' ? 'bg-[#059669] text-white' : 'bg-white text-[#059669] border border-[#E2E8F0]'}`}>
            {isFr ? 'Voter OUI' : 'Vote YES'}
          </button>
          <button type="button" onClick={() => setSide('NO')} className={`py-3 rounded-[4px] text-xs font-semibold ${side === 'NO' ? 'bg-[#DC2626] text-white' : 'bg-white text-[#DC2626] border border-[#E2E8F0]'}`}>
            {isFr ? 'Voter NON' : 'Vote NO'}
          </button>
        </div>

        <div className="card p-4 space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {SHARE_PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => setShares(p)} className={`py-2 rounded-[4px] text-xs font-semibold num ${shares === p ? 'bg-[#1E0B36] text-white' : 'bg-[#F2F3FF]'}`}>
                {p}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#64748B]">{isFr ? 'Coût estimé' : 'Estimated cost'}</span>
            <span className="num font-display text-base font-bold">{formatXAF(total)}</span>
          </div>
          {error && <p className="text-xs text-[#DC2626]">{error}</p>}
          {done && <p className="text-xs text-[#059669] font-semibold">{done}</p>}
          <button type="button" disabled={busy} onClick={submit} className="w-full py-3.5 rounded-[4px] bg-[#1E0B36] text-white text-sm font-semibold uppercase tracking-wide disabled:opacity-40">
            {!user ? (isFr ? 'Connectez-vous pour voter' : 'Sign in to vote') : busy ? '…' : isFr ? 'Confirmer via MoMo' : 'Confirm via MoMo'}
          </button>
        </div>
      </div>
    </div>
  );
};
