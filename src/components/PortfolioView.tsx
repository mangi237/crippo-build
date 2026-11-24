import React, { useMemo } from 'react';
import { Briefcase, Wallet, ShieldCheck, ArrowRight } from 'lucide-react';
import type { Creator, Trade, UserProfile } from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import { formatXAF } from '../utils/format';
import { ScreenState } from './ScreenState';

interface PortfolioViewProps {
  user: UserProfile | null;
  trades: Trade[];
  creators: Creator[];
  lang: AppLang;
  onRequireAuth: () => void;
  onSelectCreator: (creator: Creator, side: 'BUY' | 'SELL') => void;
  onGoToMarket: () => void;
  onOpenWallet: () => void;
}

interface Holding {
  creator: Creator;
  shares: number;
  costXAF: number;
  valueXAF: number;
}

/**
 * Post-race portfolio & royalty monitor (Crippo Exchange design, "Post-Race Portfolio Royalty Monitor").
 * Holdings are derived from the signed-in user's trades and live share prices.
 */
export const PortfolioView: React.FC<PortfolioViewProps> = ({
  user,
  trades,
  creators,
  lang,
  onRequireAuth,
  onSelectCreator,
  onGoToMarket,
  onOpenWallet,
}) => {
  const isFr = lang === 'FR';

  const holdings = useMemo<Holding[]>(() => {
    const byCreator = new Map<string, { shares: number; cost: number }>();
    for (const tr of trades) {
      const cur = byCreator.get(tr.creatorId) || { shares: 0, cost: 0 };
      if (tr.side === 'SELL') {
        const avg = cur.shares > 0 ? cur.cost / cur.shares : 0;
        cur.shares -= tr.sharesHeld;
        cur.cost -= avg * tr.sharesHeld;
      } else {
        cur.shares += tr.sharesHeld;
        cur.cost += tr.totalPaidXAF;
      }
      byCreator.set(tr.creatorId, cur);
    }
    const out: Holding[] = [];
    for (const [creatorId, pos] of byCreator.entries()) {
      if (pos.shares <= 0) continue;
      const creator = creators.find((c) => c.id === creatorId);
      if (!creator) continue;
      out.push({
        creator,
        shares: pos.shares,
        costXAF: Math.round(pos.cost),
        valueXAF: Math.round(pos.shares * creator.sharePriceXAF),
      });
    }
    return out.sort((a, b) => b.valueXAF - a.valueXAF);
  }, [trades, creators]);

  const totalValue = holdings.reduce((sum, h) => sum + h.valueXAF, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.costXAF, 0);
  const roiPct = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;
  const recentTrades = [...trades].sort((a, b) => (b.id > a.id ? 1 : -1)).slice(0, 6);

  if (!user) {
    return (
      <ScreenState
        title={isFr ? 'Connectez-vous pour voir vos parts' : 'Sign in to see your shares'}
        actionLabel={isFr ? 'Se connecter' : 'Sign in'}
        onAction={onRequireAuth}
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="card p-6">
        <p className="label-xs text-[#64748B]">{isFr ? 'Valorisation totale du portefeuille' : 'Total portfolio valuation'}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <p className="num font-display text-4xl font-bold text-[#0F172A]">{formatXAF(totalValue)}</p>
          <span className={`num text-sm font-semibold px-3 py-1 rounded-full ${roiPct >= 0 ? 'bg-[#059669]/10 text-[#059669]' : 'bg-[#DC2626]/10 text-[#DC2626]'}`}>
            {roiPct >= 0 ? '+' : ''}
            {roiPct.toFixed(1)}% ROI
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-[8px] bg-[#F8F9FC] p-4">
            <p className="label-xs text-[#64748B]">{isFr ? 'Coût de base' : 'Cost basis'}</p>
            <p className="num font-semibold mt-1">{formatXAF(totalCost)}</p>
          </div>
          <button type="button" onClick={onOpenWallet} className="rounded-[8px] bg-[#F8F9FC] p-4 text-left">
            <p className="label-xs text-[#64748B] flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> MoMo cash</p>
            <p className="num font-semibold mt-1">{formatXAF(user.walletBalanceXAF || 0)}</p>
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{isFr ? 'Déploiements actifs' : 'Active deployments'}</h2>
          <span className="label-xs text-[#6C2BD9]">{holdings.length} {isFr ? 'live' : 'live'}</span>
        </div>

        {holdings.length === 0 ? (
          <div className="card p-6 text-center space-y-3">
            <p className="text-sm text-[#64748B]">{isFr ? 'Aucune part détenue pour le moment.' : 'You do not hold any shares yet.'}</p>
            <button type="button" onClick={onGoToMarket} className="inline-flex items-center gap-2 text-xs font-semibold text-[#6C2BD9]">
              {isFr ? 'Explorer les courses' : 'Explore races'} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          holdings.map((h) => {
            const pnl = h.valueXAF - h.costXAF;
            return (
              <div key={h.creator.id} className="card p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-semibold truncate">{h.creator.raiseTitle || h.creator.name}</p>
                    <p className="text-xs text-[#64748B] truncate">{h.creator.name} · {h.creator.handle}</p>
                  </div>
                  <span className="label-xs px-2.5 py-1 rounded-full bg-[#6C2BD9]/10 text-[#6C2BD9] shrink-0">
                    {h.creator.escrowStatus === 'COMPLETED_LOCKED' ? (isFr ? 'Clôturée' : 'Settled') : (isFr ? 'En production' : 'In production')}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="label-xs text-[#64748B]">{isFr ? 'Parts' : 'You hold'}</p>
                    <p className="num font-semibold mt-1">{h.shares.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="label-xs text-[#64748B]">{isFr ? 'Valeur' : 'Current value'}</p>
                    <p className="num font-semibold mt-1">{formatXAF(h.valueXAF)}</p>
                  </div>
                  <div>
                    <p className="label-xs text-[#64748B]">P&amp;L</p>
                    <p className={`num font-semibold mt-1 ${pnl >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                      {pnl >= 0 ? '+' : ''}
                      {formatXAF(pnl)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => onSelectCreator(h.creator, 'SELL')} className="flex-1 py-2.5 rounded-[4px] bg-[#6C2BD9] text-white text-xs font-semibold">
                    {isFr ? 'Mettre en vente' : 'List for resale'}
                  </button>
                  <button type="button" onClick={() => onSelectCreator(h.creator, 'BUY')} className="flex-1 py-2.5 rounded-[4px] bg-[#F2F3FF] text-[#1E0B36] text-xs font-semibold">
                    {isFr ? 'Acheter plus' : 'Buy more'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-display text-base font-semibold">{isFr ? 'Journal des transactions' : 'Recent trades'}</h2>
        {recentTrades.length === 0 ? (
          <p className="text-xs text-[#64748B]">{isFr ? 'Aucune transaction.' : 'No trades yet.'}</p>
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {recentTrades.map((tr) => (
              <div key={tr.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{tr.creatorName}</p>
                  <p className="text-[#64748B]">{tr.paymentMethod || 'MTN MoMo'} · {tr.sharesHeld} {isFr ? 'parts' : 'sh'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`num font-semibold ${tr.side === 'SELL' ? 'text-[#DC2626]' : 'text-[#059669]'}`}>
                    {tr.side === 'SELL' ? '−' : '+'}
                    {formatXAF(tr.totalPaidXAF)}
                  </p>
                  <p className="label-xs text-[#64748B]">{tr.side || 'BUY'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[8px] bg-[#1E0B36] p-5 text-white space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#894FF7]" />
          <p className="font-display font-semibold">{isFr ? 'Coffre juridique' : 'Investor legal escrow vault'}</p>
        </div>
        <p className="text-xs text-white/70 leading-relaxed">
          {isFr
            ? 'Audité selon le registre CEMAC et le cadre OHADA. Contient les preuves de cession des revenus fractionnés.'
            : 'Audited under the CEMAC investment registry and the OHADA Uniform framework. Holds the fractional revenue assignment proofs.'}
        </p>
      </section>
    </div>
  );
};
