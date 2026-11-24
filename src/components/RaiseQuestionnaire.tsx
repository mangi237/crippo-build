import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import type { UserProfile } from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import { submitCreatorApplication } from '../services/firestoreService';
import { formatXAF } from '../utils/format';
import { ORIGINATION_FEE_MULTIPLIER } from '../utils/sharePricing';

interface RaiseQuestionnaireProps {
  user: UserProfile | null;
  lang: AppLang;
  onBack: () => void;
  onRequireAuth: () => void;
  onSubmitted: () => void;
}

const FORMATS = ['Music & Albums', 'TikTok Series', 'Movies & Docs', 'Podcasts'] as const;
const SHARE_PRESETS = [2100, 1000, 5000] as const;
const BUDGET_PRESETS = [5_000_000, 10_000_000, 25_000_000, 50_000_000] as const;
const HORIZONS = [6, 12, 18, 24] as const;

const inputClass =
  'w-full px-4 py-3 text-sm bg-white border border-[#E2E8F0] rounded-[4px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[1.5px] focus:border-[#6C2BD9]';
const labelClass = 'label-xs text-[#64748B]';

/**
 * Pre-production race questionnaire (Crippo Exchange design, "Pre-Production Race Questionnaire").
 * Four sections: scope, financial terms, the production flight plan (read-only), and legal declarations.
 * Submits a pending creator application for admin underwriting review.
 */
export const RaiseQuestionnaire: React.FC<RaiseQuestionnaireProps> = ({
  user,
  lang,
  onBack,
  onRequireAuth,
  onSubmitted,
}) => {
  const isFr = lang === 'FR';
  const [stageName, setStageName] = useState('');
  const [handle, setHandle] = useState('');
  const [city, setCity] = useState('Douala, Cameroon');
  const [category, setCategory] = useState<(typeof FORMATS)[number]>('Music & Albums');
  const [pitch, setPitch] = useState('');
  const [raiseTitle, setRaiseTitle] = useState('');
  const [netBudget, setNetBudget] = useState<number>(10_000_000);
  const [totalShares, setTotalShares] = useState<number>(2100);
  const [revSharePct, setRevSharePct] = useState<number>(25);
  const [horizon, setHorizon] = useState<number>(12);
  const [momoNumber, setMomoNumber] = useState(user?.momoPhone || '');
  const [ownsRights, setOwnsRights] = useState(true);
  const [signature, setSignature] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const grossTarget = Math.round(netBudget * ORIGINATION_FEE_MULTIPLIER);
  const unitPrice = totalShares > 0 ? Math.round(grossTarget / totalShares / 100) * 100 : 0;
  const fee = grossTarget - netBudget;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!ownsRights) {
      setError(isFr ? 'Vous devez confirmer vos droits.' : 'You must confirm your rights to submit.');
      return;
    }
    if (signature.trim().length < 3) {
      setError(isFr ? 'Signature légale requise.' : 'A typed legal signature is required.');
      return;
    }
    setSubmitting(true);
    try {
      await submitCreatorApplication({
        uid: user.uid,
        stageName: stageName || raiseTitle,
        handle,
        category,
        city,
        momoNumber,
        netBudgetXAF: netBudget,
        totalShares,
        targetRaiseXAF: grossTarget,
        revSharePct,
        pitch: `[Raise: ${raiseTitle}] [Horizon: ${horizon} months] [Signed: ${signature.trim()}] ${pitch}`,
      });
      setDone(true);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto card p-8 text-center space-y-4">
        <CheckCircle2 className="w-12 h-12 text-[#059669] mx-auto" />
        <h1 className="font-display text-xl font-bold text-[#0F172A]">
          {isFr ? 'Dossier envoyé' : 'Dossier submitted'}
        </h1>
        <p className="text-sm text-[#64748B] leading-relaxed">
          {isFr
            ? 'Votre dossier est en revue. Vous serez notifié après la validation de la contre-expertise.'
            : 'Your dossier is under review. You will be notified after the underwriting audit.'}
        </p>
        <button type="button" onClick={onBack} className="px-6 py-3 rounded-[4px] bg-[#1E0B36] text-white text-xs font-semibold uppercase tracking-wide">
          {isFr ? 'Retour' : 'Back'}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-5 pb-28">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="label-xs text-[#6C2BD9]">{isFr ? 'Nouvelle course' : 'New race'}</span>
        <span className="w-9" />
      </div>

      <div className="rounded-[8px] bg-[#1E0B36] p-6 text-white">
        <p className="label-xs text-[#894FF7]">{isFr ? 'Étape 1 sur 4' : 'Stage 01 · Pre-production'}</p>
        <h1 className="font-display text-2xl font-bold mt-2">
          {isFr ? 'Levée de capitaux pré-production' : 'Pre-production capital raise'}
        </h1>
        <p className="text-sm text-white/70 mt-2 leading-relaxed">
          {isFr
            ? 'Les fonds sont bloqués en escrow jusqu’aux jalons validés. Aucune production n’a commencé.'
            : 'Funds are held in escrow until milestones clear. Production has not started yet.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* 01 Scope */}
          <section className="card p-5 space-y-4">
            <h2 className="font-display text-base font-semibold">01 · {isFr ? 'Portée et format' : 'Scope & creative taxonomy'}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setCategory(f)}
                  className={`p-3 rounded-[4px] text-left text-xs font-semibold border ${
                    category === f ? 'border-[#6C2BD9] bg-[#6C2BD9]/5 text-[#6C2BD9]' : 'border-[#E2E8F0] text-[#0F172A]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{isFr ? 'Titre de la course' : 'Race & project title'}</label>
                <input required value={raiseTitle} onChange={(e) => setRaiseTitle(e.target.value)} placeholder="Genesis EP: The Buea Sessions" className={`${inputClass} mt-1.5`} />
              </div>
              <div>
                <label className={labelClass}>{isFr ? 'Nom légal / artiste' : 'Creator entity / artist name'}</label>
                <input required value={stageName} onChange={(e) => setStageName(e.target.value)} placeholder="Kameni" className={`${inputClass} mt-1.5`} />
              </div>
              <div>
                <label className={labelClass}>Handle</label>
                <input required value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@kameni" className={`${inputClass} mt-1.5`} />
              </div>
              <div>
                <label className={labelClass}>{isFr ? 'Ville' : 'City'}</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} className={`${inputClass} mt-1.5`} />
              </div>
            </div>
            <div>
              <label className={labelClass}>{isFr ? 'Pitch' : 'Pitch'}</label>
              <textarea required rows={4} value={pitch} onChange={(e) => setPitch(e.target.value)} className={`${inputClass} mt-1.5`} />
            </div>
          </section>

          {/* 02 Financial terms */}
          <section className="card p-5 space-y-4">
            <h2 className="font-display text-base font-semibold">02 · {isFr ? 'Termes financiers' : 'Financial terms & share mechanics'}</h2>
            <div>
              <label className={labelClass}>{isFr ? 'Budget net de production (FCFA)' : 'Net production budget (FCFA)'}</label>
              <input
                type="number"
                min={1_000_000}
                value={netBudget}
                onChange={(e) => setNetBudget(Number(e.target.value) || 0)}
                className={`${inputClass} mt-1.5 num`}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {BUDGET_PRESETS.map((b) => (
                  <button key={b} type="button" onClick={() => setNetBudget(b)} className={`px-3 py-1 rounded-full text-[11px] font-semibold ${netBudget === b ? 'bg-[#1E0B36] text-white' : 'bg-[#EAEDFF] text-[#1E0B36]'}`}>
                    {b / 1_000_000}M
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{isFr ? 'Parts totales' : 'Total supply (shares)'}</label>
                <div className="mt-2 flex gap-2">
                  {SHARE_PRESETS.map((s) => (
                    <button key={s} type="button" onClick={() => setTotalShares(s)} className={`px-3 py-1.5 rounded-[4px] text-xs font-semibold num ${totalShares === s ? 'bg-[#6C2BD9] text-white' : 'bg-[#F2F3FF]'}`}>
                      {s.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>{isFr ? 'Part des revenus pour les fans' : 'Revenue share to fans'} · {revSharePct}%</label>
                <input type="range" min={5} max={50} value={revSharePct} onChange={(e) => setRevSharePct(Number(e.target.value))} className="w-full mt-3 accent-[#6C2BD9]" />
              </div>
            </div>

            <div>
              <label className={labelClass}>{isFr ? 'Horizon de dividendes (mois)' : 'Dividend stream horizon (months)'}</label>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {HORIZONS.map((h) => (
                  <button key={h} type="button" onClick={() => setHorizon(h)} className={`py-2 rounded-[4px] text-xs font-semibold ${horizon === h ? 'bg-[#1E0B36] text-white' : 'bg-[#F2F3FF]'}`}>
                    {h} Mo
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 rounded-[8px] bg-[#F8F9FC] p-4 text-xs">
              <div>
                <p className={labelClass}>{isFr ? 'Frais Crippo' : 'Crippo fee'}</p>
                <p className="num font-semibold mt-1">{formatXAF(fee)}</p>
              </div>
              <div>
                <p className={labelClass}>{isFr ? 'Objectif brut' : 'Total target raise'}</p>
                <p className="num font-semibold mt-1 text-[#6C2BD9]">{formatXAF(grossTarget)}</p>
              </div>
              <div>
                <p className={labelClass}>{isFr ? 'Prix unitaire' : 'Unit share price'}</p>
                <p className="num font-display font-bold mt-1">{formatXAF(unitPrice)}</p>
              </div>
            </div>
          </section>

          {/* 03 Flight plan (read-only) */}
          <section className="card p-5 space-y-3">
            <h2 className="font-display text-base font-semibold">03 · {isFr ? 'Plan de production en 4 phases' : '4-phase production flight plan'}</h2>
            {[
              ['Pre-production capital raise', 'Funds locked in CEMAC trust account. Escrow tranche 1: 25% on funding.'],
              ['Studio recording & engineering', 'Vendor disbursement against verified studio invoices. Tranche 2: 50%.'],
              ['Master delivery & ISRC lock', 'Masters and metadata locked to ISRC/UPC registry. Tranche 3: 25%.'],
              ['Global distribution & MoMo dividends', 'Streaming revenue split via CamPay; payouts to MTN/Orange wallets.'],
            ].map(([title, body], i) => (
              <div key={title} className="flex gap-3 rounded-[4px] bg-[#F8F9FC] p-3">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${i === 0 ? 'bg-[#6C2BD9]' : 'bg-[#94A3B8]'}`}>{i + 1}</span>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-[#64748B] mt-0.5">{body}</p>
                </div>
              </div>
            ))}
          </section>

          {/* 04 Legal */}
          <section className="card p-5 space-y-4">
            <h2 className="font-display text-base font-semibold">04 · {isFr ? 'Déclarations légales' : 'Master rights & legal declarations'}</h2>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={ownsRights} onChange={(e) => setOwnsRights(e.target.checked)} className="mt-1 accent-[#6C2BD9]" />
              <span>
                {isFr
                  ? 'Je confirme détenir les droits maîtres et d’édition non grevés, et j’accepte le privilège OHADA sur les revenus ISRC.'
                  : 'I confirm I hold the unencumbered master and publishing rights, and accept an OHADA first-priority lien on the ISRC revenue payouts.'}
              </span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{isFr ? 'Signature légale (tapée)' : 'Typed legal signature'}</label>
                <input required value={signature} onChange={(e) => setSignature(e.target.value)} className={`${inputClass} mt-1.5 font-display italic text-[#6C2BD9]`} />
              </div>
              <div>
                <label className={labelClass}>MTN MoMo / Orange Money</label>
                <input value={momoNumber} onChange={(e) => setMomoNumber(e.target.value)} placeholder="+237 6xx xxx xxx" className={`${inputClass} mt-1.5 num`} />
              </div>
            </div>
          </section>
        </div>

        {/* Right column: underwriting status */}
        <aside className="space-y-5 lg:sticky lg:top-28 self-start">
          <section className="card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#6C2BD9]" />
              <h2 className="font-display text-sm font-semibold">{isFr ? 'Contre-expertise' : 'Underwriter review'}</h2>
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              {isFr
                ? 'Votre dossier sera examiné par l’équipe de souscription avant publication de la course.'
                : 'Your dossier goes to the underwriting desk before the race is published.'}
            </p>
            <p className="label-xs text-[#059669]">{isFr ? 'Statut : en attente' : 'Status: pending'}</p>
          </section>

          {error && <p className="text-xs text-[#DC2626] leading-relaxed">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-[4px] bg-[#059669] hover:bg-[#047857] disabled:opacity-50 text-white text-sm font-semibold uppercase tracking-wide"
          >
            {!user ? (isFr ? 'Connectez-vous pour soumettre' : 'Sign in to submit') : submitting ? '…' : isFr ? 'Soumettre pour audit' : 'Submit dossier for underwriter audit'}
          </button>
          <p className="text-[11px] text-[#64748B] leading-relaxed">
            {isFr
              ? 'Les fonds restent bloqués en escrow jusqu’à validation humaine (24–48 h).'
              : 'Funds remain locked in escrow until human underwriter sign-off (24–48h).'}
          </p>
        </aside>
      </div>
    </form>
  );
};
