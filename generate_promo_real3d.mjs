import fs from 'fs';
import { execSync } from 'child_process';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 25;
const TOTAL_SEC = 26;
const TOTAL_FRAMES = FPS * TOTAL_SEC; // 650 frames

const TMP_DIR = '/tmp/promo_real3d';
fs.mkdirSync(TMP_DIR, { recursive: true });

// 1. Fetch real routes from original notebook (moje-hory)
console.log('1. Načítám trasy z původního zápisníku (moje-hory)...');
const app = initializeApp({ projectId: 'moje-hory' });
const db = getFirestore(app);
const snap = await getDocs(collection(db, 'vyslapy'));

const allRoutes = [];
let totalKm = 0;
let totalAscent = 0;

snap.forEach((doc) => {
  const d = doc.data();
  let pts = [];
  if (typeof d.routePoints === 'string') {
    try { pts = JSON.parse(d.routePoints); } catch {}
  } else if (Array.isArray(d.routePoints)) {
    pts = d.routePoints;
  }
  const cleanPts = pts
    .map((p) => {
      if (Array.isArray(p)) return { lat: Number(p[0]), lon: Number(p[1]), ele: Number(p[2] || 0) };
      return { lat: Number(p.lat), lon: Number(p.lon ?? p.lng), ele: Number(p.ele || 0) };
    })
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));

  const dist = Number(d.distance || 0);
  const asc = Number(d.elevationGain || d.ascent || 0);
  totalKm += dist;
  totalAscent += asc;

  if (cleanPts.length > 5) {
    allRoutes.push({
      id: doc.id,
      name: d.name || d.title || 'Horský výšlap',
      date: d.date || '2025',
      distance: dist,
      ascent: asc,
      points: cleanPts,
    });
  }
});

allRoutes.sort((a, b) => String(a.date).localeCompare(String(b.date)));

// 2. Parse real GPX route (Beskydy - Lysá hora) for authentic 3D Diorama Flyover
function parseGpxText(raw) {
  const pts = [];
  const regex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>[\s\S]*?<ele>([^<]+)<\/ele>[\s\S]*?<\/trkpt>/g;
  let m;
  while ((m = regex.exec(raw)) !== null) {
    pts.push({ lat: parseFloat(m[1]), lon: parseFloat(m[2]), ele: parseFloat(m[3]) });
  }
  return pts;
}
const lysaGpxRaw = fs.readFileSync('./public/assets/aistudio/2_e079fbcf.txt', 'utf8');
const lysaPointsFull = parseGpxText(lysaGpxRaw);
const lysaPoints = lysaPointsFull.filter((_, idx) => idx % 4 === 0 || idx === lysaPointsFull.length - 1);

// Compute cumulative distances along Lysá hora route
let cumDist = 0;
lysaPoints.forEach((p, idx) => {
  if (idx > 0) {
    const prev = lysaPoints[idx - 1];
    const dLat = (p.lat - prev.lat) * 111.32;
    const dLon = (p.lon - prev.lon) * 111.32 * Math.cos((p.lat * Math.PI) / 180);
    cumDist += Math.hypot(dLat, dLon);
  }
  p.dist = cumDist;
});
const totalLysaDist = cumDist || 16.2;

// 3. Download real 2D Beskydy map tiles (Zoom 11)
console.log('2. Stahuji mapový podklad Beskyd (Zoom 11)...');
const Z2D = 11;
const X_MIN_2D = 1126, X_MAX_2D = 1130; // 5 tiles
const Y_MIN_2D = 701, Y_MAX_2D = 703;   // 3 tiles
const TILE_W_2D = (X_MAX_2D - X_MIN_2D + 1) * 256;
const TILE_H_2D = (Y_MAX_2D - Y_MIN_2D + 1) * 256;
const mapRgb2D = Buffer.alloc(TILE_W_2D * TILE_H_2D * 3);

for (let ty = Y_MIN_2D; ty <= Y_MAX_2D; ty++) {
  for (let tx = X_MIN_2D; tx <= X_MAX_2D; tx++) {
    const pngPath = `${TMP_DIR}/t2d_${tx}_${ty}.png`;
    const rgbPath = `${TMP_DIR}/t2d_${tx}_${ty}.rgb`;
    const url = `https://a.tile.openstreetmap.org/${Z2D}/${tx}/${ty}.png`;
    try {
      if (!fs.existsSync(rgbPath)) {
        execSync(`curl -s -L -A "HorskyZapisnikPromo/1.0" "${url}" -o "${pngPath}"`);
        execSync(`ffmpeg -y -loglevel error -i "${pngPath}" -f rawvideo -pix_fmt rgb24 "${rgbPath}"`);
      }
      const tileBuf = fs.readFileSync(rgbPath);
      const ox = (tx - X_MIN_2D) * 256;
      const oy = (ty - Y_MIN_2D) * 256;
      for (let r = 0; r < 256; r++) {
        const srcStart = r * 256 * 3;
        const dstStart = ((oy + r) * TILE_W_2D + ox) * 3;
        tileBuf.copy(mapRgb2D, dstStart, srcStart, srcStart + 256 * 3);
      }
    } catch {}
  }
}

// 4. Download real 3D Diorama tiles for Lysá hora (Zoom 13 Map + AWS Terrarium DEM Elevation)
console.log('3. Stahuji 3D výšková data (AWS Terrarium DEM) a mapovou texturu Lysé hory (Zoom 13)...');
const Z3D = 13;
const X_MIN_3D = 4514, X_MAX_3D = 4517; // 4 tiles wide (1024px)
const Y_MIN_3D = 2807, Y_MAX_3D = 2810; // 4 tiles high (1024px)
const TEX_W = (X_MAX_3D - X_MIN_3D + 1) * 256;
const TEX_H = (Y_MAX_3D - Y_MIN_3D + 1) * 256;
const texRgb3D = Buffer.alloc(TEX_W * TEX_H * 3);
const demRgb3D = Buffer.alloc(TEX_W * TEX_H * 3);

for (let ty = Y_MIN_3D; ty <= Y_MAX_3D; ty++) {
  for (let tx = X_MIN_3D; tx <= X_MAX_3D; tx++) {
    const ox = (tx - X_MIN_3D) * 256;
    const oy = (ty - Y_MIN_3D) * 256;
    // Map texture tile
    try {
      const pngPath = `${TMP_DIR}/m3d_${tx}_${ty}.png`;
      const rgbPath = `${TMP_DIR}/m3d_${tx}_${ty}.rgb`;
      const url = `https://a.tile.openstreetmap.org/${Z3D}/${tx}/${ty}.png`;
      if (!fs.existsSync(rgbPath)) {
        execSync(`curl -s -L -A "HorskyZapisnikPromo/1.0" "${url}" -o "${pngPath}"`);
        execSync(`ffmpeg -y -loglevel error -i "${pngPath}" -f rawvideo -pix_fmt rgb24 "${rgbPath}"`);
      }
      const tileBuf = fs.readFileSync(rgbPath);
      for (let r = 0; r < 256; r++) {
        tileBuf.copy(texRgb3D, ((oy + r) * TEX_W + ox) * 3, r * 256 * 3, (r + 1) * 256 * 3);
      }
    } catch {}
    // AWS Terrarium DEM elevation tile
    try {
      const pngPath = `${TMP_DIR}/dem_${tx}_${ty}.png`;
      const rgbPath = `${TMP_DIR}/dem_${tx}_${ty}.rgb`;
      const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z3D}/${tx}/${ty}.png`;
      if (!fs.existsSync(rgbPath)) {
        execSync(`curl -s -L -A "HorskyZapisnikPromo/1.0" "${url}" -o "${pngPath}"`);
        execSync(`ffmpeg -y -loglevel error -i "${pngPath}" -f rawvideo -pix_fmt rgb24 "${rgbPath}"`);
      }
      const tileBuf = fs.readFileSync(rgbPath);
      for (let r = 0; r < 256; r++) {
        tileBuf.copy(demRgb3D, ((oy + r) * TEX_W + ox) * 3, r * 256 * 3, (r + 1) * 256 * 3);
      }
    } catch {}
  }
}

function lonToTileX(lon, z) {
  return ((lon + 180) / 360) * Math.pow(2, z);
}
function latToTileY(lat, z) {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z);
}

// Bounding box for the 3D Tabletop Diorama (Lysá hora & Ostravice / Šance valley)
let minLat3D = Infinity, maxLat3D = -Infinity, minLon3D = Infinity, maxLon3D = -Infinity;
for (const p of lysaPoints) {
  if (p.lat < minLat3D) minLat3D = p.lat;
  if (p.lat > maxLat3D) maxLat3D = p.lat;
  if (p.lon < minLon3D) minLon3D = p.lon;
  if (p.lon > maxLon3D) maxLon3D = p.lon;
}
const padLat = (maxLat3D - minLat3D) * 0.24;
const padLon = (maxLon3D - minLon3D) * 0.28;
minLat3D -= padLat; maxLat3D += padLat;
minLon3D -= padLon; maxLon3D += padLon;

// Sample real DEM elevation & map texture at (lat, lon)
function sampleDemEle(lat, lon) {
  const px = Math.max(0, Math.min(TEX_W - 1, Math.round((lonToTileX(lon, Z3D) - X_MIN_3D) * 256)));
  const py = Math.max(0, Math.min(TEX_H - 1, Math.round((latToTileY(lat, Z3D) - Y_MIN_3D) * 256)));
  const idx = (py * TEX_W + px) * 3;
  const r = demRgb3D[idx];
  const g = demRgb3D[idx + 1];
  const b = demRgb3D[idx + 2];
  const ele = r * 256 + g + b / 256 - 32768;
  return (Number.isFinite(ele) && ele > 100 && ele < 3000) ? ele : 500;
}

function sampleMapTex(lat, lon) {
  const px = Math.max(0, Math.min(TEX_W - 1, Math.round((lonToTileX(lon, Z3D) - X_MIN_3D) * 256)));
  const py = Math.max(0, Math.min(TEX_H - 1, Math.round((latToTileY(lat, Z3D) - Y_MIN_3D) * 256)));
  const idx = (py * TEX_W + px) * 3;
  return [texRgb3D[idx], texRgb3D[idx + 1], texRgb3D[idx + 2]];
}

// Build 3D Diorama Grid matching Terrain3DMap.tsx (planeWidth = 100, planeHeight = 76)
const GRID_W = 136;
const GRID_H = 104;
const PLANE_W = 100;
const PLANE_H = 76;
const BASE_SOIL = 4.5;
const EXAGGERATION = 2.15;

// Compute real min/max elevation across the diorama grid
const rawGridEle = new Float32Array(GRID_W * GRID_H);
let minDemEle = Infinity, maxDemEle = -Infinity;
for (let gz = 0; gz < GRID_H; gz++) {
  const v = gz / (GRID_H - 1);
  const lat = maxLat3D - v * (maxLat3D - minLat3D);
  for (let gx = 0; gx < GRID_W; gx++) {
    const u = gx / (GRID_W - 1);
    const lon = minLon3D + u * (maxLon3D - minLon3D);
    // 3x3 box filter smooth for silky terrain mesh
    let sum = 0;
    const dLat = (maxLat3D - minLat3D) / GRID_H * 0.6;
    const dLon = (maxLon3D - minLon3D) / GRID_W * 0.6;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        sum += sampleDemEle(lat + dy * dLat, lon + dx * dLon);
      }
    }
    const ele = sum / 9;
    rawGridEle[gz * GRID_W + gx] = ele;
    if (ele < minDemEle) minDemEle = ele;
    if (ele > maxDemEle) maxDemEle = ele;
  }
}

const latSpanMeters = (maxLat3D - minLat3D) * 111320;
const lonSpanMeters = (maxLon3D - minLon3D) * 111320 * Math.cos(((minLat3D + maxLat3D) * 0.5 * Math.PI) / 180);
const metersToWorldY = (PLANE_W / lonSpanMeters) * EXAGGERATION;

function eleToWorldY(ele) {
  return BASE_SOIL + Math.max(0, ele - minDemEle) * metersToWorldY;
}

function latLonToWorld(lat, lon, eleOffset = 0.35) {
  const u = (lon - minLon3D) / (maxLon3D - minLon3D);
  const v = (maxLat3D - lat) / (maxLat3D - minLat3D);
  const x = (u - 0.5) * PLANE_W;
  const z = (v - 0.5) * PLANE_H;
  const demEle = sampleDemEle(lat, lon);
  const y = eleToWorldY(demEle) + eleOffset;
  return { x, y, z, demEle };
}

// Precompute 3D vertices and pre-lit map colors for every grid cell
const gridVerts = new Array(GRID_W * GRID_H);
const gridColors = new Array(GRID_W * GRID_H);

for (let gz = 0; gz < GRID_H; gz++) {
  const v = gz / (GRID_H - 1);
  const lat = maxLat3D - v * (maxLat3D - minLat3D);
  for (let gx = 0; gx < GRID_W; gx++) {
    const u = gx / (GRID_W - 1);
    const lon = minLon3D + u * (maxLon3D - minLon3D);
    const x = (u - 0.5) * PLANE_W;
    const z = (v - 0.5) * PLANE_H;
    const ele = rawGridEle[gz * GRID_W + gx];
    const y = eleToWorldY(ele);
    gridVerts[gz * GRID_W + gx] = { x, y, z, ele };
  }
}

// Compute directional alpine sun shading + map texture color per grid cell
// Sun from WNW: (-0.65, 0.62, -0.35)
const sunX = -0.65, sunY = 0.65, sunZ = -0.38;
const sunLen = Math.hypot(sunX, sunY, sunZ);
const sX = sunX / sunLen, sY = sunY / sunLen, sZ = sunZ / sunLen;

for (let gz = 0; gz < GRID_H; gz++) {
  const v = gz / (GRID_H - 1);
  const lat = maxLat3D - v * (maxLat3D - minLat3D);
  for (let gx = 0; gx < GRID_W; gx++) {
    const u = gx / (GRID_W - 1);
    const lon = minLon3D + u * (maxLon3D - minLon3D);
    const [tr, tg, tb] = sampleMapTex(lat, lon);

    const xm = gridVerts[gz * GRID_W + Math.max(0, gx - 1)];
    const xp = gridVerts[gz * GRID_W + Math.min(GRID_W - 1, gx + 1)];
    const zm = gridVerts[Math.max(0, gz - 1) * GRID_W + gx];
    const zp = gridVerts[Math.min(GRID_H - 1, gz + 1) * GRID_W + gx];

    // Surface normal via cross product
    const dxY = xp.y - xm.y;
    const dxX = xp.x - xm.x || 1;
    const dzY = zp.y - zm.y;
    const dzZ = zp.z - zm.z || 1;
    let nx = -dxY / dxX;
    let ny = 1.0;
    let nz = -dzY / dzZ;
    const nLen = Math.hypot(nx, ny, nz) || 1;
    nx /= nLen; ny /= nLen; nz /= nLen;

    const dot = Math.max(0, nx * sX + ny * sY + nz * sZ);
    const curV = gridVerts[gz * GRID_W + gx];
    const hNorm = (curV.ele - minDemEle) / Math.max(1, maxDemEle - minDemEle);
    const ao = 0.85 + 0.18 * hNorm;
    const light = Math.min(1.22, (0.58 + 0.62 * dot) * ao);

    gridColors[gz * GRID_W + gx] = [
      Math.min(255, Math.max(0, Math.round(tr * light))),
      Math.min(255, Math.max(0, Math.round(tg * light))),
      Math.min(255, Math.max(0, Math.round(tb * light))),
    ];
  }
}

// Convert Lysá hora route points to 3D diorama world coords
const lysaWorldPts = lysaPoints.map((p) => {
  const w = latLonToWorld(p.lat, p.lon, 0.42);
  return { ...p, wx: w.x, wy: w.y, wz: w.z };
});

// Find highest point (Lysá hora summit 1323 m)
let summitPt = lysaWorldPts[0];
for (const p of lysaWorldPts) {
  if (p.ele > summitPt.ele) summitPt = p;
}

// Beskydy 2D bounding box for Scene 2
const LON_MIN = 18.08, LON_MAX = 18.78;
const LAT_MIN = 49.40, LAT_MAX = 49.68;
const beskydyRoutes = allRoutes.filter((r) => {
  const p = r.points[0];
  return p.lat >= 49.35 && p.lat <= 49.72 && p.lon >= 17.95 && p.lon <= 18.85;
});

function latLonToScreen2D(lat, lon) {
  const u = (lon - LON_MIN) / (LON_MAX - LON_MIN);
  const v = 1 - (lat - LAT_MIN) / (LAT_MAX - LAT_MIN);
  return { x: Math.round(60 + u * (WIDTH - 120)), y: Math.round(130 + v * (HEIGHT - 190)) };
}

// Prepare 2D Map Background Buffer
const bgMapFrame = Buffer.alloc(WIDTH * HEIGHT * 3);
const txMin = lonToTileX(LON_MIN, Z2D), txMax = lonToTileX(LON_MAX, Z2D);
const tyMin = latToTileY(LAT_MAX, Z2D), tyMax = latToTileY(LAT_MIN, Z2D);

for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    const u = x / WIDTH, v = y / HEIGHT;
    const tx = txMin + u * (txMax - txMin);
    const ty = tyMin + v * (tyMax - tyMin);
    const px = Math.max(0, Math.min(TILE_W_2D - 1, Math.floor((tx - X_MIN_2D) * 256)));
    const py = Math.max(0, Math.min(TILE_H_2D - 1, Math.floor((ty - Y_MIN_2D) * 256)));
    const srcIdx = (py * TILE_W_2D + px) * 3;
    const dstIdx = (y * WIDTH + x) * 3;
    const lum = 0.299 * mapRgb2D[srcIdx] + 0.587 * mapRgb2D[srcIdx + 1] + 0.114 * mapRgb2D[srcIdx + 2];
    bgMapFrame[dstIdx]     = Math.min(255, Math.floor(lum * 0.16 + 12));
    bgMapFrame[dstIdx + 1] = Math.min(255, Math.floor(lum * 0.23 + 20));
    bgMapFrame[dstIdx + 2] = Math.min(255, Math.floor(lum * 0.31 + 34));
  }
}

// Drawing primitives
function setPixel(buf, x, y, r, g, b, alpha = 1) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const idx = (y * WIDTH + x) * 3;
  if (alpha >= 0.99) {
    buf[idx] = r; buf[idx + 1] = g; buf[idx + 2] = b;
  } else {
    buf[idx]     = Math.round(buf[idx] * (1 - alpha) + r * alpha);
    buf[idx + 1] = Math.round(buf[idx + 1] * (1 - alpha) + g * alpha);
    buf[idx + 2] = Math.round(buf[idx + 2] * (1 - alpha) + b * alpha);
  }
}

function fillRect(buf, x0, y0, w, h, r, g, b, alpha = 1) {
  const xs = Math.max(0, Math.floor(x0)), xe = Math.min(WIDTH - 1, Math.floor(x0 + w));
  const ys = Math.max(0, Math.floor(y0)), ye = Math.min(HEIGHT - 1, Math.floor(y0 + h));
  for (let y = ys; y <= ye; y++) {
    for (let x = xs; x <= xe; x++) {
      setPixel(buf, x, y, r, g, b, alpha);
    }
  }
}

function strokeRect(buf, x0, y0, w, h, thickness, r, g, b, alpha = 1) {
  fillRect(buf, x0, y0, w, thickness, r, g, b, alpha);
  fillRect(buf, x0, y0 + h - thickness, w, thickness, r, g, b, alpha);
  fillRect(buf, x0, y0, thickness, h, r, g, b, alpha);
  fillRect(buf, x0 + w - thickness, y0, thickness, h, r, g, b, alpha);
}

function drawCircle(buf, cx, cy, rad, r, g, b, alpha = 1) {
  const r2 = rad * rad;
  const x0 = Math.max(0, Math.floor(cx - rad)), x1 = Math.min(WIDTH - 1, Math.ceil(cx + rad));
  const y0 = Math.max(0, Math.floor(cy - rad)), y1 = Math.min(HEIGHT - 1, Math.ceil(cy + rad));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) {
        setPixel(buf, x, y, r, g, b, alpha);
      }
    }
  }
}

function drawLine(buf, x0, y0, x1, y1, thickness, r, g, b, alpha = 1) {
  const dx = x1 - x0, dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    drawCircle(buf, Math.round(x0 + dx * t), Math.round(y0 + dy * t), thickness, r, g, b, alpha);
  }
}

// Fast Z-buffered triangle rasterizer for the 3D Tabletop Diorama
const zBuffer = new Float32Array(WIDTH * HEIGHT);

function fillTriangleZ(buf, x0, y0, z0, x1, y1, z1, x2, y2, z2, r, g, b) {
  const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
  const maxX = Math.min(WIDTH - 1, Math.ceil(Math.max(x0, x1, x2)));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
  const maxY = Math.min(HEIGHT - 1, Math.ceil(Math.max(y0, y1, y2)));
  if (minX > maxX || minY > maxY) return;

  const denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  if (Math.abs(denom) < 0.0001) return;
  const invDenom = 1.0 / denom;

  for (let py = minY; py <= maxY; py++) {
    const pyCenter = py + 0.5;
    for (let px = minX; px <= maxX; px++) {
      const pxCenter = px + 0.5;
      const w0 = ((y1 - y2) * (pxCenter - x2) + (x2 - x1) * (pyCenter - y2)) * invDenom;
      if (w0 < -0.001) continue;
      const w1 = ((y2 - y0) * (pxCenter - x2) + (x0 - x2) * (pyCenter - y2)) * invDenom;
      if (w1 < -0.001) continue;
      const w2 = 1.0 - w0 - w1;
      if (w2 < -0.001) continue;

      const z = w0 * z0 + w1 * z1 + w2 * z2;
      const bIdx = py * WIDTH + px;
      if (z < zBuffer[bIdx]) {
        zBuffer[bIdx] = z;
        const cIdx = bIdx * 3;
        buf[cIdx] = r;
        buf[cIdx + 1] = g;
        buf[cIdx + 2] = b;
      }
    }
  }
}

// 3D Camera projection helper
function makeCamera(camPos, lookAt, fovScale = 820) {
  let fx = lookAt.x - camPos.x;
  let fy = lookAt.y - camPos.y;
  let fz = lookAt.z - camPos.z;
  const fLen = Math.hypot(fx, fy, fz) || 1;
  fx /= fLen; fy /= fLen; fz /= fLen;

  // Right = cross(forward, worldUp(0,1,0)) -> (-fz, 0, fx)
  let rx = -fz, ry = 0, rz = fx;
  const rLen = Math.hypot(rx, ry, rz) || 1;
  rx /= rLen; ry /= rLen; rz /= rLen;

  // Up = cross(right, forward)
  const ux = ry * fz - rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy - ry * fx;

  return function project(wx, wy, wz) {
    const dx = wx - camPos.x;
    const dy = wy - camPos.y;
    const dz = wz - camPos.z;
    const cx = dx * rx + dy * ry + dz * rz;
    const cy = dx * ux + dy * uy + dz * uz;
    const cz = dx * fx + dy * fy + dz * fz;
    if (cz <= 1.5) return null;
    return {
      x: WIDTH * 0.5 + (cx / cz) * fovScale,
      y: HEIGHT * 0.47 - (cy / cz) * fovScale,
      z: cz,
    };
  };
}

// Render the authentic Terrain3DMap.tsx + Route3DView.tsx 3D Diorama Scene!
function renderAuthentic3DDiorama(buf, progress) {
  // 1. Dark slate background matching Terrain3DMap.tsx (0x0f172a)
  for (let y = 0; y < HEIGHT; y++) {
    const rowIdx = y * WIDTH * 3;
    for (let x = 0; x < WIDTH; x++) {
      const idx = rowIdx + x * 3;
      buf[idx] = 15;
      buf[idx + 1] = 23;
      buf[idx + 2] = 42;
    }
  }
  zBuffer.fill(1e9);

  // Active route point along Lysá hora flyover (progress 0.0 -> 1.0)
  const routeProgress = Math.min(1, Math.max(0, (progress - 0.04) / 0.90));
  const activeFloatIdx = routeProgress * (lysaWorldPts.length - 1);
  const activeIdx = Math.min(lysaWorldPts.length - 1, Math.floor(activeFloatIdx));
  const nextIdx = Math.min(lysaWorldPts.length - 1, activeIdx + 1);
  const frac = activeFloatIdx - activeIdx;
  const pA = lysaWorldPts[activeIdx];
  const pB = lysaWorldPts[nextIdx];
  const beacon = {
    x: pA.wx + (pB.wx - pA.wx) * frac,
    y: pA.wy + (pB.wy - pA.wy) * frac,
    z: pA.wz + (pB.wz - pA.wz) * frac,
    ele: Math.round(pA.ele + (pB.ele - pA.ele) * frac),
    dist: (pA.dist + (pB.dist - pA.dist) * frac).toFixed(1),
  };

  // Cinematic 3D camera orbit + flyover tracking the route on the 3D tabletop diorama
  // Starts with a majestic sweeping diorama overview from South-East to South-West while zooming closer to the trail
  const angle = 0.55 - progress * 1.18; // sweeps across the front of the diorama block
  const radius = 84 - Math.sin(progress * Math.PI) * 18;
  const camHeight = 46 - Math.sin(progress * Math.PI) * 10;

  const targetX = beacon.x * 0.45;
  const targetY = beacon.y * 0.55 + 4.5;
  const targetZ = beacon.z * 0.45;

  const camPos = {
    x: targetX + Math.sin(angle) * radius,
    y: camHeight,
    z: targetZ + Math.cos(angle) * radius,
  };
  const project = makeCamera(camPos, { x: targetX, y: targetY, z: targetZ }, 860);

  // Project all 3D terrain vertices
  const projVerts = new Array(GRID_W * GRID_H);
  for (let i = 0; i < gridVerts.length; i++) {
    const v = gridVerts[i];
    projVerts[i] = project(v.x, v.y, v.z);
  }

  // 2. Rasterize 3D Terrain Mesh with Real Cartographic Map Texture + Alpine Hillshading
  for (let gz = 0; gz < GRID_H - 1; gz++) {
    for (let gx = 0; gx < GRID_W - 1; gx++) {
      const i00 = gz * GRID_W + gx;
      const i10 = i00 + 1;
      const i01 = (gz + 1) * GRID_W + gx;
      const i11 = i01 + 1;

      const p00 = projVerts[i00];
      const p10 = projVerts[i10];
      const p01 = projVerts[i01];
      const p11 = projVerts[i11];
      if (!p00 || !p10 || !p01 || !p11) continue;

      const c0 = gridColors[i00];
      const c1 = gridColors[i11];

      fillTriangleZ(buf, p00.x, p00.y, p00.z, p10.x, p10.y, p10.z, p01.x, p01.y, p01.z, c0[0], c0[1], c0[2]);
      fillTriangleZ(buf, p10.x, p10.y, p10.z, p11.x, p11.y, p11.z, p01.x, p01.y, p01.z, c1[0], c1[1], c1[2]);
    }
  }

  // 3. Rasterize Geological Cross-Section Side Walls matching buildDioramaWallsGeometry in Terrain3DMap.tsx
  // Colors: topSoil #6b5344 (107,83,68), midRock #4a3b32 (74,59,50), deepBedrock #27211d (39,33,29)
  function drawWallColumn(vA, vB, shadeMult) {
    const yMidA = vA.y * 0.45;
    const yMidB = vB.y * 0.45;

    const tA = project(vA.x, vA.y, vA.z);
    const tB = project(vB.x, vB.y, vB.z);
    const mA = project(vA.x, yMidA, vA.z);
    const mB = project(vB.x, yMidB, vB.z);
    const bA = project(vA.x, 0, vA.z);
    const bB = project(vB.x, 0, vB.z);
    if (!tA || !tB || !mA || !mB || !bA || !bB) return;

    // Upper soil strata
    const r1 = Math.round(107 * shadeMult), g1 = Math.round(83 * shadeMult), b1 = Math.round(68 * shadeMult);
    fillTriangleZ(buf, tA.x, tA.y, tA.z, tB.x, tB.y, tB.z, mA.x, mA.y, mA.z, r1, g1, b1);
    fillTriangleZ(buf, tB.x, tB.y, tB.z, mB.x, mB.y, mB.z, mA.x, mA.y, mA.z, r1, g1, b1);

    // Lower bedrock strata
    const r2 = Math.round(54 * shadeMult), g2 = Math.round(43 * shadeMult), b2 = Math.round(37 * shadeMult);
    fillTriangleZ(buf, mA.x, mA.y, mA.z, mB.x, mB.y, mB.z, bA.x, bA.y, bA.z, r2, g2, b2);
    fillTriangleZ(buf, mB.x, mB.y, mB.z, bB.x, bB.y, bB.z, bA.x, bA.y, bA.z, r2, g2, b2);
  }

  // South wall (gz = GRID_H - 1)
  for (let gx = 0; gx < GRID_W - 1; gx++) {
    drawWallColumn(gridVerts[(GRID_H - 1) * GRID_W + gx], gridVerts[(GRID_H - 1) * GRID_W + gx + 1], 0.95);
  }
  // North wall (gz = 0)
  for (let gx = 0; gx < GRID_W - 1; gx++) {
    drawWallColumn(gridVerts[gx + 1], gridVerts[gx], 0.70);
  }
  // West wall (gx = 0)
  for (let gz = 0; gz < GRID_H - 1; gz++) {
    drawWallColumn(gridVerts[gz * GRID_W], gridVerts[(gz + 1) * GRID_W], 1.05);
  }
  // East wall (gx = GRID_W - 1)
  for (let gz = 0; gz < GRID_H - 1; gz++) {
    drawWallColumn(gridVerts[(gz + 1) * GRID_W + (GRID_W - 1)], gridVerts[gz * GRID_W + (GRID_W - 1)], 0.78);
  }

  // 4. Draw Vivid Purple/Fuchsia 3D Route Tube (#c026d3 with #3b0764 border) matching Terrain3DMap.tsx!
  const projRoute = lysaWorldPts.map((p) => project(p.wx, p.wy, p.wz));

  // First draw subtle full route preview (dark purple halo + muted purple core)
  for (let i = 1; i < projRoute.length; i++) {
    const a = projRoute[i - 1], b = projRoute[i];
    if (!a || !b) continue;
    drawLine(buf, a.x, a.y, b.x, b.y, 4, 59, 7, 100, 0.55);
    drawLine(buf, a.x, a.y, b.x, b.y, 2, 168, 85, 247, 0.55);
  }

  // Then draw active traversed 3D route tube in vivid purple/fuchsia (#c026d3 / #e879f9) with #3b0764 dark casing
  for (let i = 1; i <= activeIdx; i++) {
    const a = projRoute[i - 1], b = projRoute[i];
    if (!a || !b) continue;
    drawLine(buf, a.x, a.y, b.x, b.y, 6, 59, 7, 100, 0.95);    // #3b0764 outer border tube
    drawLine(buf, a.x, a.y, b.x, b.y, 4, 192, 38, 211, 1.0);   // #c026d3 main fuchsia/purple tube
    drawLine(buf, a.x, a.y, b.x, b.y, 1, 245, 208, 254, 0.9);  // bright specular core highlight
  }

  // 5. Draw 3D Terrain Pins (START, CÍL, and Lysá hora 1323 m Summit Pin)
  const startW = lysaWorldPts[0];
  const endW = lysaWorldPts[lysaWorldPts.length - 1];
  const pStartBase = project(startW.wx, startW.wy, startW.wz);
  const pStartTop = project(startW.wx, startW.wy + 3.2, startW.wz);
  if (pStartBase && pStartTop) {
    drawLine(buf, pStartBase.x, pStartBase.y, pStartTop.x, pStartTop.y, 1, 255, 255, 255, 0.95);
    drawCircle(buf, Math.round(pStartTop.x), Math.round(pStartTop.y), 7, 255, 255, 255, 1);
    drawCircle(buf, Math.round(pStartTop.x), Math.round(pStartTop.y), 5, 22, 163, 74, 1); // #16a34a START
  }

  const pEndBase = project(endW.wx, endW.wy, endW.wz);
  const pEndTop = project(endW.wx, endW.wy + 3.2, endW.wz);
  if (pEndBase && pEndTop) {
    drawLine(buf, pEndBase.x, pEndBase.y, pEndTop.x, pEndTop.y, 1, 255, 255, 255, 0.95);
    drawCircle(buf, Math.round(pEndTop.x), Math.round(pEndTop.y), 7, 255, 255, 255, 1);
    drawCircle(buf, Math.round(pEndTop.x), Math.round(pEndTop.y), 5, 220, 38, 38, 1); // #dc2626 CÍL
  }

  // Summit 3D Pin (Lysá hora 1323 m)
  const pSumBase = project(summitPt.wx, summitPt.wy, summitPt.wz);
  const pSumTop = project(summitPt.wx, summitPt.wy + 4.2, summitPt.wz);
  if (pSumBase && pSumTop) {
    drawLine(buf, pSumBase.x, pSumBase.y, pSumTop.x, pSumTop.y, 2, 255, 255, 255, 0.95);
    drawCircle(buf, Math.round(pSumTop.x), Math.round(pSumTop.y), 8, 255, 255, 255, 1);
    drawCircle(buf, Math.round(pSumTop.x), Math.round(pSumTop.y), 6, 217, 119, 6, 1); // #d97706 MAX peak
  }

  // 6. Draw Active Golden Flyover Beacon (#fbbf24 sphere + white ground ring) matching Terrain3DMap.tsx!
  const pBeacon = project(beacon.x, beacon.y + 0.55, beacon.z);
  if (pBeacon) {
    drawCircle(buf, Math.round(pBeacon.x), Math.round(pBeacon.y), 18, 251, 191, 36, 0.25);
    drawCircle(buf, Math.round(pBeacon.x), Math.round(pBeacon.y), 12, 255, 255, 255, 0.95);
    drawCircle(buf, Math.round(pBeacon.x), Math.round(pBeacon.y), 8, 251, 191, 36, 1.0); // #fbbf24
    drawCircle(buf, Math.round(pBeacon.x - 2), Math.round(pBeacon.y - 2), 3, 254, 243, 199, 1.0);
  }

  // 7. Authentic Route3DView.tsx HUD Overlays:
  // Top Center White Floating Control Bar
  fillRect(buf, 310, 18, 660, 46, 255, 255, 255, 0.95);
  strokeRect(buf, 310, 18, 660, 46, 1, 203, 213, 225, 1);
  // Active "Vrcholy" amber pill button inside top bar
  fillRect(buf, 835, 25, 122, 32, 245, 158, 11, 1);

  // Dark Telemetry Flyover Pill below top bar (bg-slate-900/95 border-amber-400/70)
  fillRect(buf, 465, 72, 350, 36, 15, 23, 42, 0.95);
  strokeRect(buf, 465, 72, 350, 36, 2, 251, 191, 36, 0.85);

  // Bottom White Translucent Elevation Profile Card matching Route3DView.tsx (bg-white/95)
  const cardX = 190, cardY = 548, cardW = 900, cardH = 154;
  fillRect(buf, cardX, cardY, cardW, cardH, 255, 255, 255, 0.95);
  strokeRect(buf, cardX, cardY, cardW, cardH, 1, 226, 232, 240, 1);

  // Render the 4-color slope grade elevation chart inside the bottom card
  const chartX = cardX + 28, chartY = cardY + 52, chartW = cardW - 56, chartH = 82;
  // Subtle horizontal grid lines
  fillRect(buf, chartX, chartY, chartW, 1, 226, 232, 240, 1);
  fillRect(buf, chartX, chartY + Math.round(chartH / 2), chartW, 1, 226, 232, 240, 1);
  fillRect(buf, chartX, chartY + chartH, chartW, 1, 203, 213, 225, 1);

  for (let i = 1; i < lysaWorldPts.length; i++) {
    const p0 = lysaWorldPts[i - 1], p1 = lysaWorldPts[i];
    const u0 = (i - 1) / (lysaWorldPts.length - 1);
    const u1 = i / (lysaWorldPts.length - 1);
    const x0 = Math.round(chartX + u0 * chartW);
    const x1 = Math.round(chartX + u1 * chartW);
    const y0 = Math.round(chartY + chartH - ((p0.ele - 450) / 920) * chartH);
    const y1 = Math.round(chartY + chartH - ((p1.ele - 450) / 920) * chartH);

    // Slope percentage color matching Route3DView.tsx (#10b981, #3b82f6, #f59e0b, #e11d48)
    const dKm = Math.max(0.005, p1.dist - p0.dist);
    const grade = (Math.abs(p1.ele - p0.ele) / (dKm * 1000)) * 100;
    let cr = 16, cg = 185, cb = 129; // #10b981 (<5%)
    if (grade > 15) { cr = 225; cg = 29; cb = 72; }        // #e11d48 (>15%)
    else if (grade > 10) { cr = 245; cg = 158; cb = 11; }  // #f59e0b (10-15%)
    else if (grade > 5) { cr = 59; cg = 130; cb = 246; }   // #3b82f6 (5-10%)

    // Soft area fill under curve
    for (let xx = x0; xx <= x1; xx++) {
      const t = x1 === x0 ? 0 : (xx - x0) / (x1 - x0);
      const yy = Math.round(y0 + (y1 - y0) * t);
      for (let fy = yy; fy <= chartY + chartH; fy++) {
        setPixel(buf, xx, fy, cr, cg, cb, i <= activeIdx ? 0.26 : 0.10);
      }
    }
    drawLine(buf, x0, y0, x1, y1, 2, cr, cg, cb, i <= activeIdx ? 1.0 : 0.45);
  }

  // Synchronized red/amber active flyover marker on the elevation profile chart
  const curChartX = Math.round(chartX + routeProgress * chartW);
  const curChartY = Math.round(chartY + chartH - ((beacon.ele - 450) / 920) * chartH);
  fillRect(buf, curChartX - 1, chartY, 2, chartH, 245, 158, 11, 0.75);
  drawCircle(buf, curChartX, curChartY, 7, 255, 255, 255, 1);
  drawCircle(buf, curChartX, curChartY, 5, 239, 68, 68, 1); // #ef4444 active profile dot

  return { beacon, pSumTop, pStartTop, pEndTop, routeProgress };
}

console.log(`4. Generuji ${TOTAL_FRAMES} snímků videa s reálným 3D dioramem z aplikace...`);

for (let f = 0; f < TOTAL_FRAMES; f++) {
  const t = f / FPS;
  const frame = Buffer.alloc(WIDTH * HEIGHT * 3);

  if (t < 4.0) {
    // SCENE 1: Opening Title
    bgMapFrame.copy(frame);
    fillRect(frame, 0, 0, WIDTH, HEIGHT, 9, 14, 24, 0.58);
    for (let i = 0; i < Math.min(18, beskydyRoutes.length); i++) {
      const pts = beskydyRoutes[i].points;
      for (let j = 1; j < pts.length; j += 3) {
        const p0 = latLonToScreen2D(pts[j - 1].lat, pts[j - 1].lon);
        const p1 = latLonToScreen2D(pts[j].lat, pts[j].lon);
        drawLine(frame, p0.x, p0.y, p1.x, p1.y, 1, 16, 185, 129, 0.25);
      }
    }
    fillRect(frame, 180, 145, 920, 430, 15, 23, 42, 0.88);
    strokeRect(frame, 180, 145, 920, 430, 2, 16, 185, 129, 0.7);
    fillRect(frame, 480, 182, 320, 38, 16, 185, 129, 0.2);
    strokeRect(frame, 480, 182, 320, 38, 1, 16, 185, 129, 0.8);
    fillRect(frame, 235, 420, 250, 108, 30, 41, 59, 0.95);
    strokeRect(frame, 235, 420, 250, 108, 1, 56, 189, 248, 0.5);
    fillRect(frame, 515, 420, 250, 108, 30, 41, 59, 0.95);
    strokeRect(frame, 515, 420, 250, 108, 1, 16, 185, 129, 0.5);
    fillRect(frame, 795, 420, 250, 108, 30, 41, 59, 0.95);
    strokeRect(frame, 795, 420, 250, 108, 1, 251, 191, 36, 0.5);

  } else if (t < 11.0) {
    // SCENE 2: 2D Map of Beskydy with progressive drawing of all 48 Beskydy routes
    bgMapFrame.copy(frame);
    const sceneProgress = Math.min(1, (t - 4.0) / 5.8);
    const routesToShow = Math.max(1, Math.floor(sceneProgress * beskydyRoutes.length));
    const palette = [
      [16, 185, 129],
      [56, 189, 248],
      [251, 191, 36],
      [244, 63, 94],
      [168, 85, 247],
    ];
    for (let i = 0; i < routesToShow; i++) {
      const r = beskydyRoutes[i];
      const col = palette[i % palette.length];
      const isNewest = i === routesToShow - 1;
      const pts = r.points;
      const step = pts.length > 250 ? 2 : 1;
      for (let j = step; j < pts.length; j += step) {
        const p0 = latLonToScreen2D(pts[j - 1].lat, pts[j - 1].lon);
        const p1 = latLonToScreen2D(pts[j].lat, pts[j].lon);
        drawLine(frame, p0.x, p0.y, p1.x, p1.y, isNewest ? 3 : 2, col[0], col[1], col[2], isNewest ? 1.0 : 0.78);
      }
      const startPt = latLonToScreen2D(pts[0].lat, pts[0].lon);
      drawCircle(frame, startPt.x, startPt.y, isNewest ? 5 : 3, 255, 255, 255, 0.95);
    }
    fillRect(frame, 36, 22, 1208, 84, 15, 23, 42, 0.9);
    strokeRect(frame, 36, 22, 1208, 84, 2, 16, 185, 129, 0.65);
    fillRect(frame, 36, 616, 540, 78, 15, 23, 42, 0.9);
    strokeRect(frame, 36, 616, 540, 78, 1, 56, 189, 248, 0.6);

  } else if (t < 18.5) {
    // SCENE 3: REAL 3D DIORAMA & FLYOVER matching Terrain3DMap.tsx + Route3DView.tsx!
    const p3d = (t - 11.0) / 7.5;
    renderAuthentic3DDiorama(frame, p3d);

  } else if (t < 22.5) {
    // SCENE 4: Detailed Elevation Profile & Seasonal Stats
    bgMapFrame.copy(frame);
    fillRect(frame, 0, 0, WIDTH, HEIGHT, 9, 14, 25, 0.84);
    fillRect(frame, 50, 28, 1180, 78, 15, 23, 42, 0.92);
    strokeRect(frame, 50, 28, 1180, 78, 2, 56, 189, 248, 0.6);

    fillRect(frame, 50, 128, 700, 540, 15, 23, 42, 0.92);
    strokeRect(frame, 50, 128, 700, 540, 1, 148, 163, 184, 0.35);

    const p4 = Math.min(1, (t - 18.5) / 2.8);
    const gx0 = 90, gy0 = 590, gw = 620, gh = 330;
    for (let l = 0; l <= 4; l++) {
      const ly = Math.round(gy0 - (l / 4) * gh);
      drawLine(frame, gx0, ly, gx0 + gw, ly, 1, 51, 65, 85, 0.6);
    }
    const maxIdx = Math.max(2, Math.floor(p4 * (lysaPoints.length - 1)));
    for (let i = 1; i <= maxIdx; i++) {
      const u0 = (i - 1) / (lysaPoints.length - 1);
      const u1 = i / (lysaPoints.length - 1);
      const x0 = Math.round(gx0 + u0 * gw);
      const x1 = Math.round(gx0 + u1 * gw);
      const y0 = Math.round(gy0 - ((lysaPoints[i - 1].ele - 450) / 920) * gh);
      const y1 = Math.round(gy0 - ((lysaPoints[i].ele - 450) / 920) * gh);
      const dKm = Math.max(0.005, lysaPoints[i].dist - lysaPoints[i - 1].dist);
      const grade = (Math.abs(lysaPoints[i].ele - lysaPoints[i - 1].ele) / (dKm * 1000)) * 100;
      let cr = 16, cg = 185, cb = 129;
      if (grade > 15) { cr = 225; cg = 29; cb = 72; }
      else if (grade > 10) { cr = 245; cg = 158; cb = 11; }
      else if (grade > 5) { cr = 59; cg = 130; cb = 246; }
      for (let x = x0; x <= x1; x++) {
        const yf = Math.round(y0 + ((y1 - y0) * (x - x0)) / Math.max(1, x1 - x0));
        for (let y = yf; y <= gy0; y++) setPixel(frame, x, y, cr, cg, cb, 0.25);
      }
      drawLine(frame, x0, y0, x1, y1, 3, cr, cg, cb, 1.0);
    }

    fillRect(frame, 780, 128, 450, 540, 15, 23, 42, 0.92);
    strokeRect(frame, 780, 128, 450, 540, 1, 148, 163, 184, 0.35);
    const months = [52, 78, 96, 138, 178, 220, 240, 210, 165, 120];
    for (let m = 0; m < months.length; m++) {
      const bx = 815 + m * 39;
      const bh = Math.round(months[m] * p4);
      const by = 590 - bh;
      fillRect(frame, bx, by, 26, bh, 56, 189, 248, 0.85);
      strokeRect(frame, bx, by, 26, bh, 1, 125, 211, 252, 1);
    }

  } else {
    // SCENE 5: Price-Free Closing Summary & Call to Action
    bgMapFrame.copy(frame);
    fillRect(frame, 0, 0, WIDTH, HEIGHT, 9, 14, 24, 0.65);
    for (let i = 0; i < beskydyRoutes.length; i++) {
      const pts = beskydyRoutes[i].points;
      for (let j = 2; j < pts.length; j += 2) {
        const p0 = latLonToScreen2D(pts[j - 2].lat, pts[j - 2].lon);
        const p1 = latLonToScreen2D(pts[j].lat, pts[j].lon);
        drawLine(frame, p0.x, p0.y, p1.x, p1.y, 1, 16, 185, 129, 0.32);
      }
    }
    fillRect(frame, 170, 110, 940, 500, 15, 23, 42, 0.93);
    strokeRect(frame, 170, 110, 940, 500, 2, 16, 185, 129, 0.85);
    fillRect(frame, 330, 485, 620, 74, 16, 185, 129, 0.95);
    strokeRect(frame, 330, 485, 620, 74, 2, 167, 243, 208, 1);
  }

  const framePath = `${TMP_DIR}/frame_${String(f).padStart(4, '0')}.rgb`;
  fs.writeFileSync(framePath, frame);
}

console.log('5. Sestavuji MP4 video s autentickými popisky 3D scény (bez ceny)...');

const BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const REG = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

const drawFilters = [
  // SCENE 1 (0 - 4s)
  `drawtext=expansion=none:fontfile=${BOLD}:text='HORSKÝ ZÁPISNÍK  v4.1 PRO':fontcolor=0x34d399:fontsize=20:x=(w-text_w)/2:y=191:enable='between(t,0,4)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='Váš osobní 2D a 3D archív horských výšlapů':fontcolor=white:fontsize=38:x=(w-text_w)/2:y=258:enable='between(t,0,4)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='Interaktivní GPX mapy  •  3D přelet terénem  •  Výškové profily  •  Google Drive':fontcolor=0x94a3b8:fontsize=21:x=(w-text_w)/2:y=328:enable='between(t,0,4)'`,

  `drawtext=expansion=none:fontfile=${BOLD}:text='${allRoutes.length} VÝŠLAPŮ':fontcolor=0x38bdf8:fontsize=30:x=275:y=444:enable='between(t,0,4)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='v původním zápisníku':fontcolor=0xcbd5e1:fontsize=16:x=275:y=486:enable='between(t,0,4)'`,

  `drawtext=expansion=none:fontfile=${BOLD}:text='${Math.round(totalKm)} KM':fontcolor=0x34d399:fontsize=30:x=572:y=444:enable='between(t,0,4)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='nachoděno v horách':fontcolor=0xcbd5e1:fontsize=16:x=562:y=486:enable='between(t,0,4)'`,

  `drawtext=expansion=none:fontfile=${BOLD}:text='+${Math.round(totalAscent)} M':fontcolor=0xfbbf24:fontsize=30:x=835:y=444:enable='between(t,0,4)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='celkové převýšení':fontcolor=0xcbd5e1:fontsize=16:x=845:y=486:enable='between(t,0,4)'`,

  // SCENE 2 (4 - 11s): 2D Map of Beskydy
  `drawtext=expansion=none:fontfile=${BOLD}:text='ARCHÍV VŠECH TRAS NA JEDNÉ INTERAKTIVNÍ MAPĚ':fontcolor=white:fontsize=25:x=64:y=38:enable='between(t,4,11)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='Reálná data z původního zápisníku: Moravskoslezské Beskydy (${beskydyRoutes.length} zaznamenaných tras)':fontcolor=0x34d399:fontsize=18:x=64:y=72:enable='between(t,4,11)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='Lysá hora  •  Smrk  •  Radhošť  •  Travný  •  Ropice':fontcolor=0x38bdf8:fontsize=20:x=58:y=632:enable='between(t,4,11)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='Automatická detekce zdolaných vrcholů a kompletní GPX záznamy':fontcolor=0xe2e8f0:fontsize=16:x=58:y=662:enable='between(t,4,11)'`,

  // SCENE 3 (11 - 18.5s): Authentic Route3DView + Terrain3DMap UI Texts
  `drawtext=expansion=none:fontfile=${BOLD}:text='Beskydy – Lysá hora (ze Šancí)':fontcolor=0x1e293b:fontsize=18:x=335:y=33:enable='between(t,11,18.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='2D   |   Zastavit   |':fontcolor=0x475569:fontsize=14:x=675:y=35:enable='between(t,11,18.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='▲ Vrcholy (1)':fontcolor=white:fontsize=14:x=848:y=35:enable='between(t,11,18.5)'`,

  // Dynamic telemetry pill values during 3D flyover (early / mid / summit / descent)
  `drawtext=expansion=none:fontfile=${BOLD}:text='3.2 km   |   785 m   |   22 %':fontcolor=0xfbbf24:fontsize=16:x=522:y=82:enable='between(t,11,12.8)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='6.8 km   |   1 180 m   |   46 %':fontcolor=0xfbbf24:fontsize=16:x=514:y=82:enable='between(t,12.8,14.7)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='8.4 km   |   1 323 m   |   56 %':fontcolor=0xfbbf24:fontsize=16:x=514:y=82:enable='between(t,14.7,16.6)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='13.9 km   |   690 m   |   88 %':fontcolor=0xfbbf24:fontsize=16:x=514:y=82:enable='between(t,16.6,18.5)'`,

  // Bottom White Elevation Profile Card headers matching Route3DView.tsx
  `drawtext=expansion=none:fontfile=${BOLD}:text='Výškový profil: Beskydy – Lysá hora':fontcolor=0x1e293b:fontsize=17:x=218:y=562:enable='between(t,11,18.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='↗ +935 m stoupání':fontcolor=0x16a34a:fontsize=14:x=580:y=564:enable='between(t,11,18.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='↘ -935 m klesání':fontcolor=0xdc2626:fontsize=14:x=745:y=564:enable='between(t,11,18.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='Max: 1 323 m n.m.':fontcolor=0x475569:fontsize=14:x=915:y=564:enable='between(t,11,18.5)'`,

  // SCENE 4 (18.5 - 22.5s): Analytics & Elevation Profile
  `drawtext=expansion=none:fontfile=${BOLD}:text='DETAILNÍ VÝŠKOVÉ PROFILY A STATISTIKY SEZÓNY':fontcolor=white:fontsize=25:x=76:y=54:enable='between(t,18.5,22.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='Výškový profil podle sklonu trasy (Lysá hora 1 323 m)':fontcolor=0x34d399:fontsize=20:x=85:y=154:enable='between(t,18.5,22.5)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='Zelená <5%  •  Modrá 5-10%  •  Oranžová 10-15%  •  Červená >15%':fontcolor=0x94a3b8:fontsize=16:x=85:y=188:enable='between(t,18.5,22.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='Měsíční přehled kilometrů':fontcolor=0x38bdf8:fontsize=20:x=815:y=154:enable='between(t,18.5,22.5)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='Automatické součty za rok a pohoří':fontcolor=0x94a3b8:fontsize=16:x=815:y=188:enable='between(t,18.5,22.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='Celkem: ${Math.round(totalKm)} km  |  +${Math.round(totalAscent)} m':fontcolor=0xfbbf24:fontsize=21:x=815:y=616:enable='between(t,18.5,22.5)'`,

  // SCENE 5 (22.5 - 26s): Price-Free Outro
  `drawtext=expansion=none:fontfile=${BOLD}:text='HORSKÝ ZÁPISNÍK A ARCHÍV TRAS':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=158:enable='between(t,22.5,26)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='Funguje 100% offline v prohlížeči i jako mobilní PWA aplikace':fontcolor=0x34d399:fontsize=21:x=(w-text_w)/2:y=220:enable='between(t,22.5,26)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='✓  2D a 3D interaktivní mapy všech vašich GPX výšlapů':fontcolor=0xe2e8f0:fontsize=21:x=310:y=288:enable='between(t,22.5,26)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='✓  Fotogalerie s GPS pozicí přímo na trase a 3D přelet':fontcolor=0xe2e8f0:fontsize=21:x=310:y=336:enable='between(t,22.5,26)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='✓  Soukromá záloha na váš vlastní Google Drive':fontcolor=0xe2e8f0:fontsize=21:x=310:y=384:enable='between(t,22.5,26)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='✓  Přehledné statistiky kilometrů, převýšení a vrcholů':fontcolor=0xe2e8f0:fontsize=21:x=310:y=432:enable='between(t,22.5,26)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='hor-zap.github.io/HZ':fontcolor=0x0f172a:fontsize=28:x=(w-text_w)/2:y=508:enable='between(t,22.5,26)'`,
].join(',');

const outMp4 = './public/promo-horsky-zapisnik.mp4';
execSync(
  `ffmpeg -y -loglevel error ` +
  `-f rawvideo -pix_fmt rgb24 -s ${WIDTH}x${HEIGHT} -r ${FPS} -i "${TMP_DIR}/frame_%04d.rgb" ` +
  `-f lavfi -i "sine=frequency=220:sample_rate=44100:duration=${TOTAL_SEC}" ` +
  `-vf "${drawFilters}" ` +
  `-af "aeval='0.06*sin(2*PI*196*t)+0.05*sin(2*PI*246.94*t)+0.05*sin(2*PI*293.66*t)+0.03*sin(2*PI*392*t)':c=stereo,afade=t=in:st=0:d=1.5,afade=t=out:st=24:d=2" ` +
  `-c:v libx264 -preset fast -crf 21 -pix_fmt yuv420p -movflags +faststart ` +
  `-c:a aac -b:a 128k -shortest "${outMp4}"`,
  { stdio: 'inherit' }
);

// Extract two sample frames from Scene 3 (at t=12.5s and t=15.5s) to visually verify the 3D diorama
execSync(`ffmpeg -y -loglevel error -ss 12.5 -i "${outMp4}" -frames:v 1 "${TMP_DIR}/verify_3d_a.png"`);
execSync(`ffmpeg -y -loglevel error -ss 15.5 -i "${outMp4}" -frames:v 1 "${TMP_DIR}/verify_3d_b.png"`);

console.log('HOTOVO:', outMp4);
process.exit(0);
