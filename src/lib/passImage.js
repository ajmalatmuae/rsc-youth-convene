import { code128B } from './code128.js';
import { FRAME, loadImage } from './photo.js';
import ycUrl from '../assets/youth-convene.png';
import rscUrl from '../assets/rsc.png';
import samUrl from '../assets/samastha-centenary.png';
import bmUrl from '../assets/be-more.png';

const FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';

function fit(c, t, w, size, min) {
  let z = size;
  c.font = '700 ' + z + 'px ' + FONT;
  while (z > min && c.measureText(t).width > w) {
    z -= 1;
    c.font = '700 ' + z + 'px ' + FONT;
  }
}

function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function spacedWidth(c, t, sp) {
  let w = 0;
  for (let i = 0; i < t.length; i++) w += c.measureText(t.charAt(i)).width + sp;
  return w - sp;
}

function spaced(c, t, x, y, sp, align) {
  const w = spacedWidth(c, t, sp);
  let px = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  c.textAlign = 'left';
  for (let i = 0; i < t.length; i++) {
    c.fillText(t.charAt(i), px, y);
    px += c.measureText(t.charAt(i)).width + sp;
  }
  return w;
}

function label(c, t, x, y, align) {
  c.fillStyle = 'rgba(26,0,0,.5)';
  c.font = '700 15px ' + FONT;
  spaced(c, t, x, y, 3, align || 'left');
}

function field(c, lab, val, x, yl, yv, w, size, min) {
  label(c, lab, x, yl);
  c.fillStyle = '#1a0000';
  fit(c, val, w, size, min);
  c.textAlign = 'left';
  c.fillText(val, x, yv);
}

function wrapLines(c, t, w) {
  const words = t.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? cur + ' ' + word : word;
    if (c.measureText(test).width <= w || !cur) cur = test;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** A single line down to 30px; otherwise up to two lines (down to 18px). The name is drawn a little larger than the other values. */
function layoutName(c, val, w) {
  for (let z = 38; z >= 30; z--) {
    c.font = '700 ' + z + 'px ' + FONT;
    if (c.measureText(val).width <= w) return { z, lines: [val] };
  }
  let z = 36;
  let lines = [val];
  for (; z >= 18; z--) {
    c.font = '700 ' + z + 'px ' + FONT;
    lines = wrapLines(c, val, w);
    if (lines.length <= 2 && lines.every((l) => c.measureText(l).width <= w)) break;
  }
  return { z, lines: lines.slice(0, 2) };
}

/**
 * Draws the Councillor Pass as a canvas at 2x. Layout (card coordinates):
 *   photo top left; to its right FROM/TO (level with the top of the photo), then DATE/DAY, BOARDING/GATE and NAME/FLIGHT,
 *   each pair on one line. A two-line name makes the card a little taller.
 * photo: { src, w, h }   view: { s, x, y } (the zoom/position chosen in the photo frame)
 */
export async function drawPass({ name, sector, regId, payload, photo, view }) {
  const [yc, rsc, pimg, sam, bm] = await Promise.all([
    loadImage(ycUrl),
    loadImage(rscUrl),
    loadImage(photo.src),
    loadImage(samUrl),
    loadImage(bmUrl),
  ]);

  // measure the name first: it decides the height of the card
  const NAME_W = 320;
  const probe = document.createElement('canvas').getContext('2d');
  const nm = layoutName(probe, name, NAME_W);
  const extra = nm.lines.length > 1 ? Math.round(nm.z * 1.15) : 0;
  const T = 380 + extra; // y of the tear line
  const cx = 60, cy = 170, cw = 1080, ch = T + 180;
  const W = 1200, H = ch + 220;

  const cv = document.createElement('canvas');
  cv.width = W * 2;
  cv.height = H * 2;
  const c = cv.getContext('2d');
  c.scale(2, 2);

  let g = c.createLinearGradient(0, 0, W * 0.6, H);
  g.addColorStop(0, '#2a0000');
  g.addColorStop(1, '#0a0000');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  g = c.createRadialGradient(W * 0.85, 0, 0, W * 0.85, 0, W * 0.5);
  g.addColorStop(0, 'rgba(196,0,0,.95)');
  g.addColorStop(1, 'rgba(196,0,0,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  const lh = 100;
  const lw = (yc.naturalWidth * lh) / yc.naturalHeight;
  c.drawImage(yc, (W - lw) / 2, 40, lw, lh);

  // header: Samastha Centenary logo (left) and Be In Be More logo (right), each on a small white plate because their lettering is dark
  const lh2 = 72, pad = 10, ph2 = lh2 + pad * 2, py2 = 90 - ph2 / 2;
  const sw0 = (sam.naturalWidth * lh2) / sam.naturalHeight;
  c.fillStyle = '#fff';
  rr(c, 60, py2, sw0 + pad * 2, ph2, 12);
  c.fill();
  c.drawImage(sam, 60 + pad, py2 + pad, sw0, lh2);
  const bw = (bm.naturalWidth * lh2) / bm.naturalHeight;
  c.fillStyle = '#fff';
  rr(c, 1140 - bw - pad * 2, py2, bw + pad * 2, ph2, 12);
  c.fill();
  c.drawImage(bm, 1140 - bw - pad, py2 + pad, bw, lh2);

  const cc = document.createElement('canvas');
  cc.width = cw * 2;
  cc.height = ch * 2;
  const d = cc.getContext('2d');
  d.scale(2, 2);

  d.fillStyle = '#fff';
  rr(d, 0, 0, cw, ch, 26);
  d.fill();
  d.save();
  rr(d, 0, 0, cw, ch, 26);
  d.clip();
  d.fillStyle = '#e10600';
  d.fillRect(0, 0, cw, 56);
  d.restore();
  d.textBaseline = 'alphabetic';
  d.fillStyle = '#fff';
  d.font = '800 20px ' + FONT;
  spaced(d, 'COUNCILLOR PASS', cw / 2, 35, 6, 'center');

  // photo (cropped exactly as framed on the page), top left
  const pw = 200, ph = Math.round((pw * FRAME.h) / FRAME.w), px = 40, py = 82;
  d.save();
  rr(d, px, py, pw, ph, 10);
  d.clip();
  d.drawImage(pimg, -view.x / view.s, -view.y / view.s, FRAME.w / view.s, FRAME.h / view.s, px, py, pw, ph);
  d.restore();
  d.lineWidth = 3;
  d.strokeStyle = '#000';
  rr(d, px, py, pw, ph, 10);
  d.stroke();

  // to the right of the photo: FROM/TO (top level with the photo), then three rows of two columns
  const X1 = 270, X2 = 620;
  label(d, 'FROM', X1, 94);
  label(d, 'TO', X2, 94);
  d.fillStyle = '#1a0000';
  const from = sector.toUpperCase();
  fit(d, from, 270, 34, 20);
  d.textAlign = 'left';
  d.fillText(from, X1, 132);
  const fromW = d.measureText(from).width;
  fit(d, 'HAMDAN', 420, 34, 18);
  d.textAlign = 'left';
  d.fillText('HAMDAN', X2, 132);
  d.fillStyle = '#e10600';
  d.font = '34px ' + FONT;
  d.textAlign = 'center';
  d.fillText('\u2708\uFE0E', (X1 + fromW + X2) / 2, 130);

  // row 2: NAME (a little larger, up to two lines) and FLIGHT
  label(d, 'NAME', X1, 162);
  d.fillStyle = '#1a0000';
  d.font = '700 ' + nm.z + 'px ' + FONT;
  d.textAlign = 'left';
  nm.lines.forEach((l, i) => d.fillText(l, X1, 200 + i * Math.round(nm.z * 1.15)));
  field(d, 'FLIGHT', 'Abu Dhabi City Zone', X2, 162, 200, 420, 34, 18);

  // rows 3 and 4 (pushed down when the name needs a second line)
  field(d, 'DATE', '29 NOV 2026', X1, 230 + extra, 268 + extra, 330, 34, 18);
  field(d, 'DAY', 'Sunday', X2, 230 + extra, 268 + extra, 420, 34, 18);
  field(d, 'BOARDING', '10:30 AM', X1, 298 + extra, 336 + extra, 330, 34, 18);
  field(d, 'GATE', 'Fogg International', X2, 298 + extra, 336 + extra, 420, 34, 18);

  // tear line
  d.strokeStyle = '#bbb';
  d.lineWidth = 2;
  d.setLineDash([10, 8]);
  d.beginPath();
  d.moveTo(0, T);
  d.lineTo(cw, T);
  d.stroke();
  d.setLineDash([]);

  // barcode: left aligned (like the RSC row), whole device pixels per module, never thinner than 2 device px
  const { bars, total } = code128B(payload);
  const U = Math.max(2, Math.floor(920 / total));
  const u = U / 2;
  const x0 = 40 - 10 * u; // the 10-module quiet zone sits to the left of x = 40, so the first bar starts at x = 40
  d.fillStyle = '#000';
  for (const [bx, bw2] of bars) d.fillRect(x0 + bx * u, T + 30, bw2 * u, 70);
  d.fillStyle = '#1a0000';
  d.font = '700 16px ' + FONT;
  spaced(d, 'ID  ' + regId, 40, T + 122, 3, 'left');

  // footer: RSC logo + city
  const city = 'ABU DHABI CITY';
  d.font = '700 20px ' + FONT;
  d.fillStyle = '#1a0000';
  const cwid = spacedWidth(d, city, 1);
  const rh = 30, rw = (rsc.naturalWidth * rh) / rsc.naturalHeight;
  spaced(d, city, cw - 40, T + 147, 1, 'right');
  d.drawImage(rsc, cw - 40 - cwid - 10 - rw, T + 125, rw, rh);

  // perforation notches
  d.globalCompositeOperation = 'destination-out';
  d.beginPath();
  d.arc(0, T, 14, 0, Math.PI * 2);
  d.fill();
  d.beginPath();
  d.arc(cw, T, 14, 0, Math.PI * 2);
  d.fill();
  d.globalCompositeOperation = 'source-over';

  c.save();
  c.shadowColor = 'rgba(0,0,0,.5)';
  c.shadowBlur = 80;
  c.shadowOffsetY = 40;
  c.drawImage(cc, cx, cy, cw, ch);
  c.restore();
  return cv;
}
