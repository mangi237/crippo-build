import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { BrandCampaign, Creator, UserProfile } from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import { submitBrandApplication } from '../services/firestoreService';
import { formatXAF } from '../utils/format';

interface BrandApplySheetProps {
  campaign: BrandCampaign | null;
  user: UserProfile | null;
  myCreators: Creator[];
  lang: AppLang;
  onClose: () => void;
  onDone: () => void;
}

/**
 * Brand partnership application. Only verified creators with a claimed profile can apply.
 * The creator applies as one of their own claimed profiles, with a pitch and a proposed fee.
 */
export const BrandApplySheet: React.FC<BrandApplySheetProps> = ({ campaign, user, myCreators, lang, onClose, onDone }) => {
  const isFr = lang === 'FR';
  const [creatorId, setCreatorId] = useState(myCreators[0]?.id || '');
  const [pitch, setPitch] = useState('');
  const [fee, setFee] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!campaign) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const creator = myCreators.find((c) => c.id === creatorId);
    if (!user || !creator) {
      setError(isFr ? 'Aucun profil créateur vérifié.' : 'No verified creator profile.');
      return;
    }
    setBusy(true);
    try {
      await submitBrandApplication({
        campaign: campaign!,
        uid: user.uid,
        creatorId: creator.id,
        creatorName: creator.name,
        pitch,
        proposedFeeXAF: fee,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Application failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0F172A]/40">
      <form onSubmit={submit} className="w-full max-w-md bg-[#F8F9FC] rounded-t-[12px] sm:rounded-[12px] p-5 space-y-4 max-h-[92vh] overflow-y-auto shadow-[0_25px_50px_-12px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="label-xs text-[#6C2BD9]">{campaign.brandName}{campaign.agencyName ? ` · ${campaign.agencyName}` : ''}</p>
            <h2 className="font-display text-base font-semibold mt-1">{isFr ? campaign.titleFr : campaign.titleEn}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        {campaign.deliverable && <p className="text-xs text-[#64748B] leading-relaxed">{campaign.deliverable}</p>}
        <p className="num text-xs">
          {isFr ? 'Budget du partenaire' : 'Brand budget'}: <strong>{formatXAF(campaign.budgetXAF)}</strong>
        </p>

        <div className="space-y-1.5">
          <label className="label-xs text-[#64748B]">{isFr ? 'Profil créateur' : 'Creator profile'}</label>
          <select value={creatorId} onChange={(e) => setCreatorId(e.target.value)} className="w-full px-3 py-2.5 text-sm bg-white border border-[#E2E8F0] rounded-[4px]">
            {myCreators.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="label-xs text-[#64748B]">{isFr ? 'Proposition' : 'Pitch'}</label>
          <textarea required rows={4} value={pitch} onChange={(e) => setPitch(e.target.value)} className="w-full px-3 py-2.5 text-sm bg-white border border-[#E2E8F0] rounded-[4px] focus:outline-none focus:border-[1.5px] focus:border-[#6C2BD9]" />
        </div>
        <div className="space-y-1.5">
          <label className="label-xs text-[#64748B]">{isFr ? 'Frais proposés (FCFA)' : 'Proposed fee (XAF)'}</label>
          <input type="number" min={0} value={fee} onChange={(e) => setFee(Number(e.target.value) || 0)} className="w-full px-3 py-2.5 text-sm bg-white border border-[#E2E8F0] rounded-[4px] num focus:outline-none focus:border-[1.5px] focus:border-[#6C2BD9]" />
        </div>
        {error && <p className="text-xs text-[#DC2626]">{error}</p>}
        <button type="submit" disabled={busy || !creatorId} className="w-full py-3.5 rounded-[4px] bg-[#1E0B36] text-white text-sm font-semibold uppercase tracking-wide disabled:opacity-40">
          {busy ? '…' : isFr ? 'Envoyer la candidature' : 'Send application'}
        </button>
      </form>
    </div>
  );
};
