import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { Creator } from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import { translations } from '../i18n/translations';
import { formatCompact, formatXAF } from '../utils/format';
import { MiniSparkline } from './PriceChart';

interface MarketTableViewProps {
  creators: Creator[];
  lang: AppLang;
  onTrade: (creator: Creator, side: 'BUY' | 'SELL') => void;
}

export const MarketTableView: React.FC<MarketTableViewProps> = ({ creators, lang, onTrade }) => {
  const t = translations[lang];

  return (
    <div className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[680px]">
        <thead>
          <tr className="border-b border-[#E4DFF2] dark:border-[#2A174A] text-[11px] font-semibold text-[#645582] dark:text-[#A99BC8]">
            <th className="py-3 px-4">Raise / Creator</th>
            <th className="py-3 px-3">Trend</th>
            <th className="py-3 px-3 text-right">{t.sharePrice}</th>
            <th className="py-3 px-3 text-right">{t.change24h}</th>
            <th className="py-3 px-3 text-right">{t.sharesLeft}</th>
            <th className="py-3 px-3 text-right">{t.raised}</th>
            <th className="py-3 px-4 text-right">Order</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E4DFF2] dark:divide-[#2A174A] text-xs">
          {creators.map((c) => {
            const isUp = c.priceChangePct >= 0;
            const totalShares = c.totalShares || 1000;
            const left = c.sharesRemaining ?? totalShares;
            return (
              <tr
                key={c.id}
                onClick={() => onTrade(c, 'BUY')}
                className="cursor-pointer hover:bg-[#F8F7FC] dark:hover:bg-[#11081F]/70 transition-colors"
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {c.avatarUrl ? (
                      <img
                        src={c.avatarUrl}
                        alt={c.name}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-violet-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 font-semibold text-[#11081F] dark:text-[#F8F7FC] truncate">
                        <span className="truncate">
                          {lang === 'FR' ? c.raiseTitleFr || c.raiseTitle || c.name : c.raiseTitle || c.name}
                        </span>
                        {c.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-violet-500 shrink-0" />}
                      </div>
                      <div className="text-[11px] text-[#645582] dark:text-[#A99BC8] truncate">
                        {c.name} · {c.category}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <MiniSparkline
                    values={c.sparkline && c.sparkline.length > 1 ? c.sparkline : [c.sharePriceXAF, c.sharePriceXAF]}
                    isPositive={isUp}
                    width={72}
                    height={24}
                  />
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-[#11081F] dark:text-[#F8F7FC] tabular-nums">
                  {formatXAF(c.sharePriceXAF)}
                </td>
                <td
                  className={`py-3 px-3 text-right font-mono font-semibold tabular-nums ${
                    isUp ? 'text-emerald-500' : 'text-red-500'
                  }`}
                >
                  {isUp ? '+' : ''}
                  {c.priceChangePct}%
                </td>
                <td className="py-3 px-3 text-right font-mono text-[#11081F] dark:text-[#F8F7FC] tabular-nums">
                  {left.toLocaleString()} / {totalShares.toLocaleString()}
                </td>
                <td className="py-3 px-3 text-right font-mono text-[#645582] dark:text-[#A99BC8] tabular-nums">
                  {formatCompact(c.totalRaisedXAF || 0)}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTrade(c, 'BUY');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-semibold"
                    >
                      {t.buy}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTrade(c, 'SELL');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] text-[#11081F] dark:text-[#F8F7FC] text-[11px] font-semibold"
                    >
                      {t.sell}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
