import { API_URL } from '../config.js';

/** POST JSON (as text/plain, which avoids a CORS preflight) to the Apps Script web app and parse the JSON reply. */
export async function post(payload, timeoutMs = 25000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: ctl.signal,
    });
    const text = await r.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('badjson');
    }
  } finally {
    clearTimeout(timer);
  }
}

export function describeNetError(err) {
  const m = err && err.message;
  if (m === 'badjson')
    return 'The sheet replied with a web page instead of data. In Apps Script, set the Web app access to "Anyone" and deploy a New version.';
  if (err && err.name === 'AbortError') return 'The sheet took too long to answer. Please try again.';
  return 'Could not reach the sheet (' + (m || 'network error') + '). The page may be blocked from calling Google Apps Script.';
}
