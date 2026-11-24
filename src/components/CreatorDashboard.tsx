import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';
import type { Creator, LabelInvitation, UserProfile } from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import { respondToInvitation, subscribeMyInvitations, updateCreatorBio } from '../services/firestoreService';
import { ScreenState } from './ScreenState';

interface CreatorDashboardProps {
  user: UserProfile | null;
  creators: Creator[];
  lang: AppLang;
  onBack: () => void;
  onOpenDossier: (c: Creator) => void;
  onStartRaise: () => void;
  onVerify: () => void;
  onRequestMemo: () => void;
}

const inputClass = 'w-full px-3 py-2.5 text-sm bg-white border border-[#E2E8F0] rounded-[4px] focus:outline-none focus:border-[1.5px] focus:border-[#6C2BD9]';

/**
 * Creator dashboard (verified creators only). Label invitations, the public bio editor,
 * and the next steps: raise, claim, or request a memo.
 */
export const CreatorDashboard: React.FC<CreatorDashboardProps> = ({ user, creators, lang, onBack, onOpenDossier, onStartRaise, onVerify, onRequestMemo }) => {
  const isFr = lang === 'FR';
  const [invites, setInvites] = useState<LabelInvitation[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const mine = useMemo(() => creators.filter((c) => c.claimedByUid === user?.uid && c.claimStatus === 'CLAIMED'), [creators, user?.uid]);
  const [selectedId, setSelectedId] = useState<string>('');
  const creator = mine.find((c) => c.id === selectedId) || mine[0];

  const [bio, setBio] = useState('');
  const [genres, setGenres] = useState('');
  const [activeSince, setActiveSince] = useState('');
  const [website, setWebsite] = useState('');
  const [ageVisible, setAgeVisible] = useState(false);
  const [birthYear, setBirthYear] = useState('');

  useEffect(() => {
    if (!user) return;
    return subscribeMyInvitations(user.uid, setInvites);
  }, [user?.uid]);

  useEffect(() => {
    if (!creator) return;
    setBio(creator.bio || '');
    setGenres((creator.genres || []).join(', '));
    setActiveSince(creator.activeSinceYear ? String(creator.activeSinceYear) : '');
    setWebsite(creator.websiteUrl || '');
    setAgeVisible(!!creator.ageVisible);
    setBirthYear(creator.birthYear ? String(creator.birthYear) : '');
  }, [creator?.id]);

  if (!user) return <ScreenState title={isFr ? 'Connectez-vous' : 'Sign in'} body={isFr ? 'Votre tableau de bord créateur est réservé aux comptes connectés.' : 'Your creator dashboard is for signed-in accounts.'} />;

  if (!user.isVerifiedCreator) {
    return (
      <ScreenState
        title={isFr ? 'Compte non vérifié' : 'Account not verified'}
        body={isFr ? 'Vérifiez votre identité pour accéder au tableau de bord créateur, aux invitations de labels et aux courses.' : 'Verify your identity to unlock the creator dashboard, label invitations and races.'}
        actionLabel={isFr ? 'Vérifier mon compte' : 'Verify my account'}
        onAction={onVerify}
      />
    );
  }

  async function respond(invite: LabelInvitation, accept: boolean) {
    setBusy(invite.id);
    setMessage(null);
    try {
      await respondToInvitation(invite, accept);
      setMessage(accept ? (isFr ? `Vous avez rejoint ${invite.labelName}.` : `You joined ${invite.labelName}.`) : isFr ? 'Invitation déclinée.' : 'Invitation declined.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusy(null);
    }
  }

  async function saveBio(e: React.FormEvent) {
    e.preventDefault();
    if (!creator) return;
    setBusy('bio');
    setMessage(null);
    try {
      await updateCreatorBio(creator.id, {
        bio,
        genres: genres.split(',').map((g) => g.trim()),
        activeSinceYear: Number(activeSince) || undefined,
        websiteUrl: website || undefined,
        ageVisible,
        birthYear: Number(birthYear) || undefined,
      });
      setMessage(isFr ? 'Biographie enregistrée.' : 'Bio saved.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(null);
    }
  }

  const pending = invites.filter((i) => i.status === 'pending');

  return (
    <div className="space-y-6 pb-28 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="label-xs text-[#6C2BD9]">{isFr ? 'Tableau de bord créateur' : 'Creator dashboard'}</span>
        <span className="w-9" />
      </div>

      {message && <p className="text-xs text-[#1E0B36] font-semibold">{message}</p>}

      {/* Next steps */}
      <section className="grid grid-cols-3 gap-2">
        <button type="button" onClick={onStartRaise} className="py-3 rounded-[4px] bg-[#059669] text-white text-xs font-semibold">{isFr ? 'Lancer une course' : 'Start a raise'}</button>
        <button type="button" onClick={onVerify} className="py-3 rounded-[4px] bg-[#1E0B36] text-white text-xs font-semibold">{isFr ? 'Réclamer un profil' : 'Claim a profile'}</button>
        <button type="button" onClick={onRequestMemo} className="py-3 rounded-[4px] bg-[#F2F3FF] text-[#1E0B36] text-xs font-semibold">{isFr ? 'Demander un mémo' : 'Request a memo'}</button>
      </section>

      {/* Label invitations */}
      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold">{isFr ? 'Invitations de label' : 'Label invitations'}</h2>
        {pending.length === 0 && <p className="text-xs text-[#64748B]">{isFr ? 'Aucune invitation en attente.' : 'No pending invitations.'}</p>}
        {pending.map((inv) => (
          <div key={inv.id} className="card p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{inv.labelName}</p>
              <p className="text-xs text-[#64748B]">{isFr ? `Invite ${inv.creatorName}` : `Invited ${inv.creatorName}`}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button type="button" disabled={busy === inv.id} onClick={() => respond(inv, true)} className="w-9 h-9 rounded-[4px] bg-[#059669] text-white flex items-center justify-center disabled:opacity-40" aria-label="Accept">
                <Check className="w-4 h-4" />
              </button>
              <button type="button" disabled={busy === inv.id} onClick={() => respond(inv, false)} className="w-9 h-9 rounded-[4px] bg-[#F2F3FF] flex items-center justify-center disabled:opacity-40" aria-label="Decline">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Profiles */}
      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold">{isFr ? 'Mes profils' : 'My profiles'}</h2>
        {mine.length === 0 && <p className="text-xs text-[#64748B]">{isFr ? 'Aucun profil réclamé. Réclamez un profil non réclamé pour commencer.' : 'No claimed profiles yet. Claim an unclaimed profile to start.'}</p>}
        {mine.length > 1 && (
          <select value={creator?.id} onChange={(e) => setSelectedId(e.target.value)} className={inputClass}>
            {mine.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {creator && (
          <div className="card p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display font-semibold truncate">{creator.name}</p>
              <p className="text-xs text-[#64748B]">{creator.labelName ? `${isFr ? 'Label' : 'Label'}: ${creator.labelName}` : isFr ? 'Sans label' : 'Independent'}</p>
            </div>
            <button type="button" onClick={() => onOpenDossier(creator)} className="text-xs font-semibold text-[#6C2BD9] shrink-0">{isFr ? 'Voir le dossier' : 'View dossier'}</button>
          </div>
        )}
      </section>

      {/* Bio editor */}
      {creator && (
        <form onSubmit={saveBio} className="space-y-4">
          <h2 className="font-display text-base font-semibold">{isFr ? 'Biographie publique' : 'Public bio'}</h2>
          <textarea rows={6} value={bio} onChange={(e) => setBio(e.target.value)} placeholder={isFr ? 'Qui êtes-vous, d’où venez-vous, ce que vous faites…' : 'Who you are, where you are from, what you make…'} className={inputClass} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={genres} onChange={(e) => setGenres(e.target.value)} placeholder={isFr ? 'Genres (séparés par des virgules)' : 'Genres (comma separated)'} className={inputClass} />
            <input value={activeSince} onChange={(e) => setActiveSince(e.target.value)} placeholder={isFr ? 'Actif depuis (année)' : 'Active since (year)'} className={`${inputClass} num`} />
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" className={inputClass} />
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={ageVisible} onChange={(e) => setAgeVisible(e.target.checked)} className="mt-1 accent-[#6C2BD9]" />
            <span>
              {isFr ? 'Afficher mon âge sur ma biographie publique' : 'Show my age on my public bio'}
              <span className="block text-xs text-[#64748B]">{isFr ? 'Désactivé par défaut. L’année de naissance est retirée si vous désactivez.' : 'Off by default. Birth year is removed if you turn this off.'}</span>
            </span>
          </label>
          {ageVisible && <input value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder={isFr ? 'Année de naissance' : 'Birth year'} className={`${inputClass} num`} />}
          <button type="submit" disabled={busy === 'bio'} className="w-full py-3.5 rounded-[4px] bg-[#1E0B36] text-white text-sm font-semibold uppercase tracking-wide disabled:opacity-40">
            {busy === 'bio' ? '…' : isFr ? 'Enregistrer la biographie' : 'Save bio'}
          </button>
        </form>
      )}
    </div>
  );
};
