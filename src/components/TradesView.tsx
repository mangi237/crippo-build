import React from 'react';
import { Clock, Layers, TrendingUp } from 'lucide-react';
import type { Creator, PredictionVote, Trade, UserProfile } from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import { translations } from '../i18n/translations';
import { formatTimeRemaining, formatXAF, getRoiWindowProgress } from '../utils/format';

interface TradesViewProps {
  user: UserProfile | null;
  trades: Trade[];
  predictionVotes: PredictionVote[];
  creators: Creator[];
  lang: AppLang;
  onRequireAuth: () => void;
  onSelectCreator: (creator: Creator) => void;
  onGoToMarket: () => void;
  onOpenWallet: () => void;
}

export const TradesView: React.FC<TradesViewProps> = ({
  user,
  trades,
  predictionVotes,
  creators,
  lang,
  onRequireAuth,
  onSelectCreator,
  onGoToMarket,
  onOpenWallet,
}) => {
  const t = translations[lang];

  if (!user) {
    return (
      <div className="py-16 px-4 text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-[#6C2BD9]/15 text-[#6C2BD9] flex items-center justify-center mx-auto">
          <Layers className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-[#0F172A] dark:text-[#F8F9FC]">{t.portfolio}</h2>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#A99BC8] max-w-sm mx-auto leading-relaxed">
            Sign in to view your active Raise trades, countdown timelines, Yes/No prediction contracts, and MoMo Cash Wallet.
          </p>
        </div>
        <button
          type="button"
          onClick={onRequireAuth}
          className="px-7 py-3.5 rounded-full bg-[#6C2BD9] hover:bg-[#6C2BD9] text-white text-xs font-semibold transition-colors"
        >
          {t.logIn}
        </button>
      </div>
    );
  }

  const creatorMap = new Map<string, Creator>();
  for (const c of creators) creatorMap.set(c.id, c);

  let totalCostXAF = 0;
  let liveValueXAF = 0;

  for (const tr of trades) {
    if (tr.side === 'SELL') continue;
    const liveCreator = creatorMap.get(tr.creatorId);
    const currentPrice = liveCreator ? liveCreator.sharePriceXAF : tr.entryPriceXAF;
    totalCostXAF += tr.totalPaidXAF;
    liveValueXAF += tr.sharesHeld * currentPrice;
  }

  const totalPnlXAF = liveValueXAF - totalCostXAF;
  const totalPnlPct = totalCostXAF > 0 ? Math.round((totalPnlXAF / totalCostXAF) * 1000) / 10 : 0;
  const portfolioUp = totalPnlXAF >= 0;

  return (
    <div className="space-y-5">
      {/* Portfolio Summary + Wallet CTA */}
      <div className="bg-white dark:bg-[#180D2B] border border-[#E2E8F0] dark:border-[#2A174A] rounded-lg p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-xs text-[#64748B] dark:text-[#A99BC8]">{t.portfolio}</span>
            <h1 className="text-3xl font-bold font-display num text-[#0F172A] dark:text-[#F8F9FC] tabular-nums mt-0.5">
              {formatXAF(liveValueXAF)}
            </h1>
            {trades.length > 0 && (
              <div
                className={`text-xs font-display num font-semibold tabular-nums mt-1 ${
                  portfolioUp ? 'text-[#059669]' : 'text-[#DC2626]'
                }`}
              >
                {portfolioUp ? '▲ +' : '▼ '}
                {formatXAF(totalPnlXAF)} ({portfolioUp ? '+' : ''}
                {totalPnlPct}%)
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenWallet}
            className="px-5 py-2.5 rounded-full bg-[#6C2BD9] hover:bg-[#6C2BD9] text-white text-xs font-semibold tabular-nums"
          >
            {t.wallet}: {formatXAF(user.walletBalanceXAF || 0)}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#E2E8F0] dark:border-[#2A174A] text-xs">
          <div>
            <div className="text-[#64748B] dark:text-[#A99BC8]">Invested</div>
            <div className="font-display num font-bold tabular-nums mt-0.5">{formatXAF(totalCostXAF)}</div>
          </div>
          <div>
            <div className="text-[#64748B] dark:text-[#A99BC8]">Raise Positions</div>
            <div className="font-display num font-bold tabular-nums mt-0.5">{trades.length}</div>
          </div>
          <div>
            <div className="text-[#64748B] dark:text-[#A99BC8]">Predictions</div>
            <div className="font-display num font-bold tabular-nums mt-0.5">{predictionVotes.length}</div>
          </div>
        </div>
      </div>

      {/* Share Positions */}
      {trades.length === 0 && predictionVotes.length === 0 ? (
        <div className="py-14 px-4 text-center space-y-4">
          <p className="text-base font-bold text-[#0F172A] dark:text-[#F8F9FC]">No active positions yet</p>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#A99BC8] max-w-sm mx-auto">
            Back any creator Raise or vote Yes/No on a cultural prediction market to build your portfolio.
          </p>
          <button
            type="button"
            onClick={onGoToMarket}
            className="px-6 py-3 rounded-full bg-[#6C2BD9] hover:bg-[#6C2BD9] text-white text-xs font-semibold"
          >
            Explore {t.markets}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {trades.map((trade) => {
            const liveCreator = creatorMap.get(trade.creatorId);
            const livePrice = liveCreator ? liveCreator.sharePriceXAF : trade.entryPriceXAF;
            const currentVal = trade.sharesHeld * livePrice;
            const pnl = currentVal - trade.totalPaidXAF;
            const pnlPct = trade.totalPaidXAF > 0 ? Math.round((pnl / trade.totalPaidXAF) * 1000) / 10 : 0;
            const isUp = pnl >= 0;

            const roiWindow = getRoiWindowProgress(
              trade.status === 'roi_active' ? trade.createdAt : undefined,
              trade.closesAt,
              trade.roiDurationMonths || 12
            );

            return (
              <div
                key={trade.id}
                onClick={() => liveCreator && onSelectCreator(liveCreator)}
                className={`bg-white dark:bg-[#180D2B] border border-[#E2E8F0] dark:border-[#2A174A] rounded-lg p-5 space-y-3.5 ${
                  liveCreator ? 'cursor-pointer hover:border-violet-500/70' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          trade.side === 'SELL'
                            ? 'bg-[#DC2626]/15 text-[#DC2626]'
                            : 'bg-[#059669]/15 text-[#059669]'
                        }`}
                      >
                        {trade.side || 'BUY'}
                      </span>
                      <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8F9FC] truncate">
                        {trade.creatorName}
                      </h3>
                    </div>
                    <p className="text-xs text-[#64748B] dark:text-[#A99BC8] tabular-nums mt-0.5">
                      {trade.sharesHeld} shares @ {formatXAF(trade.entryPriceXAF)}
                      {trade.ownershipPct ? ` · ${trade.ownershipPct}% royalty` : ''}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-display num font-bold tabular-nums">{formatXAF(currentVal)}</div>
                    <div
                      className={`text-xs font-display num font-semibold tabular-nums ${
                        isUp ? 'text-[#059669]' : 'text-[#DC2626]'
                      }`}
                    >
                      {isUp ? '+' : ''}
                      {pnlPct}%
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] space-y-1.5">
                  <div className="flex justify-between text-[11px] text-[#64748B] dark:text-[#A99BC8]">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#6C2BD9]" />
                      {trade.status === 'in_race' ? 'Raise Window' : trade.status === 'roi_active' ? 'ROI Active' : 'Settled'}
                    </span>
                    <span className="tabular-nums">
                      {trade.closesAt ? formatTimeRemaining(trade.closesAt) : 'Active'}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#E2E8F0] dark:bg-[#2A174A] overflow-hidden">
                    <div
                      className="h-full bg-[#6C2BD9] rounded-full"
                      style={{ width: `${Math.max(8, roiWindow.pct)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {predictionVotes.map((v) => (
            <div
              key={v.id}
              className="bg-white dark:bg-[#180D2B] border border-[#E2E8F0] dark:border-[#2A174A] rounded-lg p-5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#6C2BD9]">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {t.predictions}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    v.side === 'YES' ? 'bg-[#059669]/15 text-[#059669]' : 'bg-[#DC2626]/15 text-[#DC2626]'
                  }`}
                >
                  {v.side} · {v.shares}x
                </span>
              </div>
              <p className="text-xs font-semibold text-[#0F172A] dark:text-[#F8F9FC]">
                {lang === 'FR' ? v.questionFr || v.questionEn : v.questionEn}
              </p>
              <div className="flex justify-between text-[11px] text-[#64748B] dark:text-[#A99BC8] tabular-nums">
                <span>Stake: {formatXAF(v.totalPaidXAF)}</span>
                <span>Max Payout: {formatXAF(v.shares * 1000)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
