import { Hike, HikeActivity, RoutePart, PlannedRoute, ParticipantProfile } from '../types';
import { resolveGpxVal, calculateCoordsDistanceKm } from '../utils/gpxParser';
import { normalizeHikeActivity } from '../components/ActivityBadge';

const DB_NAME = 'horsky_zapisnik_v4_db';
const DB_VERSION = 1;

const STORE_HIKES = 'hikes';
const STORE_PLANNED = 'planned_routes';
const STORE_PARTICIPANTS = 'participants';
const STORE_META = 'meta';

const LEGACY_HIKES_KEY = 'hikingArchiveDataJsonOnly';
const LEGACY_PLANNED_KEY = 'plannedRoutesArchiveData';
const LEGACY_PARTICIPANTS_KEY = 'participantsProfilesArchiveData';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB není v tomto prohlížeči dostupná.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_HIKES)) {
        db.createObjectStore(STORE_HIKES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PLANNED)) {
        db.createObjectStore(STORE_PLANNED, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PARTICIPANTS)) {
        db.createObjectStore(STORE_PARTICIPANTS, { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error || new Error('Nepodařilo se otevřít lokální databázi.'));
    };
  });
  return dbPromise;
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve((req.result as T[]) || []);
    req.onerror = () => reject(req.error);
  });
}

async function putInStore<T>(storeName: string, value: T): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteFromStore(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function replaceAllInStore<T>(storeName: string, items: T[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getMetaValue<T>(key: string): Promise<T | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get(key);
      req.onsuccess = () => {
        const record = req.result as { key: string; value: T } | undefined;
        resolve(record ? record.value : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function setMetaValue<T>(key: string, value: T): Promise<void> {
  try {
    await putInStore(STORE_META, { key, value });
  } catch {
    // ignore storage errors
  }
}

export async function extractRoutesFromData(
  data: Record<string, unknown>
): Promise<RoutePart[]> {
  const routes: RoutePart[] = [];

  async function processItem(item: unknown): Promise<RoutePart | null> {
    if (!item) return null;
    if (typeof item === 'string') {
      const coords = await resolveGpxVal(item);
      const isHttp = item.startsWith('http');
      const isMapy = isHttp && (item.includes('mapy.cz') || item.includes('mapy.com'));
      return {
        link: isMapy ? item : '',
        url: isMapy ? item : '',
        gpxUrl: isHttp && !isMapy ? item : '',
        hasGpx: coords.length > 0,
        coordinates: coords,
        visible: true,
      };
    }

    const obj = item as Record<string, unknown>;
    const rawGpxVal =
      obj.gpxData ||
      obj.gpx ||
      obj.gpxUrl ||
      obj.gpxFile ||
      obj.file ||
      obj.fileData ||
      obj.coordinates ||
      obj.coords ||
      obj.points ||
      obj.track ||
      obj.path ||
      obj.gpxContent ||
      obj.xml;

    const coords = await resolveGpxVal(rawGpxVal);
    const mapLink = String(obj.link || obj.url || obj.mapUrl || obj.map || obj.mapa || '');
    const gpxLink = String(
      obj.gpxUrl ||
        obj.gpxDownload ||
        (typeof obj.gpx === 'string' && obj.gpx.startsWith('http') ? obj.gpx : '')
    );
    const gpxName = String(
      obj.gpxName || (gpxLink ? 'GPX trasa' : coords.length > 0 ? 'Nahrané GPX' : '')
    );

    let routePhotos = obj.photosUrl || obj.photos || obj.photo || obj.fotky || obj.foto || '';
    if (Array.isArray(routePhotos)) routePhotos = routePhotos[0] || '';

    const video = String(obj.youtube || obj.video || obj.videa || '');
    const savedGpxData =
      typeof obj.gpxData === 'string'
        ? obj.gpxData
        : typeof rawGpxVal === 'string' && !rawGpxVal.startsWith('http')
        ? rawGpxVal
        : null;

    const rawSegDist =
      obj.distance !== undefined && obj.distance !== null && obj.distance !== ''
        ? parseFloat(String(obj.distance))
        : NaN;
    const gpxDist = coords.length >= 2 ? calculateCoordsDistanceKm(coords) : 0;
    const segDist =
      !isNaN(rawSegDist) && rawSegDist > 0
        ? Math.round(rawSegDist * 10) / 10
        : gpxDist > 0
        ? Math.round(gpxDist * 10) / 10
        : undefined;

    return {
      distance: segDist,
      link: mapLink,
      url: mapLink,
      gpxUrl: gpxLink,
      gpxName,
      gpxData: savedGpxData,
      hasGpx: coords.length > 0 || !!gpxLink || !!savedGpxData,
      coordinates: coords,
      visible: obj.visible !== undefined ? Boolean(obj.visible) : true,
      photosUrl: String(routePhotos || ''),
      photos: String(routePhotos || ''),
      youtube: video,
      video,
    };
  }

  const arrayFields = ['routes', 'maps', 'trasy', 'tracks', 'mapy', 'items'];
  for (const field of arrayFields) {
    const list = data[field];
    if (Array.isArray(list) && list.length > 0) {
      for (const item of list) {
        const processed = await processItem(item);
        if (processed) routes.push(processed);
      }
      break;
    }
  }

  if (routes.length === 0 || routes.every((r) => !r.coordinates || r.coordinates.length === 0)) {
    const rootGpx =
      data.gpx ||
      data.gpxData ||
      data.gpxUrl ||
      data.gpxFile ||
      data.gpxXml ||
      data.gpxContent ||
      data.file ||
      data.coordinates ||
      data.coords ||
      data.points;

    const directCoords = await resolveGpxVal(rootGpx);
    const mapLink = String(data.mapUrl || data.url || data.link || data.map || data.mapa || '');
    const gpxLink = String(
      (typeof data.gpxUrl === 'string' && data.gpxUrl.startsWith('http') ? data.gpxUrl : '') ||
        (typeof data.gpx === 'string' && data.gpx.startsWith('http') ? data.gpx : '')
    );

    if (directCoords.length > 0 || mapLink || gpxLink) {
      routes.push({
        link: mapLink,
        url: mapLink,
        gpxUrl: gpxLink,
        gpxData: typeof data.gpx === 'string' && !data.gpx.startsWith('http') ? data.gpx : null,
        gpxName: gpxLink ? 'GPX trasa' : directCoords.length > 0 ? 'Původní GPX' : '',
        hasGpx: directCoords.length > 0 || !!gpxLink,
        coordinates: directCoords,
        visible: true,
      });
    }
  }

  return routes;
}

export async function normalizeHikeRecord(raw: Record<string, unknown>, fallbackId?: string): Promise<Hike> {
  const id =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : fallbackId || `hike_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const distNum = parseFloat(String(raw.distance || '0'));
  let startDateRaw = String(raw.date || raw.dateFrom || raw.startDate || raw.from || '');
  let endDateRaw = String(raw.dateTo || raw.endDate || raw.to || raw.end || '');

  if (startDateRaw && !endDateRaw) {
    if (startDateRaw.includes(' - ')) {
      const p = startDateRaw.split(' - ');
      startDateRaw = p[0].trim();
      endDateRaw = p[1].trim();
    } else if (startDateRaw.includes(' – ')) {
      const p = startDateRaw.split(' – ');
      startDateRaw = p[0].trim();
      endDateRaw = p[1].trim();
    }
  }

  const routes = await extractRoutesFromData(raw);

  if (routes.length === 1 && !routes[0].distance && !isNaN(distNum) && distNum > 0) {
    routes[0].distance = Math.round(distNum * 10) / 10;
  }

  const explicitSegmentsSum = routes.reduce((sum, r) => {
    const d = r.distance !== undefined ? parseFloat(String(r.distance)) : NaN;
    return sum + (!isNaN(d) && d > 0 ? d : 0);
  }, 0);

  const finalDistNum =
    !isNaN(distNum) && distNum > 0
      ? distNum
      : explicitSegmentsSum > 0
      ? explicitSegmentsSum
      : 0;

  return {
    id,
    name: String(raw.name || 'Neznámý výšlap'),
    distance: finalDistNum.toFixed(1),
    date: startDateRaw,
    dateTo: endDateRaw,
    rawDate: startDateRaw,
    endDate: endDateRaw,
    participants: String(raw.participants || ''),
    note: String(raw.note || raw.notes || raw.description || ''),
    activity: normalizeHikeActivity(raw.activity),
    routes,
    maps: routes,
    gpx: typeof raw.gpx === 'string' ? raw.gpx : undefined,
  };
}

export async function normalizePlannedRouteRecord(
  raw: Record<string, unknown>,
  fallbackId?: string
): Promise<PlannedRoute> {
  const id =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : fallbackId || `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const routes = await extractRoutesFromData(raw);
  const directCoords =
    routes.length > 0 && routes[0].coordinates && routes[0].coordinates.length > 0
      ? routes[0].coordinates
      : await resolveGpxVal(raw.gpxData || raw.gpx || raw.coordinates);

  const distNum = parseFloat(String(raw.distance || '0'));
  const explicitSegmentsSum = routes.reduce((sum, r) => {
    const d = r.distance !== undefined ? parseFloat(String(r.distance)) : NaN;
    return sum + (!isNaN(d) && d > 0 ? d : 0);
  }, 0);
  const calcDist = directCoords.length >= 2 ? calculateCoordsDistanceKm(directCoords) : 0;

  const finalDistNum =
    !isNaN(distNum) && distNum > 0
      ? distNum
      : explicitSegmentsSum > 0
      ? explicitSegmentsSum
      : calcDist > 0
      ? calcDist
      : 0;

  if (routes.length === 0 && (directCoords.length > 0 || raw.link)) {
    routes.push({
      distance: Math.round(finalDistNum * 10) / 10,
      link: String(raw.link || ''),
      url: String(raw.link || ''),
      gpxName: String(raw.gpxName || ''),
      gpxData: typeof raw.gpxData === 'string' ? raw.gpxData : null,
      hasGpx: directCoords.length > 0,
      coordinates: directCoords,
      visible: true,
    });
  }

  return {
    id,
    name: String(raw.name || 'Plánovaná trasa'),
    distance: finalDistNum.toFixed(1),
    link: String(raw.link || routes[0]?.link || ''),
    note: String(raw.note || ''),
    color: typeof raw.color === 'string' ? raw.color : undefined,
    gpxName: String(raw.gpxName || routes[0]?.gpxName || ''),
    gpxData: typeof raw.gpxData === 'string' ? raw.gpxData : null,
    coordinates: directCoords,
    routes,
    createdAt: String(raw.createdAt || new Date().toISOString()),
  };
}

export async function normalizeImportedHikes(rawItems: unknown[]): Promise<Hike[]> {
  const result: Hike[] = [];
  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i];
    if (item && typeof item === 'object') {
      const normalized = await normalizeHikeRecord(
        item as Record<string, unknown>,
        `hike_${Date.now()}_${i}`
      );
      result.push(normalized);
    }
  }
  return result;
}

export async function normalizeImportedPlannedRoutes(rawItems: unknown[]): Promise<PlannedRoute[]> {
  const result: PlannedRoute[] = [];
  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i];
    if (item && typeof item === 'object') {
      const normalized = await normalizePlannedRouteRecord(
        item as Record<string, unknown>,
        `plan_${Date.now()}_${i}`
      );
      result.push(normalized);
    }
  }
  return result;
}

function serializeRoutesClean(routes?: RoutePart[]): RoutePart[] {
  return (routes || [])
    .filter(
      (r) =>
        (r.distance !== undefined && r.distance !== '' && parseFloat(String(r.distance)) > 0) ||
        r.link ||
        r.url ||
        r.gpxData ||
        (r.coordinates && r.coordinates.length > 0) ||
        r.photosUrl ||
        r.photos ||
        r.youtube ||
        r.video
    )
    .map((r) => {
      const parsedDist =
        r.distance !== undefined && r.distance !== '' ? parseFloat(String(r.distance)) : NaN;
      const coords = r.coordinates || [];
      const link = (r.link || r.url || '').trim();
      const photos = (r.photosUrl || r.photos || '').trim();
      const video = (r.youtube || r.video || '').trim();
      return {
        distance: !isNaN(parsedDist) && parsedDist > 0 ? Math.round(parsedDist * 10) / 10 : 0,
        link,
        url: link,
        gpxData: r.gpxData || null,
        gpxName: r.gpxName || '',
        gpxUrl: r.gpxUrl || '',
        hasGpx: coords.length > 0 || !!r.gpxData || !!r.gpxUrl,
        coordinates: coords,
        visible: r.visible !== false,
        photosUrl: photos,
        photos,
        youtube: video,
        video,
      };
    });
}

export async function initializeLocalStore(): Promise<{
  hikes: Hike[];
  plannedRoutes: PlannedRoute[];
  participants: Record<string, ParticipantProfile>;
}> {
  let hikes = await getAllFromStore<Hike>(STORE_HIKES);
  let plannedRoutes = await getAllFromStore<PlannedRoute>(STORE_PLANNED);
  const participantList = await getAllFromStore<ParticipantProfile>(STORE_PARTICIPANTS);
  const participants: Record<string, ParticipantProfile> = {};
  for (const p of participantList) {
    if (p.name) participants[p.name] = p;
  }

  // One-time migration from legacy localStorage cache if IndexedDB is completely empty
  const migrated = await getMetaValue<boolean>('legacy_migrated_v4');
  if (!migrated && hikes.length === 0 && plannedRoutes.length === 0) {
    try {
      const legacyHikesRaw = localStorage.getItem(LEGACY_HIKES_KEY);
      if (legacyHikesRaw) {
        const parsed = JSON.parse(legacyHikesRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          hikes = await normalizeImportedHikes(parsed);
          await replaceAllInStore(STORE_HIKES, hikes);
        }
      }
    } catch {
      // ignore malformed legacy data
    }

    try {
      const legacyPlannedRaw = localStorage.getItem(LEGACY_PLANNED_KEY);
      if (legacyPlannedRaw) {
        const parsed = JSON.parse(legacyPlannedRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          plannedRoutes = await normalizeImportedPlannedRoutes(parsed);
          await replaceAllInStore(STORE_PLANNED, plannedRoutes);
        }
      }
    } catch {
      // ignore
    }

    try {
      const legacyPartRaw = localStorage.getItem(LEGACY_PARTICIPANTS_KEY);
      if (legacyPartRaw) {
        const parsed = JSON.parse(legacyPartRaw);
        if (parsed && typeof parsed === 'object') {
          const items: ParticipantProfile[] = [];
          for (const [k, v] of Object.entries(parsed)) {
            if (v && typeof v === 'object') {
              const obj = v as ParticipantProfile;
              const name = (obj.name || k).trim();
              if (name) {
                const profile: ParticipantProfile = {
                  name,
                  email: (obj.email || '').trim(),
                  notifiedMilestones: Array.isArray(obj.notifiedMilestones)
                    ? obj.notifiedMilestones.map(String)
                    : [],
                };
                participants[name] = profile;
                items.push(profile);
              }
            }
          }
          if (items.length > 0) {
            await replaceAllInStore(STORE_PARTICIPANTS, items);
          }
        }
      }
    } catch {
      // ignore
    }

    await setMetaValue('legacy_migrated_v4', true);
  }

  // Sort hikes descending by date so the newest appear first consistently
  hikes.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  plannedRoutes.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  return { hikes, plannedRoutes, participants };
}

export async function addLocalHike(hikeData: {
  name: string;
  distance: number;
  date: string;
  dateTo?: string;
  participants?: string;
  note?: string;
  activity?: HikeActivity;
  routes?: RoutePart[];
}): Promise<Hike> {
  const routes = serializeRoutesClean(hikeData.routes);
  const newHike: Hike = {
    id: `hike_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: hikeData.name.trim(),
    distance: hikeData.distance.toFixed(1),
    date: hikeData.date,
    rawDate: hikeData.date,
    dateTo: hikeData.dateTo || '',
    endDate: hikeData.dateTo || '',
    participants: (hikeData.participants || '').trim(),
    note: (hikeData.note || '').trim(),
    activity: hikeData.activity,
    routes,
    maps: routes,
  };
  await putInStore(STORE_HIKES, newHike);
  return newHike;
}

export async function updateLocalHike(
  id: string,
  hikeData: {
    name: string;
    distance: number;
    date: string;
    dateTo?: string;
    participants?: string;
    note?: string;
    activity?: HikeActivity;
    routes?: RoutePart[];
  }
): Promise<Hike> {
  const routes = serializeRoutesClean(hikeData.routes);
  const updated: Hike = {
    id,
    name: hikeData.name.trim(),
    distance: hikeData.distance.toFixed(1),
    date: hikeData.date,
    rawDate: hikeData.date,
    dateTo: hikeData.dateTo || '',
    endDate: hikeData.dateTo || '',
    participants: (hikeData.participants || '').trim(),
    note: (hikeData.note || '').trim(),
    activity: hikeData.activity,
    routes,
    maps: routes,
  };
  await putInStore(STORE_HIKES, updated);
  return updated;
}

export async function deleteLocalHike(id: string): Promise<void> {
  await deleteFromStore(STORE_HIKES, id);
}

export async function replaceAllLocalHikes(hikes: Hike[]): Promise<void> {
  await replaceAllInStore(STORE_HIKES, hikes);
}

export async function addLocalPlannedRoute(routeData: {
  name: string;
  distance: number;
  link?: string;
  note?: string;
  color?: string;
  routes: RoutePart[];
}): Promise<PlannedRoute> {
  const routes = serializeRoutesClean(routeData.routes);
  const newItem: PlannedRoute = {
    id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: routeData.name.trim(),
    distance: routeData.distance.toFixed(1),
    link: (routeData.link || routes[0]?.link || '').trim(),
    note: (routeData.note || '').trim(),
    color: routeData.color || '',
    gpxName: routes[0]?.gpxName || '',
    gpxData: routes[0]?.gpxData || null,
    coordinates: routes[0]?.coordinates || [],
    routes,
    createdAt: new Date().toISOString(),
  };
  await putInStore(STORE_PLANNED, newItem);
  return newItem;
}

export async function updateLocalPlannedRoute(
  id: string,
  routeData: {
    name: string;
    distance: number;
    link?: string;
    note?: string;
    color?: string;
    routes: RoutePart[];
  },
  existingCreatedAt?: string
): Promise<PlannedRoute> {
  const routes = serializeRoutesClean(routeData.routes);
  const updated: PlannedRoute = {
    id,
    name: routeData.name.trim(),
    distance: routeData.distance.toFixed(1),
    link: (routeData.link || routes[0]?.link || '').trim(),
    note: (routeData.note || '').trim(),
    color: routeData.color || '',
    gpxName: routes[0]?.gpxName || '',
    gpxData: routes[0]?.gpxData || null,
    coordinates: routes[0]?.coordinates || [],
    routes,
    createdAt: existingCreatedAt || new Date().toISOString(),
  };
  await putInStore(STORE_PLANNED, updated);
  return updated;
}

export async function deleteLocalPlannedRoute(id: string): Promise<void> {
  await deleteFromStore(STORE_PLANNED, id);
}

export async function replaceAllLocalPlannedRoutes(routes: PlannedRoute[]): Promise<void> {
  await replaceAllInStore(STORE_PLANNED, routes);
}

export async function saveLocalParticipantProfile(profile: ParticipantProfile): Promise<ParticipantProfile> {
  const clean: ParticipantProfile = {
    name: profile.name.trim(),
    email: profile.email.trim(),
    notifiedMilestones: Array.isArray(profile.notifiedMilestones)
      ? Array.from(new Set(profile.notifiedMilestones.map(String)))
      : [],
  };
  await putInStore(STORE_PARTICIPANTS, clean);
  return clean;
}

export async function replaceAllLocalParticipants(
  profiles: Record<string, ParticipantProfile>
): Promise<void> {
  const items = Object.values(profiles)
    .filter((p) => p && typeof p.name === 'string' && p.name.trim().length > 0)
    .map((p) => ({
      name: p.name.trim(),
      email: (p.email || '').trim(),
      notifiedMilestones: Array.isArray(p.notifiedMilestones)
        ? p.notifiedMilestones.map(String)
        : [],
    }));
  await replaceAllInStore(STORE_PARTICIPANTS, items);
}
