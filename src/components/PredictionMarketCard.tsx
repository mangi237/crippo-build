import React from 'react';
import type { PredictionMarket } from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import { translations } from '../i18n/translations';
import { formatCompact, formatXAF } from '../utils/format';

interface PredictionMarketCardProps {
  prediction: PredictionMarket;
  lang: AppLang;
  onVote: (prediction: PredictionMarket, side: 'YES' | 'NO') => void;
}

export const PredictionMarketCard: React.FC<PredictionMarketCardProps> = ({
  prediction,
  lang,
  onVote,
}) => {
  const t = translations[lang];
  const question = lang === 'FR' ? prediction.questionFr : prediction.questionEn;
  const yesPrice = prediction.yesProbabilityPct * 10;
  const noPrice = prediction.noProbabilityPct * 10;

  return (
    <div className="rounded-lg bg-white dark:bg-[#180D2B] border border-[#E2E8F0] dark:border-[#2A174A] p-5 space-y-3.5 hover:border-violet-500/60 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 text-[11px] text-[#64748B] dark:text-[#A99BC8]">
            <span className="font-semibold text-[#6C2BD9] dark:text-[#894FF7]">{prediction.category}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{formatCompact(prediction.totalVolumeXAF)} XAF vol</span>
          </div>
          <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8F9FC] leading-snug">
            {question}
          </h3>
        </div>

        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-[#059669] tabular-nums leading-none">
            {prediction.yesProbabilityPct}%
          </div>
          <div className="text-[10px] text-[#64748B] dark:text-[#A99BC8] mt-1">{t.chance}</div>
        </div>
      </div>

      {/* Live Probability Bar */}
      <div className="w-full h-1.5 rounded-full bg-[#DC2626]/25 overflow-hidden">
        <div
          className="h-full bg-[#059669] rounded-full transition-all"
          style={{ width: `${prediction.yesProbabilityPct}%` }}
        />
      </div>

      {/* Direct Yes / No Voting Buttons */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          disabled={prediction.status !== 'OPEN'}
          onClick={() => onVote(prediction, 'YES')}
          className="py-2.5 px-3 rounded-full bg-emerald-600 hover:bg-[#059669] text-white text-xs font-semibold transition-colors tabular-nums disabled:opacity-50"
        >
          {t.yes} · {formatXAF(yesPrice)}
        </button>
        <button
          type="button"
          disabled={prediction.status !== 'OPEN'}
          onClick={() => onVote(prediction, 'NO')}
          className="py-2.5 px-3 rounded-full bg-red-600 hover:bg-[#DC2626] text-white text-xs font-semibold transition-colors tabular-nums disabled:opacity-50"
        >
          {t.no} · {formatXAF(noPrice)}
        </button>
      </div>
    </div>
  );
};
