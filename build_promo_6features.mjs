import fs from 'fs';
import { execSync } from 'child_process';

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 25;
const TMP_DIR = '/tmp/promo_6feat';
fs.rmSync(TMP_DIR, { recursive: true, force: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

const ASSETS = './public/assets/aistudio';
const BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const REG = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

console.log('1. Připravuji a upravuji všech 6 obrázků z Horského zápisníku...');

function decodeImageRgb(inputPath, w, h, vfExtra = '') {
  const outRgb = `${TMP_DIR}/img_${Math.random().toString(36).slice(2)}.rgb`;
  const vf = vfExtra ? `${vfExtra},scale=${w}:${h}:flags=lanczos` : `scale=${w}:${h}:flags=lanczos`;
  execSync(`ffmpeg -y -loglevel error -i "${inputPath}" -vf "${vf}" -f rawvideo -pix_fmt rgb24 "${outRgb}"`);
  const buf = fs.readFileSync(outRgb);
  fs.unlinkSync(outRgb);
  return { buf, w, h };
}

// 1. Obr. 1: Grafické zobrazení na mapě (908x677 -> 1440x1074)
const img1 = decodeImageRgb(`${ASSETS}/image_4aa19c4a.png`, 1440, 1074, 'unsharp=3:3:0.6:3:3:0.0');
// 2. Obr. 2: Vyhledání ubytování, občerstvení a parkovišť (919x687 -> 1440x1076)
const img2 = decodeImageRgb(`${ASSETS}/image_d2416586.png`, 1440, 1076, 'unsharp=3:3:0.6:3:3:0.0');
// 3. Obr. 3: Různé statistiky (1195x839 -> 1216x854)
const img3 = decodeImageRgb(`${ASSETS}/image_76312a11.png`, 1216, 854, 'unsharp=3:3:0.5:3:3:0.0');
// 4. Obr. 4: Systém milníků (1264x662 -> 1280x670)
const img4 = decodeImageRgb(`${ASSETS}/image_2a7fd957.png`, 1280, 670, 'unsharp=3:3:0.5:3:3:0.0');
// 5. Obr. 5: 3D dioráma trasy s možností přeletu po trase (1062x504 -> 1260x598 and 920x436)
const img5Large = decodeImageRgb(`${ASSETS}/image_71f7a5c7.png`, 1260, 598, 'unsharp=3:3:0.6:3:3:0.0');
const img5Med   = decodeImageRgb(`${ASSETS}/image_71f7a5c7.png`, 920, 436, 'unsharp=3:3:0.5:3:3:0.0');
// 6. Obr. 6: Výškový profil trasy se sklonem podle obtížnosti (1222x162 -> 1216x162)
const img6Full = decodeImageRgb(`${ASSETS}/image_4d68c92a.png`, 1216, 162, 'unsharp=3:3:0.6:3:3:0.0');

// Logo for Intro & Outro background
const logoImg = decodeImageRgb(`${ASSETS}/logo_55070224.png`, 520, 520);

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

function blitCrop(dstBuf, srcImg, srcX, srcY, w, h, dstX, dstY, alpha = 1) {
  const sx0 = Math.round(srcX);
  const sy0 = Math.round(srcY);
  for (let dy = 0; dy < h; dy++) {
    const py = dstY + dy;
    if (py < 0 || py >= HEIGHT) continue;
    const sy = Math.max(0, Math.min(srcImg.h - 1, sy0 + dy));
    if (alpha >= 0.99 && dstX >= 0 && dstX + w <= WIDTH && sx0 >= 0 && sx0 + w <= srcImg.w) {
      const srcOff = (sy * srcImg.w + sx0) * 3;
      const dstOff = (py * WIDTH + dstX) * 3;
      srcImg.buf.copy(dstBuf, dstOff, srcOff, srcOff + w * 3);
      continue;
    }
    for (let dx = 0; dx < w; dx++) {
      const px = dstX + dx;
      if (px < 0 || px >= WIDTH) continue;
      const sx = Math.max(0, Math.min(srcImg.w - 1, sx0 + dx));
      const sIdx = (sy * srcImg.w + sx) * 3;
      setPixel(dstBuf, px, py, srcImg.buf[sIdx], srcImg.buf[sIdx + 1], srcImg.buf[sIdx + 2], alpha);
    }
  }
}

function drawTopHeader(buf, stepIndex) {
  fillRect(buf, 0, 0, WIDTH, 102, 15, 23, 42, 0.96);
  fillRect(buf, 0, 100, WIDTH, 3, 16, 185, 129, 0.95);
  fillRect(buf, 36, 14, 290, 26, 16, 185, 129, 0.22);
  strokeRect(buf, 36, 14, 290, 26, 1, 16, 185, 129, 0.8);

  for (let i = 1; i <= 6; i++) {
    const cx = 1090 + (i - 1) * 26;
    const cy = 27;
    if (i === stepIndex) {
      drawCircle(buf, cx, cy, 7, 16, 185, 129, 1);
    } else if (i < stepIndex) {
      drawCircle(buf, cx, cy, 5, 52, 211, 153, 0.7);
    } else {
      drawCircle(buf, cx, cy, 5, 71, 85, 105, 0.8);
    }
  }
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

const TOTAL_SEC = 35;
const TOTAL_FRAMES = TOTAL_SEC * FPS;

const splashBg = Buffer.alloc(WIDTH * HEIGHT * 3);
blitCrop(splashBg, img1, 80, 120, WIDTH, HEIGHT, 0, 0, 1);
fillRect(splashBg, 0, 0, WIDTH, HEIGHT, 15, 23, 42, 0.88);
blitCrop(splashBg, logoImg, 0, 0, 520, 520, Math.round((WIDTH - 520) / 2), Math.round((HEIGHT - 520) / 2), 0.22);

const flyoverPath2D = [
  { x: 312, y: 332 },
  { x: 350, y: 312 },
  { x: 320, y: 278 },
  { x: 438, y: 230 },
  { x: 428, y: 205 },
  { x: 555, y: 184 },
  { x: 678, y: 162 },
  { x: 724, y: 132 },
  { x: 785, y: 112 },
  { x: 836, y: 184 },
  { x: 870, y: 236 },
  { x: 882, y: 295 },
  { x: 944, y: 318 },
  { x: 1004, y: 358 },
];

function sampleFlyoverBeacon(progress) {
  const idxFloat = Math.max(0, Math.min(1, progress)) * (flyoverPath2D.length - 1);
  const i0 = Math.floor(idxFloat);
  const i1 = Math.min(flyoverPath2D.length - 1, i0 + 1);
  const f = idxFloat - i0;
  return {
    x: flyoverPath2D[i0].x + (flyoverPath2D[i1].x - flyoverPath2D[i0].x) * f,
    y: flyoverPath2D[i0].y + (flyoverPath2D[i1].y - flyoverPath2D[i0].y) * f,
  };
}

console.log(`2. Renderuji ${TOTAL_FRAMES} HD snímků propagačního videa...`);
const streamPath = `${TMP_DIR}/video_stream.rgb`;
const fd = fs.openSync(streamPath, 'w');
const frame = Buffer.alloc(WIDTH * HEIGHT * 3);

for (let f = 0; f < TOTAL_FRAMES; f++) {
  const t = f / FPS;

  if (t < 3.5) {
    splashBg.copy(frame);
    fillRect(frame, 0, 0, WIDTH, 60, 15, 23, 42, 0.95);
    fillRect(frame, 0, 58, WIDTH, 2, 16, 185, 129, 0.9);

    fillRect(frame, 170, 160, 940, 410, 15, 23, 42, 0.88);
    strokeRect(frame, 170, 160, 940, 410, 2, 16, 185, 129, 0.85);
    fillRect(frame, 460, 195, 360, 36, 16, 185, 129, 0.22);
    strokeRect(frame, 460, 195, 360, 36, 1, 16, 185, 129, 0.85);

    fillRect(frame, 220, 425, 260, 100, 30, 41, 59, 0.95);
    strokeRect(frame, 220, 425, 260, 100, 1, 16, 185, 129, 0.6);

    fillRect(frame, 510, 425, 260, 100, 30, 41, 59, 0.95);
    strokeRect(frame, 510, 425, 260, 100, 1, 56, 189, 248, 0.6);

    fillRect(frame, 800, 425, 260, 100, 30, 41, 59, 0.95);
    strokeRect(frame, 800, 425, 260, 100, 1, 251, 191, 36, 0.6);

  } else if (t < 8.0) {
    const p = easeInOut((t - 3.5) / 4.5);
    const sx = 30 + p * 120;
    const sy = 160 + p * 150;
    blitCrop(frame, img1, sx, sy, WIDTH, HEIGHT - 102, 0, 102, 1);

    drawTopHeader(frame, 1);

    fillRect(frame, 36, 636, 780, 64, 15, 23, 42, 0.92);
    strokeRect(frame, 36, 636, 780, 64, 2, 249, 115, 22, 0.85);
    fillRect(frame, 58, 662, 34, 12, 249, 115, 22, 1);
    strokeRect(frame, 58, 662, 34, 12, 2, 255, 255, 255, 1);
    fillRect(frame, 385, 662, 34, 12, 6, 182, 212, 1);
    strokeRect(frame, 385, 662, 34, 12, 2, 255, 255, 255, 1);

  } else if (t < 12.5) {
    const p = easeInOut((t - 8.0) / 4.5);
    const sx = 120 - p * 80;
    const sy = 140 + p * 140;
    blitCrop(frame, img2, sx, sy, WIDTH, HEIGHT - 102, 0, 102, 1);

    drawTopHeader(frame, 2);

    fillRect(frame, 36, 634, 1040, 66, 15, 23, 42, 0.94);
    strokeRect(frame, 36, 634, 1040, 66, 2, 56, 189, 248, 0.8);

    drawCircle(frame, 74, 667, 17, 255, 255, 255, 1);
    drawCircle(frame, 74, 667, 14, 37, 99, 235, 1);

    drawCircle(frame, 290, 667, 17, 255, 255, 255, 1);
    drawCircle(frame, 290, 667, 14, 16, 185, 129, 1);

    drawCircle(frame, 635, 667, 17, 255, 255, 255, 1);
    drawCircle(frame, 635, 667, 14, 124, 58, 237, 1);

    drawCircle(frame, 835, 667, 17, 255, 255, 255, 1);
    drawCircle(frame, 835, 667, 14, 217, 119, 6, 1);

  } else if (t < 17.5) {
    fillRect(frame, 0, 102, WIDTH, HEIGHT - 102, 248, 250, 252, 1);
    const rawP = Math.max(0, Math.min(1, (t - 13.0) / 3.8));
    const p = easeInOut(rawP);
    const maxScrollY = img3.h - (HEIGHT - 122);
    const sy = Math.round(p * maxScrollY);

    blitCrop(frame, img3, 0, sy, img3.w, HEIGHT - 122, 32, 114, 1);
    strokeRect(frame, 30, 112, img3.w + 4, HEIGHT - 118, 2, 203, 213, 225, 1);

    drawTopHeader(frame, 3);

  } else if (t < 22.0) {
    fillRect(frame, 0, 102, WIDTH, HEIGHT - 102, 248, 250, 252, 1);
    const rawP = Math.max(0, Math.min(1, (t - 17.8) / 3.6));
    const p = easeInOut(rawP);
    const maxScrollY = Math.max(0, img4.h - (HEIGHT - 118));
    const sy = Math.round(p * maxScrollY);

    blitCrop(frame, img4, 0, sy, WIDTH, Math.min(img4.h, HEIGHT - 118), 0, 112, 1);

    drawTopHeader(frame, 4);

  } else if (t < 26.5) {
    fillRect(frame, 0, 102, WIDTH, HEIGHT - 102, 8, 16, 33, 1);
    const dx = 10, dy = 112;
    blitCrop(frame, img5Large, 0, 0, img5Large.w, img5Large.h, dx, dy, 1);

    const flyP = Math.max(0, Math.min(1, (t - 22.2) / 4.0));
    const bPos = sampleFlyoverBeacon(flyP);
    const bx = Math.round(dx + bPos.x);
    const by = Math.round(dy + bPos.y);

    const pulseRad = 18 + Math.round(Math.sin(t * 10) * 4);
    drawCircle(frame, bx, by, pulseRad, 251, 191, 36, 0.32);
    drawCircle(frame, bx, by, 11, 255, 255, 255, 0.96);
    drawCircle(frame, bx, by, 7, 245, 158, 11, 1.0);
    drawCircle(frame, bx - 2, by - 2, 2, 254, 243, 199, 1.0);

    fillRect(frame, 450, 120, 380, 36, 15, 23, 42, 0.94);
    strokeRect(frame, 450, 120, 380, 36, 2, 251, 191, 36, 0.9);

    drawTopHeader(frame, 5);

  } else if (t < 31.5) {
    fillRect(frame, 0, 102, WIDTH, HEIGHT - 102, 11, 19, 38, 1);
    blitCrop(frame, img5Med, 0, 28, img5Med.w, 370, Math.round((WIDTH - img5Med.w) / 2), 104, 1);

    const profP = Math.max(0, Math.min(1, (t - 26.8) / 4.2));
    const bPos = sampleFlyoverBeacon(profP);
    const scaleM = 920 / 1260;
    const bx = Math.round((WIDTH - img5Med.w) / 2 + bPos.x * scaleM);
    const by = Math.round(104 + (bPos.y - 28) * scaleM);
    drawCircle(frame, bx, by, 14, 251, 191, 36, 0.35);
    drawCircle(frame, bx, by, 9, 255, 255, 255, 0.95);
    drawCircle(frame, bx, by, 6, 245, 158, 11, 1.0);

    const cardX = 24, cardY = 472, cardW = 1232, cardH = 228;
    fillRect(frame, cardX, cardY, cardW, cardH, 255, 255, 255, 0.98);
    strokeRect(frame, cardX, cardY, cardW, cardH, 3, 16, 185, 129, 0.9);

    const p6X = 32, p6Y = 482;
    blitCrop(frame, img6Full, 0, 0, img6Full.w, img6Full.h, p6X, p6Y, 1);

    const chartLeft = p6X + 58;
    const chartRight = p6X + 1200;
    const curX = Math.round(chartLeft + profP * (chartRight - chartLeft));
    fillRect(frame, curX - 1, p6Y + 46, 3, 94, 239, 68, 68, 0.88);
    drawCircle(frame, curX, p6Y + 86, 7, 255, 255, 255, 1);
    drawCircle(frame, curX, p6Y + 86, 5, 239, 68, 68, 1);

    fillRect(frame, cardX + 20, cardY + 176, cardW - 40, 40, 241, 245, 249, 1);
    strokeRect(frame, cardX + 20, cardY + 176, cardW - 40, 40, 1, 203, 213, 225, 1);

    drawCircle(frame, 180, cardY + 196, 8, 16, 185, 129, 1);
    drawCircle(frame, 435, cardY + 196, 8, 59, 130, 246, 1);
    drawCircle(frame, 725, cardY + 196, 8, 245, 158, 11, 1);
    drawCircle(frame, 1005, cardY + 196, 8, 225, 29, 72, 1);

    drawTopHeader(frame, 6);

  } else {
    splashBg.copy(frame);
    fillRect(frame, 0, 0, WIDTH, 60, 15, 23, 42, 0.95);
    fillRect(frame, 0, 58, WIDTH, 2, 16, 185, 129, 0.9);

    fillRect(frame, 140, 110, 1000, 520, 15, 23, 42, 0.92);
    strokeRect(frame, 140, 110, 1000, 520, 2, 16, 185, 129, 0.85);

    fillRect(frame, 330, 525, 620, 72, 16, 185, 129, 0.96);
    strokeRect(frame, 330, 525, 620, 72, 2, 167, 243, 208, 1);
  }

  fs.writeSync(fd, frame);
}
fs.closeSync(fd);

console.log('3. Sestavuji finální MP4 video s českými popisky všech 6 funkcí...');

const drawFilters = [
  `drawtext=expansion=none:fontfile=${BOLD}:text='HORSKÝ ZÁPISNÍK  v4.1 PRO':fontcolor=white:fontsize=24:x=40:y=18:enable='lt(t,3.5)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='hor-zap.github.io/HZ':fontcolor=0x34d399:fontsize=20:x=1025:y=20:enable='lt(t,3.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='OSOBNÍ HORSKÝ DENÍK A ARCHÍV GPX TRAS':fontcolor=0x34d399:fontsize=18:x=(w-text_w)/2:y=204:enable='lt(t,3.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='Horský zápisník a Archív tras':fontcolor=white:fontsize=44:x=(w-text_w)/2:y=264:enable='lt(t,3.5)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='Všechny vaše výšlapy, 3D terénní modely, statistiky a milníky na jednom místě':fontcolor=0xcbd5e1:fontsize=21:x=(w-text_w)/2:y=338:enable='lt(t,3.5)'`,

  `drawtext=expansion=none:fontfile=${BOLD}:text='2D & 3D MAPY':fontcolor=0x34d399:fontsize=24:x=265:y=446:enable='lt(t,3.5)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='Přehled všech výšlapů':fontcolor=0x94a3b8:fontsize=16:x=262:y=484:enable='lt(t,3.5)'`,

  `drawtext=expansion=none:fontfile=${BOLD}:text='BODY ZÁJMU & PROFILY':fontcolor=0x38bdf8:fontsize=20:x=522:y=448:enable='lt(t,3.5)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='Chaty, parkoviště a sklon':fontcolor=0x94a3b8:fontsize=16:x=536:y=484:enable='lt(t,3.5)'`,

  `drawtext=expansion=none:fontfile=${BOLD}:text='STATISTIKY & MILNÍKY':fontcolor=0xfbbf24:fontsize=20:x=814:y=448:enable='lt(t,3.5)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='Grafy převýšení a výzvy':fontcolor=0x94a3b8:fontsize=16:x=835:y=484:enable='lt(t,3.5)'`,

  // SCENE 1 (3.5 - 8.0s)
  `drawtext=expansion=none:fontfile=${BOLD}:text='FUNKCE 1 / 6  •  HORSKÝ ZÁPISNÍK':fontcolor=0x34d399:fontsize=14:x=52:y=20:enable='between(t,3.5,8.0)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='Grafické zobrazení všech vašich tras na mapě':fontcolor=white:fontsize=26:x=36:y=48:enable='between(t,3.5,8.0)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='Přehled jednodenních i vícedenních výšlapů napříč pohořími':fontcolor=0x94a3b8:fontsize=16:x=755:y=56:enable='between(t,3.5,8.0)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='Jednodenní a vícedenní horské přechody':fontcolor=white:fontsize=17:x=104:y=659:enable='between(t,3.5,8.0)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='Filtrování podle období, pohoří a typu trasy':fontcolor=0x38bdf8:fontsize=17:x=432:y=659:enable='between(t,3.5,8.0)'`,

  // SCENE 2 (8.0 - 12.5s)
  `drawtext=expansion=none:fontfile=${BOLD}:text='FUNKCE 2 / 6  •  HORSKÝ ZÁPISNÍK':fontcolor=0x34d399:fontsize=14:x=52:y=20:enable='between(t,8.0,12.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='Vyhledání ubytování, občerstvení a parkovišť':fontcolor=white:fontsize=26:x=36:y=48:enable='between(t,8.0,12.5)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='Body zájmu v okolí plánované i uložené trasy':fontcolor=0x94a3b8:fontsize=16:x=845:y=56:enable='between(t,8.0,12.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='P':fontcolor=white:fontsize=16:x=68:y=659:enable='between(t,8.0,12.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='Parkoviště':fontcolor=white:fontsize=17:x=100:y=659:enable='between(t,8.0,12.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='H':fontcolor=white:fontsize=16:x=284:y=659:enable='between(t,8.0,12.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='Horské chaty a občerstvení':fontcolor=0x34d399:fontsize=17:x=316:y=659:enable='between(t,8.0,12.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='U':fontcolor=white:fontsize=16:x=629:y=659:enable='between(t,8.0,12.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='Ubytování':fontcolor=0xc4b5fd:fontsize=17:x=660:y=659:enable='between(t,8.0,12.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='K':fontcolor=white:fontsize=16:x=829:y=659:enable='between(t,8.0,12.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='Kempy a přístřešky':fontcolor=0xfbbf24:fontsize=17:x=860:y=659:enable='between(t,8.0,12.5)'`,

  // SCENE 3 (12.5 - 17.5s)
  `drawtext=expansion=none:fontfile=${BOLD}:text='FUNKCE 3 / 6  •  HORSKÝ ZÁPISNÍK':fontcolor=0x34d399:fontsize=14:x=52:y=20:enable='between(t,12.5,17.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='Různé statistiky a kumulativní grafy převýšení':fontcolor=white:fontsize=26:x=36:y=48:enable='between(t,12.5,17.5)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='Aktivní dny, celkové kilometry, osobní rekordy a nárůst převýšení':fontcolor=0x94a3b8:fontsize=16:x=735:y=56:enable='between(t,12.5,17.5)'`,

  // SCENE 4 (17.5 - 22.0s)
  `drawtext=expansion=none:fontfile=${BOLD}:text='FUNKCE 4 / 6  •  HORSKÝ ZÁPISNÍK':fontcolor=0x34d399:fontsize=14:x=52:y=20:enable='between(t,17.5,22.0)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='Systém milníků a osobních horských výzev':fontcolor=white:fontsize=26:x=36:y=48:enable='between(t,17.5,22.0)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='Přehled splněných cílů s komentáři a přímým odkazem na mapu':fontcolor=0x94a3b8:fontsize=16:x=745:y=56:enable='between(t,17.5,22.0)'`,

  // SCENE 5 (22.0 - 26.5s)
  `drawtext=expansion=none:fontfile=${BOLD}:text='FUNKCE 5 / 6  •  HORSKÝ ZÁPISNÍK':fontcolor=0x34d399:fontsize=14:x=52:y=20:enable='between(t,22.0,26.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='3D dioráma trasy s možností přeletu po trase':fontcolor=white:fontsize=26:x=36:y=48:enable='between(t,22.0,26.5)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='Prostorový 3D model terénu s vrcholy v okolí a živým průletem':fontcolor=0x94a3b8:fontsize=16:x=745:y=56:enable='between(t,22.0,26.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='▶ 3D PŘELET TRASOU  •  6.0 km  |  1 174 m n.m. (Malý Smrk)':fontcolor=0xfbbf24:fontsize=14:x=472:y=131:enable='between(t,22.0,24.2)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='▶ 3D PŘELET TRASOU  •  7.4 km  |  1 278 m n.m. (Smrk)':fontcolor=0xfbbf24:fontsize=14:x=488:y=131:enable='between(t,24.2,26.5)'`,

  // SCENE 6 (26.5 - 31.5s)
  `drawtext=expansion=none:fontfile=${BOLD}:text='FUNKCE 6 / 6  •  HORSKÝ ZÁPISNÍK':fontcolor=0x34d399:fontsize=14:x=52:y=20:enable='between(t,26.5,31.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='Výškový profil trasy se sklonem podle obtížnosti':fontcolor=white:fontsize=26:x=36:y=48:enable='between(t,26.5,31.5)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='Barevné rozlišení prudkosti stoupání a klesání po celé délce trasy':fontcolor=0x94a3b8:fontsize=16:x=735:y=56:enable='between(t,26.5,31.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='Rovina (< 5 %)':fontcolor=0x0f172a:fontsize=16:x=200:y=660:enable='between(t,26.5,31.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='Standardní sklon (5–10 %)':fontcolor=0x0f172a:fontsize=16:x=455:y=660:enable='between(t,26.5,31.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='Prudké stoupání (10–20 %)':fontcolor=0x0f172a:fontsize=16:x=745:y=660:enable='between(t,26.5,31.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='Extrémní sklon (> 20 %)':fontcolor=0x0f172a:fontsize=16:x=1025:y=660:enable='between(t,26.5,31.5)'`,

  // OUTRO (31.5 - 35.0s)
  `drawtext=expansion=none:fontfile=${BOLD}:text='HORSKÝ ZÁPISNÍK  v4.1 PRO':fontcolor=white:fontsize=24:x=40:y=18:enable='gte(t,31.5)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='hor-zap.github.io/HZ':fontcolor=0x34d399:fontsize=20:x=1025:y=20:enable='gte(t,31.5)'`,
  `drawtext=expansion=none:fontfile=${BOLD}:text='HORSKÝ ZÁPISNÍK A ARCHÍV TRAS':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=146:enable='gte(t,31.5)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='Kompletní 2D a 3D kronika vašich horských výšlapů v počítači i mobilu':fontcolor=0x34d399:fontsize=20:x=(w-text_w)/2:y=198:enable='gte(t,31.5)'`,

  `drawtext=expansion=none:fontfile=${REG}:text='✓  Grafické zobrazení všech GPX tras na přehledné mapě':fontcolor=0xe2e8f0:fontsize=20:x=280:y=256:enable='gte(t,31.5)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='✓  Vyhledání ubytování, občerstvení, horských chat a parkovišť':fontcolor=0xe2e8f0:fontsize=20:x=280:y=298:enable='gte(t,31.5)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='✓  Detailní statistiky, rekordy a grafy kumulativního převýšení':fontcolor=0xe2e8f0:fontsize=20:x=280:y=340:enable='gte(t,31.5)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='✓  Motivační systém milníků a osobních horských výzev':fontcolor=0xe2e8f0:fontsize=20:x=280:y=382:enable='gte(t,31.5)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='✓  3D dioráma trasy s přeletem a výškový profil podle sklonu':fontcolor=0xe2e8f0:fontsize=20:x=280:y=424:enable='gte(t,31.5)'`,
  `drawtext=expansion=none:fontfile=${REG}:text='✓  100% soukromá offline data se zálohou na vlastní Google Disk':fontcolor=0xe2e8f0:fontsize=20:x=280:y=466:enable='gte(t,31.5)'`,

  `drawtext=expansion=none:fontfile=${BOLD}:text='hor-zap.github.io/HZ':fontcolor=0x0f172a:fontsize=28:x=(w-text_w)/2:y=547:enable='gte(t,31.5)'`,
].join(',');

const outMp4 = './public/promo-horsky-zapisnik.mp4';
execSync(
  `ffmpeg -y -loglevel error ` +
  `-f rawvideo -pix_fmt rgb24 -s ${WIDTH}x${HEIGHT} -r ${FPS} -i "${streamPath}" ` +
  `-f lavfi -i "sine=frequency=220:sample_rate=44100:duration=${TOTAL_SEC}" ` +
  `-vf "${drawFilters}" ` +
  `-af "aformat=channel_layouts=stereo,lowpass=f=360,volume=0.07,afade=t=in:st=0:d=1.5,afade=t=out:st=${TOTAL_SEC - 2}:d=2" ` +
  `-c:v libx264 -preset fast -crf 19 -pix_fmt yuv420p -movflags +faststart ` +
  `-c:a aac -b:a 128k -shortest "${outMp4}"`
);

execSync(`ffmpeg -y -loglevel error -ss 5.5 -i "${outMp4}" -frames:v 1 "./public/tmp_s1.png"`);
execSync(`ffmpeg -y -loglevel error -ss 10.0 -i "${outMp4}" -frames:v 1 "./public/tmp_s2.png"`);
execSync(`ffmpeg -y -loglevel error -ss 15.0 -i "${outMp4}" -frames:v 1 "./public/tmp_s3.png"`);
execSync(`ffmpeg -y -loglevel error -ss 19.5 -i "${outMp4}" -frames:v 1 "./public/tmp_s4.png"`);
execSync(`ffmpeg -y -loglevel error -ss 24.5 -i "${outMp4}" -frames:v 1 "./public/tmp_s5.png"`);
execSync(`ffmpeg -y -loglevel error -ss 29.0 -i "${outMp4}" -frames:v 1 "./public/tmp_s6.png"`);

console.log('HOTOVO:', outMp4);
