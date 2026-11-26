import React, { useState, useEffect } from 'react';
import {
  X,
  Crown,
  Cloud,
  Check,
  Lock,
  UploadCloud,
  DownloadCloud,
  RefreshCw,
  LogOut,
  KeyRound,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  HardDrive,
  Scale,
  Mail,
  FileText,
} from 'lucide-react';
import { GoogleUserInfo } from '../services/googleAuth';
import { DriveBackupInfo } from '../services/driveSync';
import {
  LicenseState,
  ProFeatureId,
  PRO_FEATURE_META,
  PublicBillingConfig,
  FREE_MAX_HIKES,
  FREE_MAX_PLANNED,
  hasProAccess,
  getTrialDaysRemaining,
} from '../services/licensing';

export type AccountModalTab = 'drive' | 'license' | 'legal';

interface AccountLicenseModalProps {
  isOpen: boolean;
  initialTab: AccountModalTab;
  lockedFeature: ProFeatureId | null;
  onClose: () => void;
  licenseState: LicenseState;
  billingConfig: PublicBillingConfig;
  hikesCount: number;
  plannedCount: number;
  googleUser: GoogleUserInfo | null;
  hasActiveDriveToken: boolean;
  driveBackupInfo: DriveBackupInfo | null;
  isDriveBusy: boolean;
  isOffline: boolean;
  onGoogleSignIn: () => Promise<void>;
  onGoogleSignOut: () => Promise<void>;
  onRefreshDriveStatus: () => Promise<void>;
  onRequestDriveBackup: () => void;
  onRequestDriveRestore: () => void;
  onStartTrial: () => Promise<void>;
  onActivateLicenseKey: (key: string, email: string) => Promise<void>;
  onRequestDeactivateLicense: () => void;
}

function formatCzechDateTime(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('cs-CZ', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatSizeBytes(raw?: string): string {
  if (!raw) return '';
  const bytes = Number(raw);
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const AccountLicenseModal: React.FC<AccountLicenseModalProps> = ({
  isOpen,
  initialTab,
  lockedFeature,
  onClose,
  licenseState,
  billingConfig,
  hikesCount,
  plannedCount,
  googleUser,
  hasActiveDriveToken,
  driveBackupInfo,
  isDriveBusy,
  isOffline,
  onGoogleSignIn,
  onGoogleSignOut,
  onRefreshDriveStatus,
  onRequestDriveBackup,
  onRequestDriveRestore,
  onStartTrial,
  onActivateLicenseKey,
  onRequestDeactivateLicense,
}) => {
  const [activeTab, setActiveTab] = useState<AccountModalTab>(initialTab);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [emailInput, setEmailInput] = useState(licenseState.customerEmail || '');
  const [isActivating, setIsActivating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(lockedFeature ? 'license' : initialTab);
      setFormError(null);
    }
  }, [isOpen, initialTab, lockedFeature]);

  if (!isOpen) return null;

  const isPro = hasProAccess(licenseState);
  const trialDaysLeft = getTrialDaysRemaining(licenseState);
  const lockedMeta = lockedFeature ? PRO_FEATURE_META[lockedFeature] : null;

  const handleActivateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) {
      setFormError('Zadejte prosím licenční klíč.');
      return;
    }
    setFormError(null);
    setIsActivating(true);
    try {
      await onActivateLicenseKey(licenseKeyInput.trim(), emailInput.trim());
      setLicenseKeyInput('');
    } catch (err: unknown) {
      const eObj = err as Error;
      setFormError(eObj?.message || 'Aktivace klíče se nezdařila.');
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div
      className="absolute md:fixed inset-0 z-[2200] flex items-center justify-center bg-stone-900/65 backdrop-blur-xs p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-2xl max-h-[92%] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 bg-stone-50/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              {activeTab === 'drive' ? (
                <Cloud className="w-5 h-5" />
              ) : (
                <Crown className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-extrabold text-stone-900 leading-tight">
                Účet, záloha a PRO licence
              </h2>
              <p className="text-xs text-stone-500">
                Soukromá lokální data v zařízení + volitelná záloha na váš Google Disk
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/70 transition-colors cursor-pointer"
            aria-label="Zavřít"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="px-5 pt-3 pb-0 bg-stone-50/60 border-b border-stone-200 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('license')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'license'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Licence & PRO</span>
            {licenseState.tier === 'pro' && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-extrabold">
                Aktivní
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('drive')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'drive'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Záloha na Google Disk</span>
            {!isPro && <Lock className="w-3 h-3 text-amber-500" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('legal')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'legal'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Podmínky, GDPR & Podpora</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Locked Feature Banner */}
          {lockedMeta && !isPro && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                <Lock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-amber-950">
                  PRO funkce: {lockedMeta.title}
                </div>
                <p className="text-xs text-amber-900/85 mt-0.5 leading-relaxed">
                  {lockedMeta.description}
                </p>
              </div>
            </div>
          )}

          {/* TAB 1: LICENSE & PRO */}
          {activeTab === 'license' && (
            <div className="space-y-5">
              {/* Current status summary */}
              <div
                className={`p-4 rounded-xl border ${
                  licenseState.tier === 'pro'
                    ? 'bg-emerald-50/80 border-emerald-200'
                    : licenseState.tier === 'trial' && isPro
                    ? 'bg-amber-50/80 border-amber-200'
                    : 'bg-stone-50 border-stone-200'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                      Aktuální tarif
                    </div>
                    <div className="text-base font-extrabold text-stone-900 flex items-center gap-2 mt-0.5">
                      {licenseState.tier === 'pro' ? (
                        <>
                          <Crown className="w-4 h-4 text-emerald-600" />
                          <span>Horský zápisník PRO (doživotní licence)</span>
                        </>
                      ) : licenseState.tier === 'trial' && isPro ? (
                        <>
                          <Sparkles className="w-4 h-4 text-amber-600" />
                          <span>7denní zkušební verze PRO (zbývá {trialDaysLeft} d.)</span>
                        </>
                      ) : (
                        <span>Start — verze zdarma</span>
                      )}
                    </div>
                  </div>

                  {licenseState.tier === 'pro' && (
                    <button
                      type="button"
                      onClick={onRequestDeactivateLicense}
                      className="text-[11px] font-semibold text-stone-500 hover:text-red-600 transition-colors cursor-pointer"
                    >
                      Deaktivovat na tomto zařízení
                    </button>
                  )}
                </div>

                {licenseState.tier === 'pro' ? (
                  <div className="mt-2.5 pt-2.5 border-t border-emerald-200/70 flex flex-wrap gap-x-5 gap-y-1 text-xs text-emerald-900">
                    <span>
                      Klíč: <strong className="font-mono">{licenseState.licenseKey}</strong>
                    </span>
                    {licenseState.customerEmail && (
                      <span>
                        E-mail: <strong>{licenseState.customerEmail}</strong>
                      </span>
                    )}
                    {licenseState.activatedAt && (
                      <span>Aktivováno: {formatCzechDateTime(licenseState.activatedAt)}</span>
                    )}
                  </div>
                ) : (
                  <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-stone-600">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-stone-200 font-semibold">
                      Výšlapy: {hikesCount}
                      {!isPro ? ` / ${FREE_MAX_HIKES}` : ' (neomezeně)'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-stone-200 font-semibold">
                      Plánované trasy: {plannedCount}
                      {!isPro ? ` / ${FREE_MAX_PLANNED}` : ' (neomezeně)'}
                    </span>
                  </div>
                )}
              </div>

              {/* Plans Comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Free Tier */}
                <div className="p-4 rounded-xl border border-stone-200 bg-white flex flex-col justify-between">
                  <div>
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-sm font-extrabold text-stone-900">Start</h3>
                      <span className="text-base font-extrabold text-stone-700">0 Kč</span>
                    </div>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      Pro vyzkoušení a menší deník výletů
                    </p>
                    <ul className="mt-3 space-y-1.5 text-xs text-stone-600">
                      <li className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Až {FREE_MAX_HIKES} uložených výšlapů</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Až {FREE_MAX_PLANNED} plánované trasy</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>2D interaktivní mapa, GPX a výškový profil</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Analytika, milníky a lokální uložení</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Export a import zálohy JSON</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* PRO Lifetime Tier */}
                <div className="p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50/40 flex flex-col justify-between relative">
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-sm font-extrabold text-emerald-950 flex items-center gap-1.5">
                        <Crown className="w-4 h-4 text-emerald-600" />
                        <span>Horský zápisník PRO</span>
                      </h3>
                      <div className="text-right">
                        <div className="text-base font-extrabold text-emerald-700 leading-none">
                          {billingConfig.priceLifetimeCzk} Kč
                        </div>
                        <div className="text-[10px] font-bold text-emerald-700/80 mt-0.5">
                          ({billingConfig.priceLifetimeEur} €) · jednorázově
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-emerald-800/80 mt-0.5 font-medium">
                      Zaplatíte jednou, funguje doživotně · bez předplatného
                    </p>
                    <ul className="mt-3 space-y-1.5 text-xs text-stone-800">
                      <li className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>Neomezeně</strong> výšlapů i plánovaných tras
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Záloha a synchronizace na vlastní Google Disk</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>3D terénní pohled a průlet trasou</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Zázemí na trase (ubytování, jídlo, parkování)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Stahování offline mapových balíčků do hor</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>Tisk, PDF kronika, Excel (XLSX) a notifikace</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Actions for non-lifetime users */}
              {licenseState.tier !== 'pro' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2.5">
                    {!licenseState.trialUsed && licenseState.tier === 'free' && (
                      <button
                        type="button"
                        onClick={() => void onStartTrial()}
                        className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Vyzkoušet PRO na 7 dní zdarma</span>
                      </button>
                    )}

                    {billingConfig.checkoutUrl && (
                      <a
                        href={billingConfig.checkoutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-xs transition-colors"
                      >
                        <Crown className="w-4 h-4 text-amber-400" />
                        <span>
                          Koupit doživotní PRO ({billingConfig.priceLifetimeCzk} Kč /{' '}
                          {billingConfig.priceLifetimeEur} €)
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                      </a>
                    )}
                  </div>

                  {/* License Key Activation Form */}
                  <form
                    onSubmit={handleActivateSubmit}
                    className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-extrabold text-stone-800 flex items-center gap-1.5">
                        <KeyRound className="w-4 h-4 text-emerald-600" />
                        <span>Aktivovat zakoupený licenční klíč</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        value={licenseKeyInput}
                        onChange={(e) => setLicenseKeyInput(e.target.value)}
                        placeholder="Zadejte váš licenční klíč"
                        className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs font-mono text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        maxLength={128}
                      />
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="Váš e-mail (volitelné)"
                        className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        maxLength={200}
                      />
                    </div>

                    {formError && (
                      <div className="text-xs text-red-600 font-semibold">{formError}</div>
                    )}

                    <button
                      type="submit"
                      disabled={isActivating || isOffline}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      {isActivating ? 'Ověřuji klíč…' : 'Aktivovat doživotní PRO licenci'}
                    </button>
                  </form>
                </div>
              )}

              {/* Legal Quick Links Footer */}
              <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500">
                <span>
                  Jednorázová platba · bez skrytého předplatného · data zůstávají u vás
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('legal')}
                  className="font-semibold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                >
                  Obchodní podmínky, GDPR a podpora
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: GOOGLE DRIVE BACKUP */}
          {activeTab === 'drive' && (
            <div className="space-y-4">
              {/* Privacy architecture explanation */}
              <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-stone-700 leading-relaxed">
                  <strong className="text-stone-900">Vaše data zůstávají jen u vás.</strong>{' '}
                  Výšlapy, plánované trasy i profily účastníků jsou uloženy přímo v paměti vašeho
                  zařízení (IndexedDB). Záloha na váš vlastní Google Disk vytváří jediný soubor{' '}
                  <code className="px-1 py-0.5 rounded bg-stone-200/70 text-[11px] font-mono">
                    horsky-zapisnik-zaloha.json
                  </code>{' '}
                  a aplikace nikdy nemá přístup k vašim ostatním souborům.
                </div>
              </div>

              {!isPro ? (
                <div className="p-5 rounded-xl border border-amber-200 bg-amber-50/70 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-stone-900">
                      Záloha na vlastní Google Disk je součástí PRO verze
                    </h3>
                    <p className="text-xs text-stone-600 mt-1 max-w-md mx-auto">
                      Vyzkoušejte 7denní PRO verzi zdarma nebo odemkněte doživotní licenci za
                      jednorázových {billingConfig.priceLifetimeCzk} Kč (
                      {billingConfig.priceLifetimeEur} €). Lokální JSON export a import zůstávají
                      vždy zdarma.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('license')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Zobrazit možnosti PRO
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Auth status & Official Sign in with Google button */}
                  {!googleUser || !hasActiveDriveToken ? (
                    <div className="p-5 rounded-xl border border-stone-200 bg-white text-center space-y-3">
                      {googleUser && !hasActiveDriveToken ? (
                        <div className="text-xs text-stone-600">
                          Přihlášený účet <strong>{googleUser.email}</strong>. Z bezpečnostních
                          důvodů se přístup k Google Disku drží pouze v operační paměti — pro zálohu
                          nebo obnovení prosím potvrďte přihlášení:
                        </div>
                      ) : (
                        <div className="text-xs text-stone-600">
                          Připojte svůj Google účet pro ukládání a obnovování archívu mezi telefonem
                          a počítačem.
                        </div>
                      )}

                      <div className="flex justify-center pt-1">
                        <button
                          type="button"
                          disabled={isDriveBusy || isOffline}
                          onClick={() => void onGoogleSignIn()}
                          className="gsi-material-button"
                        >
                          <div className="gsi-material-button-state"></div>
                          <div className="gsi-material-button-content-wrapper">
                            <div className="gsi-material-button-icon">
                              <svg
                                version="1.1"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 48 48"
                                style={{ display: 'block' }}
                              >
                                <path
                                  fill="#EA4335"
                                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                                ></path>
                                <path
                                  fill="#4285F4"
                                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                                ></path>
                                <path
                                  fill="#FBBC05"
                                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                                ></path>
                                <path
                                  fill="#34A853"
                                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                                ></path>
                                <path fill="none" d="M0 0h48v48H0z"></path>
                              </svg>
                            </div>
                            <span className="gsi-material-button-contents">Sign in with Google</span>
                            <span style={{ display: 'none' }}>Sign in with Google</span>
                          </div>
                        </button>
                      </div>

                      {isOffline && (
                        <div className="text-[11px] text-amber-700 font-semibold">
                          Pro připojení ke Google Disku vypněte offline režim.
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Connected Google Account Card */}
                      <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-extrabold text-sm flex items-center justify-center shrink-0">
                            {(googleUser.displayName || googleUser.email || 'G')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-stone-900 truncate">
                              {googleUser.displayName || 'Připojený Google účet'}
                            </div>
                            <div className="text-[11px] text-emerald-800 truncate">
                              {googleUser.email}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isDriveBusy || isOffline}
                            onClick={() => void onRefreshDriveStatus()}
                            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            title="Zkontrolovat zálohu na Google Disku"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isDriveBusy ? 'animate-spin' : ''}`} />
                            <span>Obnovit stav</span>
                          </button>
                          <button
                            type="button"
                            disabled={isDriveBusy}
                            onClick={() => void onGoogleSignOut()}
                            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-red-50 border border-stone-200 text-stone-600 hover:text-red-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Odhlásit</span>
                          </button>
                        </div>
                      </div>

                      {/* Drive Backup File Info */}
                      <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                          <HardDrive className="w-3.5 h-3.5" />
                          <span>Stav zálohy na Google Disku</span>
                        </div>
                        {driveBackupInfo ? (
                          <div className="text-xs text-stone-700 space-y-0.5">
                            <div>
                              Soubor: <strong className="font-mono">{driveBackupInfo.name}</strong>
                            </div>
                            <div>
                              Poslední záloha:{' '}
                              <strong>{formatCzechDateTime(driveBackupInfo.modifiedTime)}</strong>
                              {driveBackupInfo.size
                                ? ` · ${formatSizeBytes(driveBackupInfo.size)}`
                                : ''}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-stone-500">
                            Na vašem Google Disku zatím nebyla nalezena žádná záloha. Kliknutím na{' '}
                            <strong>Uložit zálohu</strong> vytvoříte první zálohu.
                          </div>
                        )}
                      </div>

                      {/* Explicit Backup / Restore Buttons (trigger ConfirmModal in App.tsx) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          disabled={isDriveBusy || isOffline}
                          onClick={onRequestDriveBackup}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
                        >
                          <UploadCloud className="w-4 h-4" />
                          <span>Uložit zálohu na Google Disk</span>
                        </button>

                        <button
                          type="button"
                          disabled={isDriveBusy || isOffline || !driveBackupInfo}
                          onClick={onRequestDriveRestore}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-stone-100 disabled:opacity-40 text-stone-800 border border-stone-300 text-xs font-bold transition-colors cursor-pointer"
                        >
                          <DownloadCloud className="w-4 h-4 text-indigo-600" />
                          <span>Obnovit z Google Disku</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LEGAL, GDPR & SUPPORT (CZ/EU) */}
          {activeTab === 'legal' && (
            <div className="space-y-4 text-xs text-stone-700 leading-relaxed">
              {/* 1. Obchodní podmínky */}
              <section className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                <h3 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Obchodní podmínky (Digitální obsah)</span>
                </h3>
                <p>
                  <strong>Předmět licence:</strong> Zakoupením licence{' '}
                  <strong>Horský zápisník PRO</strong> získává uživatel nevýhradní licenci k
                  používání prémiových funkcí webové a PWA aplikace za jednorázovou cenu{' '}
                  <strong>
                    {billingConfig.priceLifetimeCzk} Kč (ekvivalent {billingConfig.priceLifetimeEur}{' '}
                    €)
                  </strong>
                  . Cena je konečná a nezahrnuje žádné opakované předplatné.
                </p>
                <p>
                  <strong>Rozsah doživotní licence a trvalý offline provoz:</strong> Doživotní
                  licencí se rozumí právo užívat aplikaci <em>Horský zápisník</em> (řada v4.x) po
                  celou dobu jejího provozu bez jakýchkoli dalších pravidelných poplatků. Aplikace
                  je navržena jako samostatná <em>Local-first PWA</em> — po instalaci do zařízení
                  (telefonu či počítače) a aktivaci klíče funguje plně autonomně přímo ze zařízení
                  uživatele včetně kompletního exportu dat (JSON/XLSX), a není tak závislá na
                  trvalém provozu centrálního serveru či konkrétní internetové domény.
                </p>
                <p>
                  <strong>Dodání a aktivace:</strong> Po dokončení platby je uživateli elektronicky
                  doručen licenční klíč, kterým odemkne PRO funkce přímo v aplikaci v sekci{' '}
                  <em>Licence &amp; PRO</em>.
                </p>
                <p>
                  <strong>Odstoupení od smlouvy (ČR/EU):</strong> V souladu s § 1837 písm. l)
                  občanského zákoníku (zák. č. 89/2012 Sb.) bere spotřebitel na vědomí, že aktivací
                  digitálního obsahu (licenčního klíče) před uplynutím 14denní lhůty zaniká právo na
                  odstoupení od smlouvy. Pro nezávazné ověření funkčnosti před nákupem je k dispozici
                  bezplatná verze <em>Start</em> i 7denní zkušební verze PRO zdarma bez zadání
                  platební karty.
                </p>
                {(billingConfig.operatorName ||
                  billingConfig.operatorIco ||
                  billingConfig.operatorAddress) && (
                  <div className="pt-2 border-t border-stone-200/80 text-[11px] text-stone-600">
                    <strong>Provozovatel:</strong>{' '}
                    {[
                      billingConfig.operatorName,
                      billingConfig.operatorIco ? `IČO: ${billingConfig.operatorIco}` : '',
                      billingConfig.operatorAddress,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                )}
              </section>

              {/* 2. GDPR / Ochrana osobních údajů */}
              <section className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                <h3 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Zásady ochrany osobních údajů (GDPR)</span>
                </h3>
                <ul className="space-y-1.5 list-disc pl-4">
                  <li>
                    <strong>Lokální ukládání (Local-first):</strong> Veškeré výšlapy, GPX trasy,
                    poznámky, plánované trasy a profily účastníků jsou uloženy výhradně v paměti
                    vašeho zařízení (IndexedDB). Provozovatel k těmto datům nemá žádný přístup a
                    neukládá je na vlastním serveru.
                  </li>
                  <li>
                    <strong>Záloha na váš Google Disk:</strong> Pokud dobrovolně připojíte svůj
                    Google účet, aplikace žádá pouze o minimální oprávnění{' '}
                    <code className="px-1 py-0.5 rounded bg-stone-200/70 font-mono text-[11px]">
                      drive.file
                    </code>{' '}
                    pro práci s jediným záložním souborem{' '}
                    <code className="px-1 py-0.5 rounded bg-stone-200/70 font-mono text-[11px]">
                      horsky-zapisnik-zaloha.json
                    </code>
                    . Přístupový token je držen výhradně v operační paměti prohlížeče a při
                    odhlášení nebo zavření stránky zaniká.
                  </li>
                  <li>
                    <strong>Ověření licenčního klíče:</strong> Při aktivaci licence se odesílá
                    pouze zadaný licenční klíč (případně dobrovolný e-mail) za účelem ověření jeho
                    platnosti.
                  </li>
                  <li>
                    <strong>Mapové podklady třetích stran:</strong> Při online prohlížení map a
                    vyhledávání zázemí na trase prohlížeč načítá mapové dlaždice a body zájmu přímo
                    od veřejných poskytovatelů (OpenFreeMap, OpenStreetMap/Overpass, AWS Terrain
                    Tiles, EOX Sentinel-2).
                  </li>
                  <li>
                    <strong>Vaše práva podle GDPR (EU 2016/679):</strong> Svá data máte plně pod
                    kontrolou — můžete je kdykoli exportovat (JSON/XLSX), upravit nebo trvale smazat
                    přímo v aplikaci, vymazáním dat prohlížeče či odstraněním záložního souboru ze
                    svého Google Disku.
                  </li>
                </ul>
              </section>

              {/* 3. Kontakt a technická podpora */}
              <section className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                <h3 className="text-sm font-extrabold text-emerald-950 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Technická podpora a reklamace</span>
                </h3>
                <p className="text-emerald-950/90">
                  Potřebujete poradit s aktivací licenčního klíče, přenosem dat mezi zařízeními nebo
                  uplatnit reklamaci? Napište nám a uveďte e-mail použitý při nákupu.
                </p>
                {billingConfig.supportEmail ? (
                  <div className="pt-1">
                    <a
                      href={`mailto:${billingConfig.supportEmail}?subject=${encodeURIComponent(
                        'Horský zápisník PRO – Podpora'
                      )}`}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>{billingConfig.supportEmail}</span>
                    </a>
                  </div>
                ) : (
                  <div className="text-[11px] text-emerald-900/75 bg-white/80 border border-emerald-200/80 rounded-lg px-3 py-2">
                    Kontaktní e-mail podpory bude doplněn provozovatelem před zahájením prodeje.
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
