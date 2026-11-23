import React, { useState } from 'react';
import { CheckCircle2, Search as SearchIcon, Send, Sparkles } from 'lucide-react';
import type { Creator, MemoRequest, PredictionMarket, UserProfile } from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import { translations } from '../i18n/translations';
import { submitMemoRequest } from '../services/firestoreService';
import { CreatorMarketCard } from './CreatorMarketCard';
import { PredictionMarketCard } from './PredictionMarketCard';

interface SearchViewProps {
  user: UserProfile | null;
  creators: Creator[];
  predictions: PredictionMarket[];
  lang: AppLang;
  onSelectCreator: (creator: Creator, side?: 'BUY' | 'SELL') => void;
  onVotePrediction: (prediction: PredictionMarket, side: 'YES' | 'NO') => void;
  onRequireAuth: () => void;
}

export const SearchView: React.FC<SearchViewProps> = ({
  user,
  creators,
  predictions,
  lang,
  onSelectCreator,
  onVotePrediction,
  onRequireAuth,
}) => {
  const t = translations[lang];
  const [queryText, setQueryText] = useState('');
  const [showMemoForm, setShowMemoForm] = useState(false);

  const [creatorName, setCreatorName] = useState('');
  const [handle, setHandle] = useState('');
  const [platform, setPlatform] = useState<MemoRequest['platform']>('TikTok');
  const [socialUrl, setSocialUrl] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedMemo, setSubmittedMemo] = useState<MemoRequest | null>(null);

  const normalized = queryText.trim().toLowerCase();
  const filteredCreators = creators.filter((c) => {
    if (!normalized) return true;
    return (
      c.name.toLowerCase().includes(normalized) ||
      c.handle.toLowerCase().includes(normalized) ||
      (c.raiseTitle && c.raiseTitle.toLowerCase().includes(normalized)) ||
      c.category.toLowerCase().includes(normalized) ||
      (c.city && c.city.toLowerCase().includes(normalized))
    );
  });

  const filteredPreds = predictions.filter((p) => {
    if (!normalized) return true;
    return (
      p.questionEn.toLowerCase().includes(normalized) ||
      p.questionFr.toLowerCase().includes(normalized) ||
      p.category.toLowerCase().includes(normalized)
    );
  });

  function openMemoPrompt() {
    if (!user) {
      onRequireAuth();
      return;
    }
    setCreatorName(queryText.trim());
    setSubmittedMemo(null);
    setError(null);
    setShowMemoForm(true);
  }

  async function handleSubmitMemo(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const created = await submitMemoRequest({
        requestedByUid: user.uid,
        creatorName,
        handle: handle || undefined,
        platform,
        socialUrl: socialUrl || undefined,
        reason: reason || undefined,
      });
      setSubmittedMemo(created);
      setShowMemoForm(false);
      setCreatorName('');
      setHandle('');
      setSocialUrl('');
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit memo request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="relative">
        <SearchIcon className="w-4 h-4 text-[#7E6FA1] absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={queryText}
          onChange={(e) => {
            setQueryText(e.target.value);
            if (submittedMemo) setSubmittedMemo(null);
          }}
          placeholder={t.searchPlaceholder}
          className="w-full pl-11 pr-4 py-3 text-sm bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl text-[#11081F] dark:text-[#F8F7FC] placeholder:text-[#7E6FA1] focus:outline-none focus:border-violet-500"
        />
      </div>

      {submittedMemo && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-[#11081F] dark:text-[#F8F7FC]">Listing Memo Logged</p>
            <p className="text-xs text-[#645582] dark:text-[#A99BC8] mt-0.5">
              Requested underwriting review for <strong>{submittedMemo.creatorName}</strong>.
            </p>
          </div>
        </div>
      )}

      {filteredCreators.length > 0 || filteredPreds.length > 0 ? (
        <div className="space-y-5">
          {filteredCreators.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredCreators.map((creator) => (
                <CreatorMarketCard
                  key={creator.id}
                  creator={creator}
                  lang={lang}
                  onTrade={onSelectCreator}
                />
              ))}
            </div>
          )}

          {filteredPreds.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredPreds.map((pred) => (
                <PredictionMarketCard
                  key={pred.id}
                  prediction={pred}
                  lang={lang}
                  onVote={onVotePrediction}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-3xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-violet-600/15 text-violet-500 flex items-center justify-center mx-auto">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#11081F] dark:text-[#F8F7FC]">
              {normalized ? `No listing for "${queryText.trim()}"` : t.emptyRaises}
            </h3>
            <p className="text-xs text-[#645582] dark:text-[#A99BC8] max-w-xs mx-auto">
              Request an AI underwriting memo so our team can verify social metrics and open a Raise.
            </p>
          </div>
          {!showMemoForm && (
            <button
              type="button"
              onClick={openMemoPrompt}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
            >
              {t.requestListing}
            </button>
          )}
        </div>
      )}

      {(filteredCreators.length > 0 || filteredPreds.length > 0) && normalized.length >= 2 && !showMemoForm && (
        <div className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl p-4 flex items-center justify-between gap-3">
          <span className="text-xs text-[#645582] dark:text-[#A99BC8]">{t.requestListing}</span>
          <button
            type="button"
            onClick={openMemoPrompt}
            className="px-3.5 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold shrink-0"
          >
            Request Memo
          </button>
        </div>
      )}

      {showMemoForm && (
        <form
          onSubmit={handleSubmitMemo}
          className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-3xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#11081F] dark:text-[#F8F7FC]">Request Creator Listing</h3>
            <button
              type="button"
              onClick={() => setShowMemoForm(false)}
              className="text-xs font-semibold text-[#645582] dark:text-[#A99BC8]"
            >
              Cancel
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-500">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              minLength={2}
              value={creatorName}
              onChange={(e) => setCreatorName(e.target.value)}
              placeholder="Creator or artist name *"
              className="px-4 py-3 text-sm bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl focus:outline-none focus:border-violet-500"
            />
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@handle"
              className="px-4 py-3 text-sm bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as MemoRequest['platform'])}
              className="px-4 py-3 text-sm bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl"
            >
              <option value="TikTok">TikTok</option>
              <option value="Facebook">Facebook</option>
              <option value="YouTube">YouTube</option>
              <option value="Other">Other</option>
            </select>
            <input
              type="url"
              value={socialUrl}
              onChange={(e) => setSocialUrl(e.target.value)}
              placeholder="Channel URL"
              className="px-4 py-3 text-sm bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl focus:outline-none focus:border-violet-500"
            />
          </div>

          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Upcoming project or cultural catalyst..."
            className="w-full px-4 py-3 text-sm bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl focus:outline-none focus:border-violet-500 resize-none"
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-5 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Submitting...' : 'Submit Memo Request'}
          </button>
        </form>
      )}
    </div>
  );
};
