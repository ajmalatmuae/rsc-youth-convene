import { code128B } from './code128.js';
import { FRAME, loadImage } from './photo.js';
import ycUrl from '../assets/youth-convene.png';
import rscUrl from '../assets/rsc.png';

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

function field(c, label, val, x, yl, yv, w, size, min) {
  c.fillStyle = 'rgba(26,0,0,.5)';
  c.font = '700 15px ' + FONT;
  spaced(c, label, x, yl, 3, 'left');
  c.fillStyle = '#1a0000';
  fit(c, val, w, size, min);
  c.textAlign = 'left';
  c.fillText(val, x, yv);
}

/**
 * Draws the Councillor Pass as a 2400 x 1600 canvas (1200 x 800 at 2x).
 * photo: { src, w, h }   view: { s, x, y } (the zoom/position chosen in the photo frame)
 */
export async function drawPass({ name, sector, regId, payload, photo, view }) {
  const [yc, rsc, pimg] = await Promise.all([loadImage(ycUrl), loadImage(rscUrl), loadImage(photo.src)]);
  const W = 1200, H = 800;
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

  const cx = 60, cy = 170, cw = 1080, ch = 580;
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

  // route row
  d.fillStyle = 'rgba(26,0,0,.5)';
  d.font = '700 15px ' + FONT;
  spaced(d, 'FROM', 40, 102, 3, 'left');
  spaced(d, 'TO', 590, 102, 3, 'right');
  d.fillStyle = '#1a0000';
  const from = sector.toUpperCase();
  fit(d, from, 250, 34, 20);
  d.textAlign = 'left';
  d.fillText(from, 40, 142);
  fit(d, 'HAMDAN', 170, 34, 20);
  d.textAlign = 'right';
  d.fillText('HAMDAN', 590, 142);
  d.fillStyle = '#e10600';
  d.font = '34px ' + FONT;
  d.textAlign = 'center';
  d.fillText('\u2708\uFE0E', 340, 140);

  field(d, 'PASSENGER', name, 40, 200, 242, 380, 34, 18);
  field(d, 'FLIGHT', 'Abu Dhabi Zone', 40, 292, 334, 380, 34, 18);
  field(d, 'DATE', '29 NOV 2026', 660, 102, 142, 190, 30, 18);
  field(d, 'DAY', 'Sunday', 870, 102, 142, 170, 30, 18);
  field(d, 'BOARDING', '10:30 AM', 660, 200, 242, 190, 30, 18);
  field(d, 'GATE', 'Hamdan, Abu Dhabi', 870, 200, 242, 170, 30, 14);

  // photo (cropped exactly as framed on the page)
  const pw = 140, ph = Math.round((pw * FRAME.h) / FRAME.w), px = 450, py = 170;
  d.save();
  rr(d, px, py, pw, ph, 10);
  d.clip();
  d.drawImage(pimg, -view.x / view.s, -view.y / view.s, FRAME.w / view.s, FRAME.h / view.s, px, py, pw, ph);
  d.restore();
  d.lineWidth = 3;
  d.strokeStyle = '#e10600';
  rr(d, px, py, pw, ph, 10);
  d.stroke();

  // tear line
  d.strokeStyle = '#bbb';
  d.lineWidth = 2;
  d.setLineDash([10, 8]);
  d.beginPath();
  d.moveTo(0, 400);
  d.lineTo(cw, 400);
  d.stroke();
  d.setLineDash([]);

  // barcode: whole device pixels per module so the bars stay sharp
  const { bars, total } = code128B(payload);
  const U = Math.max(1, Math.floor(2000 / total));
  const u = U / 2;
  const x0 = 40 + Math.round(((1000 - u * total) / 2) * 2) / 2;
  d.fillStyle = '#000';
  for (const [bx, bw] of bars) d.fillRect(x0 + bx * u, 430, bw * u, 70);
  d.fillStyle = '#1a0000';
  d.font = '700 16px ' + FONT;
  spaced(d, 'ID  ' + regId, cw / 2, 522, 3, 'center');

  // footer: RSC logo + city
  const city = 'ABU DHABI CITY';
  d.font = '700 20px ' + FONT;
  d.fillStyle = '#1a0000';
  const cwid = spacedWidth(d, city, 1);
  const rh = 30, rw = (rsc.naturalWidth * rh) / rsc.naturalHeight;
  spaced(d, city, cw - 40, 547, 1, 'right');
  d.drawImage(rsc, cw - 40 - cwid - 10 - rw, 525, rw, rh);

  // perforation notches
  d.globalCompositeOperation = 'destination-out';
  d.beginPath();
  d.arc(0, 400, 14, 0, Math.PI * 2);
  d.fill();
  d.beginPath();
  d.arc(cw, 400, 14, 0, Math.PI * 2);
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
