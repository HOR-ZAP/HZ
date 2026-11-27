import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  BookOpen,
  MapPin,
  Mountain,
  Route,
  Compass,
  BarChart3,
  WifiOff,
  HelpCircle,
  Film,
  Check,
  Minus,
} from 'lucide-react';
import { ActiveTab } from './Navbar';
import {
  FREE_MAX_HIKES,
  FREE_MAX_PLANNED,
  TRIAL_DAYS,
  LIFETIME_PRICE_CZK,
  LIFETIME_PRICE_EUR,
} from '../services/licensing';

interface UserManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenOfflineModal: () => void;
  onOpenAccountModal: (tab?: 'drive' | 'license') => void;
  onOpenPromoVideo: () => void;
}

interface ChapterStep {
  title: string;
  text: string;
}

interface ControlRow {
  control: string;
  action: string;
  note?: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

interface ManualImage {
  file: string;
  caption: string;
  alt: string;
}

interface ManualChapter {
  id: string;
  number: string;
  shortTitle: string;
  title: string;
  summary: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
  actionLabel?: string;
  actionType?: 'tab' | 'offline' | 'account-drive' | 'account-license';
  actionTab?: ActiveTab;
  steps?: ChapterStep[];
  controls?: ControlRow[];
  controlsHeading?: string;
  tips?: string[];
  images?: ManualImage[];
  comparisonRows?: { feature: string; free: string; pro: string }[];
  faqs?: FaqItem[];
}

const CHAPTERS: ManualChapter[] = [
  {
    id: 'quick-start',
    number: '01',
    shortTitle: 'Rychlý start',
    title: 'Rychlý start a základní ovládání',
    summary:
      'Horský zápisník je váš soukromý turistický deník a archív GPX tras. Funguje přímo v prohlížeči bez registrace a všechna data ukládá bezpečně lokálně do paměti vašeho zařízení (IndexedDB).',
    icon: BookOpen,
    keywords: [
      'start',
      'začít',
      'ukázkové trasy',
      'gpx',
      'instalace',
      'pwa',
      'mobil',
      'soukromí',
      'lišta',
      'navigace',
    ],
    actionLabel: 'Otevřít Zápisník',
    actionType: 'tab',
    actionTab: 'journal',
    steps: [
      {
        title: '1. Vyzkoušejte ukázky nebo nahrajte vlastní GPX',
        text: 'Při prvním spuštění si můžete jedním kliknutím načíst ukázkové výšlapy (Králický Sněžník, Lysá hora, Šumava), případně rovnou nahrát vlastní GPX soubor exportovaný z Mapy.cz, Garmin Connect, Stravy nebo sportovních hodinek.',
      },
      {
        title: '2. Přehled horní navigační lišty',
        text: 'Hlavní sekce v horní liště přepínají mezi 2D Mapou a trasami, Plánovanými trasami, Zápisníkem, Zázemím na trase, Analytikou a Milníky. Vpravo najdete stav PRO licence, přepínač Offline režimu / lokálního úložiště, Tisk a PDF, správu Účastníků a menu Data (import/export GPX, JSON, Excel).',
      },
      {
        title: '3. Instalace na telefon nebo počítač (PWA)',
        text: 'V menu Data (ikona šipky dolů vpravo nahoře) nebo v nabídce mobilního prohlížeče zvolte „Nainstalovat aplikaci“. Horský zápisník pak spustíte z plochy jako běžnou nativní aplikaci i bez připojení k internetu.',
      },
    ],
    tips: [
      'Data nikdy neodesíláme na cizí servery — pokud si sami nezapnete zálohu na vlastní Google Disk, vše zůstává výhradně ve vašem zařízení.',
      'Na mobilním telefonu můžete mezi hlavními sekcemi přepínat jedním klepnutím v rychlé liště pod horním okrajem obrazovky.',
    ],
  },
  {
    id: 'map-and-profile',
    number: '02',
    shortTitle: 'Mapa a profil',
    title: 'Mapa a trasy (2D) a výškový profil',
    summary:
      'Interaktivní 2D mapa zobrazuje celý váš turistický archív najednou. Jednodenní túry i vícedenní přechody lze přehledně filtrovat a okamžitě analyzovat jejich sklon i převýšení.',
    icon: MapPin,
    keywords: [
      'mapa',
      '2d',
      'filtr',
      'výškový profil',
      'sklon',
      'obtížnost',
      'vrstevnice',
      'podklad',
      'pohoří',
      'barvy',
    ],
    actionLabel: 'Přejít na Mapu a trasy',
    actionType: 'tab',
    actionTab: 'map',
    images: [
      {
        file: 'assets/aistudio/image_4aa19c4a.png',
        alt: 'Grafické zobrazení všech absolvovaných tras na interaktivní 2D mapě',
        caption: 'Všechny uložené trasy vykreslené na jedné mapě s barevným rozlišením výšlapů.',
      },
      {
        file: 'assets/aistudio/image_4d68c92a.png',
        alt: 'Výškový profil trasy s barevným rozlišením sklonu podle obtížnosti',
        caption: 'Interaktivní výškový profil se sklonem: Rovina (<5 %), Standard (5–10 %), Prudký (10–20 %) a Extrém (>20 %).',
      },
    ],
    steps: [
      {
        title: 'Výběr a filtrování tras',
        text: 'Kliknutím na libovolnou trasu v mapě nebo v bočním seznamu zobrazíte její detail, délku, nastoupané a sestoupané metry, poznámky i odkazy na fotky či video. Horní filtry umožňují omezit pohled na konkrétní rok, pohoří, účastníka nebo typ aktivity.',
      },
      {
        title: 'Přepínání mapových podkladů',
        text: 'V ovládacím panelu mapy můžete přepínat mezi vlastní vektorovou turistickou mapou (s vrstevnicemi a turistickými značkami), OpenTopoMap a satelitním či terénním podkladem.',
      },
      {
        title: 'Práce s výškovým profilem',
        text: 'Po otevření detailu trasy zapněte výškový profil. Najetím myší (nebo prstem) na graf se přesný bod a jeho nadmořská výška i procentuální sklon současně promítnou přímo na mapu.',
      },
    ],
    controlsHeading: 'Barevné rozlišení sklonu ve výškovém profilu',
    controls: [
      { control: 'Zelená — Rovina', action: 'Sklon pod 5 %', note: 'Pohodová rovinatá nebo mírně zvlněná pasáž' },
      { control: 'Modrá — Standard', action: 'Sklon 5 až 10 %', note: 'Běžné turistické stoupání či klesání' },
      { control: 'Oranžová — Prudký', action: 'Sklon 10 až 20 %', note: 'Náročnější horský výstup nebo prudký sestup' },
      { control: 'Červená — Extrém', action: 'Sklon nad 20 %', note: 'Strmé pasáže, sjezdovky, strmé hřebeny' },
    ],
  },
  {
    id: 'terrain-3d',
    number: '03',
    shortTitle: '3D dioráma',
    title: '3D dioráma trasy a přelet terénem',
    summary:
      'Prohlédněte si absolvovaný nebo plánovaný výšlap na realistickém 3D modelu horského masivu s automatickým označením okolních vrcholů, sedel, rozhleden a možností plynulého přeletu.',
    icon: Mountain,
    keywords: [
      '3d',
      'dioráma',
      'přelet',
      'terén',
      'vrcholy',
      'kamera',
      'myš',
      'ovládání',
      'sever',
      'reliéf',
    ],
    actionLabel: 'Otevřít Mapu (a vybrat trasu pro 3D)',
    actionType: 'tab',
    actionTab: 'map',
    images: [
      {
        file: 'assets/aistudio/image_71f7a5c7.png',
        alt: '3D dioráma horské trasy s označením vrcholů, startem a cílem',
        caption: 'Prostorový 3D model masivu s automaticky načtenými vrcholy v okolí trasy a jasným označením START / CÍL.',
      },
    ],
    steps: [
      {
        title: 'Jak spustit 3D pohled',
        text: 'Vyberte libovolnou trasu s GPX záznamem v sekci Mapa a trasy (nebo Plánované trasy) a klikněte na tlačítko „3D pohled“. Aplikace automaticky sestaví výškový model terénu a doplní štítky významných vrcholů v okolí.',
      },
      {
        title: 'Živý přelet po trase',
        text: 'Kliknutím na tlačítko Přehrát (Play) spustíte automatický průlet kamery podél celé GPX trasy od startu až do cíle. Během letu vidíte aktuální kilometr, nadmořskou výšku a sklon; kdykoli můžete let pozastavit nebo upravit jeho rychlost.',
      },
      {
        title: 'Přizpůsobení zobrazení',
        text: 'V nástrojové liště 3D zobrazení lze měnit převýšení reliéfu, skrýt/zobrazit popisky vrcholů, přepnout mapovou vrstvu nebo jedním kliknutím vrátit pohled zpět na celý masiv.',
      },
    ],
    controlsHeading: 'Ovládání 3D kamery (myš a dotykový displej)',
    controls: [
      { control: 'Levé tlačítko myši + tah', action: 'Otáčení 3D diorámatu a náklon kamery', note: 'Na mobilu: tah jedním prstem' },
      { control: 'Pravé tlačítko myši + tah', action: 'Posun terénu do stran', note: 'Na mobilu: tah dvěma prsty' },
      { control: 'Kolečko myši', action: 'Přiblížení a oddálení', note: 'Na mobilu: roztažení / sevření dvěma prsty' },
      { control: 'Tlačítko SEVER (kompas)', action: 'Srovnání mapy zpět na sever', note: 'Užitečné pro rychlou orientaci v terénu' },
    ],
  },
  {
    id: 'journal-and-planned',
    number: '04',
    shortTitle: 'Zápisník a plánování',
    title: 'Zápisník výšlapů a Plánované trasy',
    summary:
      'Udržujte kompletní kroniku všech absolvovaných výletů včetně vícedenních přechodů a připravujte si dopředu nové trasy, které po dokončení jedním kliknutím přesunete do deníku.',
    icon: Route,
    keywords: [
      'zápisník',
      'formulář',
      'přidat',
      'upravit',
      'vícedenní',
      'etapa',
      'plánované',
      'plánování',
      'gpx',
      'youtube',
      'fotky',
    ],
    actionLabel: 'Otevřít Plánované trasy',
    actionType: 'tab',
    actionTab: 'planned',
    steps: [
      {
        title: 'Zápis nového výšlapu v Zápisníku',
        text: 'Vyplňte název, datum (případně rozsah dnů u vícedenních akcí), pohoří, typ aktivity a jména účastníků. Nahrajte jeden nebo více GPX souborů — vzdálenost, stoupání, klesání i nejvyšší bod se dopočítají automaticky.',
      },
      {
        title: 'Vícedenní přechody a jednotlivé úseky',
        text: 'K jednomu výšlapu můžete přidat více samostatných denních etap (úseků). Aplikace pak zvlášť sleduje nejdelší denní etapu i celkovou kumulovanou délku celého přechodu.',
      },
      {
        title: 'Plánované trasy před výletem',
        text: 'V sekci Plánované trasy si nahrajte připravený GPX soubor (například z plánovače Mapy.cz). Předem si zkontrolujete výškový profil, náročné sklony, 3D terén i možnosti občerstvení. Po návratu z túry můžete plán rovnou převést do Zápisníku.',
      },
    ],
    tips: [
      'Ke každému výšlapu můžete uložit poznámky z cesty a externí odkazy na fotoalbum nebo video na YouTube.',
      'Rychlé nahrání GPX najdete kdykoli i v horním menu Data → Nahrát GPX soubor.',
    ],
  },
  {
    id: 'accommodation-poi',
    number: '05',
    shortTitle: 'Zázemí na trase',
    title: 'Zázemí na trase (ubytování, občerstvení, parkoviště)',
    summary:
      'Naplánujte si logistiku celého výletu bez přepínání mezi aplikacemi. Vyhledejte parkoviště u nástupních míst, horské chaty, restaurace, ubytování i kempy přímo podél své trasy.',
    icon: Compass,
    keywords: [
      'zázemí',
      'ubytování',
      'občerstvení',
      'restaurace',
      'chata',
      'parkoviště',
      'kemp',
      'poi',
      'body zájmu',
    ],
    actionLabel: 'Otevřít Zázemí na trase',
    actionType: 'tab',
    actionTab: 'accommodation',
    images: [
      {
        file: 'assets/aistudio/image_d2416586.png',
        alt: 'Mapa bodů zájmu v okolí horských tras — parkoviště, chaty, ubytování a kempy',
        caption: 'Přehledné zobrazení parkovišť (P), horských chat a občerstvení (H), ubytování (U) a kempů (K) na mapě.',
      },
    ],
    steps: [
      {
        title: 'Vyhledání bodů v okolí trasy nebo výřezu mapy',
        text: 'Vyberte uloženou či plánovanou trasu, případně přibližte mapu do libovolné oblasti hor a spusťte vyhledávání. Aplikace načte aktuální body zájmu z databáze OpenStreetMap.',
      },
      {
        title: 'Filtrování a detail místa',
        text: 'Pomocí filtrů si zobrazte jen ty kategorie, které právě potřebujete. Po kliknutí na značku v mapě vidíte název objektu, vzdálenost od trasy a odkaz na web či externí navigaci.',
      },
    ],
    controlsHeading: 'Význam značek na mapě zázemí',
    controls: [
      { control: 'P (modrá značka)', action: 'Parkoviště a odstavné plochy', note: 'Ideální pro nalezení nástupního místa autem' },
      { control: 'H (tmavá / zelená značka)', action: 'Horské chaty, boudy a občerstvení', note: 'Restaurace, hospody a horské bufety na trase' },
      { control: 'U (fialová značka)', action: 'Ubytování, penziony a hotely', note: 'Nocleh při vícedenních přechodech' },
      { control: 'K (oranžová značka)', action: 'Kempy a tábořiště', note: 'Místa pro stanování a karavany' },
    ],
  },
  {
    id: 'analytics-milestones',
    number: '06',
    shortTitle: 'Analytika a milníky',
    title: 'Analytika, Milníky, Účastníci a Tisk (PDF)',
    summary:
      'Sledujte svůj dlouhodobý pokrok v přehledných grafech, plňte motivační turistické výzvy, porovnávejte výsledky s parťáky a vytiskněte si celoroční kroniku výšlapů.',
    icon: BarChart3,
    keywords: [
      'analytika',
      'statistiky',
      'graf',
      'rekordy',
      'milníky',
      'odznaky',
      'výzvy',
      'účastníci',
      'tisk',
      'pdf',
      'kronika',
    ],
    actionLabel: 'Otevřít Analytiku',
    actionType: 'tab',
    actionTab: 'analytics',
    images: [
      {
        file: 'assets/aistudio/image_76312a11.png',
        alt: 'Přehled statistik, rekordů a kumulativního grafu převýšení',
        caption: 'Analytika počítá aktivní dny, kilometry, osobní rekordy a vykresluje detailní graf kumulativního převýšení.',
      },
      {
        file: 'assets/aistudio/image_2a7fd957.png',
        alt: 'Karty turistických milníků se stavem splnění a postupem',
        caption: 'Systém milníků automaticky hlídá dosažené mety a jedním kliknutím otevře konkrétní výšlap na mapě.',
      },
    ],
    steps: [
      {
        title: 'Analytika a graf kumulativního převýšení',
        text: 'V sekci Analytika vidíte aktivní dny, průměrnou denní délku, celkové kilometry, nejvyšší dosažený bod i nejdelší jednodenní a vícedenní trasu. Spodní posuvník grafu umožňuje plynule přiblížit libovolné časové období.',
      },
      {
        title: 'Systém milníků a proklik na mapu',
        text: 'Milníky (např. První túra, Padesátník, Stovkař, Dvacetikilometrový test, Dálkový plazec či výškové rekordy) se vyhodnocují automaticky podle data. U každého splněného milníku můžete kliknout na „Mapa“ a zobrazit výšlap, na kterém jste ho dosáhli.',
      },
      {
        title: 'Účastníci a Tisk / PDF kronika',
        text: 'Ikona turisty v horní liště otevírá přehled všech parťáků z výšlapů včetně jejich statistik a možnosti vygenerovat nebo odeslat e-mailem diplom za splněný milník. Tlačítko „Tisk a PDF“ připraví čistou tiskovou sestavu pro vybraný filtr či rok.',
      },
    ],
  },
  {
    id: 'offline-and-backup',
    number: '07',
    shortTitle: 'Offline a zálohy',
    title: 'Offline režim, Google Disk a zálohování dat',
    summary:
      'V horách nebývá signál — proto aplikace funguje plně offline, umí si dopředu stáhnout mapové dlaždice a pro bezpečný přenos mezi zařízeními nabízí zálohu na váš Google Disk i lokální export.',
    icon: WifiOff,
    keywords: [
      'offline',
      'signál',
      'stáhnout mapu',
      'dlaždice',
      'google disk',
      'záloha',
      'synchronizace',
      'json',
      'excel',
      'xlsx',
      'export',
      'import',
    ],
    actionLabel: 'Otevřít Offline režim a mapy',
    actionType: 'offline',
    steps: [
      {
        title: 'Předstažení offline map před cestou',
        text: 'Klikněte v horní liště na tlačítko „Lokální / Disk / Offline“ (nebo Data → Offline režim a mapy). Vyberte konkrétní trasu nebo celý archív a stáhněte si mapové podklady i výšková data (DEM) do paměti prohlížeče.',
      },
      {
        title: 'Ruční offline režim v terénu',
        text: 'V dialogu Offline režimu můžete ručně vynutit práci bez internetu — aplikace pak okamžitě využívá staženou mezipaměť a šetří baterii i mobilní data při slabém signálu.',
      },
      {
        title: 'Záloha a synchronizace na vlastní Google Disk',
        text: 'V okně Účet / PRO → Google Disk se přihlaste svým Google účtem. Jedním kliknutím uložíte celý archív do vlastního soukromého souboru na Google Disku a na jiném zařízení (např. na telefonu) jej stejně snadno obnovíte.',
      },
      {
        title: 'Export JSON a Excel (XLSX)',
        text: 'V menu Data (šipka dolů vpravo nahoře) můžete kdykoli stáhnout kompletní zálohu ve formátu JSON (pro archivaci nebo import na jiný počítač) nebo přehlednou tabulku výšlapů pro Excel (XLSX).',
      },
    ],
    tips: [
      'Pravidelná záloha (JSON nebo Google Disk) ochrání vaše data i v případě vymazání dat prohlížeče nebo ztráty telefonu.',
      'Export i import ve formátu JSON je vždy zcela zdarma bez ohledu na verzi licence.',
    ],
  },
  {
    id: 'plans-and-faq',
    number: '08',
    shortTitle: 'Zdarma vs. PRO & FAQ',
    title: 'Bezplatná verze vs. PRO licence a časté dotazy',
    summary:
      `Horský zápisník si můžete bez časového omezení používat zdarma, případně si na ${TRIAL_DAYS} dní zdarma vyzkoušet všechny PRO funkce. Doživotní PRO licence stojí jednorázově ${LIFETIME_PRICE_CZK} Kč (${LIFETIME_PRICE_EUR} €) bez jakéhokoli předplatného.`,
    icon: HelpCircle,
    keywords: [
      'licence',
      'pro',
      'zdarma',
      'free',
      'trial',
      'zkušební',
      'cena',
      'klíč',
      'faq',
      'dotazy',
      'mapy.cz',
      'pomoc',
    ],
    actionLabel: 'Otevřít správu licence a Google Disku',
    actionType: 'account-license',
    comparisonRows: [
      {
        feature: 'Archív absolvovaných výšlapů',
        free: `Až ${FREE_MAX_HIKES} výšlapů`,
        pro: 'Neomezený počet',
      },
      {
        feature: 'Plánované trasy',
        free: `Až ${FREE_MAX_PLANNED} trasy`,
        pro: 'Neomezený počet',
      },
      {
        feature: '2D mapa, výškový profil se sklonem, Analytika a Milníky',
        free: 'V plném rozsahu',
        pro: 'V plném rozsahu',
      },
      {
        feature: 'Záloha a obnovení přes JSON soubor',
        free: 'Ano (zdarma)',
        pro: 'Ano (zdarma)',
      },
      {
        feature: '3D dioráma terénu a přelet po trase',
        free: 'V rámci 7denního testu',
        pro: 'Neomezeně',
      },
      {
        feature: 'Zázemí na trase (ubytování, chaty, parkoviště)',
        free: 'V rámci 7denního testu',
        pro: 'Neomezeně',
      },
      {
        feature: 'Offline mapové balíčky do hor',
        free: 'V rámci 7denního testu',
        pro: 'Neomezeně',
      },
      {
        feature: 'Synchronizace na vlastní Google Disk',
        free: 'V rámci 7denního testu',
        pro: 'Neomezeně',
      },
      {
        feature: 'Tisk / PDF kronika, export Excel (XLSX) a e-maily účastníkům',
        free: 'V rámci 7denního testu',
        pro: 'Neomezeně',
      },
    ],
    faqs: [
      {
        question: 'Jak dostanu GPX trasu z Mapy.cz do Horského zápisníku?',
        answer:
          'Na webu nebo v aplikaci Mapy.cz otevřete uloženou aktivitu či naplánovanou trasu, zvolte „Exportovat“ → formát „GPX“ a stažený soubor nahrajte v Horském zápisníku přes Data → Nahrát GPX soubor nebo přímo ve formuláři v Zápisníku.',
      },
      {
        question: 'Jak aktivuji zakoupený PRO licenční klíč?',
        answer:
          'Klikněte v horní liště na tlačítko „PRO“, vložte licenční klíč z potvrzovacího e-mailu do pole pro aktivaci a potvrďte. PRO funkce se odemknou okamžitě.',
      },
      {
        question: 'Co se stane s mými daty, když vyprší 7denní zkušební verze?',
        answer:
          'Žádný váš výšlap se nikdy nesmaže. Všechna uložená data můžete nadále prohlížet na 2D mapě, v Zápisníku i exportovat do JSON — zamknou se pouze pokročilé PRO nástroje a přidávání tras nad limit bezplatné verze.',
      },
      {
        question: 'Jak přenesu výšlapy z počítače do telefonu?',
        answer:
          'Nejrychlejší je záloha na vlastní Google Disk (tlačítko PRO / Disk v horní liště) — na počítači kliknete na „Uložit zálohu“ a na telefonu na „Obnovit ze zálohy“. Bez Google Disku můžete kdykoli použít Export JSON a Import JSON.',
      },
    ],
  },
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildStandaloneManualHtml(): string {
  const sectionsHtml = CHAPTERS.map((ch) => {
    const stepsHtml = ch.steps
      ? `<div class="steps">${ch.steps
          .map(
            (s) =>
              `<div class="step"><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.text)}</p></div>`
          )
          .join('')}</div>`
      : '';

    const controlsHtml = ch.controls
      ? `<h3>${escapeHtml(ch.controlsHeading || 'Přehled ovládání')}</h3>
         <table><thead><tr><th>Prvek / značka</th><th>Význam / akce</th><th>Poznámka</th></tr></thead><tbody>
         ${ch.controls
           .map(
             (r) =>
               `<tr><td><strong>${escapeHtml(r.control)}</strong></td><td>${escapeHtml(
                 r.action
               )}</td><td>${escapeHtml(r.note || '')}</td></tr>`
           )
           .join('')}
         </tbody></table>`
      : '';

    const comparisonHtml = ch.comparisonRows
      ? `<h3>Srovnání verzí</h3>
         <table><thead><tr><th>Funkce</th><th>Zdarma</th><th>PRO (doživotní)</th></tr></thead><tbody>
         ${ch.comparisonRows
           .map(
             (r) =>
               `<tr><td>${escapeHtml(r.feature)}</td><td>${escapeHtml(
                 r.free
               )}</td><td><strong>${escapeHtml(r.pro)}</strong></td></tr>`
           )
           .join('')}
         </tbody></table>`
      : '';

    const tipsHtml = ch.tips
      ? `<div class="tips"><strong>Tipy z praxe:</strong><ul>${ch.tips
          .map((t) => `<li>${escapeHtml(t)}</li>`)
          .join('')}</ul></div>`
      : '';

    const faqsHtml = ch.faqs
      ? `<h3>Časté dotazy</h3>${ch.faqs
          .map(
            (f) =>
              `<div class="faq"><div class="q">${escapeHtml(f.question)}</div><p>${escapeHtml(
                f.answer
              )}</p></div>`
          )
          .join('')}`
      : '';

    return `<section id="${ch.id}">
      <div class="chapter-num">Kapitola ${ch.number}</div>
      <h2>${escapeHtml(ch.title)}</h2>
      <p class="summary">${escapeHtml(ch.summary)}</p>
      ${stepsHtml}
      ${controlsHtml}
      ${comparisonHtml}
      ${tipsHtml}
      ${faqsHtml}
    </section>`;
  }).join('');

  return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Uživatelský manuál — Horský zápisník a Archív tras</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1c1917; background: #fafaf9; margin: 0; line-height: 1.6; }
  .wrap { max-width: 860px; margin: 0 auto; padding: 36px 24px 64px; background: #fff; }
  header { border-bottom: 1px solid #e7e5e4; padding-bottom: 20px; margin-bottom: 28px; }
  h1 { margin: 0 0 6px; font-size: 28px; letter-spacing: -0.02em; }
  .meta { color: #57534e; font-size: 13px; }
  nav { background: #f5f5f4; border: 1px solid #e7e5e4; border-radius: 10px; padding: 14px 18px; margin-bottom: 32px; }
  nav strong { display: block; font-size: 12px; color: #57534e; margin-bottom: 8px; }
  nav ol { margin: 0; padding-left: 20px; columns: 2; gap: 24px; font-size: 14px; }
  nav a { color: #047857; text-decoration: none; }
  nav a:hover { text-decoration: underline; }
  section { padding: 24px 0; border-bottom: 1px solid #e7e5e4; page-break-inside: avoid; }
  .chapter-num { font-size: 12px; font-weight: 700; color: #047857; margin-bottom: 4px; }
  h2 { margin: 0 0 10px; font-size: 21px; }
  h3 { margin: 18px 0 6px; font-size: 15px; color: #1c1917; }
  .summary { color: #44403c; font-size: 15px; margin-top: 0; }
  .step p, .faq p { margin: 4px 0 12px; color: #44403c; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0 18px; font-size: 13.5px; }
  th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid #e7e5e4; vertical-align: top; }
  th { background: #fafaf9; font-weight: 600; color: #44403c; }
  .tips { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-top: 14px; font-size: 13.5px; color: #14532d; }
  .tips ul { margin: 6px 0 0; padding-left: 18px; }
  .faq .q { font-weight: 600; color: #1c1917; margin-top: 12px; }
  footer { margin-top: 32px; font-size: 12px; color: #78716c; text-align: center; }
  @media print { body { background: #fff; } .wrap { padding: 0; } nav { display: none; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Horský zápisník a Archív tras — Uživatelský manuál</h1>
    <div class="meta">Kompletní průvodce funkcemi a ovládáním · Verze 4.2 · hor-zap.github.io/HZ</div>
  </header>
  <nav>
    <strong>Obsah manuálu</strong>
    <ol>${CHAPTERS.map((c) => `<li><a href="#${c.id}">${escapeHtml(c.title)}</a></li>`).join('')}</ol>
  </nav>
  ${sectionsHtml}
  <footer>Horský zápisník a Archív tras · Vygenerováno pro offline čtení nebo tisk do PDF (Ctrl+P / Cmd+P)</footer>
</div>
</body>
</html>`;
}

export const UserManualModal: React.FC<UserManualModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenOfflineModal,
  onOpenAccountModal,
  onOpenPromoVideo,
}) => {
  const [activeChapterId, setActiveChapterId] = useState<string>(CHAPTERS[0].id);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const contentScrollRef = useRef<HTMLDivElement>(null);

  const base = import.meta.env.BASE_URL || './';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const filteredChapters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return CHAPTERS;
    return CHAPTERS.filter((ch) => {
      const haystack = [
        ch.title,
        ch.shortTitle,
        ch.summary,
        ...ch.keywords,
        ...(ch.steps?.flatMap((s) => [s.title, s.text]) || []),
        ...(ch.controls?.flatMap((c) => [c.control, c.action, c.note || '']) || []),
        ...(ch.tips || []),
        ...(ch.faqs?.flatMap((f) => [f.question, f.answer]) || []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [searchQuery]);

  const activeChapter = useMemo(() => {
    const found = filteredChapters.find((c) => c.id === activeChapterId);
    return found || filteredChapters[0] || CHAPTERS[0];
  }, [filteredChapters, activeChapterId]);

  const activeIndex = useMemo(
    () => CHAPTERS.findIndex((c) => c.id === activeChapter.id),
    [activeChapter.id]
  );

  const selectChapter = (id: string) => {
    setActiveChapterId(id);
    if (contentScrollRef.current) {
      contentScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleChapterAction = (chapter: ManualChapter) => {
    onClose();
    if (chapter.actionType === 'tab' && chapter.actionTab) {
      onNavigateTab(chapter.actionTab);
    } else if (chapter.actionType === 'offline') {
      onOpenOfflineModal();
    } else if (chapter.actionType === 'account-drive') {
      onOpenAccountModal('drive');
    } else if (chapter.actionType === 'account-license') {
      onOpenAccountModal('license');
    }
  };

  const handleDownloadOfflineManual = () => {
    const html = buildStandaloneManualHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manual-horsky-zapisnik.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!isOpen) return null;

  const prevChapter = activeIndex > 0 ? CHAPTERS[activeIndex - 1] : null;
  const nextChapter = activeIndex < CHAPTERS.length - 1 ? CHAPTERS[activeIndex + 1] : null;

  return (
    <div
      className="fixed inset-0 z-[2450] flex items-center justify-center bg-stone-950/70 backdrop-blur-xs p-2 sm:p-5 no-print"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-manual-title"
    >
      <div
        className="bg-white text-stone-900 rounded-2xl shadow-2xl border border-stone-200 w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <header className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-stone-200 bg-white shrink-0">
          <div className="min-w-0">
            <h2
              id="user-manual-title"
              className="text-base sm:text-lg font-bold text-stone-900 tracking-tight truncate"
            >
              Uživatelský manuál — Horský zápisník
            </h2>
            <p className="text-xs text-stone-500 flex items-center gap-2 mt-0.5 truncate">
              <span>8 kapitol</span>
              <span aria-hidden="true">·</span>
              <span>Verze 4.2</span>
              <span aria-hidden="true">·</span>
              <span>Kompletní průvodce funkcemi a ovládáním</span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadOfflineManual}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Stáhnout celý manuál jako offline HTML (lze i vytisknout do PDF)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Stáhnout manuál (HTML / PDF)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
              aria-label="Zavřít manuál"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Mobile Search + Horizontal Chapter Bar */}
        <div className="md:hidden border-b border-stone-200 bg-stone-50 px-3 py-2.5 space-y-2 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hledat v manuálu (např. GPX, 3D, offline)…"
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {filteredChapters.map((ch) => {
              const isSelected = ch.id === activeChapter.id;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => selectChapter(ch.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-700 text-white'
                      : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {ch.number}. {ch.shortTitle}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main 2-Column Body */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Desktop Left Sidebar TOC */}
          <aside className="hidden md:flex flex-col w-72 shrink-0 border-r border-stone-200 bg-stone-50/70">
            <div className="p-3.5 border-b border-stone-200/80">
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Hledat v manuálu…"
                  aria-label="Hledat v manuálu"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-stone-200 rounded-lg text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto p-2.5 space-y-0.5" aria-label="Kapitoly manuálu">
              {filteredChapters.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-stone-500">
                  Pro výraz „{searchQuery}“ nebyla nalezena žádná kapitola.
                </div>
              ) : (
                filteredChapters.map((ch) => {
                  const Icon = ch.icon;
                  const isSelected = ch.id === activeChapter.id;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => selectChapter(ch.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-white text-emerald-800 font-semibold border border-stone-200 shadow-2xs'
                          : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80 font-medium border border-transparent'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isSelected ? 'text-emerald-600' : 'text-stone-400'
                        }`}
                      />
                      <span className="truncate">
                        <span className="font-mono tabular-nums text-[11px] text-stone-400 mr-1.5">
                          {ch.number}.
                        </span>
                        {ch.shortTitle}
                      </span>
                    </button>
                  );
                })
              )}
            </nav>

            <div className="p-3.5 border-t border-stone-200/80 space-y-2 bg-stone-50">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPromoVideo();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                <Film className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Promo video (16:9 &amp; 9:16)</span>
              </button>
            </div>
          </aside>

          {/* Right Scrollable Chapter Content */}
          <main ref={contentScrollRef} className="flex-1 min-w-0 overflow-y-auto bg-white">
            {filteredChapters.length === 0 ? (
              <div className="max-w-2xl mx-auto px-6 py-16 text-center space-y-3">
                <p className="text-sm font-semibold text-stone-800">
                  Nenalezen žádný odpovídající návod pro „{searchQuery}“.
                </p>
                <p className="text-xs text-stone-500">
                  Zkuste jiný výraz, například GPX, 3D, výškový profil, Google Disk, offline nebo licence.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="inline-flex items-center px-3.5 py-2 rounded-lg border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
                >
                  Zobrazit všechny kapitoly
                </button>
              </div>
            ) : (
              <article className="max-w-3xl mx-auto px-5 sm:px-9 py-7 sm:py-9 space-y-8">
                {/* Chapter Heading */}
                <div className="space-y-3 border-b border-stone-200 pb-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-emerald-700 tabular-nums">
                      Kapitola {activeChapter.number} z {String(CHAPTERS.length).padStart(2, '0')}
                    </div>

                    {activeChapter.actionLabel && (
                      <button
                        type="button"
                        onClick={() => handleChapterAction(activeChapter)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <span>{activeChapter.actionLabel}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    )}
                  </div>

                  <h3 className="text-2xl sm:text-[26px] font-bold text-stone-900 tracking-tight leading-snug text-balance">
                    {activeChapter.title}
                  </h3>
                  <p className="text-sm sm:text-[15px] text-stone-600 leading-relaxed">
                    {activeChapter.summary}
                  </p>
                </div>

                {/* Real App Screenshots */}
                {activeChapter.images && activeChapter.images.length > 0 && (
                  <div className="space-y-5">
                    {activeChapter.images.map((img) => {
                      const imgSrc = `${normalizedBase}${img.file}`;
                      const isBroken = brokenImages[img.file];
                      return (
                        <figure
                          key={img.file}
                          className="rounded-xl overflow-hidden border border-stone-200 bg-stone-50"
                        >
                          {isBroken ? (
                            <div className="h-44 flex flex-col items-center justify-center gap-2 text-stone-400 px-4 text-center">
                              <Mountain className="w-7 h-7" />
                              <span className="text-xs">{img.alt}</span>
                            </div>
                          ) : (
                            <img
                              src={imgSrc}
                              alt={img.alt}
                              referrerPolicy="no-referrer"
                              onError={() =>
                                setBrokenImages((prev) => ({ ...prev, [img.file]: true }))
                              }
                              className="w-full h-auto block bg-stone-100"
                            />
                          )}
                          <figcaption className="px-4 py-2.5 text-xs text-stone-600 border-t border-stone-200 bg-stone-50/90">
                            {img.caption}
                          </figcaption>
                        </figure>
                      );
                    })}
                  </div>
                )}

                {/* Detailed Steps */}
                {activeChapter.steps && activeChapter.steps.length > 0 && (
                  <section className="space-y-5">
                    <h4 className="text-sm font-bold text-stone-900">Postup a hlavní možnosti</h4>
                    <div className="divide-y divide-stone-100 border-t border-b border-stone-200">
                      {activeChapter.steps.map((step) => (
                        <div key={step.title} className="py-4 space-y-1.5">
                          <h5 className="text-sm font-semibold text-stone-900">{step.title}</h5>
                          <p className="text-sm text-stone-600 leading-relaxed">{step.text}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Controls / Legend Table */}
                {activeChapter.controls && activeChapter.controls.length > 0 && (
                  <section className="space-y-3">
                    <h4 className="text-sm font-bold text-stone-900">
                      {activeChapter.controlsHeading || 'Ovládání a legenda'}
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-stone-200">
                      <table className="w-full text-left border-collapse text-xs sm:text-[13px]">
                        <thead>
                          <tr className="bg-stone-50 border-b border-stone-200 text-stone-600">
                            <th className="py-2.5 px-3.5 font-semibold">Ovládání / značka</th>
                            <th className="py-2.5 px-3.5 font-semibold">Akce / význam</th>
                            <th className="py-2.5 px-3.5 font-semibold">Poznámka</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {activeChapter.controls.map((row) => (
                            <tr key={row.control} className="hover:bg-stone-50/70">
                              <td className="py-2.5 px-3.5 font-semibold text-stone-900 whitespace-nowrap">
                                {row.control}
                              </td>
                              <td className="py-2.5 px-3.5 text-stone-700">{row.action}</td>
                              <td className="py-2.5 px-3.5 text-stone-500">{row.note || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {/* Free vs PRO Comparison Matrix */}
                {activeChapter.comparisonRows && activeChapter.comparisonRows.length > 0 && (
                  <section className="space-y-3">
                    <h4 className="text-sm font-bold text-stone-900">
                      Přehled rozdílů: Zdarma vs. PRO licence
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-stone-200">
                      <table className="w-full text-left border-collapse text-xs sm:text-[13px] tabular-nums">
                        <thead>
                          <tr className="bg-stone-50 border-b border-stone-200 text-stone-600">
                            <th className="py-2.5 px-3.5 font-semibold">Funkce</th>
                            <th className="py-2.5 px-3.5 font-semibold">Zdarma</th>
                            <th className="py-2.5 px-3.5 font-semibold text-emerald-800">
                              PRO ({LIFETIME_PRICE_CZK} Kč jednorázově)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {activeChapter.comparisonRows.map((row) => (
                            <tr key={row.feature} className="hover:bg-stone-50/70">
                              <td className="py-2.5 px-3.5 font-medium text-stone-900">
                                {row.feature}
                              </td>
                              <td className="py-2.5 px-3.5 text-stone-600">
                                <span className="inline-flex items-center gap-1.5">
                                  {row.free.startsWith('V rámci') ? (
                                    <Minus className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  )}
                                  <span>{row.free}</span>
                                </span>
                              </td>
                              <td className="py-2.5 px-3.5 font-semibold text-emerald-800">
                                <span className="inline-flex items-center gap-1.5">
                                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>{row.pro}</span>
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {/* Practical Tips */}
                {activeChapter.tips && activeChapter.tips.length > 0 && (
                  <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5 space-y-2">
                    <h4 className="text-xs font-bold text-emerald-900">Praktické tipy</h4>
                    <ul className="space-y-1.5 text-sm text-emerald-950/90 list-disc pl-5">
                      {activeChapter.tips.map((tip) => (
                        <li key={tip} className="leading-relaxed">
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* FAQ Section */}
                {activeChapter.faqs && activeChapter.faqs.length > 0 && (
                  <section className="space-y-3">
                    <h4 className="text-sm font-bold text-stone-900">Často kladené dotazy</h4>
                    <div className="divide-y divide-stone-200 border-t border-b border-stone-200">
                      {activeChapter.faqs.map((item) => (
                        <div key={item.question} className="py-4 space-y-1.5">
                          <h5 className="text-sm font-semibold text-stone-900">{item.question}</h5>
                          <p className="text-sm text-stone-600 leading-relaxed">{item.answer}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Mobile Download Offline Manual Button */}
                <div className="sm:hidden pt-2">
                  <button
                    type="button"
                    onClick={handleDownloadOfflineManual}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-800 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Stáhnout celý manuál (HTML / PDF)</span>
                  </button>
                </div>

                {/* Chapter Prev / Next Footer */}
                <nav
                  aria-label="Navigace mezi kapitolami"
                  className="flex items-center justify-between gap-3 pt-6 border-t border-stone-200"
                >
                  {prevChapter ? (
                    <button
                      type="button"
                      onClick={() => selectChapter(prevChapter.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4 shrink-0" />
                      <span>
                        {prevChapter.number}. {prevChapter.shortTitle}
                      </span>
                    </button>
                  ) : (
                    <div />
                  )}

                  {nextChapter ? (
                    <button
                      type="button"
                      onClick={() => selectChapter(nextChapter.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <span>
                        {nextChapter.number}. {nextChapter.shortTitle}
                      </span>
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <span>Zavřít manuál a používat aplikaci</span>
                    </button>
                  )}
                </nav>
              </article>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
