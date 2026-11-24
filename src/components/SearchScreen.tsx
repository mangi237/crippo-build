import React, { useMemo, useState } from 'react';
import { Search, Send } from 'lucide-react';
import type { Creator, PredictionMarket, UserProfile } from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import { submitMemoRequest } from '../services/firestoreService';
import { formatCompact, formatXAF } from '../utils/format';

interface SearchScreenProps {
  user: UserProfile | null;
  creators: Creator[];
  predictions: PredictionMarket[];
  lang: AppLang;
  onSelectCreator: (c: Creator, side?: 'BUY' | 'SELL') => void;
  onClaimCreator: (c: Creator) => void;
  onVotePrediction: (p: PredictionMarket, side: 'YES' | 'NO') => void;
  onRequireAuth: () => void;
}

type Scope = 'creators' | 'predictions' | 'memo';
const PLATFORMS = ['TikTok', 'Facebook', 'YouTube', 'Other'] as const;

/**
 * Search & directory (Crippo Exchange design, "Search Creators").
 * Filter the creator directory and cultural predictions, or request a paid memo for an unlisted creator.
 */
export const SearchScreen: React.FC<SearchScreenProps> = ({ user, creators, predictions, lang, onSelectCreator, onClaimCreator, onVotePrediction, onRequireAuth }) => {
  const isFr = lang === 'FR';
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('creators');
  const [memoName, setMemoName] = useState('');
  const [memoHandle, setMemoHandle] = useState('');
  const [memoPlatform, setMemoPlatform] = useState<(typeof PLATFORMS)[number]>('TikTok');
  const [memoUrl, setMemoUrl] = useState('');
  const [memoReason, setMemoReason] = useState('');
  const [memoStatus, setMemoStatus] = useState<string | null>(null);
  const [memoError, setMemoError] = useState<string | null>(null);

  const q = query.trim().toLowerCase();

  const matchedCreators = useMemo(
    () =>
      creators.filter((c) => {
        if (!q) return true;
        return `${c.name} ${c.handle} ${c.raiseTitle || ''} ${c.category} ${c.city || ''}`.toLowerCase().includes(q);
      }),
    [creators, q]
  );

  const matchedPredictions = useMemo(
    () => predictions.filter((p) => !q || `${p.questionEn} ${p.questionFr} ${p.category}`.toLowerCase().includes(q)),
    [predictions, q]
  );

  async function submitMemo(e: React.FormEvent) {
    e.preventDefault();
    setMemoError(null);
    setMemoStatus(null);
    if (!user) {
      onRequireAuth();
      return;
    }
    try {
      await submitMemoRequest({
        requestedByUid: user.uid,
        creatorName: memoName.trim(),
        handle: memoHandle.trim() || undefined,
        platform: memoPlatform,
        socialUrl: memoUrl.trim() || undefined,
        reason: memoReason.trim() || undefined,
      });
      setMemoStatus(isFr ? 'Demande envoyée. Un analyste vous contactera.' : 'Request sent. An analyst will follow up.');
      setMemoName('');
      setMemoHandle('');
      setMemoUrl('');
      setMemoReason('');
    } catch (err) {
      setMemoError(err instanceof Error ? err.message : 'Request failed.');
    }
  }

  return (
    <div className="space-y-5 pb-28 max-w-3xl mx-auto">
      <div>
        <h1 className="font-display text-2xl font-bold">{isFr ? 'Recherche' : 'Search creators'}</h1>
        <p className="text-xs text-[#64748B] mt-1">{isFr ? 'Annuaire des créateurs, prédictions et mémos.' : 'Creator directory, predictions and listing memos.'}</p>
      </div>

      <div className="card flex items-center gap-3 px-4 py-3">
        <Search className="w-4 h-4 text-[#64748B]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isFr ? 'Nom, handle, catégorie, ville…' : 'Name, handle, category, city…'}
          className="flex-1 bg-transparent text-sm focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-3 gap-1 p-1 bg-[#EEF1F8] rounded-[8px]">
        {([
          ['creators', isFr ? 'Créateurs' : 'Creators'],
          ['predictions', isFr ? 'Prédictions' : 'Predictions'],
          ['memo', isFr ? 'Mémo' : 'Memo request'],
        ] as [Scope, string][]).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setScope(id)} className={`py-2 rounded-[4px] text-xs font-semibold ${scope === id ? 'bg-white shadow-sm' : 'text-[#64748B]'}`}>
            {label}
          </button>
        ))}
      </div>

      {scope === 'creators' && (
        <div className="space-y-3">
          {matchedCreators.length === 0 && <p className="text-xs text-[#64748B] text-center py-8">{isFr ? 'Aucun résultat.' : 'No matches.'}</p>}
          {matchedCreators.map((c) => (
            <div key={c.id} className="card p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-[8px] bg-[#EAEDFF] overflow-hidden shrink-0">
                {c.avatarUrl && <img src={c.avatarUrl} alt="" className="w-full h-full object-cover" />}
              </div>
              <button type="button" onClick={() => onSelectCreator(c, 'BUY')} className="min-w-0 flex-1 text-left">
                <p className="font-display font-semibold truncate">{c.name}</p>
                <p className="text-xs text-[#64748B] truncate">
                  {c.handle} · {c.category}
                </p>
                <p className="num text-[11px] text-[#64748B] mt-0.5">
                  {formatXAF(c.sharePriceXAF)} · {formatCompact(c.tradingVolumeXAF)} {isFr ? 'vol.' : 'vol.'}
                </p>
              </button>
              {c.claimStatus !== 'CLAIMED' ? (
                <button type="button" onClick={() => onClaimCreator(c)} className="px-3 py-2 rounded-[4px] bg-[#1E0B36] text-white text-[11px] font-semibold shrink-0">
                  {isFr ? 'Réclamer' : 'Claim'}
                </button>
              ) : (
                <span className="label-xs text-[#059669] shrink-0">{isFr ? 'Réclamé' : 'Claimed'}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {scope === 'predictions' && (
        <div className="space-y-3">
          {matchedPredictions.length === 0 && <p className="text-xs text-[#64748B] text-center py-8">{isFr ? 'Aucune prédiction.' : 'No predictions.'}</p>}
          {matchedPredictions.map((p) => (
            <div key={p.id} className="card p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="label-xs text-[#6C2BD9]">{p.category}</span>
                <span className="num text-xs font-semibold">{p.yesProbabilityPct}% {isFr ? 'OUI' : 'YES'}</span>
              </div>
              <p className="text-sm font-semibold">{isFr ? p.questionFr : p.questionEn}</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => onVotePrediction(p, 'YES')} className="py-2.5 rounded-[4px] bg-[#059669] text-white text-xs font-semibold">
                  {isFr ? 'Voter OUI' : 'Vote YES'}
                </button>
                <button type="button" onClick={() => onVotePrediction(p, 'NO')} className="py-2.5 rounded-[4px] bg-[#DC2626] text-white text-xs font-semibold">
                  {isFr ? 'Voter NON' : 'Vote NO'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {scope === 'memo' && (
        <form onSubmit={submitMemo} className="card p-5 space-y-4">
          <div>
            <h2 className="font-display text-base font-semibold">{isFr ? 'Demander un mémo de cotation' : 'Request a listing memo'}</h2>
            <p className="text-xs text-[#64748B] mt-1">
              {isFr ? 'Pour un créateur absent de la liste. Un mémo payant est rédigé par notre équipe.' : 'For a creator who is not listed yet. Our team prepares a paid memo.'}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input required value={memoName} onChange={(e) => setMemoName(e.target.value)} placeholder={isFr ? 'Nom d’artiste' : 'Creator name'} className="px-4 py-3 text-sm bg-[#F8F9FC] border border-[#E2E8F0] rounded-[4px] focus:outline-none focus:border-[1.5px] focus:border-[#6C2BD9]" />
            <input value={memoHandle} onChange={(e) => setMemoHandle(e.target.value)} placeholder="@handle" className="px-4 py-3 text-sm bg-[#F8F9FC] border border-[#E2E8F0] rounded-[4px] focus:outline-none focus:border-[1.5px] focus:border-[#6C2BD9]" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {PLATFORMS.map((pl) => (
              <button key={pl} type="button" onClick={() => setMemoPlatform(pl)} className={`py-2 rounded-[4px] text-xs font-semibold ${memoPlatform === pl ? 'bg-[#6C2BD9] text-white' : 'bg-[#F2F3FF]'}`}>
                {pl}
              </button>
            ))}
          </div>
          <input value={memoUrl} onChange={(e) => setMemoUrl(e.target.value)} placeholder="https://" className="w-full px-4 py-3 text-sm bg-[#F8F9FC] border border-[#E2E8F0] rounded-[4px] focus:outline-none focus:border-[1.5px] focus:border-[#6C2BD9]" />
          <textarea value={memoReason} onChange={(e) => setMemoReason(e.target.value)} rows={3} placeholder={isFr ? 'Pourquoi ce créateur ?' : 'Why this creator?'} className="w-full px-4 py-3 text-sm bg-[#F8F9FC] border border-[#E2E8F0] rounded-[4px] focus:outline-none focus:border-[1.5px] focus:border-[#6C2BD9]" />
          {memoError && <p className="text-xs text-[#DC2626]">{memoError}</p>}
          {memoStatus && <p className="text-xs text-[#059669] font-semibold">{memoStatus}</p>}
          <button type="submit" className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[4px] bg-[#1E0B36] text-white text-sm font-semibold uppercase tracking-wide">
            <Send className="w-4 h-4" /> {user ? (isFr ? 'Envoyer la demande' : 'Send request') : isFr ? 'Connectez-vous' : 'Sign in to request'}
          </button>
        </form>
      )}
    </div>
  );
};
