import { BARCODE_HAS_DETAILS } from '../config.js';

// Code 128 (subset B) encoder. Pattern table: bar/space widths for symbols 0..105, then the stop pattern (106).
const TABLE = ["212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412", "211214", "211232", "2331112"];

/** Returns the dark bars as [x, width] pairs (in modules) and the total width including 10-module quiet zones. */
export function code128B(text) {
  const codes = [104];
  let sum = 104;
  for (let i = 0; i < text.length; i++) {
    const v = text.charCodeAt(i) - 32;
    if (v < 0 || v > 94) throw new Error('Unsupported character in barcode text');
    codes.push(v);
    sum += v * (i + 1);
  }
  codes.push(sum % 103, 106);
  let x = 10;
  const bars = [];
  for (const c of codes) {
    const p = TABLE[c];
    for (let k = 0; k < p.length; k++) {
      const w = +p[k];
      if (k % 2 === 0) bars.push([x, w]);
      x += w;
    }
  }
  return { bars, total: x + 10 };
}

/** What the barcode contains: the ID (default) or ID|name|sector, see BARCODE_HAS_DETAILS in config.js. */
export function barcodePayload(regId, name, sector) {
  if (!regId) return 'YOUTH CONVENE';
  if (!BARCODE_HAS_DETAILS) return String(regId);
  const nm = String(name || '').replace(/[^\x20-\x7E|]/g, '').replace(/\|/g, '/').trim().slice(0, 22);
  return regId + '|' + nm + '|' + sector;
}
