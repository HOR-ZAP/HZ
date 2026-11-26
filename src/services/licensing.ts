import { getMetaValue, setMetaValue } from './localStore';

export const FREE_MAX_HIKES = 10;
export const FREE_MAX_PLANNED = 3;
export const TRIAL_DAYS = 7;
export const LIFETIME_PRICE_CZK = 250;
export const LIFETIME_PRICE_EUR = 10;

export type LicenseTier = 'free' | 'trial' | 'pro';

export type ProFeatureId =
  | 'unlimited_hikes'
  | 'unlimited_planned'
  | 'drive_sync'
  | 'route3d'
  | 'accommodation'
  | 'offline_maps'
  | 'exports'
  | 'participants_notify';

export interface LicenseState {
  tier: LicenseTier;
  trialUsed: boolean;
  trialStartedAt?: string;
  trialEndsAt?: string;
  licenseKey?: string;
  customerEmail?: string;
  activatedAt?: string;
  isDemo?: boolean;
}

export interface PublicBillingConfig {
  checkoutUrl: string;
  priceLifetimeCzk: number;
  priceLifetimeEur: number;
  supportEmail: string;
  operatorName: string;
  operatorIco: string;
  operatorAddress: string;
}

export const PRO_FEATURE_META: Record<
  ProFeatureId,
  { title: string; description: string }
> = {
  unlimited_hikes: {
    title: 'Neomezený počet výšlapů',
    description: `Bezplatná verze umožňuje uložit až ${FREE_MAX_HIKES} výšlapů. S doživotní PRO licencí můžete archivovat neomezený počet tras.`,
  },
  unlimited_planned: {
    title: 'Neomezené plánované trasy',
    description: `Bezplatná verze umožňuje uložit až ${FREE_MAX_PLANNED} plánované trasy. PRO odemyká neomezené plánování.`,
  },
  drive_sync: {
    title: 'Záloha a synchronizace na vlastní Google Disk',
    description:
      'Uložte celý archív do svého soukromého Google Disku a přeneste data jedním kliknutím mezi telefonem a počítačem.',
  },
  route3d: {
    title: '3D terénní pohled a průlet trasou',
    description:
      'Prohlížejte si své i plánované trasy na realistickém 3D výškovém modelu terénu s interaktivním průletem.',
  },
  accommodation: {
    title: 'Zázemí na trase (ubytování, jídlo, parkování)',
    description:
      'Vyhledávejte turistické ubytování, restaurace a parkoviště přímo v okolí svých tras.',
  },
  offline_maps: {
    title: 'Stahování offline mapových balíčků do hor',
    description:
      'Předem si stáhněte mapové podklady a výškový reliéf (DEM) pro vybranou trasu nebo celý archív, aby mapa fungovala i bez signálu.',
  },
  exports: {
    title: 'Tisk, PDF sestavy a export do Excelu (XLSX)',
    description:
      'Generujte tiskové kroniky výšlapů do PDF a exportujte přehledné tabulky do Excelu.',
  },
  participants_notify: {
    title: 'Účastníci a e-mailové notifikace milníků',
    description:
      'Spravujte profily parťáků z výšlapů a posílejte jim diplomy při dosažení turistických milníků.',
  },
};

const META_LICENSE_KEY = 'license_state_v1';
const LOCAL_STORAGE_FALLBACK_KEY = 'hz_license_state_v1';

export const DEFAULT_LICENSE_STATE: LicenseState = {
  tier: 'free',
  trialUsed: false,
};

function sanitizeHttpsUrl(raw: string | undefined): string {
  if (!raw || typeof raw !== 'string') return '';
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    // invalid URL
  }
  return '';
}

function getStaticFallbackConfig(): PublicBillingConfig {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};
  return {
    checkoutUrl: sanitizeHttpsUrl(env.VITE_CHECKOUT_URL),
    priceLifetimeCzk: LIFETIME_PRICE_CZK,
    priceLifetimeEur: LIFETIME_PRICE_EUR,
    supportEmail: (env.VITE_SUPPORT_EMAIL || '').trim(),
    operatorName: (env.VITE_OPERATOR_NAME || '').trim(),
    operatorIco: (env.VITE_OPERATOR_ICO || '').trim(),
    operatorAddress: (env.VITE_OPERATOR_ADDRESS || '').trim(),
  };
}

/**
 * Verifies a self-contained offline license key with format:
 * HZ-V4-<4..8 ALPHANUM>-<4..8 ALPHANUM>-<4 CHAR CHECKSUM>
 * Works 100% offline and on static hosting (GitHub Pages / Cloudflare Pages) with zero server cost.
 */
export function verifyOfflineChecksumKey(rawKey: string): boolean {
  const clean = rawKey.trim().toUpperCase();
  const match = /^HZ-V4-([A-Z0-9]{4,8})-([A-Z0-9]{4,8})-([A-Z0-9]{4})$/.exec(clean);
  if (!match) return false;
  const [, partA, partB, providedChecksum] = match;
  const payload = `HZV4:${partA}:${partB}:LIFETIME250`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const expectedChecksum = (hash >>> 0).toString(36).toUpperCase().padStart(4, '0').slice(-4);
  return providedChecksum === expectedChecksum;
}

/**
 * Direct client-side Lemon Squeezy Public License API activation.
 * Lemon Squeezy's /v1/licenses/activate endpoint is public by design (for desktop, mobile, and static web apps)
 * and requires no secret API key, enabling 0 CZK static hosting on GitHub Pages.
 */
async function verifyDirectlyWithLemonSqueezy(
  licenseKey: string,
  instanceName = 'HorskyZapisnikWeb'
): Promise<{ valid: boolean; customerEmail?: string; message?: string }> {
  try {
    const body = new URLSearchParams({
      license_key: licenseKey,
      instance_name: instanceName,
    });
    const res = await fetch('https://api.lemonsqueezy.com/v1/licenses/activate', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = (await res.json()) as {
      activated?: boolean;
      valid?: boolean;
      error?: string;
      license_key?: { status?: string };
      meta?: { customer_email?: string };
    };

    if (
      res.ok &&
      (data.activated || data.valid) &&
      (!data.license_key?.status || data.license_key.status === 'active')
    ) {
      return {
        valid: true,
        customerEmail:
          typeof data.meta?.customer_email === 'string' ? data.meta.customer_email : undefined,
      };
    }

    return {
      valid: false,
      message: data.error || 'Licenční klíč nebyl rozpoznán nebo již vyčerpal počet aktivací.',
    };
  } catch {
    return {
      valid: false,
      message: 'Nelze se spojit s licenčním serverem. Zkontrolujte připojení k internetu.',
    };
  }
}

export function hasProAccess(state: LicenseState): boolean {
  if (state.tier === 'pro') return true;
  if (state.tier === 'trial' && state.trialEndsAt) {
    return Date.now() < new Date(state.trialEndsAt).getTime();
  }
  return false;
}

export function getTrialDaysRemaining(state: LicenseState): number {
  if (state.tier !== 'trial' || !state.trialEndsAt) return 0;
  const diffMs = new Date(state.trialEndsAt).getTime() - Date.now();
  if (diffMs <= 0) return 0;
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function loadLicenseStateSync(): LicenseState {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_FALLBACK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LicenseState;
      if (parsed && typeof parsed === 'object' && parsed.tier) {
        return normalizeLicenseState(parsed);
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_LICENSE_STATE;
}

function normalizeLicenseState(state: LicenseState): LicenseState {
  if (state.tier === 'trial' && state.trialEndsAt) {
    if (Date.now() >= new Date(state.trialEndsAt).getTime()) {
      return {
        ...state,
        tier: 'free',
        trialUsed: true,
      };
    }
  }
  return state;
}

export async function loadLicenseState(): Promise<LicenseState> {
  const fromDb = await getMetaValue<LicenseState>(META_LICENSE_KEY);
  if (fromDb && fromDb.tier) {
    const normalized = normalizeLicenseState(fromDb);
    try {
      localStorage.setItem(LOCAL_STORAGE_FALLBACK_KEY, JSON.stringify(normalized));
    } catch {
      // ignore
    }
    return normalized;
  }
  return loadLicenseStateSync();
}

export async function saveLicenseState(state: LicenseState): Promise<void> {
  const normalized = normalizeLicenseState(state);
  try {
    localStorage.setItem(LOCAL_STORAGE_FALLBACK_KEY, JSON.stringify(normalized));
  } catch {
    // ignore
  }
  await setMetaValue(META_LICENSE_KEY, normalized);
}

export async function activateSevenDayTrial(current: LicenseState): Promise<LicenseState> {
  if (current.trialUsed) {
    throw new Error('7denní zkušební verze PRO již byla na tomto zařízení využita.');
  }
  const now = new Date();
  const ends = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const next: LicenseState = {
    ...current,
    tier: 'trial',
    trialUsed: true,
    trialStartedAt: now.toISOString(),
    trialEndsAt: ends.toISOString(),
  };
  await saveLicenseState(next);
  return next;
}

export async function activateLicenseKeyOnServer(
  licenseKey: string,
  email?: string,
  current?: LicenseState
): Promise<{ state: LicenseState; message: string }> {
  const normalizedKey = licenseKey.trim().toUpperCase();
  if (normalizedKey.length < 4 || normalizedKey.length > 128) {
    throw new Error('Neplatný formát licenčního klíče.');
  }

  const finalizeActivation = async (opts: {
    customerEmail?: string;
    isDemo?: boolean;
    activatedAt?: string;
    message: string;
  }) => {
    const next: LicenseState = {
      tier: 'pro',
      trialUsed: current?.trialUsed ?? false,
      trialStartedAt: current?.trialStartedAt,
      trialEndsAt: current?.trialEndsAt,
      licenseKey: normalizedKey,
      customerEmail: opts.customerEmail || email?.trim() || undefined,
      activatedAt: opts.activatedAt || new Date().toISOString(),
      isDemo: Boolean(opts.isDemo),
    };
    await saveLicenseState(next);
    return { state: next, message: opts.message };
  };

  // 1. Instant offline verification for self-contained signed HZ-V4-... key
  if (verifyOfflineChecksumKey(normalizedKey)) {
    return finalizeActivation({
      isDemo: false,
      message: 'Doživotní licence Horský zápisník PRO byla úspěšně aktivována.',
    });
  }

  // 2. Try backend API (/api/license/verify) when running on Node.js / Cloud Run
  let backendReachable = false;
  try {
    const res = await fetch('/api/license/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey: normalizedKey,
        email: email?.trim() || '',
        instanceName: 'HorskyZapisnikWeb',
      }),
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      backendReachable = true;
      const data = (await res.json()) as {
        valid?: boolean;
        customerEmail?: string;
        activatedAt?: string;
        isDemo?: boolean;
        message?: string;
      };

      if (res.ok && data.valid) {
        return finalizeActivation({
          customerEmail: data.customerEmail,
          activatedAt: data.activatedAt,
          isDemo: data.isDemo,
          message: data.message || 'Doživotní licence PRO byla aktivována.',
        });
      }

      if (res.status === 400) {
        throw new Error(data.message || 'Licenční klíč nebyl rozpoznán.');
      }
    }
  } catch (err: unknown) {
    if (backendReachable && err instanceof Error) {
      throw err;
    }
    // If /api/license/verify is not present (e.g. static GitHub Pages hosting), fall through to direct Lemon Squeezy verification
  }

  // 3. Serverless / Static Hosting fallback: verify directly against Lemon Squeezy Public License API
  const lsResult = await verifyDirectlyWithLemonSqueezy(normalizedKey);
  if (lsResult.valid) {
    return finalizeActivation({
      customerEmail: lsResult.customerEmail,
      isDemo: false,
      message: 'Doživotní licence Horský zápisník PRO byla ověřena a aktivována.',
    });
  }

  throw new Error(
    lsResult.message ||
      'Licenční klíč nebyl rozpoznán. Zkontrolujte prosím překlepy nebo kontaktujte podporu.'
  );
}

export async function deactivateToFree(current: LicenseState): Promise<LicenseState> {
  const next: LicenseState = {
    tier: 'free',
    trialUsed: current.trialUsed,
    trialStartedAt: current.trialStartedAt,
    trialEndsAt: current.trialEndsAt,
  };
  await saveLicenseState(next);
  return next;
}

export async function fetchPublicBillingConfig(): Promise<PublicBillingConfig> {
  const fallback = getStaticFallbackConfig();
  try {
    const res = await fetch('/api/config/public');
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      return fallback;
    }
    const data = (await res.json()) as Partial<PublicBillingConfig>;
    return {
      checkoutUrl: sanitizeHttpsUrl(data.checkoutUrl) || fallback.checkoutUrl,
      priceLifetimeCzk:
        typeof data.priceLifetimeCzk === 'number' ? data.priceLifetimeCzk : LIFETIME_PRICE_CZK,
      priceLifetimeEur:
        typeof data.priceLifetimeEur === 'number' ? data.priceLifetimeEur : LIFETIME_PRICE_EUR,
      supportEmail:
        typeof data.supportEmail === 'string' && data.supportEmail.trim()
          ? data.supportEmail.trim()
          : fallback.supportEmail,
      operatorName:
        typeof data.operatorName === 'string' && data.operatorName.trim()
          ? data.operatorName.trim()
          : fallback.operatorName,
      operatorIco:
        typeof data.operatorIco === 'string' && data.operatorIco.trim()
          ? data.operatorIco.trim()
          : fallback.operatorIco,
      operatorAddress:
        typeof data.operatorAddress === 'string' && data.operatorAddress.trim()
          ? data.operatorAddress.trim()
          : fallback.operatorAddress,
    };
  } catch {
    return fallback;
  }
}
