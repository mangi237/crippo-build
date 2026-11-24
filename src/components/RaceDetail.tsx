import React, { useMemo, useState } from 'react';
import { ArrowLeft, BadgeCheck, Minus, Plus, ShieldCheck, Smartphone, Users } from 'lucide-react';
import type { Creator, UserProfile } from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import { executeRaiseOrder } from '../services/firestoreService';
import { formatCompact, formatTimeRemaining, formatXAF } from '../utils/format';
import { calculateInvestorOwnershipPct } from '../utils/sharePricing';
import { PriceChart } from './PriceChart';

interface RaceDetailProps {
  creator: Creator;
  user: UserProfile | null;
  lang: AppLang;
  onBack: () => void;
  onRequireAuth: () => void;
  onClaim?: (creator: Creator) => void;
  onOpenDossier: (creator: Creator) => void;
}

const QTY_PRESETS = [1, 4, 10, 20] as const;
type Network = 'MTN MoMo' | 'Orange Money';

const PHASES = [
  { en: 'Pre-production capital raise', fr: 'Levée de capitaux pré-production', body: 'Crowdfund vault escrow. Target funding for studio sound and mastering.' },
  { en: 'Studio recording & engineering', fr: 'Enregistrement & ingénierie', body: 'Recording sessions, instrumentation and mixing, paid against verified invoices.' },
  { en: 'Master delivery & ISRC lock', fr: 'Livraison maîtres & verrou ISRC', body: 'Masters and metadata locked to the ISRC registry before distribution.' },
  { en: 'Worldwide distribution & royalties', fr: 'Distribution mondiale & royalties', body: 'Streaming revenue split and paid out to holders via Mobile Money each quarter.' },
];

/**
 * Pre-production race fundraising (Crippo Exchange design, "Pre-Production Race Fundraising").
 * BUY flow for a creator Raise: stage banner, funding progress, flight plan, MoMo unit purchase.
 * Selling is handled by OrderExecution.
 */
export const RaceDetail: React.FC<RaceDetailProps> = ({ creator, user, lang, onBack, onRequireAuth, onClaim, onOpenDossier }) => {
  const isFr = lang === 'FR';
  const [qty, setQty] = useState(4);
  const [network, setNetwork] = useState<Network>('MTN MoMo');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const raised = creator.totalRaisedXAF ?? 0;
  const target = creator.targetRaiseXAF ?? creator.grossTargetXAF ?? 0;
  const fundedPct = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0;
  const remainingXAF = Math.max(0, target - raised);
  const isOpen = creator.status !== 'FUNDED' && creator.status !== 'ENDED';
  const stageIndex = fundedPct >= 100 ? 2 : 0;
  const ownership = calculateInvestorOwnershipPct(qty, creator.totalShares ?? 1, creator.revSharePct ?? 0);
  const cost = qty * creator.sharePriceXAF;
  const history = useMemo(() => creator.priceHistory ?? [], [creator.priceHistory]);
  const isUp = creator.priceChangePct >= 0;

  async function handleBuy() {
    setError(null);
    setDone(null);
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!isOpen) {
      setError(isFr ? 'Cette course est fermée.' : 'This race is closed.');
      return;
    }
    setSubmitting(true);
    try {
      await executeRaiseOrder({ uid: user.uid, creator, shares: qty, side: 'BUY', paymentMethod: network });
      setDone(isFr ? `${qty} parts achetées. Confirmez l’invite USSD sur votre téléphone.` : `Bought ${qty} units. Approve the USSD prompt on your phone.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 pb-28">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="label-xs text-[#6C2BD9]">{isFr ? 'Course en direct' : 'Live race'}</span>
        <button type="button" onClick={() => onOpenDossier(creator)} className="text-xs font-semibold text-[#6C2BD9]">
          {isFr ? 'Dossier' : 'Dossier'}
        </button>
      </div>

      {/* Stage banner */}
      <div className="rounded-[8px] bg-[#1E0B36] p-5 text-white flex items-center justify-between gap-3">
        <div>
          <p className="label-xs text-[#894FF7]">{isOpen ? (isFr ? 'Course ouverte' : 'Live race status') : isFr ? 'Course fermée' : 'Race closed'}</p>
          <p className="font-display text-lg font-bold mt-1">
            {isFr ? 'Étape 01 · Levée pré-production' : 'Stage 01 · Pre-production capital raise'}
          </p>
        </div>
        {creator.closesAt && (
          <span className="label-xs px-3 py-1.5 rounded-full bg-white/10 whitespace-nowrap">
            {isFr ? 'Clôture' : 'Ends in'} {formatTimeRemaining(creator.closesAt)}
          </span>
        )}
      </div>

      {/* Creator + raise header */}
      <section className="card p-5 flex gap-4">
        <div className="w-20 h-20 rounded-[8px] bg-[#EAEDFF] overflow-hidden shrink-0">
          {(creator.coverUrl || creator.avatarUrl) && <img src={creator.coverUrl || creator.avatarUrl} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            <span className="label-xs px-2 py-0.5 rounded-full bg-[#6C2BD9]/10 text-[#6C2BD9]">{creator.category}</span>
            {creator.isVerified && (
              <span className="label-xs px-2 py-0.5 rounded-full bg-[#059669]/10 text-[#059669] flex items-center gap-1">
                <BadgeCheck className="w-3 h-3" /> {isFr ? 'Vérifié' : 'Verified'}
              </span>
            )}
          </div>
          <h1 className="font-display text-xl font-bold truncate">{creator.raiseTitle || creator.name}</h1>
          <p className="text-xs text-[#64748B] truncate">
            {creator.name} · {creator.handle}
            {creator.city ? ` · ${creator.city}` : ''}
          </p>
          {creator.summary && <p className="text-xs text-[#64748B] leading-relaxed line-clamp-3">{creator.summary}</p>}
        </div>
      </section>

      {/* Funding progress */}
      <section className="card p-5 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="label-xs text-[#64748B]">{isFr ? 'Levé à ce jour' : 'Raised to date'}</p>
            <p className="num font-display text-2xl font-bold mt-1">{formatXAF(raised)}</p>
          </div>
          <div className="text-right">
            <p className="label-xs text-[#64748B]">{isFr ? 'Objectif' : 'Target'}</p>
            <p className="num text-sm font-semibold mt-1">{formatXAF(target)}</p>
          </div>
        </div>
        <div className="h-2 rounded-full bg-[#EAEDFF] overflow-hidden">
          <div className="h-full bg-[#6C2BD9] rounded-full" style={{ width: `${fundedPct}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="num font-semibold text-[#6C2BD9]">{fundedPct}% {isFr ? 'financé' : 'funded'}</span>
          <span className="num text-[#64748B]">{formatXAF(remainingXAF)} {isFr ? 'restants' : 'remaining'}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <Stat label={isFr ? 'Prix de la part' : 'Share price'} value={formatXAF(creator.sharePriceXAF)} />
          <Stat label={isFr ? 'Pool de revenus' : 'Royalty pool'} value={`${creator.revSharePct ?? 0}% gross`} tone="green" />
          <Stat label={isFr ? 'Investisseurs' : 'Shareholders'} value={(creator.investorsCount ?? 0).toLocaleString()} icon={<Users className="w-3.5 h-3.5" />} />
          <Stat label={isFr ? 'Score Crippo' : 'Crippo score'} value={`${creator.crippoScore ?? creator.underwritingScore ?? '—'}/100`} />
        </div>
      </section>

      {/* Price trajectory */}
      <section className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">{isFr ? 'Trajectoire du prix' : 'Price trajectory'}</h2>
          <span className={`num text-xs font-semibold ${isUp ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
            {isUp ? '+' : ''}
            {creator.priceChangePct}%
          </span>
        </div>
        {history.length > 1 ? (
          <PriceChart history={history} isPositive={isUp} heightClass="h-52" />
        ) : (
          <p className="text-xs text-[#64748B]">{isFr ? 'Historique disponible après les premières transactions.' : 'History appears after the first trades.'}</p>
        )}
        <p className="text-[11px] text-[#64748B] num">
          {isFr ? 'Volume' : 'Volume'} {formatCompact(creator.tradingVolumeXAF)} XAF
        </p>
      </section>

      {/* Flight plan */}
      <section className="card p-5 space-y-3">
        <h2 className="font-display text-base font-semibold">{isFr ? 'Plan de production' : 'Production flight plan'}</h2>
        {PHASES.map((p, i) => (
          <div key={p.en} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${i === stageIndex ? 'bg-[#6C2BD9]' : 'bg-[#94A3B8]'}`}>{i + 1}</span>
              {i < PHASES.length - 1 && <span className="w-px flex-1 bg-[#E2E8F0] my-1" />}
            </div>
            <div className="pb-3">
              <p className="text-sm font-semibold">
                {isFr ? p.fr : p.en}
                {i === stageIndex && <span className="ml-2 label-xs text-[#6C2BD9]">{isFr ? 'En cours' : 'Current'}</span>}
              </p>
              <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">{p.body}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Acquire units */}
      <section className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold">{isFr ? 'Acquérir des parts' : 'Acquire units'}</h2>
            <p className="text-xs text-[#64748B]">{isFr ? 'Achat instantané par Mobile Money' : 'Instant mobile money execution'}</p>
          </div>
          <span className="label-xs px-2 py-1 rounded-full bg-[#059669]/10 text-[#059669]">CamPay</span>
        </div>

        <div className="flex items-center justify-between rounded-[8px] bg-[#F8F9FC] p-4">
          <div>
            <p className="label-xs text-[#64748B]">{isFr ? 'Montant alloué' : 'Allocated stake'}</p>
            <p className="num font-display text-xl font-bold mt-1">{formatXAF(cost)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Fewer units" onClick={() => setQty(Math.max(1, qty - 1))} className="w-9 h-9 rounded-[4px] bg-white flex items-center justify-center">
              <Minus className="w-4 h-4" />
            </button>
            <span className="num w-10 text-center font-display text-lg font-bold">{qty}</span>
            <button type="button" aria-label="More units" onClick={() => setQty(qty + 1)} className="w-9 h-9 rounded-[4px] bg-white flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {QTY_PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => setQty(p)} className={`py-2 rounded-[4px] text-xs font-semibold ${qty === p ? 'bg-[#6C2BD9] text-white' : 'bg-[#F2F3FF]'}`}>
              {p} {isFr ? 'part' : 'unit'}{p > 1 && !isFr ? 's' : ''}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(['MTN MoMo', 'Orange Money'] as Network[]).map((n) => (
            <button key={n} type="button" onClick={() => setNetwork(n)} className={`flex items-center gap-2.5 p-3 rounded-[8px] border text-left ${network === n ? 'border-[#6C2BD9]' : 'border-[#E2E8F0]'}`}>
              <span className={`w-8 h-8 rounded-[4px] flex items-center justify-center ${n === 'MTN MoMo' ? 'bg-[#FFCC00]' : 'bg-[#FF7900]'}`}>
                <Smartphone className="w-4 h-4 text-[#0F172A]" />
              </span>
              <span>
                <span className="block text-xs font-semibold">{n}</span>
                <span className="block text-[10px] text-[#64748B]">{n === 'MTN MoMo' ? (isFr ? 'Invite push' : 'Push prompt') : 'USSD · CamPay'}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="text-xs text-[#64748B] space-y-1">
          <p>
            {isFr ? 'Part de pool' : 'Pool ownership'}: <span className="num font-semibold text-[#0F172A]">{ownership.poolOwnershipPct}%</span>
          </p>
          <p>
            {isFr ? 'Part effective des revenus' : 'Effective royalty share'}: <span className="num font-semibold text-[#0F172A]">{ownership.effectiveRoyaltySharePct}%</span>
          </p>
        </div>

        {error && <p className="text-xs text-[#DC2626]">{error}</p>}
        {done && <p className="text-xs text-[#059669] font-semibold">{done}</p>}

        <button
          type="button"
          onClick={handleBuy}
          disabled={submitting || !isOpen}
          className="w-full py-3.5 rounded-[4px] bg-[#059669] hover:bg-[#047857] disabled:opacity-40 text-white text-sm font-semibold uppercase tracking-wide"
        >
          {!user ? (isFr ? 'Connectez-vous pour investir' : 'Sign in to invest') : submitting ? '…' : isFr ? `Acheter via ${network}` : `Buy via ${network}`}
        </button>
        <p className="flex items-center gap-1.5 text-[11px] text-[#64748B] justify-center">
          <ShieldCheck className="w-3.5 h-3.5" />
          {isFr ? 'Fonds bloqués en escrow jusqu’aux jalons validés.' : 'Funds held in Crippo escrow until milestones clear.'}
        </p>
      </section>

      {creator.claimStatus !== 'CLAIMED' && onClaim && (
        <section className="card p-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{isFr ? 'Profil non réclamé' : 'Unclaimed profile'}</p>
            <p className="text-xs text-[#64748B]">{isFr ? 'Êtes-vous ce créateur ?' : 'Are you this creator?'}</p>
          </div>
          <button type="button" onClick={() => onClaim(creator)} className="px-4 py-2 rounded-[4px] bg-[#1E0B36] text-white text-xs font-semibold">
            {isFr ? 'Réclamer' : 'Claim'}
          </button>
        </section>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; tone?: 'green'; icon?: React.ReactNode }> = ({ label, value, tone, icon }) => (
  <div className="rounded-[8px] bg-[#F8F9FC] p-3">
    <p className="label-xs text-[#64748B] flex items-center gap-1">
      {icon}
      {label}
    </p>
    <p className={`num font-semibold text-sm mt-1 ${tone === 'green' ? 'text-[#059669]' : 'text-[#0F172A]'}`}>{value}</p>
  </div>
);
