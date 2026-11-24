import React from 'react';
import { ArrowLeft, BadgeCheck, Download, Music, Play, Radio, ShieldCheck } from 'lucide-react';
import type { Creator } from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import { formatCompact, formatXAF } from '../utils/format';
import { MiniSparkline } from './PriceChart';

interface CreatorDossierProps {
  creator: Creator;
  lang: AppLang;
  onBack: () => void;
  onBuy: (creator: Creator) => void;
  onClaim?: (creator: Creator) => void;
}

/**
 * Creator dossier (Crippo Exchange design, "Creator Wikipedia Dossier").
 * Public read-only profile: infobox, audience metrics, velocity chart and audited races.
 */
export const CreatorDossier: React.FC<CreatorDossierProps> = ({ creator, lang, onBack, onBuy, onClaim }) => {
  const isFr = lang === 'FR';
  const isUp = creator.priceChangePct >= 0;
  const claimed = creator.claimStatus === 'CLAIMED';

  return (
    <div className="space-y-5 pb-28 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="label-xs text-[#6C2BD9]">{isFr ? 'Dossier créateur' : 'Creator dossier'}</span>
        <span className="w-9" />
      </div>

      {/* Hero */}
      <section className="card p-5 flex gap-4 items-center">
        <div className="relative w-24 h-24 rounded-[8px] bg-[#EAEDFF] overflow-hidden shrink-0">
          {creator.avatarUrl && <img src={creator.avatarUrl} alt="" className="w-full h-full object-cover" />}
          {claimed && (
            <span className="absolute bottom-1 left-1 label-xs px-1.5 py-0.5 rounded bg-[#1E0B36] text-white">
              {isFr ? 'Vérifié' : 'Verified'}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-bold truncate">{creator.name}</h1>
            {creator.isVerified && <BadgeCheck className="w-4 h-4 text-[#059669] shrink-0" />}
          </div>
          <p className="text-xs text-[#64748B] truncate">
            {creator.handle} · {creator.category}
            {creator.city ? ` · ${creator.city}` : ''}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <span className="label-xs px-2 py-0.5 rounded-full bg-[#6C2BD9]/10 text-[#6C2BD9]">
              {isFr ? 'Score' : 'Score'} {creator.crippoScore ?? creator.underwritingScore ?? '—'}
            </span>
            <span className={`num label-xs px-2 py-0.5 rounded-full ${isUp ? 'bg-[#059669]/10 text-[#059669]' : 'bg-[#DC2626]/10 text-[#DC2626]'}`}>
              {isUp ? '+' : ''}
              {creator.priceChangePct}% (30D)
            </span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => onBuy(creator)} className="py-3 rounded-[4px] bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold uppercase tracking-wide">
          {isFr ? 'Acheter des parts' : 'Buy shares'}
        </button>
        {!claimed && onClaim ? (
          <button type="button" onClick={() => onClaim(creator)} className="py-3 rounded-[4px] bg-[#1E0B36] text-white text-xs font-semibold uppercase tracking-wide">
            {isFr ? 'Réclamer le profil' : 'Claim profile'}
          </button>
        ) : (
          <span className="py-3 rounded-[4px] bg-[#F2F3FF] text-[#64748B] text-xs font-semibold uppercase tracking-wide text-center">
            {isFr ? 'Profil réclamé' : 'Profile claimed'}
          </span>
        )}
      </div>

      {/* Lead (biography) */}
      {creator.bio && (
        <section className="card p-5 space-y-2">
          <h2 className="font-display text-base font-semibold">{isFr ? 'Biographie' : 'Biography'}</h2>
          <p className="text-sm leading-relaxed whitespace-pre-line">{creator.bio}</p>
        </section>
      )}

      {/* Infobox */}
      <section className="card p-5 space-y-1">
        <h2 className="font-display text-base font-semibold mb-2">{isFr ? 'Fiche' : 'Genesis infobox'}</h2>
        <InfoRow label={isFr ? 'Nom' : 'Name'} value={creator.name} />
        <InfoRow label={isFr ? 'Origine' : 'Origin / base'} value={creator.city || 'Cameroon'} />
        {creator.labelName && <InfoRow label="Label" value={creator.labelName} />}
        {creator.ageVisible && creator.birthYear ? (
          <InfoRow label={isFr ? 'Âge' : 'Age'} value={String(new Date().getFullYear() - creator.birthYear)} />
        ) : null}
        {creator.genres && creator.genres.length > 0 && <InfoRow label={isFr ? 'Genres' : 'Genres'} value={creator.genres.join(', ')} />}
        {creator.activeSinceYear && <InfoRow label={isFr ? 'Actif depuis' : 'Active since'} value={String(creator.activeSinceYear)} />}
        {creator.websiteUrl && <InfoRow label={isFr ? 'Site' : 'Website'} value={creator.websiteUrl} />}
        <InfoRow label={isFr ? 'Valorisation du catalogue' : 'Catalog valuation'} value={formatXAF(creator.targetRaiseXAF ?? creator.grossTargetXAF ?? 0)} />
        <InfoRow label={isFr ? 'Capitalisation totale' : 'Total market cap'} value={formatXAF(creator.sharePriceXAF * (creator.totalShares ?? 0))} />
        <InfoRow label={isFr ? 'Plateforme' : 'Platform'} value={creator.platform || '—'} />
        <InfoRow label={isFr ? 'Jalons atteints' : 'Milestones completed'} value={String(creator.milestonesCompleted ?? 0)} />
        <InfoRow label={isFr ? 'Paiement MoMo' : 'Primary payout'} value={creator.distributorSplitEmail ? (isFr ? 'Escrow CamPay' : 'CamPay escrow') : '—'} />
      </section>

      {/* Audience */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={<Music className="w-4 h-4" />} label={isFr ? 'Audience' : 'Audience'} value={formatCompact(creator.followersCount ?? 0)} sub={isFr ? 'Abonnés' : 'Followers'} />
        <MetricCard icon={<Play className="w-4 h-4" />} label={isFr ? 'Vues' : 'Views'} value={formatCompact(creator.viewVelocity ?? 0)} sub={isFr ? 'Vélocité' : 'View velocity'} />
      </div>

      {/* Velocity */}
      <section className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#6C2BD9]" />
            <h2 className="font-display text-sm font-semibold">{isFr ? 'Accélération virale' : 'Viral acceleration'}</h2>
          </div>
          <span className="label-xs px-2 py-0.5 rounded-full bg-[#6C2BD9]/10 text-[#6C2BD9]">
            {isFr ? 'Engagement' : 'Engagement'} {creator.engagementRate ?? 0}%
          </span>
        </div>
        {creator.sparkline && creator.sparkline.length > 1 ? (
          <MiniSparkline values={creator.sparkline} isPositive={isUp} width={320} height={80} />
        ) : (
          <p className="text-xs text-[#64748B]">{isFr ? 'Données disponibles après synchronisation.' : 'Data appears after the next sync.'}</p>
        )}
      </section>

      {/* Audited race */}
      {creator.status !== undefined && (
        <section className="card p-5 space-y-3">
          <h2 className="font-display text-base font-semibold">{isFr ? 'Courses auditées' : 'Audited races'}</h2>
          <div className="rounded-[8px] bg-[#F8F9FC] p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="label-xs px-2 py-0.5 rounded bg-[#6C2BD9]/10 text-[#6C2BD9]">
                {creator.status === 'OPEN' ? (isFr ? 'En direct' : 'Live race') : creator.status === 'FUNDED' ? (isFr ? 'Financée' : 'Funded') : isFr ? 'Clôturée' : 'Closed'}
              </span>
              <p className="font-display font-semibold mt-2 truncate">{creator.raiseTitle || creator.name}</p>
              <p className="text-xs text-[#64748B] mt-0.5">
                {creator.revSharePct ?? 0}% {isFr ? 'pool de revenus' : 'royalty pool'} · {creator.roiDurationMonths ?? 12} {isFr ? 'mois' : 'months'}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="num font-display font-bold">{formatXAF(creator.sharePriceXAF)}</p>
              <p className="label-xs text-[#64748B]">{isFr ? 'par part' : 'per share'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#64748B]">
            <ShieldCheck className="w-4 h-4 text-[#059669]" />
            {isFr ? 'Escrow ISRC audité · MTN MoMo et Orange Money' : 'ISRC escrow audited · MTN MoMo and Orange Money'}
          </div>
        </section>
      )}

      <button type="button" disabled className="w-full flex items-center justify-center gap-2 py-3 rounded-[4px] bg-[#F2F3FF] text-[#64748B] text-xs font-semibold">
        <Download className="w-4 h-4" />
        {isFr ? 'Télécharger le registre ISRC (bientôt)' : 'Download ISRC ledger (coming soon)'}
      </button>
    </div>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 py-2.5 border-b border-[#E2E8F0] last:border-0 text-xs">
    <span className="text-[#64748B]">{label}</span>
    <span className="num font-semibold text-right">{value}</span>
  </div>
);

const MetricCard: React.FC<{ icon: React.ReactNode; label: string; value: string; sub: string }> = ({ icon, label, value, sub }) => (
  <div className="card p-4 space-y-2">
    <div className="flex items-center justify-between text-[#64748B]">
      <span className="label-xs">{label}</span>
      {icon}
    </div>
    <p className="num font-display text-2xl font-bold">{value}</p>
    <p className="text-[11px] text-[#64748B]">{sub}</p>
  </div>
);
