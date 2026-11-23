import React, { useState } from 'react';
import { ArrowUpRight, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Creator, PredictionMarket } from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import { translations } from '../i18n/translations';
import { formatCompact, formatXAF } from '../utils/format';
import { PriceChart } from './PriceChart';

interface FeaturedHeroCarouselProps {
  creators: Creator[];
  predictions: PredictionMarket[];
  lang: AppLang;
  onSelectCreator: (creator: Creator) => void;
  onVotePrediction: (prediction: PredictionMarket, side: 'YES' | 'NO') => void;
}

export const FeaturedHeroCarousel: React.FC<FeaturedHeroCarouselProps> = ({
  creators,
  predictions,
  lang,
  onSelectCreator,
  onVotePrediction,
}) => {
  const [index, setIndex] = useState(0);
  const t = translations[lang];

  const slides: Array<
    | { kind: 'raise'; creator: Creator }
    | { kind: 'prediction'; prediction: PredictionMarket }
  > = [];

  if (creators[0]) slides.push({ kind: 'raise', creator: creators[0] });
  if (predictions[0]) slides.push({ kind: 'prediction', prediction: predictions[0] });
  for (const c of creators.slice(1, 3)) slides.push({ kind: 'raise', creator: c });

  if (slides.length === 0) return null;

  const activeIndex = index % slides.length;
  const active = slides[activeIndex];

  return (
    <section className="rounded-3xl bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
          {t.featuredMarkets}
        </span>

        {slides.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#645582] dark:text-[#A99BC8] tabular-nums">
              {activeIndex + 1} / {slides.length}
            </span>
            <button
              type="button"
              aria-label="Previous featured market"
              onClick={() => setIndex((prev) => (prev - 1 + slides.length) % slides.length)}
              className="w-8 h-8 rounded-xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] flex items-center justify-center text-[#11081F] dark:text-[#F8F7FC] hover:border-violet-500"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Next featured market"
              onClick={() => setIndex((prev) => (prev + 1) % slides.length)}
              className="w-9 h-9 rounded-full bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] flex items-center justify-center text-[#11081F] dark:text-[#F8F7FC] hover:border-violet-500"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {active.kind === 'raise' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {active.creator.avatarUrl ? (
                  <img
                    src={active.creator.avatarUrl}
                    alt={active.creator.name}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-full object-cover bg-[#F8F7FC] dark:bg-[#11081F] shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-violet-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
                    {active.creator.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-lg sm:text-xl font-bold text-[#11081F] dark:text-[#F8F7FC] truncate">
                      {lang === 'FR'
                        ? active.creator.raiseTitleFr || active.creator.raiseTitle || active.creator.name
                        : active.creator.raiseTitle || active.creator.name}
                    </h2>
                    {active.creator.isVerified && <CheckCircle2 className="w-4 h-4 text-violet-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-[#645582] dark:text-[#A99BC8] truncate">
                    {active.creator.name} · {active.creator.handle} · {active.creator.category}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-xl sm:text-2xl font-bold text-[#11081F] dark:text-[#F8F7FC] tabular-nums">
                  {formatXAF(active.creator.sharePriceXAF)}
                </div>
                <div
                  className={`text-xs font-semibold tabular-nums ${
                    active.creator.priceChangePct >= 0 ? 'text-emerald-500' : 'text-red-500'
                  }`}
                >
                  {active.creator.priceChangePct >= 0 ? '+' : ''}
                  {active.creator.priceChangePct}%
                </div>
              </div>
            </div>

            <PriceChart
              history={
                active.creator.priceHistory && active.creator.priceHistory.length > 0
                  ? active.creator.priceHistory
                  : (active.creator.sparkline || [active.creator.sharePriceXAF]).map((p, i) => ({
                      label: `T-${(active.creator.sparkline?.length || 1) - 1 - i}`,
                      priceXAF: p,
                    }))
              }
              isPositive={active.creator.priceChangePct >= 0}
              heightClass="h-44 sm:h-48"
            />
          </div>

          <div className="lg:col-span-5 flex flex-col justify-between gap-4 p-5 rounded-3xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A]">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[#645582] dark:text-[#A99BC8]">
                <span>{t.raised}</span>
                <span className="font-mono font-semibold text-[#11081F] dark:text-[#F8F7FC] tabular-nums">
                  {formatXAF(active.creator.totalRaisedXAF || 0)} /{' '}
                  {formatXAF(active.creator.grossTargetXAF || active.creator.targetRaiseXAF || 0)}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#E4DFF2] dark:bg-[#2A174A] overflow-hidden">
                <div
                  className="h-full bg-violet-600 rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        4,
                        Math.round(
                          ((active.creator.totalRaisedXAF || 0) /
                            Math.max(1, active.creator.grossTargetXAF || active.creator.targetRaiseXAF || 1)) *
                            100
                        )
                      )
                    )}%`,
                  }}
                />
              </div>
            </div>

            <p className="text-xs text-[#544675] dark:text-[#B9ADD6] line-clamp-3 leading-relaxed">
              {(lang === 'FR' ? active.creator.summaryFr || active.creator.summary : active.creator.summary) ||
                `${active.creator.revSharePct || 25}% pledged project royalty pool across ${formatCompact(
                  active.creator.totalShares || 1000
                )} fixed shares.`}
            </p>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-2xl bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A]">
                <div className="text-[#645582] dark:text-[#A99BC8]">{t.sharesLeft}</div>
                <div className="font-bold text-[#11081F] dark:text-[#F8F7FC] tabular-nums mt-0.5">
                  {(active.creator.sharesRemaining ?? active.creator.totalShares ?? 1000).toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A]">
                <div className="text-[#645582] dark:text-[#A99BC8]">{t.investors}</div>
                <div className="font-bold text-[#11081F] dark:text-[#F8F7FC] tabular-nums mt-0.5">
                  {active.creator.investorsCount ?? 0}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSelectCreator(active.creator)}
              className="w-full py-3.5 px-5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>{t.joinRaise}</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-violet-500">
                  {active.prediction.category}
                </span>
                <h2 className="text-xl font-bold text-[#11081F] dark:text-[#F8F7FC] mt-0.5">
                  {lang === 'FR' ? active.prediction.questionFr : active.prediction.questionEn}
                </h2>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-bold text-emerald-500 tabular-nums">
                  {active.prediction.yesProbabilityPct}% {t.yes}
                </div>
                <div className="text-xs text-[#645582] dark:text-[#A99BC8] tabular-nums">
                  {formatXAF(active.prediction.totalVolumeXAF)} {t.volume24h}
                </div>
              </div>
            </div>

            <PriceChart
              history={(active.prediction.sparkline || [active.prediction.yesProbabilityPct]).map(
                (pct, i, arr) => ({
                  label: i === arr.length - 1 ? 'Live' : `T-${arr.length - 1 - i}`,
                  priceXAF: pct * 10,
                })
              )}
              isPositive={active.prediction.yesProbabilityPct >= 50}
              heightClass="h-44"
            />
          </div>

          <div className="lg:col-span-5 p-5 rounded-3xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] space-y-4">
            <p className="text-xs text-[#544675] dark:text-[#B9ADD6]">
              {active.prediction.resolutionCriteria ||
                'Contract settles at 1,000 XAF per winning share based on official public results.'}
            </p>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold tabular-nums">
                <span className="text-emerald-500">
                  {t.yes} {active.prediction.yesProbabilityPct}%
                </span>
                <span className="text-red-500">
                  {t.no} {active.prediction.noProbabilityPct}%
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-red-500/30 overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${active.prediction.yesProbabilityPct}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onVotePrediction(active.prediction, 'YES')}
                className="py-3 px-4 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors tabular-nums"
              >
                {t.voteYes} · {formatXAF(active.prediction.yesProbabilityPct * 10)}
              </button>
              <button
                type="button"
                onClick={() => onVotePrediction(active.prediction, 'NO')}
                className="py-3 px-4 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors tabular-nums"
              >
                {t.voteNo} · {formatXAF(active.prediction.noProbabilityPct * 10)}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
