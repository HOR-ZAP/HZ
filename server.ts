import 'dotenv/config';
import http from 'http';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const PRICE_LIFETIME_CZK = 250;
const PRICE_LIFETIME_EUR = 10;

function sanitizeCheckoutUrl(raw: string | undefined): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    // invalid URL
  }
  return '';
}

function getConfiguredLicenseKeys(): Set<string> {
  const raw = process.env.PRO_LICENSE_KEYS || '';
  const keys = raw
    .split(',')
    .map((k) => k.trim().toUpperCase())
    .filter((k) => k.length >= 6);
  return new Set(keys);
}

async function verifyWithPolar(
  licenseKey: string,
  organizationId: string,
  label: string
): Promise<{ valid: boolean; activationId?: string; message?: string }> {
  const apiBase =
    process.env.POLAR_SANDBOX === 'true' ? 'https://sandbox-api.polar.sh' : 'https://api.polar.sh';
  const key = licenseKey.trim();
  const orgId = organizationId.trim();

  const isExpired = (expiresAt?: string | null): boolean => {
    if (!expiresAt) return false;
    const ts = Date.parse(expiresAt);
    return Number.isFinite(ts) && ts <= Date.now();
  };

  try {
    const activateRes = await fetch(`${apiBase}/v1/customer-portal/license-keys/activate`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, organization_id: orgId, label: label || 'Horsky Zapisnik Web' }),
    });

    const activateData = (await activateRes.json().catch(() => ({}))) as {
      id?: string;
      license_key?: { status?: string; expires_at?: string | null };
      detail?: unknown;
    };

    if (activateRes.ok && activateData.license_key) {
      if (
        activateData.license_key.status === 'granted' &&
        !isExpired(activateData.license_key.expires_at)
      ) {
        return { valid: true, activationId: activateData.id };
      }
      return { valid: false, message: 'Tento licenční klíč již není aktivní nebo vypršel.' };
    }

    const detail = typeof activateData.detail === 'string' ? activateData.detail : '';
    const detailLower = detail.toLowerCase();

    if (
      activateRes.status === 403 &&
      (detailLower.includes('does not require activation') ||
        detailLower.includes('not support activation') ||
        detailLower.includes('no activation limit'))
    ) {
      const validateRes = await fetch(`${apiBase}/v1/customer-portal/license-keys/validate`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, organization_id: orgId }),
      });
      const validateData = (await validateRes.json().catch(() => ({}))) as {
        status?: string;
        expires_at?: string | null;
      };
      if (validateRes.ok && validateData.status === 'granted' && !isExpired(validateData.expires_at)) {
        return { valid: true };
      }
      return { valid: false, message: 'Licenční klíč nebyl ověřen nebo již není aktivní.' };
    }

    if (detailLower.includes('limit') || detailLower.includes('activation')) {
      return {
        valid: false,
        message: 'Licenční klíč již vyčerpal maximální počet aktivovaných zařízení.',
      };
    }

    return {
      valid: false,
      message: detail || 'Licenční klíč nebyl nalezen. Zkontrolujte prosím přesný tvar klíče.',
    };
  } catch {
    return {
      valid: false,
      message: 'Nepodařilo se ověřit licenci na serveru Polar. Zkuste to prosím znovu.',
    };
  }
}

async function verifyWithLemonSqueezy(
  licenseKey: string,
  instanceName: string
): Promise<{ valid: boolean; customerEmail?: string; message?: string }> {
  try {
    const body = new URLSearchParams({
      license_key: licenseKey,
      instance_name: instanceName || 'HorskyZapisnikWeb',
    });

    const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/activate', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = (await response.json()) as {
      activated?: boolean;
      valid?: boolean;
      error?: string;
      license_key?: { status?: string };
      meta?: { customer_email?: string };
    };

    if (
      response.ok &&
      (data.activated || data.valid) &&
      (!data.license_key?.status || data.license_key.status === 'active')
    ) {
      return {
        valid: true,
        customerEmail: typeof data.meta?.customer_email === 'string' ? data.meta.customer_email : undefined,
      };
    }

    return {
      valid: false,
      message: data.error || 'Licenční klíč není platný nebo již vyčerpal počet aktivací.',
    };
  } catch {
    return {
      valid: false,
      message: 'Nepodařilo se ověřit licenci na licenčním serveru. Zkuste to prosím znovu.',
    };
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '128kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '4.2.0-pro' });
  });

function sanitizeEmail(raw: string | undefined): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (trimmed.length > 200) return '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : '';
}

function sanitizeShortText(raw: string | undefined, maxLen = 160): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw.trim().slice(0, maxLen);
}

  app.get('/api/config/public', (_req, res) => {
    res.json({
      checkoutUrl: sanitizeCheckoutUrl(process.env.CHECKOUT_URL || process.env.VITE_CHECKOUT_URL),
      polarOrganizationId: sanitizeShortText(
        process.env.POLAR_ORGANIZATION_ID || process.env.VITE_POLAR_ORGANIZATION_ID,
        120
      ),
      priceLifetimeCzk: PRICE_LIFETIME_CZK,
      priceLifetimeEur: PRICE_LIFETIME_EUR,
      supportEmail: sanitizeEmail(process.env.SUPPORT_EMAIL || process.env.VITE_SUPPORT_EMAIL),
      operatorName: sanitizeShortText(process.env.OPERATOR_NAME || process.env.VITE_OPERATOR_NAME, 160),
      operatorIco: sanitizeShortText(process.env.OPERATOR_ICO || process.env.VITE_OPERATOR_ICO, 40),
      operatorAddress: sanitizeShortText(
        process.env.OPERATOR_ADDRESS || process.env.VITE_OPERATOR_ADDRESS,
        200
      ),
    });
  });

  app.post('/api/license/verify', async (req, res) => {
    const rawKey = req.body?.licenseKey;
    const rawEmail = req.body?.email;
    const rawInstance = req.body?.instanceName;

    if (typeof rawKey !== 'string') {
      res.status(400).json({ valid: false, message: 'Zadejte prosím platný licenční klíč.' });
      return;
    }

    const normalizedKey = rawKey.trim().toUpperCase();
    if (normalizedKey.length < 4 || normalizedKey.length > 128) {
      res.status(400).json({ valid: false, message: 'Neplatný formát licenčního klíče.' });
      return;
    }

    const email =
      typeof rawEmail === 'string' && rawEmail.trim().length <= 200 ? rawEmail.trim() : '';
    const instanceName =
      typeof rawInstance === 'string' && rawInstance.trim().length <= 120
        ? rawInstance.trim()
        : 'HorskyZapisnikWeb';

    // 1. Self-contained offline signed key (HZ-V4-XXXX-XXXX-CCCC)
    const match = /^HZ-V4-([A-Z0-9]{4,8})-([A-Z0-9]{4,8})-([A-Z0-9]{4})$/.exec(normalizedKey);
    if (match) {
      const [, partA, partB, providedChecksum] = match;
      const payload = `HZV4:${partA}:${partB}:LIFETIME250`;
      let hash = 0x811c9dc5;
      for (let i = 0; i < payload.length; i++) {
        hash ^= payload.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
      }
      const expectedChecksum = (hash >>> 0).toString(36).toUpperCase().padStart(4, '0').slice(-4);
      if (providedChecksum === expectedChecksum) {
        res.json({
          valid: true,
          tier: 'pro',
          plan: 'lifetime',
          licenseKey: normalizedKey,
          customerEmail: email || undefined,
          isDemo: false,
          activatedAt: new Date().toISOString(),
          message: 'Doživotní licence Horský zápisník PRO byla úspěšně aktivována.',
        });
        return;
      }
    }

    // 3. Server-configured env keys
    const configuredKeys = getConfiguredLicenseKeys();
    if (configuredKeys.has(normalizedKey)) {
      res.json({
        valid: true,
        tier: 'pro',
        plan: 'lifetime',
        licenseKey: normalizedKey,
        customerEmail: email || undefined,
        isDemo: false,
        activatedAt: new Date().toISOString(),
        message: 'Doživotní licence Horský zápisník PRO byla úspěšně aktivována.',
      });
      return;
    }

    // 3. Polar.sh Customer Portal License Key API verification
    const polarOrgId = (
      process.env.POLAR_ORGANIZATION_ID ||
      process.env.VITE_POLAR_ORGANIZATION_ID ||
      ''
    ).trim();
    if (polarOrgId) {
      const polarResult = await verifyWithPolar(rawKey.trim(), polarOrgId, instanceName);
      if (polarResult.valid) {
        res.json({
          valid: true,
          tier: 'pro',
          plan: 'lifetime',
          licenseKey: rawKey.trim(),
          activationId: polarResult.activationId,
          customerEmail: email || undefined,
          isDemo: false,
          activatedAt: new Date().toISOString(),
          message: 'Doživotní licence Horský zápisník PRO byla ověřena přes Polar a aktivována.',
        });
        return;
      }

      res.status(400).json({
        valid: false,
        message: polarResult.message || 'Licenční klíč nebyl nalezen.',
      });
      return;
    }

    // 4. Optional Lemon Squeezy License API verification
    if (process.env.LEMONSQUEEZY_ENABLED === 'true') {
      const lsResult = await verifyWithLemonSqueezy(normalizedKey, instanceName);
      if (lsResult.valid) {
        res.json({
          valid: true,
          tier: 'pro',
          plan: 'lifetime',
          licenseKey: normalizedKey,
          customerEmail: lsResult.customerEmail || email || undefined,
          isDemo: false,
          activatedAt: new Date().toISOString(),
          message: 'Doživotní licence Horský zápisník PRO byla ověřena a aktivována.',
        });
        return;
      }

      res.status(400).json({
        valid: false,
        message: lsResult.message || 'Licenční klíč nebyl nalezen.',
      });
      return;
    }

    res.status(400).json({
      valid: false,
      message:
        'Licenční klíč nebyl rozpoznán. Zkontrolujte prosím překlepy nebo kontaktujte podporu.',
    });
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';

    if (hmrDisabled) {
      app.get('/@vite/client', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.send(`
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url) { return url; }
export class ErrorOverlay extends HTMLElement {}
`);
      });
    }

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Horský zápisník PRO server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
