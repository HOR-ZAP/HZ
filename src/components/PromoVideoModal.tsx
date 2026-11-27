import React, { useState } from 'react';
import { X, Download, Play, Film, Sparkles, CheckCircle2, MapPin, Mountain, Compass, BarChart3 } from 'lucide-react';

interface PromoVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLicenseModal?: () => void;
}

export const PromoVideoModal: React.FC<PromoVideoModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const base = import.meta.env.BASE_URL || './';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const videoUrl = `${normalizedBase}promo-horsky-zapisnik.mp4?v=4.2`;

  const handleCopyShareText = async () => {
    const shareText =
      '🏔️ Horský zápisník a Archív tras — Váš osobní offline deník GPX výšlapů s interaktivní 2D a 3D mapou, výškovými profily, analytikou a zálohou na vlastní Google Disk. Vyzkoušejte na: https://hor-zap.github.io/HZ/';
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2400] flex items-center justify-center bg-stone-950/75 backdrop-blur-xs p-3 sm:p-5 no-print"
      onClick={onClose}
    >
      <div
        className="bg-stone-900 text-white rounded-2xl shadow-2xl border border-stone-700/80 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-800 bg-stone-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white leading-tight flex items-center gap-2">
                <span>Propagační video — Horský zápisník a Archív tras</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  42 s · HD MP4 · Hudba (YouTube OK)
                </span>
              </h2>
              <p className="text-xs text-stone-400">
                Prezentace 6 hlavních funkcí: 2D mapa tras, body zájmu, statistiky, systém milníků, 3D dioráma s přeletem a výškový profil se sklonem
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
            aria-label="Zavřít video"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          <div className="relative rounded-xl overflow-hidden bg-black border border-stone-800 shadow-xl aspect-video">
            <video
              src={videoUrl}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            >
              Váš prohlížeč nepodporuje přehrávání MP4 videa.
            </video>
          </div>

          {/* 6-Scene Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-stone-800/70 border border-stone-700/70">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>1 / 6 · 0:04 – 0:09</span>
              </div>
              <div className="font-bold text-stone-100 mt-1">Grafické zobrazení na mapě</div>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Přehledné barevné vykreslení všech jednodenních i vícedenních tras napříč pohořími.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-stone-800/70 border border-stone-700/70">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <Compass className="w-3 h-3" />
                <span>2 / 6 · 0:10 – 0:15</span>
              </div>
              <div className="font-bold text-stone-100 mt-1">Ubytování, občerstvení a parkoviště</div>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Body zájmu v okolí trasy: parkoviště (P), horské chaty a občerstvení (H), ubytování (U) a kempy (K).
              </p>
            </div>

            <div className="p-3 rounded-xl bg-stone-800/70 border border-stone-700/70">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <BarChart3 className="w-3 h-3" />
                <span>3 / 6 · 0:15 – 0:20</span>
              </div>
              <div className="font-bold text-stone-100 mt-1">Různé statistiky a grafy</div>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Aktivní dny, celkové kilometry, osobní rekordy a detailní graf kumulativního převýšení.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-stone-800/70 border border-stone-700/70">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>4 / 6 · 0:21 – 0:26</span>
              </div>
              <div className="font-bold text-stone-100 mt-1">Systém milníků a výzev</div>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Motivační milníky s vtipnými komentáři, postupem plnění a proklikem přímo na mapu výšlapu.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-stone-800/70 border border-stone-700/70">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <Mountain className="w-3 h-3" />
                <span>5 / 6 · 0:26 – 0:31</span>
              </div>
              <div className="font-bold text-stone-100 mt-1">3D dioráma trasy s přeletem</div>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Prostorový 3D model horského masivu s označením okolních vrcholů a živým přeletem po trase.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-stone-800/70 border border-stone-700/70">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <Play className="w-3 h-3" />
                <span>6 / 6 · 0:32 – 0:37</span>
              </div>
              <div className="font-bold text-stone-100 mt-1">Výškový profil se sklonem</div>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Barevné rozlišení sklonu podle obtížnosti: Rovina (&lt;5 %), Standard (5–10 %), Prudký (10–20 %), Extrém (&gt;20 %).
              </p>
            </div>
          </div>

          {/* Actions Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-800">
            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href={videoUrl}
                download="promo-horsky-zapisnik.mp4"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-sm transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Stáhnout MP4 video (pro YouTube / Facebook / Web)</span>
              </a>

              <button
                type="button"
                onClick={() => void handleCopyShareText()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Propagační text zkopírován!</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Zkopírovat text k příspěvku</span>
                  </>
                )}
              </button>
            </div>

            <div className="inline-flex items-center gap-1.5 text-xs text-stone-400">
              <Mountain className="w-3.5 h-3.5 text-emerald-400" />
              <span>hor-zap.github.io/HZ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
