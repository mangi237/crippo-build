import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Flame, ShieldCheck, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import type { AppLang } from '../i18n/translations';

export const SplashScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 z-50 bg-[#0B0514] text-[#F8F9FC] flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center text-center space-y-5 max-w-sm">
        <div className="w-20 h-20 rounded-full bg-[#6C2BD9] text-white text-3xl font-extrabold flex items-center justify-center">
          C
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight">Crippo</h1>
          <p className="text-sm text-[#A99BC8] leading-relaxed">
            Don’t Beg. Don’t Donate. Own a Piece of Talent.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 pt-2">
          <span className="w-2 h-2 rounded-full bg-[#059669] animate-pulse" />
          <span>CAMEROON CREATOR CAPITAL EXCHANGE · XAF</span>
        </div>
      </div>
    </div>
  );
};

interface OnboardingScreenProps {
  lang: AppLang;
  onFinish: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ lang, onFinish }) => {
  const [step, setStep] = useState(0);

  const slides =
    lang === 'FR'
      ? [
          {
            icon: TrendingUp,
            eyebrow: '01 · MARCHÉ DE CRÉATEURS',
            title: 'Investissez dans des talents, pas des dons.',
            body: 'Crippo est une bourse en temps réel dédiée aux créateurs camerounais et africains. Achetez des parts de revenus sur des albums, séries TikTok et films en XAF.',
            highlights: [
              'Prix d’ouverture audité avant cotation (P₀)',
              'Table de capitalisation transparente et séquestre en 2 tranches',
            ],
          },
          {
            icon: Flame,
            eyebrow: '02 · AGENTS & POOLS DE VOTE',
            title: 'Blogs locaux & tendances font fluctuer le marché.',
            body: 'Nos agents autonomes analysent les blogs camerounais, Facebook et TikTok pour ajuster les cours des créateurs et ouvrir des marchés de prédiction Oui/Non.',
            highlights: [
              'Fluctuation dynamique selon les catalyseurs culturels (#237)',
              'Marchés binaires Oui / Non générés automatiquement',
            ],
          },
          {
            icon: ShieldCheck,
            eyebrow: '03 · PROFIL RÉCLAMÉ & MOBILE MONEY',
            title: 'Réclamez votre profil & réglez via MoMo.',
            body: 'Les artistes vérifient leur code bio pour réclamer leur fiche, lancer une levée ou postuler aux campagnes de marques et agences. Dépôts et retraits instantanés via MTN MoMo et Orange Money.',
            highlights: [
              'Seuls les créateurs réclamés et vérifiés lancent des levées',
              'Règlement direct MTN MoMo & Orange Money en FCFA',
            ],
          },
        ]
      : [
          {
            icon: TrendingUp,
            eyebrow: '01 · PERSON & CREATOR MARKET',
            title: 'Own verified stakes in real talent.',
            body: 'Crippo is a live creator capital market. Buy revenue-sharing stakes in Cameroonian musicians, filmmakers, and digital storytellers directly in XAF.',
            highlights: [
              'Pre-listing AI underwriting fixes initial share price P₀',
              '2-tranche Clearinghouse Escrow protects every investor',
            ],
          },
          {
            icon: Flame,
            eyebrow: '02 · LIVE PULSE & VOTING POOLS',
            title: 'Local blogs & social feeds move prices live.',
            body: 'Autonomous market agents scan Cameroon blogs, Facebook, and TikTok feeds to adjust creator share values and convert trending stories into live Yes/No voting pools.',
            highlights: [
              'Real-time share fluctuations tied to verified #237 news',
              'Yes / No cultural prediction pools settle at 1,000 XAF',
            ],
          },
          {
            icon: Wallet,
            eyebrow: '03 · CLAIM PROFILE & MOMO SETTLEMENT',
            title: 'Claim your creator card. Settle in MoMo.',
            body: 'Creators must claim and verify their profile via Bio-Code + KYC before launching Raises or applying to Brand & Agency campaigns. Trade seamlessly with MTN MoMo & Orange Money.',
            highlights: [
              'Verified Creator Claim gate blocks unverified Raises',
              'Instant XAF cash wallet & Mobile Money settlement',
            ],
          },
        ];

  const current = slides[step];
  const Icon = current.icon;
  const isLast = step === slides.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-[#F8F9FC] dark:bg-[#0B0514] text-[#0F172A] dark:text-[#F8F9FC] flex flex-col justify-between p-6 sm:p-10 overflow-y-auto">
      {/* Top Bar */}
      <div className="max-w-lg w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-full bg-[#6C2BD9] text-white font-extrabold text-sm flex items-center justify-center">
            C
          </span>
          <span className="text-lg font-extrabold tracking-tight">Crippo</span>
        </div>

        <button
          type="button"
          onClick={onFinish}
          className="px-4 py-2 rounded-full text-xs font-semibold text-[#64748B] dark:text-[#A99BC8] hover:text-[#0F172A] dark:hover:text-white"
        >
          {lang === 'FR' ? 'Passer' : 'Skip'}
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-lg w-full mx-auto py-8 space-y-6">
        <div className="w-16 h-16 rounded-full bg-[#6C2BD9] text-white flex items-center justify-center">
          <Icon className="w-7 h-7" />
        </div>

        <div className="space-y-3">
          <div className="text-xs font-bold tracking-wider uppercase text-[#6C2BD9]">
            {current.eyebrow}
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight">
            {current.title}
          </h2>
          <p className="text-sm sm:text-base text-[#544675] dark:text-[#B9ADD6] leading-relaxed">
            {current.body}
          </p>
        </div>

        <div className="space-y-2.5 pt-1">
          {current.highlights.map((h) => (
            <div key={h} className="flex items-start gap-2.5 text-xs sm:text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" />
              <span>{h}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="max-w-lg w-full mx-auto space-y-5">
        <div className="flex items-center justify-center gap-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Slide ${idx + 1}`}
              onClick={() => setStep(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === step ? 'w-8 bg-[#6C2BD9]' : 'w-2 bg-[#D6CEE8] dark:bg-[#2A174A]'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            if (isLast) onFinish();
            else setStep((s) => s + 1);
          }}
          className="w-full py-4 px-6 rounded-full bg-[#6C2BD9] hover:bg-[#6C2BD9] text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
        >
          {isLast ? (
            <>
              <Sparkles className="w-4 h-4" />
              <span>{lang === 'FR' ? 'Entrer sur le marché' : 'Enter Crippo Exchange'}</span>
            </>
          ) : (
            <>
              <span>{lang === 'FR' ? 'Continuer' : 'Continue'}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
