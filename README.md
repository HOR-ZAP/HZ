# Horský zápisník a Archív tras (v4.1 PRO)

Webová a PWA aplikace pro evidenci horských výšlapů, plánování tras, 2D/3D zobrazení terénu, výškové profily, analytiku, milníky a tiskové/Excel sestavy.

## Architektura ukládání dat (Local-first + Google Disk)
- **Lokální úložiště (IndexedDB):** Všechny výšlapy, GPX trasy, plánované trasy a profily účastníků se ukládají soukromě přímo v zařízení uživatele a fungují 100 % offline.
- **Záloha na vlastní Google Disk (PRO):** Uživatel si může jedním kliknutím zazálohovat a obnovit celý archív do jediného souboru `horsky-zapisnik-zaloha.json` na svém vlastním Google Disku (rozsah oprávnění pouze `drive.file`, token držen výhradně v operační paměti).

## Licenční model
- **Start (Zdarma – 0 Kč):** Až 10 výšlapů, 3 plánované trasy, 2D mapa, GPX import, výškový profil, analytika, milníky, JSON export/import.
- **7denní zkušební verze PRO zdarma:** Plný přístup na 7 dní bez zadání platební karty.
- **Horský zápisník PRO (250 Kč / 10 € jednorázově · doživotně):** Neomezené trasy a plány, záloha na Google Disk, 3D terénní pohled a průlet trasou, Zázemí na trase, stahování offline mapových balíčků, tisk a PDF, export XLSX a e-mailové notifikace milníků.

## Konfigurace prostředí (`.env`)
- `CHECKOUT_URL` – HTTPS odkaz na platební bránu (např. Lemon Squeezy / Stripe Payment Link)
- `PRO_LICENSE_KEYS` – čárkou oddělený seznam serverem ověřovaných licenčních klíčů
- `LEMONSQUEEZY_ENABLED` – nastavte na `"true"` pro živé ověřování klíčů přes Lemon Squeezy License API
- `SUPPORT_EMAIL` – kontaktní e-mail podpory v právní sekci aplikace
- `OPERATOR_NAME`, `OPERATOR_ICO`, `OPERATOR_ADDRESS` – údaje provozovatele zobrazené v Obchodních podmínkách

## Spuštění
```bash
npm install
npm run dev
```
Produkční build:
```bash
npm run build
npm start
```
