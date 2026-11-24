import React from 'react';
import { signOut } from 'firebase/auth';
import { Briefcase, ChevronRight, LogOut, Megaphone, ShieldCheck, Wallet } from 'lucide-react';
import type { BrandApplication, Creator, CreatorApplication, PredictionVote, Trade, UserProfile, WalletTransaction } from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import { auth } from '../services/firebase';
import { formatXAF } from '../utils/format';
import { ScreenState } from './ScreenState';

interface AccountProfileProps {
  user: UserProfile | null;
  creators: Creator[];
  trades: Trade[];
  predictionVotes: PredictionVote[];
  walletTxs: WalletTransaction[];
  myApplications: CreatorApplication[];
  myBrandApplications: BrandApplication[];
  claimTargetCreator: Creator | null;
  onClearClaimTarget: () => void;
  lang: AppLang;
  onToggleLang: () => void;
  onReplayOnboarding: () => void;
  onSelectCreator: (c: Creator) => void;
  onOpenPortfolio: () => void;
  onOpenWallet: () => void;
  onRequireAuth: () => void;
  onOpenAdmin: () => void;
  onStartRaise: () => void;
  onVerifyIdentity: () => void;
  onOpenCreatorDashboard: () => void;
  onOpenLabel: () => void;
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-[#F2F3FF] text-[#6C2BD9]',
  approved: 'bg-[#059669]/10 text-[#059669]',
  accepted: 'bg-[#059669]/10 text-[#059669]',
  rejected: 'bg-[#DC2626]/10 text-[#DC2626]',
};

/**
 * Account & creator profile (Crippo Exchange design, "Creator Profile").
 * Signed-in investor account: balances, holdings shortcut, applications, creator actions.
 */
export const AccountProfile: React.FC<AccountProfileProps> = ({
  user,
  creators,
  trades,
  predictionVotes,
  walletTxs,
  myApplications,
  myBrandApplications,
  claimTargetCreator,
  onClearClaimTarget,
  lang,
  onToggleLang,
  onReplayOnboarding,
  onOpenPortfolio,
  onOpenWallet,
  onRequireAuth,
  onOpenAdmin,
  onStartRaise,
  onVerifyIdentity,
  onSelectCreator,
  onOpenCreatorDashboard,
  onOpenLabel,
}) => {
  const isFr = lang === 'FR';

  if (!user) {
    return (
      <ScreenState
        title={isFr ? 'Connectez-vous à votre compte' : 'Sign in to your account'}
        body={isFr ? 'Portefeuille, parts, vérification et candidatures.' : 'Wallet, shares, verification and applications.'}
        actionLabel={isFr ? 'Se connecter' : 'Sign in'}
        onAction={onRequireAuth}
      />
    );
  }

  const claimed = user.isVerifiedCreator;
  const claimCreatorName = claimTargetCreator?.name;

  return (
    <div className="space-y-5 pb-28 max-w-2xl mx-auto">
      <section className="card p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-[8px] bg-[#EAEDFF] overflow-hidden flex items-center justify-center font-display text-xl font-bold text-[#1E0B36]">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : user.fullName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold truncate">{user.fullName}</p>
          <p className="num text-xs text-[#64748B] truncate">{user.anonymousId} · {user.email}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className={`label-xs px-2 py-0.5 rounded-full ${claimed ? 'bg-[#059669]/10 text-[#059669]' : 'bg-[#F2F3FF] text-[#6C2BD9]'}`}>
              {claimed ? (isFr ? 'Créateur vérifié' : 'Verified creator') : isFr ? 'Investisseur' : 'Investor'}
            </span>
            {user.admin && <span className="label-xs px-2 py-0.5 rounded-full bg-[#1E0B36] text-white">Admin</span>}
          </div>
        </div>
        <button type="button" onClick={onToggleLang} className="label-xs px-3 py-1.5 rounded-full bg-[#F2F3FF]">
          {lang === 'EN' ? 'FR' : 'EN'}
        </button>
      </section>

      {claimTargetCreator && (
        <section className="card p-5 space-y-3 border border-[#6C2BD9]/30">
          <p className="label-xs text-[#6C2BD9]">{isFr ? 'Réclamation en cours' : 'Claim in progress'}</p>
          <p className="text-sm">
            {isFr ? 'Vérifiez votre identité pour réclamer' : 'Verify your identity to claim'} <strong>{claimCreatorName}</strong>.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onVerifyIdentity} className="flex-1 py-2.5 rounded-[4px] bg-[#1E0B36] text-white text-xs font-semibold">
              {isFr ? 'Vérifier' : 'Verify identity'}
            </button>
            <button type="button" onClick={onClearClaimTarget} className="px-4 py-2.5 rounded-[4px] bg-[#F2F3FF] text-xs font-semibold">
              {isFr ? 'Annuler' : 'Dismiss'}
            </button>
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={onOpenWallet} className="card p-4 text-left space-y-2">
          <Wallet className="w-4 h-4 text-[#059669]" />
          <p className="label-xs text-[#64748B]">{isFr ? 'Solde MoMo' : 'MoMo cash'}</p>
          <p className="num font-display text-lg font-bold">{formatXAF(user.walletBalanceXAF || 0)}</p>
        </button>
        <button type="button" onClick={onOpenPortfolio} className="card p-4 text-left space-y-2">
          <Briefcase className="w-4 h-4 text-[#6C2BD9]" />
          <p className="label-xs text-[#64748B]">{isFr ? 'Parts détenues' : 'Holdings'}</p>
          <p className="num font-display text-lg font-bold">{trades.length} {isFr ? 'ordres' : 'orders'}</p>
        </button>
      </div>

      {/* Creator actions */}
      <section className="card divide-y divide-[#E2E8F0]">
        <ActionRow title={isFr ? 'Tableau de bord créateur' : 'Creator dashboard'} subtitle={claimed ? (isFr ? 'Invitations, biographie, profils' : 'Invitations, bio, profiles') : isFr ? 'Disponible après vérification' : 'Available after verification'} onClick={onOpenCreatorDashboard} />
        <ActionRow title={isFr ? 'Label' : 'Label'} subtitle={isFr ? 'Enregistrer ou gérer votre roster' : 'Register or manage your roster'} onClick={onOpenLabel} />
        <ActionRow icon={<Megaphone className="w-4 h-4" />} title={isFr ? 'Lancer une course' : 'Start a raise'} subtitle={isFr ? 'Questionnaire pré-production' : 'Pre-production questionnaire'} onClick={onStartRaise} />
        <ActionRow icon={<ShieldCheck className="w-4 h-4" />} title={isFr ? 'Vérification d’identité' : 'Identity verification'} subtitle={isFr ? 'KYC, NIU et MoMo' : 'KYC, NIU and MoMo'} onClick={onVerifyIdentity} />
        <ActionRow icon={<Wallet className="w-4 h-4" />} title={isFr ? 'Portefeuille' : 'Wallet'} subtitle={isFr ? 'Dépôts et retraits MoMo' : 'MoMo deposits and withdrawals'} onClick={onOpenWallet} />
      </section>

      {/* Applications */}
      <section className="card p-5 space-y-3">
        <h2 className="font-display text-base font-semibold">{isFr ? 'Candidatures créateur' : 'Creator applications'}</h2>
        {myApplications.length === 0 ? (
          <p className="text-xs text-[#64748B]">{isFr ? 'Aucune candidature.' : 'No applications yet.'}</p>
        ) : (
          myApplications.map((app) => (
            <div key={app.id} className="flex items-center justify-between gap-3 text-xs py-2 border-b border-[#E2E8F0] last:border-0">
              <div className="min-w-0">
                <p className="font-semibold truncate">{app.stageName}</p>
                <p className="num text-[#64748B]">{new Date(app.createdAt).toLocaleDateString()}</p>
              </div>
              <span className={`label-xs px-2 py-1 rounded-full ${STATUS_STYLE[app.status] || ''}`}>{app.status}</span>
            </div>
          ))
        )}
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-display text-base font-semibold">{isFr ? 'Candidatures sponsor' : 'Brand applications'}</h2>
        {myBrandApplications.length === 0 ? (
          <p className="text-xs text-[#64748B]">{isFr ? 'Aucune candidature sponsor.' : 'No brand applications yet.'}</p>
        ) : (
          myBrandApplications.map((app) => (
            <div key={app.id} className="flex items-center justify-between gap-3 text-xs py-2 border-b border-[#E2E8F0] last:border-0">
              <div className="min-w-0">
                <p className="font-semibold truncate">{app.campaignTitle}</p>
                <p className="text-[#64748B] truncate">{app.brandName} · {app.creatorName}</p>
              </div>
              <span className={`label-xs px-2 py-1 rounded-full ${STATUS_STYLE[app.status] || ''}`}>{app.status}</span>
            </div>
          ))
        )}
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-display text-base font-semibold">{isFr ? 'Activité récente' : 'Recent activity'}</h2>
        {predictionVotes.length === 0 && walletTxs.length === 0 ? (
          <p className="text-xs text-[#64748B]">{isFr ? 'Rien pour le moment.' : 'Nothing yet.'}</p>
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {predictionVotes.slice(0, 4).map((v) => (
              <div key={v.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                <span className="truncate">{(isFr ? v.questionFr : v.questionEn) || v.predictionId}</span>
                <span className={`label-xs ${v.side === 'YES' ? 'text-[#059669]' : 'text-[#DC2626]'}`}>{v.side}</span>
              </div>
            ))}
          </div>
        )}
        {creators.length > 0 && (
          <button type="button" onClick={() => onSelectCreator(creators[0])} className="text-xs font-semibold text-[#6C2BD9]">
            {isFr ? 'Voir la course en tête' : 'View top race'}
          </button>
        )}
      </section>

      <section className="card divide-y divide-[#E2E8F0]">
        <ActionRow title={isFr ? 'Revoir l’introduction' : 'Replay intro'} onClick={onReplayOnboarding} />
        {user.admin && <ActionRow title={isFr ? 'Console admin' : 'Admin console'} onClick={onOpenAdmin} />}
        <ActionRow
          icon={<LogOut className="w-4 h-4" />}
          title={isFr ? 'Se déconnecter' : 'Sign out'}
          onClick={async () => {
            await signOut(auth);
          }}
        />
      </section>
      <p className="text-center text-[11px] text-[#64748B]">Crippo · {trades.length + predictionVotes.length} {isFr ? 'événements' : 'events'}</p>
    </div>
  );
};

const ActionRow: React.FC<{ icon?: React.ReactNode; title: string; subtitle?: string; onClick: () => void }> = ({ icon, title, subtitle, onClick }) => (
  <button type="button" onClick={onClick} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
    <span className="flex items-center gap-3 min-w-0">
      {icon && <span className="text-[#6C2BD9]">{icon}</span>}
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        {subtitle && <span className="block text-xs text-[#64748B]">{subtitle}</span>}
      </span>
    </span>
    <ChevronRight className="w-4 h-4 text-[#94A3B8] shrink-0" />
  </button>
);
