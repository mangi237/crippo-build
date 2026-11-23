import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
  Minus,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { Creator, UserProfile } from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import { translations } from '../i18n/translations';
import { executeRaiseOrder } from '../services/firestoreService';
import { formatCompact, formatTimeRemaining, formatXAF } from '../utils/format';
import {
  calculateInvestorOwnershipPct,
  computeOrderBookLevels,
  SECONDARY_SPREAD_RATE,
} from '../utils/sharePricing';
import { PriceChart } from './PriceChart';

interface RaiseDetailViewProps {
  creator: Creator;
  initialSide?: 'BUY' | 'SELL';
  user: UserProfile | null;
  lang: AppLang;
  onBack: () => void;
  onRequireAuth: () => void;
  onClaim?: (creator: Creator) => void;
}

type Timeframe = '1H' | '24H' | '7D' | 'ALL';

export const RaiseDetailView: React.FC<RaiseDetailViewProps> = ({
  creator,
  initialSide = 'BUY',
  user,
  lang,
  onBack,
  onRequireAuth,
  onClaim,
}) => {
  const t = translations[lang];
  const [timeframe, setTimeframe] = useState<Timeframe>('ALL');
  const [side, setSide] = useState<'BUY' | 'SELL'>(initialSide);
  const [shares, setShares] = useState<number>(10);
  const [paymentMethod, setPaymentMethod] = useState<'MTN MoMo' | 'Orange Money' | 'Wallet'>('MTN MoMo');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isUp = creator.priceChangePct >= 0;
  const totalFixedShares = Math.max(100, creator.totalShares || 1000);
  const sharesRemaining = creator.sharesRemaining ?? totalFixedShares;
  const projectRevSharePct = creator.revSharePct ?? 25;
  const projected12mRevenue = creator.projected12mRevenueXAF || (creator.targetRaiseXAF || 1000000) * 1.4;

  const ownership = calculateInvestorOwnershipPct(shares, totalFixedShares, projectRevSharePct);
  const projectedAnnualDividendXAF = Math.round(
    projected12mRevenue * (ownership.effectiveRoyaltySharePct / 100)
  );

  const grossAmount = shares * creator.sharePriceXAF;
  const settlementAmount =
    side === 'SELL' ? Math.max(100, Math.round(grossAmount * (1 - SECONDARY_SPREAD_RATE))) : grossAmount;

  const fullHistory = useMemo(() => {
    if (creator.priceHistory && creator.priceHistory.length > 0) {
      return creator.priceHistory;
    }
    const vals = creator.sparkline && creator.sparkline.length > 0 ? creator.sparkline : [creator.sharePriceXAF];
    return vals.map((p, i) => ({
      time: `T-${vals.length - 1 - i}`,
      priceXAF: p,
    }));
  }, [creator.priceHistory, creator.sparkline, creator.sharePriceXAF]);

  const filteredHistory = useMemo(() => {
    if (timeframe === '1H') return fullHistory.slice(-4);
    if (timeframe === '24H') return fullHistory.slice(-10);
    if (timeframe === '7D') return fullHistory.slice(-24);
    return fullHistory;
  }, [fullHistory, timeframe]);

  const orderBook = useMemo(
    () => computeOrderBookLevels(creator.sharePriceXAF, sharesRemaining),
    [creator.sharePriceXAF, sharesRemaining]
  );

  async function handleConfirmOrder() {
    if (!user) {
      onRequireAuth();
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const trade = await executeRaiseOrder({
        uid: user.uid,
        creator,
        shares,
        side,
        paymentMethod,
      });
      setSuccessMsg(
        side === 'BUY'
          ? `Confirmed ${trade.sharesHeld} shares via ${paymentMethod} (${formatXAF(trade.totalPaidXAF)}). Locked on Cap Table.`
          : `Sold ${trade.sharesHeld} shares at market price minus 1.5% spread. Credited ${formatXAF(trade.totalPaidXAF)} to Cash Wallet.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to execute order.');
    } finally {
      setSubmitting(false);
    }
  }

  const targetRaise = creator.grossTargetXAF || creator.targetRaiseXAF || 1000000;
  const raised = creator.totalRaisedXAF || 0;
  const progressPct = Math.min(100, Math.max(3, Math.round((raised / Math.max(1, targetRaise)) * 100)));

  return (
    <div className="space-y-6">
      {/* Top Back Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] text-xs font-semibold text-[#11081F] dark:text-[#F8F7FC] hover:border-violet-500"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.markets}</span>
        </button>

        <div className="flex items-center gap-3 text-xs text-[#645582] dark:text-[#A99BC8]">
          <span>{creator.category}</span>
          {creator.closesAt && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{formatTimeRemaining(creator.closesAt)}</span>
            </>
          )}
          {creator.claimStatus === 'UNCLAIMED' && onClaim && (
            <button
              type="button"
              onClick={() => onClaim(creator)}
              className="px-4 py-2 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
            >
              {lang === 'FR' ? 'Réclamer ce profil créateur' : 'Are you this creator? Claim Profile'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Chart, Key Statistics, Clearinghouse Escrow */}
        <div className="lg:col-span-7 space-y-5">
          <div className="rounded-3xl bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] p-5 sm:p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                {creator.avatarUrl ? (
                  <img
                    src={creator.avatarUrl}
                    alt={creator.name}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-2xl object-cover bg-violet-500/15 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-violet-600 text-white font-bold flex items-center justify-center shrink-0">
                    {creator.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-xl sm:text-2xl font-bold text-[#11081F] dark:text-[#F8F7FC] truncate">
                      {lang === 'FR' ? creator.raiseTitleFr || creator.raiseTitle || creator.name : creator.raiseTitle || creator.name}
                    </h1>
                    {creator.isVerified && <CheckCircle2 className="w-4 h-4 text-violet-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-[#645582] dark:text-[#A99BC8]">
                    {creator.name} · {creator.handle} · {creator.city || 'Douala'}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-2xl font-bold text-[#11081F] dark:text-[#F8F7FC] tabular-nums">
                  {formatXAF(creator.sharePriceXAF)}
                </div>
                <div
                  className={`text-xs font-bold tabular-nums ${
                    isUp ? 'text-emerald-500' : 'text-red-500'
                  }`}
                >
                  {isUp ? '▲ +' : '▼ '}
                  {creator.priceChangePct}%
                </div>
              </div>
            </div>

            {/* Timeframe Selector */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-[#645582] dark:text-[#A99BC8]">
                Tap dots on chart to inspect cultural price catalysts
              </span>
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A]">
                {(['1H', '24H', '7D', 'ALL'] as Timeframe[]).map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setTimeframe(tf)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                      timeframe === tf
                        ? 'bg-violet-600 text-white'
                        : 'text-[#645582] dark:text-[#A99BC8] hover:text-[#11081F] dark:hover:text-white'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <PriceChart history={filteredHistory} isPositive={isUp} heightClass="h-60 sm:h-72" />
          </div>

          {/* Key Statistics (Mobile & Desktop 2x2 / 4-col Grid) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A]">
              <div className="text-[11px] text-[#645582] dark:text-[#A99BC8]">{t.target}</div>
              <div className="text-sm font-bold text-[#11081F] dark:text-[#F8F7FC] tabular-nums mt-1">
                {formatXAF(targetRaise)}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A]">
              <div className="text-[11px] text-[#645582] dark:text-[#A99BC8]">{t.sharesLeft}</div>
              <div className="text-sm font-bold text-[#11081F] dark:text-[#F8F7FC] tabular-nums mt-1">
                {sharesRemaining.toLocaleString()} / {totalFixedShares.toLocaleString()}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A]">
              <div className="text-[11px] text-[#645582] dark:text-[#A99BC8]">Royalty Pool</div>
              <div className="text-sm font-bold text-emerald-500 tabular-nums mt-1">
                {projectRevSharePct}% Net
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A]">
              <div className="text-[11px] text-[#645582] dark:text-[#A99BC8]">{t.investors}</div>
              <div className="text-sm font-bold text-[#11081F] dark:text-[#F8F7FC] tabular-nums mt-1 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-violet-500" />
                {creator.investorsCount ?? 0}
              </div>
            </div>
          </div>

          {/* Raise Escrow & Distributor Split Waterfall */}
          <div className="rounded-3xl bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <h2 className="text-sm font-bold text-[#11081F] dark:text-[#F8F7FC]">{t.escrowProtection}</h2>
              </div>
              <span className="text-xs font-mono text-[#645582] dark:text-[#A99BC8] tabular-nums">
                {progressPct}% Funded ({formatCompact(raised)} XAF)
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-[#E4DFF2] dark:bg-[#2A174A] overflow-hidden">
              <div className="h-full bg-violet-600 rounded-full" style={{ width: `${progressPct}%` }} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A]">
                <div className="font-semibold text-[#11081F] dark:text-[#F8F7FC]">{t.tranche1}</div>
                <div className="text-[#645582] dark:text-[#A99BC8] mt-0.5">
                  {creator.escrowStatus === 'ESCROW_HOLDING'
                    ? 'Held in Clearinghouse Escrow (100% auto-refund if target unmet)'
                    : 'Released upon full Raise close'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A]">
                <div className="font-semibold text-[#11081F] dark:text-[#F8F7FC] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-violet-500" />
                  {t.tranche2}
                </div>
                <div className="font-mono text-[11px] text-violet-500 mt-0.5 truncate">
                  {creator.distributorSplitEmail || `raise-${creator.id}@clearing.crippo.cm`}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Order Panel + Order Book */}
        <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-28">
          <div className="rounded-3xl bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] p-5 space-y-4">
            {/* Buy / Sell Tabs */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A]">
              <button
                type="button"
                onClick={() => {
                  setSide('BUY');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 rounded-xl text-xs font-bold transition-colors ${
                  side === 'BUY'
                    ? 'bg-emerald-500 text-white'
                    : 'text-[#645582] dark:text-[#A99BC8]'
                }`}
              >
                {t.buy}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSide('SELL');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 rounded-xl text-xs font-bold transition-colors ${
                  side === 'SELL'
                    ? 'bg-red-500 text-white'
                    : 'text-[#645582] dark:text-[#A99BC8]'
                }`}
              >
                {t.sell}
              </button>
            </div>

            {/* Bulk Shares Quick Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[#645582] dark:text-[#A99BC8]">
                <span>Shares</span>
                <div className="flex items-center gap-1.5">
                  {[1, 10, 50, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setShares(preset)}
                      className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold transition-colors ${
                        shares === preset
                          ? 'bg-violet-600 text-white'
                          : 'bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] text-[#11081F] dark:text-[#F8F7FC]'
                      }`}
                    >
                      {preset}x
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShares((s) => Math.max(1, s - 1))}
                  className="w-10 h-10 rounded-xl bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] flex items-center justify-center text-[#11081F] dark:text-[#F8F7FC]"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="text-center">
                  <div className="text-xl font-bold font-mono text-[#11081F] dark:text-[#F8F7FC] tabular-nums">
                    {shares}
                  </div>
                  <div className="text-[11px] text-[#645582] dark:text-[#A99BC8] tabular-nums">
                    @ {formatXAF(creator.sharePriceXAF)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShares((s) => s + 1)}
                  className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Live Ownership % & Projected Yield Breakdown */}
            <div className="p-3.5 rounded-2xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#645582] dark:text-[#A99BC8]">{t.ownershipPct}</span>
                <span className="font-mono font-bold text-violet-500 tabular-nums">
                  {ownership.effectiveRoyaltySharePct}% ({ownership.poolOwnershipPct}% pool)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#645582] dark:text-[#A99BC8]">{t.projectedDividend}</span>
                <span className="font-mono font-bold text-emerald-500 tabular-nums">
                  ~{formatXAF(projectedAnnualDividendXAF)} / yr
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#E4DFF2] dark:border-[#2A174A]">
                <span className="font-semibold text-[#11081F] dark:text-[#F8F7FC]">
                  {side === 'BUY' ? 'Total Execution' : 'Net Payout (-1.5% spread)'}
                </span>
                <span className="font-mono font-bold text-[#11081F] dark:text-[#F8F7FC] tabular-nums">
                  {formatXAF(settlementAmount)}
                </span>
              </div>
            </div>

            {/* Payment Method (MTN MoMo / Orange Money / Cash Wallet) */}
            {side === 'BUY' && (
              <div className="grid grid-cols-3 gap-2">
                {(['MTN MoMo', 'Orange Money', 'Wallet'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 px-2 rounded-xl text-[11px] font-semibold border transition-colors ${
                      paymentMethod === method
                        ? 'bg-violet-600 border-violet-600 text-white'
                        : 'bg-[#F8F7FC] dark:bg-[#11081F] border-[#E4DFF2] dark:border-[#2A174A] text-[#645582] dark:text-[#A99BC8]'
                    }`}
                  >
                    {method === 'Wallet' ? 'Cash Wallet' : method}
                  </button>
                ))}
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-500">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-500">
                {successMsg}
              </div>
            )}

            <button
              type="button"
              disabled={submitting}
              onClick={handleConfirmOrder}
              className={`w-full py-4 px-5 rounded-full text-white text-sm font-bold transition-colors disabled:opacity-50 ${
                side === 'BUY'
                  ? 'bg-violet-600 hover:bg-violet-500'
                  : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {submitting
                ? 'Settling...'
                : `${side === 'BUY' ? t.buyNow : t.sellNow} · ${formatXAF(settlementAmount)}`}
            </button>
          </div>

          {/* Live Order Book (Bids vs Asks matching Mobile Financial UI) */}
          <div className="rounded-3xl bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] p-5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <h3 className="font-bold text-[#11081F] dark:text-[#F8F7FC]">{t.orderBook}</h3>
              <span className="font-mono text-[#645582] dark:text-[#A99BC8] tabular-nums">
                1.5% spread
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono tabular-nums">
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-semibold text-[#645582] dark:text-[#A99BC8]">
                  <span>LOT</span>
                  <span>BID (XAF)</span>
                </div>
                {orderBook.bids.map((row, idx) => (
                  <div key={idx} className="flex justify-between py-1 px-2 rounded-lg bg-emerald-500/8">
                    <span className="text-[#11081F] dark:text-[#F8F7FC]">{row.lot}</span>
                    <span className="text-emerald-500 font-semibold">{row.priceXAF.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-semibold text-[#645582] dark:text-[#A99BC8]">
                  <span>ASK (XAF)</span>
                  <span>LOT</span>
                </div>
                {orderBook.asks.map((row, idx) => (
                  <div key={idx} className="flex justify-between py-1 px-2 rounded-lg bg-red-500/8">
                    <span className="text-red-500 font-semibold">{row.priceXAF.toLocaleString()}</span>
                    <span className="text-[#11081F] dark:text-[#F8F7FC]">{row.lot}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
