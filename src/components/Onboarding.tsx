import React, { useState } from 'react';
import { ArrowRight, Flame, Percent, ShieldCheck, Smartphone } from 'lucide-react';
import type { AppLang } from '../i18n/translations';

/** Splash shown on first paint: wordmark with the violet full stop. */
export const SplashScreen: React.FC = () => (
  <div className="fixed inset-0 z-[60] bg-[#F8F9FC] flex flex-col items-center justify-center gap-4">
    <div className="w-14 h-14 rounded-[12px] bg-[#1E0B36] flex items-center justify-center shadow-[0_10px_30px_rgba(30,11,54,0.25)]">
      <Flame className="w-6 h-6 text-white" />
    </div>
    <p className="font-display text-3xl font-bold text-[#1E0B36] tracking-tight">
      Crippo<span className="text-[#6C2BD9]">.</span>
    </p>
  </div>
);

interface OnboardingScreenProps {
  lang: AppLang;
  onFinish: () => void;
}

const SLIDES = [
  {
    eyebrow: { EN: '01 · Person & creator', FR: '01 · Personne & créateur' },
    title: { EN: 'Own a piece of African talent.', FR: 'Possédez une part du talent africain.' },
    body: { EN: 'Back creators you believe in and share their royalties, paid out in FCFA.', FR: 'Soutenez les créateurs et partagez leurs revenus, versés en FCFA.' },
    Icon: Flame,
  },
  {
    eyebrow: { EN: '02 · Creator races', FR: '02 · Courses créateurs' },
    title: { EN: 'Fund the next release.', FR: 'Financez la prochaine sortie.' },
    body: { EN: 'Each race has a clear budget, an escrow and milestones. Funds unlock only when they clear.', FR: 'Chaque course a un budget, un escrow et des jalons. Les fonds se débloquent après validation.' },
    Icon: ShieldCheck,
  },
  {
    eyebrow: { EN: '03 · Cultural predictions', FR: '03 · Prédictions culturelles' },
    title: { EN: 'Read the culture, take a view.', FR: 'Lisez la culture, prenez position.' },
    body: { EN: 'Vote YES or NO on music, film and awards outcomes. Prices move with the crowd.', FR: 'Votez OUI ou NON sur la musique, le cinéma et les prix. Les cotes bougent avec la foule.' },
    Icon: Percent,
  },
  {
    eyebrow: { EN: '04 · MoMo settlement', FR: '04 · Règlement MoMo' },
    title: { EN: 'Pay with the phone you already use.', FR: 'Payez avec le téléphone que vous utilisez déjà.' },
    body: { EN: 'MTN MoMo and Orange Money, approved with a USSD prompt. No crypto, no gas fees.', FR: 'MTN MoMo et Orange Money, validés par invite USSD. Pas de crypto, pas de frais de gaz.' },
    Icon: Smartphone,
  },
];

/** First-run intro: four slides, then the app. */
export const OnboardingFlow: React.FC<OnboardingScreenProps> = ({ lang, onFinish }) => {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;
  const Icon = slide.Icon;

  return (
    <div className="fixed inset-0 z-[55] bg-[#F8F9FC] flex flex-col">
      <div className="flex items-center justify-between px-6 pt-6">
        <span className="font-display font-bold text-[#1E0B36]">
          Crippo<span className="text-[#6C2BD9]">.</span>
        </span>
        <button type="button" onClick={onFinish} className="text-xs font-semibold text-[#64748B]">
          {lang === 'FR' ? 'Passer' : 'Skip'}
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center max-w-md mx-auto">
        <div className="w-20 h-20 rounded-[12px] bg-white shadow-[0_10px_30px_rgba(15,27,61,0.08)] flex items-center justify-center">
          <Icon className="w-8 h-8 text-[#6C2BD9]" />
        </div>
        <p className="label-xs text-[#6C2BD9] mt-8">{slide.eyebrow[lang]}</p>
        <h1 className="font-display text-3xl font-bold text-[#0F172A] mt-3 leading-tight">{slide.title[lang]}</h1>
        <p className="text-sm text-[#64748B] mt-4 leading-relaxed">{slide.body[lang]}</p>
      </div>

      <div className="px-6 pb-10 max-w-md w-full mx-auto space-y-6">
        <div className="flex justify-center gap-2">
          {SLIDES.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-[#6C2BD9]' : 'w-1.5 bg-[#CBD5E1]'}`} />
          ))}
        </div>
        <button
          type="button"
          onClick={() => (last ? onFinish() : setIndex(index + 1))}
          className="w-full py-3.5 rounded-[4px] bg-[#1E0B36] hover:bg-[#4C1D95] text-white text-sm font-semibold uppercase tracking-wide flex items-center justify-center gap-2"
        >
          {last ? (lang === 'FR' ? 'Commencer' : 'Get started') : lang === 'FR' ? 'Suivant' : 'Next'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
