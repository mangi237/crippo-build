import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Creator, Label, LabelInvitation, UserProfile } from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import {
  createLabel,
  inviteCreatorToLabel,
  removeCreatorFromLabel,
  subscribeLabelInvitations,
  subscribeLabelRoster,
  subscribeMyLabel,
} from '../services/firestoreService';
import { ScreenState } from './ScreenState';

interface LabelHubProps {
  user: UserProfile | null;
  creators: Creator[];
  lang: AppLang;
  onBack: () => void;
  onOpenDossier: (c: Creator) => void;
}

const inputClass = 'w-full px-3 py-2.5 text-sm bg-white border border-[#E2E8F0] rounded-[4px] focus:outline-none focus:border-[1.5px] focus:border-[#6C2BD9]';

/**
 * Label hub. A label registers, waits for admin verification, then invites verified creators.
 * Creators accept or decline from their dashboard; accepted creators appear on the roster.
 */
export const LabelHub: React.FC<LabelHubProps> = ({ user, creators, lang, onBack, onOpenDossier }) => {
  const isFr = lang === 'FR';
  const [label, setLabel] = useState<Label | null | undefined>(undefined);
  const [roster, setRoster] = useState<Creator[]>([]);
  const [invites, setInvites] = useState<LabelInvitation[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteId, setInviteId] = useState('');

  // registration form
  const [name, setName] = useState('');
  const [country, setCountry] = useState('Cameroon');
  const [description, setDescription] = useState('');
  const [foundedYear, setFoundedYear] = useState('');
  const [rccm, setRccm] = useState('');

  useEffect(() => {
    if (!user) return;
    return subscribeMyLabel(user.uid, setLabel);
  }, [user?.uid]);

  useEffect(() => {
    if (!label || label.status !== 'approved') return;
    const u1 = subscribeLabelRoster(label.id, setRoster);
    const u2 = subscribeLabelInvitations(label.id, setInvites);
    return () => {
      u1();
      u2();
    };
  }, [label?.id, label?.status]);

  const eligible = useMemo(() => {
    const invited = new Set(invites.filter((i) => i.status !== 'declined').map((i) => i.creatorId));
    return creators.filter((c) => c.claimStatus === 'CLAIMED' && c.claimedByUid && c.labelId !== label?.id && !invited.has(c.id));
  }, [creators, invites, label?.id]);

  if (!user) return <ScreenState title={isFr ? 'Connectez-vous' : 'Sign in'} body={isFr ? 'Le hub label est réservé aux comptes connectés.' : 'The label hub is for signed-in accounts.'} />;

  if (label === undefined) return <ScreenState title={isFr ? 'Chargement…' : 'Loading…'} />;

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await createLabel({ uid: user!.uid, name, country, description, foundedYear: Number(foundedYear) || undefined, rccmNumber: rccm || undefined });
      setMessage(isFr ? 'Label soumis pour vérification.' : 'Label submitted for verification.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setBusy(false);
    }
  }

  async function invite() {
    const creator = creators.find((c) => c.id === inviteId);
    if (!label || !creator) return;
    setBusy(true);
    setMessage(null);
    try {
      await inviteCreatorToLabel({ label, creator });
      setInviteId('');
      setMessage(isFr ? `Invitation envoyée à ${creator.name}.` : `Invitation sent to ${creator.name}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Invite failed.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Creator) {
    setBusy(true);
    try {
      await removeCreatorFromLabel(c.id);
      setMessage(isFr ? `${c.name} retiré du label.` : `${c.name} removed from the label.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Remove failed.');
    } finally {
      setBusy(false);
    }
  }

  const header = (title: string) => (
    <div className="flex items-center justify-between">
      <button type="button" onClick={onBack} className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center">
        <ArrowLeft className="w-4 h-4" />
      </button>
      <span className="label-xs text-[#6C2BD9]">{title}</span>
      <span className="w-9" />
    </div>
  );

  // No label yet: registration form
  if (!label) {
    return (
      <form onSubmit={register} className="space-y-5 pb-28 max-w-2xl mx-auto">
        {header(isFr ? 'Enregistrer un label' : 'Register a label')}
        <h1 className="font-display text-2xl font-bold">{isFr ? 'Enregistrer votre label' : 'Register your label'}</h1>
        <p className="text-xs text-[#64748B] leading-relaxed">
          {isFr ? 'Une fois vérifié par l’équipe Crippo, vous pourrez inviter des créateurs vérifiés à rejoindre votre roster.' : 'Once Crippo verifies it, you can invite verified creators to join your roster.'}
        </p>
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder={isFr ? 'Nom du label' : 'Label name'} className={inputClass} />
        <div className="grid grid-cols-2 gap-3">
          <input required value={country} onChange={(e) => setCountry(e.target.value)} placeholder={isFr ? 'Pays' : 'Country'} className={inputClass} />
          <input value={foundedYear} onChange={(e) => setFoundedYear(e.target.value)} placeholder={isFr ? 'Année de fondation' : 'Founded (year)'} className={`${inputClass} num`} />
        </div>
        <input value={rccm} onChange={(e) => setRccm(e.target.value)} placeholder={isFr ? 'Numéro RCCM' : 'RCCM registration number'} className={`${inputClass} num`} />
        <textarea required rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={isFr ? 'Description du label' : 'About the label'} className={inputClass} />
        {message && <p className="text-xs text-[#1E0B36] font-semibold">{message}</p>}
        <button type="submit" disabled={busy} className="w-full py-3.5 rounded-[4px] bg-[#1E0B36] text-white text-sm font-semibold uppercase tracking-wide disabled:opacity-40">
          {busy ? '…' : isFr ? 'Soumettre' : 'Submit for verification'}
        </button>
      </form>
    );
  }

  if (label.status === 'pending') {
    return <ScreenState title={isFr ? 'Vérification en cours' : 'Verification in progress'} body={isFr ? `${label.name} est en cours d’examen par l’équipe Crippo.` : `${label.name} is being reviewed by the Crippo team.`} />;
  }
  if (label.status === 'rejected') {
    return <ScreenState title={isFr ? 'Label non approuvé' : 'Label not approved'} body={isFr ? 'Contactez l’équipe Crippo pour plus d’informations.' : 'Contact the Crippo team for more information.'} />;
  }

  // Approved label dashboard
  return (
    <div className="space-y-6 pb-28 max-w-2xl mx-auto">
      {header(label.name)}
      <section className="space-y-2">
        <h1 className="font-display text-2xl font-bold">{label.name}</h1>
        <p className="text-xs text-[#64748B]">{label.country}{label.foundedYear ? ` · ${isFr ? 'fondé en' : 'founded'} ${label.foundedYear}` : ''}</p>
        <p className="text-sm leading-relaxed">{label.description}</p>
      </section>

      {message && <p className="text-xs text-[#1E0B36] font-semibold">{message}</p>}

      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold">{isFr ? 'Inviter un créateur' : 'Invite a creator'}</h2>
        {eligible.length === 0 ? (
          <p className="text-xs text-[#64748B]">{isFr ? 'Aucun créateur vérifié disponible pour le moment.' : 'No verified creators available right now.'}</p>
        ) : (
          <div className="flex gap-2">
            <select value={inviteId} onChange={(e) => setInviteId(e.target.value)} className={inputClass}>
              <option value="">{isFr ? 'Choisir un créateur' : 'Choose a creator'}</option>
              {eligible.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.handle}</option>)}
            </select>
            <button type="button" disabled={!inviteId || busy} onClick={invite} className="px-5 rounded-[4px] bg-[#059669] text-white text-xs font-semibold disabled:opacity-40 shrink-0">
              {isFr ? 'Inviter' : 'Invite'}
            </button>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold">{isFr ? 'Roster' : 'Roster'}</h2>
        {roster.length === 0 && <p className="text-xs text-[#64748B]">{isFr ? 'Aucun créateur dans le roster.' : 'No creators on the roster yet.'}</p>}
        {roster.map((c) => (
          <div key={c.id} className="card p-4 flex items-center justify-between gap-3">
            <button type="button" onClick={() => onOpenDossier(c)} className="min-w-0 text-left">
              <p className="font-display font-semibold truncate">{c.name}</p>
              <p className="text-xs text-[#64748B] truncate">{c.handle} · {c.category}</p>
            </button>
            <button type="button" disabled={busy} onClick={() => remove(c)} className="text-xs font-semibold text-[#DC2626] shrink-0">{isFr ? 'Retirer' : 'Remove'}</button>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold">{isFr ? 'Invitations envoyées' : 'Sent invitations'}</h2>
        {invites.length === 0 && <p className="text-xs text-[#64748B]">{isFr ? 'Aucune invitation.' : 'No invitations sent.'}</p>}
        {invites.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-3 text-xs py-2 border-b border-[#E2E8F0] last:border-0">
            <span className="font-semibold truncate">{i.creatorName}</span>
            <span className={`label-xs ${i.status === 'accepted' ? 'text-[#059669]' : i.status === 'declined' ? 'text-[#DC2626]' : 'text-[#6C2BD9]'}`}>{i.status}</span>
          </div>
        ))}
      </section>
    </div>
  );
};
