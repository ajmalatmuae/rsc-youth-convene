// Photo frame maths. FRAME is the measured inner size of the photo frame in CSS px (88:111 ratio).
// The page updates it whenever the frame is resized, because the frame gets smaller on small screens.
export const FRAME = { w: 88, h: 111 };

export const minScale = (d) => Math.max(FRAME.w / d.w, FRAME.h / d.h);

function clampView(v, d) {
  const x = Math.min(0, Math.max(FRAME.w - d.w * v.s, v.x));
  const y = Math.min(0, Math.max(FRAME.h - d.h * v.s, v.y));
  return { s: v.s, x, y };
}

export function initialView(d) {
  const s = minScale(d);
  return { s, x: (FRAME.w - d.w * s) / 2, y: (FRAME.h - d.h * s) / 2 };
}

export function panBy(view, d, dx, dy) {
  return clampView({ s: view.s, x: view.x + dx, y: view.y + dy }, d);
}

/** Zoom to scale ns keeping the point (cx, cy) of the frame fixed. Limits: fit .. 4x fit. */
export function zoomAt(view, d, ns, cx, cy) {
  const min = minScale(d);
  const s = Math.max(min, Math.min(min * 4, ns));
  const k = s / view.s;
  return clampView({ s, x: cx - (cx - view.x) * k, y: cy - (cy - view.y) * k }, d);
}

/** Read an image file, shrink it to at most 1000 px and return { src, w, h }. */
export function prepareImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || file.type.indexOf('image/') !== 0) return reject(new Error('notimage'));
    const rd = new FileReader();
    rd.onerror = () => reject(new Error('read'));
    rd.onload = () => {
      const im = new Image();
      im.onerror = () => reject(new Error('format'));
      im.onload = () => {
        const k = Math.min(1, 1000 / Math.max(im.width, im.height));
        const w = Math.round(im.width * k);
        const h = Math.round(im.height * k);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d').drawImage(im, 0, 0, w, h);
        resolve({ src: c.toDataURL('image/jpeg', 0.9), w, h });
      };
      im.src = rd.result;
    };
    rd.readAsDataURL(file);
  });
}

export const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('image'));
    im.src = src;
  });
