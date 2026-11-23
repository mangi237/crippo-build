import React from 'react';
import { CheckCircle2, Users } from 'lucide-react';
import type { Creator } from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import { translations } from '../i18n/translations';
import { formatCompact, formatXAF } from '../utils/format';
import { MiniSparkline } from './PriceChart';

interface CreatorMarketCardProps {
  creator: Creator;
  lang?: AppLang;
  onTrade: (creator: Creator, initialSide?: 'BUY' | 'SELL') => void;
}

export const CreatorMarketCard: React.FC<CreatorMarketCardProps> = ({
  creator,
  lang = 'EN',
  onTrade,
}) => {
  const t = translations[lang];
  const isUp = creator.priceChangePct >= 0;
  const totalShares = creator.totalShares || 1000;
  const sharesRemaining = creator.sharesRemaining ?? totalShares;
  const targetRaise = creator.grossTargetXAF || creator.targetRaiseXAF || totalShares * (creator.baseSharePriceXAF || creator.sharePriceXAF);
  const raised = creator.totalRaisedXAF || 0;
  const progressPct = Math.min(100, Math.max(2, Math.round((raised / Math.max(1, targetRaise)) * 100)));

  const initials = creator.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const displayTitle =
    lang === 'FR'
      ? creator.raiseTitleFr || creator.raiseTitle || creator.name
      : creator.raiseTitle || creator.name;

  return (
    <div
      onClick={() => onTrade(creator, 'BUY')}
      className="cursor-pointer bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] hover:border-violet-500/70 rounded-2xl p-4 sm:p-5 space-y-4 transition-colors"
    >
      {/* Top Header: Raise Title + Category + Share Price & Sparkline */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {creator.avatarUrl ? (
            <img
              src={creator.avatarUrl}
              alt={creator.name}
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-xl object-cover bg-violet-500/15 shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-violet-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
              {initials}
            </div>
          )}

          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 truncate">
              {creator.category}
            </div>
            <h3 className="text-sm sm:text-base font-bold text-[#11081F] dark:text-[#F8F7FC] truncate">
              {displayTitle}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-[#645582] dark:text-[#A99BC8] truncate">
              <span className="truncate">{creator.name}</span>
              {creator.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-violet-500 shrink-0" />}
              <span aria-hidden="true">·</span>
              <span className="truncate">{creator.handle}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:block">
            <MiniSparkline
              values={
                creator.sparkline && creator.sparkline.length > 1
                  ? creator.sparkline
                  : [creator.sharePriceXAF, creator.sharePriceXAF]
              }
              isPositive={isUp}
              width={76}
              height={28}
            />
          </div>
          <div className="text-right">
            <div className="text-sm sm:text-base font-bold text-[#11081F] dark:text-[#F8F7FC] tabular-nums">
              {formatXAF(creator.sharePriceXAF)}
            </div>
            <div
              className={`text-xs font-semibold tabular-nums ${
                isUp ? 'text-emerald-500' : 'text-red-500'
              }`}
            >
              {isUp ? '+' : ''}
              {creator.priceChangePct}%
            </div>
          </div>
        </div>
      </div>

      {/* Progress & Cap Table Telemetry */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs tabular-nums">
          <span className="text-[#645582] dark:text-[#A99BC8]">
            {t.raised}: <strong className="text-[#11081F] dark:text-[#F8F7FC]">{formatCompact(raised)} XAF</strong>
          </span>
          <span className="text-[#645582] dark:text-[#A99BC8]">
            {t.target}: <strong className="text-[#11081F] dark:text-[#F8F7FC]">{formatCompact(targetRaise)} XAF</strong>
          </span>
        </div>

        <div className="w-full h-1.5 rounded-full bg-[#E4DFF2] dark:bg-[#2A174A] overflow-hidden">
          <div
            className="h-full bg-violet-600 rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#645582] dark:text-[#A99BC8] tabular-nums">
          <span>
            {sharesRemaining.toLocaleString()} / {totalShares.toLocaleString()} {t.sharesLeft.toLowerCase()}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="w-3 h-3 text-violet-500" />
            {creator.investorsCount ?? 0} {t.investors.toLowerCase()}
          </span>
        </div>
      </div>

      {/* Actions: Full-width Join Raise on mobile, Buy + Sell on desktop */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTrade(creator, 'BUY');
          }}
          className="flex-1 py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
        >
          <span className="sm:hidden">{t.joinRaise}</span>
          <span className="hidden sm:inline">{t.buy}</span>
        </button>

        {creator.status !== 'ENDED' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTrade(creator, 'SELL');
            }}
            className="hidden sm:inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] hover:border-red-500/60 text-[#11081F] dark:text-[#F8F7FC] text-xs font-semibold transition-colors whitespace-nowrap"
          >
            {t.sell}
          </button>
        )}
      </div>
    </div>
  );
};
