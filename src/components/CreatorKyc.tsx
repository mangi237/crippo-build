import React, { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Copy, FileCheck2, Wallet } from 'lucide-react';
import type { Creator, UserProfile } from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import {
  submitCreatorApplication,
  submitMemoRequest,
  uploadFileToStorage,
  verifyClaimBioCodeOnServer,
} from '../services/firestoreService';

interface CreatorKycProps {
  user: UserProfile | null;
  lang: AppLang;
  claimCreator?: Creator | null;
  onBack: () => void;
  onRequireAuth: () => void;
}

const inputClass =
  'w-full px-4 py-3 text-sm bg-white border border-[#E2E8F0] rounded-[4px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[1.5px] focus:border-[#6C2BD9]';
const labelClass = 'label-xs text-[#64748B]';

function makeBioCode(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `CRIPPO-${n}`;
}

/**
 * Creator market identity verification (Crippo Exchange design, "Creator Market Identity Verification").
 * Path A: claim a pre-seeded profile with a social bio handshake, then KYC and MoMo settlement.
 * Path B: request a paid memo for an unlisted creator.
 */
export const CreatorKyc: React.FC<CreatorKycProps> = ({ user, lang, claimCreator, onBack, onRequireAuth }) => {
  const isFr = lang === 'FR';
  const [path, setPath] = useState<'A' | 'B'>('A');
  const [bioCode] = useState(makeBioCode);
  const [copied, setCopied] = useState(false);
  const [stageName, setStageName] = useState(claimCreator?.name || '');
  const [handle, setHandle] = useState(claimCreator?.handle || '');
  const [socialUrl, setSocialUrl] = useState('');
  const [entity, setEntity] = useState<'solo' | 'agency'>('solo');
  const [niu, setNiu] = useState('');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [momoNumber, setMomoNumber] = useState(user?.momoPhone || '');
  const [bioStatus, setBioStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const steps = useMemo(
    () => [
      { label: isFr ? 'Profil' : 'Profile', ok: stageName.trim().length > 1 && handle.trim().length > 1 },
      { label: isFr ? 'Preuve sociale' : 'Social handshake', ok: bioStatus === 'verified' },
      { label: 'KYC & NIU', ok: niu.trim().length > 4 && !!idFile },
      { label: 'MoMo', ok: /\d{6,}/.test(momoNumber.replace(/\D/g, '')) },
    ],
    [stageName, handle, bioStatus, niu, idFile, momoNumber, isFr]
  );
  const completed = steps.filter((s) => s.ok).length;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(bioCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(isFr ? 'Copie impossible. Copiez le code manuellement.' : 'Copy failed. Copy the code manually.');
    }
  }

  async function runBioCheck() {
    setError(null);
    setBioStatus('checking');
    try {
      const r = await verifyClaimBioCodeOnServer({
        stageName,
        handle,
        bioVerificationCode: bioCode,
        socialUrl: socialUrl || undefined,
      });
      setBioStatus(r.codeFoundInPublicProfile ? 'verified' : 'not_found');
    } catch (err) {
      setBioStatus('error');
      setError(err instanceof Error ? err.message : 'Verification failed.');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!user) {
      onRequireAuth();
      return;
    }
    setSubmitting(true);
    try {
      if (path === 'B') {
        await submitMemoRequest({
          requestedByUid: user.uid,
          creatorName: stageName,
          handle,
          platform: 'Other',
          socialUrl: socialUrl || undefined,
          reason: 'Paid memo request from Crippo identity flow',
        });
        setDone(isFr ? 'Demande de mémo envoyée.' : 'Memo request sent.');
        return;
      }
      let verificationMediaUrl: string | undefined;
      if (idFile) {
        verificationMediaUrl = await uploadFileToStorage('verifications', user.uid, idFile);
      }
      await submitCreatorApplication({
        uid: user.uid,
        claimCreatorId: claimCreator?.id,
        stageName,
        handle,
        category: claimCreator?.category || 'Music & Albums',
        facebookUrl: undefined,
        tiktokUrl: socialUrl || undefined,
        verificationMediaUrl,
        bioVerificationCode: bioCode,
        kycDocType: 'CNI',
        momoNumber,
        pitch: `[Entity: ${entity}] [NIU: ${niu.trim()}] Claim submitted from identity verification.`,
      });
      setDone(isFr ? 'Vérification envoyée pour revue.' : 'Verification submitted for review.');
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
        <p className="font-display text-lg font-semibold">{done}</p>
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
        <span className="label-xs text-[#6C2BD9]">{isFr ? 'Vérification d’identité' : 'Identity verification'}</span>
        <span className="w-9" />
      </div>

      <div className="rounded-[8px] bg-[#1E0B36] p-6 text-white space-y-3">
        <p className="label-xs text-[#894FF7]">Terminal gateway</p>
        <h1 className="font-display text-2xl font-bold">Creator market mode</h1>
        <p className="text-sm text-white/70 leading-relaxed">
          {isFr
            ? 'Vérification des talents, liens ISRC et règlements souverains pour le marché panafricain.'
            : 'Verified fundraising, ISRC split contracts and sovereign brand escrows across the pan-African bourse.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1 p-1 bg-[#EEF1F8] rounded-[8px]">
        <button type="button" onClick={() => setPath('A')} className={`py-2.5 rounded-[4px] text-xs font-semibold ${path === 'A' ? 'bg-white shadow-sm' : 'text-[#64748B]'}`}>
          {isFr ? 'Voie A : pré-enregistré' : 'Path A: pre-seeded'}
        </button>
        <button type="button" onClick={() => setPath('B')} className={`py-2.5 rounded-[4px] text-xs font-semibold ${path === 'B' ? 'bg-white shadow-sm' : 'text-[#64748B]'}`}>
          {isFr ? 'Voie B : mémo payant' : 'Path B: paid memo'}
        </button>
      </div>

      {/* Progress */}
      <div className="card p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold">{isFr ? 'Progression' : 'Progress'}</span>
          <span className="num text-[#6C2BD9] font-semibold">{completed} / {steps.length}</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-[#EAEDFF] overflow-hidden">
          <div className="h-full bg-[#6C2BD9]" style={{ width: `${(completed / steps.length) * 100}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-[11px] text-[#64748B]">
          {steps.map((s) => (
            <span key={s.label} className={s.ok ? 'text-[#059669] font-semibold' : ''}>
              {s.ok ? '✓ ' : ''}
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <section className="card p-5 space-y-4">
            <h2 className="font-display text-base font-semibold">{isFr ? 'Profil créateur' : 'Creator profile'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{isFr ? 'Nom d’artiste' : 'Stage name'}</label>
                <input required value={stageName} onChange={(e) => setStageName(e.target.value)} className={`${inputClass} mt-1.5`} />
              </div>
              <div>
                <label className={labelClass}>Handle</label>
                <input required value={handle} onChange={(e) => setHandle(e.target.value)} className={`${inputClass} mt-1.5`} />
              </div>
            </div>
            <div>
              <label className={labelClass}>{isFr ? 'Lien public (TikTok, YouTube, Facebook)' : 'Public profile link (TikTok, YouTube, Facebook)'}</label>
              <input value={socialUrl} onChange={(e) => setSocialUrl(e.target.value)} placeholder="https://" className={`${inputClass} mt-1.5`} />
            </div>
          </section>

          {path === 'A' && (
            <>
              <section className="card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-semibold">{isFr ? 'Preuve sociale' : 'Social handshake token'}</h2>
                  <span className="label-xs text-[#6C2BD9]">Step 1 of 3</span>
                </div>
                <p className="label-xs text-[#64748B]">{isFr ? 'Code de vérification éphémère' : 'Ephemeral verification hash'}</p>
                <div className="flex items-center justify-between rounded-[4px] bg-[#F2F3FF] p-4">
                  <span className="num font-display text-2xl font-bold text-[#1E0B36]">{bioCode}</span>
                  <button type="button" onClick={copyCode} className="px-4 py-2 rounded-[4px] bg-[#6C2BD9] text-white text-xs font-semibold flex items-center gap-2">
                    <Copy className="w-3.5 h-3.5" /> {copied ? (isFr ? 'Copié' : 'Copied') : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  {isFr
                    ? 'Collez ce code dans votre bio YouTube, TikTok ou Instagram, puis lancez la vérification.'
                    : 'Paste this token into your YouTube About, TikTok bio, or Instagram profile, then run the check.'}
                </p>
                <button type="button" onClick={runBioCheck} disabled={!stageName || !handle || bioStatus === 'checking'} className="px-5 py-2.5 rounded-[4px] bg-[#1E0B36] text-white text-xs font-semibold disabled:opacity-40">
                  {bioStatus === 'checking' ? '…' : isFr ? 'Vérifier ma bio' : 'Run bio check'}
                </button>
                {bioStatus === 'verified' && <p className="text-xs font-semibold text-[#059669]">{isFr ? 'Code trouvé sur votre profil.' : 'Code found on your public profile.'}</p>}
                {bioStatus === 'not_found' && <p className="text-xs text-[#DC2626]">{isFr ? 'Code introuvable. Vérifiez votre bio.' : 'Code not found yet. Check your bio and retry.'}</p>}
              </section>

              <section className="card p-5 space-y-4">
                <h2 className="font-display text-base font-semibold">{isFr ? 'KYC institutionnel & NIU' : 'Institutional compliance & KYC'}</h2>
                <div className="grid grid-cols-2 gap-2">
                  {(['solo', 'agency'] as const).map((k) => (
                    <button key={k} type="button" onClick={() => setEntity(k)} className={`py-2.5 rounded-[4px] text-xs font-semibold ${entity === k ? 'bg-white shadow-sm border border-[#6C2BD9]' : 'bg-[#F2F3FF]'}`}>
                      {k === 'solo' ? (isFr ? 'Créateur solo' : 'Solo creator') : isFr ? 'Agence / label' : 'Talent agency / label'}
                    </button>
                  ))}
                </div>
                <div>
                  <label className={labelClass}>NIU (DGI)</label>
                  <input required value={niu} onChange={(e) => setNiu(e.target.value)} placeholder="M021912839210P" className={`${inputClass} mt-1.5 num`} />
                </div>
                <div>
                  <label className={labelClass}>{isFr ? 'Pièce d’identité (CNI / passeport, recto-verso)' : 'Government ID (CNI / passport, front and back)'}</label>
                  <label className="mt-1.5 flex items-center justify-center gap-2 rounded-[4px] border border-dashed border-[#94A3B8] p-5 text-xs text-[#64748B] cursor-pointer">
                    <FileCheck2 className="w-4 h-4" />
                    {idFile ? idFile.name : isFr ? 'Choisir un fichier' : 'Choose a file'}
                    <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => setIdFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              </section>
            </>
          )}

          {path === 'B' && (
            <section className="card p-5 space-y-3">
              <h2 className="font-display text-base font-semibold">{isFr ? 'Demande de mémo' : 'Paid memo request'}</h2>
              <p className="text-xs text-[#64748B] leading-relaxed">
                {isFr
                  ? 'Un analyste rédigera un mémo de cotation pour votre profil non listé. Le statut apparaîtra dans votre espace.'
                  : 'An analyst will prepare a listing memo for your unlisted profile. Status appears in your account.'}
              </p>
            </section>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-28 self-start">
          <section className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#059669]" />
              <h2 className="font-display text-sm font-semibold">{isFr ? 'Règlement MoMo' : 'Primary settlement'}</h2>
            </div>
            <div>
              <label className={labelClass}>MTN MoMo / Orange Money</label>
              <input value={momoNumber} onChange={(e) => setMomoNumber(e.target.value)} placeholder="+237 6xx xxx xxx" className={`${inputClass} mt-1.5 num`} />
            </div>
            <p className="text-[11px] text-[#64748B] leading-relaxed">
              {isFr ? 'Les dividendes sont versés automatiquement via CamPay.' : 'Dividends are auto-settled via CamPay.'}
            </p>
          </section>

          {error && <p className="text-xs text-[#DC2626] leading-relaxed">{error}</p>}

          <button type="submit" disabled={submitting} className="w-full py-3.5 rounded-[4px] bg-[#059669] hover:bg-[#047857] disabled:opacity-50 text-white text-sm font-semibold uppercase tracking-wide">
            {!user ? (isFr ? 'Connectez-vous' : 'Sign in to continue') : submitting ? '…' : path === 'A' ? (isFr ? 'Soumettre pour audit' : 'Submit for underwriter audit') : isFr ? 'Demander le mémo' : 'Request memo'}
          </button>
          <p className="text-[11px] text-[#64748B] leading-relaxed">
            {isFr
              ? 'Les fonds restent en escrow conforme CEMAC jusqu’à validation humaine.'
              : 'All operations comply with CEMAC anti-fraud rules. Funds stay in escrow until human sign-off.'}
          </p>
        </aside>
      </div>
    </form>
  );
};
