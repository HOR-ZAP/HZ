import React from 'react';
import { Mountain, Sparkles, FileUp, BookOpen, X, ShieldCheck } from 'lucide-react';

interface WelcomeOnboardingBannerProps {
  onLoadSampleTrip: () => Promise<void>;
  onOpenNewHike: () => void;
  onTriggerGpxUpload: () => void;
  onDismiss: () => void;
  isLoadingSample: boolean;
}

export const WelcomeOnboardingBanner: React.FC<WelcomeOnboardingBannerProps> = ({
  onLoadSampleTrip,
  onOpenNewHike,
  onTriggerGpxUpload,
  onDismiss,
  isLoadingSample,
}) => {
  return (
    <div className="bg-gradient-to-r from-emerald-50 via-white to-stone-50 border-b border-emerald-200/80 px-3 sm:px-6 py-3 shrink-0 no-print">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
            <Mountain className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-extrabold text-stone-900">
                Vítejte v Horském zápisníku!
              </h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                <ShieldCheck className="w-3 h-3" />
                Soukromá offline data v zařízení
              </span>
            </div>
            <p className="text-xs text-stone-600 mt-0.5 leading-snug">
              Váš archív je zatím prázdný. Vyzkoušejte si mapu, výškový profil i 3D terén na
              ukázkových trasách (Králický Sněžník, Lysá hora a Šumava), nebo nahrajte vlastní GPX.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isLoadingSample}
            onClick={() => void onLoadSampleTrip()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isLoadingSample ? 'Načítám ukázky…' : 'Načíst ukázkové trasy'}</span>
          </button>

          <button
            type="button"
            onClick={onTriggerGpxUpload}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            <FileUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>Nahrát GPX</span>
          </button>

          <button
            type="button"
            onClick={onOpenNewHike}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-stone-500" />
            <span>Zadat ručně</span>
          </button>

          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
            title="Skrýt uvítací panel"
            aria-label="Skrýt uvítací panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
