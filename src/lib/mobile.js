// Same rules as normMobile_ in Code.gs.
// UAE: 05XXXXXXXX, 5XXXXXXXX, 9715XXXXXXXX or +9715XXXXXXXX  ->  +9715XXXXXXXX
// Other countries: must start with + or 00.   Returns "+digits" or null.
export function normMobile(v) {
  const raw = String(v || '').replace(/[\s().\-]/g, '');
  if (raw.replace(/[\d+]/g, '').length) return null;
  let plus = raw.charAt(0) === '+';
  let d = raw.replace(/\D/g, '');
  if (!plus && d.indexOf('00') === 0) { d = d.slice(2); plus = true; }
  if (!plus && /^05\d{8}$/.test(d)) return '+971' + d.slice(1);
  if (!plus && /^5\d{8}$/.test(d)) return '+971' + d;
  if (/^9715\d{8}$/.test(d)) return '+' + d;
  if (plus && d.indexOf('971') !== 0 && d.length >= 8 && d.length <= 15) return '+' + d;
  return null;
}
