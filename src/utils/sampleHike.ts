import { HikeActivity, RoutePart } from '../types';
import { calculateCoordsDistanceKm, parseGpxXml } from './gpxParser';

export interface SampleHikePayload {
  name: string;
  distance: number;
  date: string;
  participants: string;
  note: string;
  activity: HikeActivity;
  routes: RoutePart[];
}

export interface SamplePlannedRoutePayload {
  name: string;
  distance: number;
  link: string;
  note: string;
  color: string;
  routes: RoutePart[];
}

interface SampleGpxAsset {
  assetFile: string;
  gpxName: string;
}

const SAMPLE_GPX_ASSETS = {
  kralickySneznik: {
    assetFile: '3_8d2a64f1.txt',
    gpxName: 'kralicky-sneznik-stribrnice.gpx',
  },
  lysaHora: {
    assetFile: '2_e079fbcf.txt',
    gpxName: 'beskydy-lysa-hora.gpx',
  },
  sumavaPlechy: {
    assetFile: '1_0608bb7b.txt',
    gpxName: 'sumava-plechy-tristolicnik.gpx',
  },
} as const satisfies Record<string, SampleGpxAsset>;

function daysAgoIso(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

async function fetchSampleGpx(asset: SampleGpxAsset): Promise<{
  gpxData: string;
  coordinates: ReturnType<typeof parseGpxXml>;
  distanceKm: number;
}> {
  const base = import.meta.env.BASE_URL || './';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const url = `${normalizedBase}assets/aistudio/${asset.assetFile}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Nepodařilo se načíst ukázkový GPX soubor (${asset.gpxName}).`);
  }

  const gpxData = await response.text();
  const coordinates = parseGpxXml(gpxData);
  if (coordinates.length < 2) {
    throw new Error(`Ukázkový GPX soubor (${asset.gpxName}) neobsahuje platné souřadnice.`);
  }

  const distanceKm = Math.round(calculateCoordsDistanceKm(coordinates) * 10) / 10;
  return { gpxData, coordinates, distanceKm };
}

export async function loadSampleHikesPayloads(): Promise<SampleHikePayload[]> {
  const [sneznikGpx, lysaGpx] = await Promise.all([
    fetchSampleGpx(SAMPLE_GPX_ASSETS.kralickySneznik),
    fetchSampleGpx(SAMPLE_GPX_ASSETS.lysaHora),
  ]);

  return [
    {
      name: 'Ukázka: Králický Sněžník ze Stříbrnic',
      distance: sneznikGpx.distanceKm,
      date: daysAgoIso(7),
      participants: 'Turista',
      note: 'Ukázkový horský okruh ze Stříbrnic na vrchol Králického Sněžníku (1 415 m n. m.) s převýšením přes 950 m. Tuto trasu můžete kdykoli upravit nebo smazat.',
      activity: 'hiking',
      routes: [
        {
          distance: sneznikGpx.distanceKm,
          link: '',
          url: '',
          gpxData: sneznikGpx.gpxData,
          gpxName: SAMPLE_GPX_ASSETS.kralickySneznik.gpxName,
          hasGpx: true,
          coordinates: sneznikGpx.coordinates,
          visible: true,
          photosUrl: '',
          photos: '',
          youtube: '',
          video: '',
        },
      ],
    },
    {
      name: 'Ukázka: Beskydy – okruh na Lysou horu',
      distance: lysaGpx.distanceKm,
      date: daysAgoIso(21),
      participants: 'Turista',
      note: 'Ukázkový beskydský výstup na královnu Moravskoslezských Beskyd – Lysou horu (1 320 m n. m.). Tuto trasu můžete kdykoli upravit nebo smazat.',
      activity: 'hiking',
      routes: [
        {
          distance: lysaGpx.distanceKm,
          link: '',
          url: '',
          gpxData: lysaGpx.gpxData,
          gpxName: SAMPLE_GPX_ASSETS.lysaHora.gpxName,
          hasGpx: true,
          coordinates: lysaGpx.coordinates,
          visible: true,
          photosUrl: '',
          photos: '',
          youtube: '',
          video: '',
        },
      ],
    },
  ];
}

export async function loadSamplePlannedRoutePayload(): Promise<SamplePlannedRoutePayload> {
  const sumavaGpx = await fetchSampleGpx(SAMPLE_GPX_ASSETS.sumavaPlechy);

  return {
    name: 'Ukázkový plán: Šumava – Plechý a Třístoličník',
    distance: sumavaGpx.distanceKm,
    link: '',
    note: 'Ukázková plánovaná šumavská hřebenovka z Nové Pece kolem Plešného jezera přes Plechý (1 370 m n. m.) a Třístoličník až do Nového Údolí.',
    color: '#0284c7',
    routes: [
      {
        distance: sumavaGpx.distanceKm,
        link: '',
        url: '',
        gpxData: sumavaGpx.gpxData,
        gpxName: SAMPLE_GPX_ASSETS.sumavaPlechy.gpxName,
        hasGpx: true,
        coordinates: sumavaGpx.coordinates,
        visible: true,
      },
    ],
  };
}
