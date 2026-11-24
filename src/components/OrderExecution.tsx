import React, { useMemo, useState } from 'react';
import { ArrowLeft, Briefcase, ShieldCheck, Smartphone, Minus, Plus } from 'lucide-react';
import type { Creator, Trade, UserProfile } from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import { executeRaiseOrder } from '../services/firestoreService';
import { formatXAF } from '../utils/format';
import { computeOrderBookLevels, SECONDARY_SPREAD_RATE } from '../utils/sharePricing';

interface OrderExecutionProps {
  creator: Creator;
  trades: Trade[];
  user: UserProfile | null;
  lang: AppLang;
  initialSide?: 'BUY' | 'SELL';
  onBack: () => void;
  onRequireAuth: () => void;
}

const QUICK_PCTS = [0.25, 0.5, 0.75, 1] as const;

/**
 * Order Execution (Crippo Exchange design, "Secondary Market P2P Share Resale").
 * Buy or sell shares of a creator Raise. Sell uses the signed-in holder's net position.
 * Settlement is MoMo-first; the order book is derived from the live share price.
 */
export const OrderExecution: React.FC<OrderExecutionProps> = ({
  creator,
  trades,
  user,
  lang,
  initialSide = 'BUY',
  onBack,
  onRequireAuth,
}) => {
  const [side, setSide] = useState<'BUY' | 'SELL'>(initialSide);
  const [shares, setShares] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const price = creator.sharePriceXAF;
  const isFr = lang === 'FR';

  const heldShares = useMemo(() => {
    let net = 0;
    for (const tr of trades) {
      if (tr.creatorId !== creator.id) continue;
      net += tr.side === 'SELL' ? -tr.sharesHeld : tr.sharesHeld;
    }
    return Math.max(0, net);
  }, [trades, creator.id]);

  const available = side === 'SELL' ? heldShares : Math.max(0, creator.sharesRemaining ?? 0);
  const maxShares = Math.max(1, Math.min(available, 10000));
  const qty = Math.min(Math.max(1, shares), maxShares);

  const gross = qty * price;
  const fee = Math.round(gross * SECONDARY_SPREAD_RATE * 2);
  const net = side === 'SELL' ? gross - fee : gross + fee;

  const book = useMemo(() => computeOrderBookLevels(price, creator.sharesRemaining ?? 0), [price, creator.sharesRemaining]);

  async function handleSubmit() {
    setError(null);
    setDone(null);
    if (!user) {
      onRequireAuth();
      return;
    }
    if (qty < 1 || qty > available) {
      setError(isFr ? 'Quantité indisponible.' : 'Quantity is not available.');
      return;
    }
    setSubmitting(true);
    try {
      await executeRaiseOrder({
        uid: user.uid,
        creator,
        shares: qty,
        side,
        paymentMethod: 'MTN MoMo',
      });
      setDone(
        side === 'BUY'
          ? isFr ? `${qty} parts achetées.` : `Bought ${qty} shares.`
          : isFr ? `${qty} parts mises en vente.` : `Listed ${qty} shares for resale.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-4 pb-28">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#0F172A] shadow-sm">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="font-display text-lg font-semibold text-[#0F172A]">
          {isFr ? 'Exécution d’ordre' : 'Order Execution'}
        </h1>
        <span className="w-9" />
      </div>

      {/* Asset header */}
      <div className="card p-4 flex items-center gap-3">
        <div className="w-14 h-14 rounded-[8px] bg-[#EAEDFF] overflow-hidden shrink-0">
          {creator.avatarUrl && <img src={creator.avatarUrl} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-[#0F172A] truncate">{creator.raiseTitle || creator.name}</p>
          <p className="label-xs text-[#6C2BD9] mt-0.5">Royalty share · {creator.handle}</p>
        </div>
        <div className="text-right">
          <p className="num font-display text-xl font-bold text-[#0F172A]">{formatXAF(price)}</p>
          <p className="num text-[11px] text-[#64748B]">
            {creator.priceChangePct >= 0 ? '▲ +' : '▼ '}
            {creator.priceChangePct}%
          </p>
        </div>
      </div>

      {/* Buy / Sell */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-[#EEF1F8] rounded-[8px]">
        <button
          type="button"
          onClick={() => {
            setSide('BUY');
            setShares(1);
          }}
          className={`py-2.5 rounded-[4px] text-xs font-semibold flex items-center justify-center gap-2 ${
            side === 'BUY' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B]'
          }`}
        >
          <Briefcase className="w-4 h-4" /> {isFr ? 'Acheter' : 'Buy shares'}
        </button>
        <button
          type="button"
          onClick={() => {
            setSide('SELL');
            setShares(1);
          }}
          className={`py-2.5 rounded-[4px] text-xs font-semibold flex items-center justify-center gap-2 ${
            side === 'SELL' ? 'bg-[#6C2BD9] text-white' : 'text-[#64748B]'
          }`}
        >
          {isFr ? 'Vendre mes parts' : 'Sell my shares'}
        </button>
      </div>

      <div className="card p-4 space-y-4">
        <div className="flex items-center justify-between rounded-[4px] bg-[#F2F3FF] px-3 py-2.5 text-xs">
          <span className="font-semibold text-[#0F172A]">
            {side === 'SELL' ? (isFr ? 'Vos parts' : 'Your portfolio') : (isFr ? 'Parts disponibles' : 'Shares available')}
          </span>
          <span className="num font-semibold text-[#6C2BD9]">{available.toLocaleString()}</span>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748B]">{isFr ? 'Parts' : 'Shares'}</span>
            <span className="num text-[11px] text-[#64748B]">Limit {formatXAF(price)}/sh</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Decrease shares"
              onClick={() => setShares(Math.max(1, qty - 1))}
              className="w-11 h-11 rounded-[4px] bg-[#F2F3FF] flex items-center justify-center"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="number"
              min={1}
              max={maxShares}
              value={qty}
              onChange={(e) => setShares(Number(e.target.value) || 1)}
              className="num flex-1 text-center font-display text-3xl font-bold text-[#0F172A] bg-transparent focus:outline-none"
            />
            <button
              type="button"
              aria-label="Increase shares"
              onClick={() => setShares(Math.min(maxShares, qty + 1))}
              className="w-11 h-11 rounded-[4px] bg-[#F2F3FF] flex items-center justify-center"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {QUICK_PCTS.map((pct) => {
              const v = Math.max(1, Math.floor(available * pct));
              return (
                <button
                  key={pct}
                  type="button"
                  disabled={available < 1}
                  onClick={() => setShares(v)}
                  className="py-2 rounded-[4px] bg-[#F8F9FC] border border-[#E2E8F0] text-xs font-semibold text-[#0F172A] disabled:opacity-40"
                >
                  {pct === 1 ? 'MAX' : `${pct * 100}%`} ({v})
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[8px] bg-[#F8F9FC] p-4 space-y-2 text-xs">
          <Row label={`${isFr ? 'Valeur brute' : 'Gross value'} (${qty} × ${price.toLocaleString()})`} value={formatXAF(gross)} />
          <Row label={`${isFr ? 'Frais de compensation' : 'Clearing fee'} (${(SECONDARY_SPREAD_RATE * 200).toFixed(1)}%)`} value={`${side === 'SELL' ? '−' : '+'}${formatXAF(fee)}`} tone="red" />
          <div className="h-px bg-[#E2E8F0]" />
          <div className="flex items-end justify-between">
            <span className="label-xs text-[#64748B]">{side === 'SELL' ? (isFr ? 'Net estimé' : 'Estimated net payout') : (isFr ? 'Total estimé' : 'Estimated total')}</span>
            <span className="num font-display text-xl font-bold text-[#059669]">{formatXAF(net)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-[8px] border border-[#E2E8F0] p-3">
          <div className="w-9 h-9 rounded-[4px] bg-[#FFCC00] flex items-center justify-center shrink-0">
            <Smartphone className="w-4 h-4 text-[#0F172A]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#0F172A]">MTN MoMo · {isFr ? 'routage auto' : 'auto-routed'}</p>
            <p className="num text-[11px] text-[#64748B] truncate">{user?.momoPhone || (isFr ? "Numéro non lié" : "No number linked")}</p>
          </div>
        </div>

        {error && <p className="text-xs text-[#DC2626] leading-relaxed">{error}</p>}
        {done && <p className="text-xs text-[#059669] font-semibold">{done}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || available < 1}
          className={`w-full py-3.5 rounded-[4px] text-white text-sm font-semibold uppercase tracking-wide disabled:opacity-40 ${
            side === 'BUY' ? 'bg-[#059669] hover:bg-[#047857]' : 'bg-[#DC2626] hover:bg-[#B91C1C]'
          }`}
        >
          {!user
            ? isFr ? 'Connectez-vous pour trader' : 'Sign in to trade'
            : submitting
              ? isFr ? 'Traitement…' : 'Processing…'
              : side === 'BUY'
                ? isFr ? 'Acheter via MoMo' : 'Buy via MTN / Orange MoMo'
                : isFr ? 'Mettre en vente' : 'List shares for instant resale'}
        </button>
      </div>

      {/* P2P order book (derived from live price and remaining supply) */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-[#0F172A]">P2P Order Book</h2>
          <span className="label-xs text-[#059669]">Live spread {formatXAF(Math.round(price * SECONDARY_SPREAD_RATE))}</span>
        </div>
        <div className="grid grid-cols-3 label-xs text-[#64748B] px-1">
          <span>{isFr ? 'Prix' : 'Unit price'}</span>
          <span className="text-center">{isFr ? 'Volume' : 'Volume'}</span>
          <span className="text-right">{isFr ? 'Participant' : 'Participant'}</span>
        </div>
        {book.asks
          .slice()
          .reverse()
          .map((lvl, i) => (
            <div key={`a${i}`} className="grid grid-cols-3 items-center text-xs num rounded-[4px] bg-[#FEE2E2]/60 px-2 py-1.5">
              <span className="font-semibold text-[#DC2626]">{lvl.priceXAF.toLocaleString()}</span>
              <span className="text-center text-[#0F172A]">{lvl.lot} Shs</span>
              <span className="text-right text-[#64748B]">Ask</span>
            </div>
          ))}
        {book.bids.map((lvl, i) => (
          <div key={`b${i}`} className="grid grid-cols-3 items-center text-xs num rounded-[4px] bg-[#D1FAE5]/60 px-2 py-1.5">
            <span className="font-semibold text-[#059669]">{lvl.priceXAF.toLocaleString()}</span>
            <span className="text-center text-[#0F172A]">{lvl.lot} Shs</span>
            <span className="text-right text-[#64748B]">Bid</span>
          </div>
        ))}
      </div>

      <div className="rounded-[8px] bg-[#1E0B36] p-5 text-white space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#894FF7]" />
          <p className="font-display font-semibold">{isFr ? 'Règlement MoMo instantané à 100 %' : '100% Instant MoMo Settlement'}</p>
        </div>
        <p className="text-xs text-white/70 leading-relaxed">
          {isFr
            ? 'L’acheteur valide l’invite USSD ; le vendeur reçoit les fonds en quelques secondes. Le droit de créance maître est transféré automatiquement.'
            : 'The buyer approves the CamPay USSD prompt; the seller receives funds in seconds. The master royalty claim transfers on-chain automatically.'}
        </p>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; tone?: 'red' }> = ({ label, value, tone }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-[#64748B]">{label}</span>
    <span className={`num font-semibold ${tone === 'red' ? 'text-[#DC2626]' : 'text-[#0F172A]'}`}>{value}</span>
  </div>
);
