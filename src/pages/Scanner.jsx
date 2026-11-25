import { useCallback, useEffect, useRef, useState } from 'react';
import { post, describeNetError } from '../lib/api.js';
import { ZXING_URL } from '../config.js';
import '../styles/scanner.css';

/** Accepts the full barcode text (YC-0007|Name|Sector), "YC-0007", "0007" or "7". */
function parseId(text) {
  let t = String(text || '').split('|')[0].trim().toUpperCase();
  if (/^\d{1,6}$/.test(t)) t = 'YC-' + ('0000' + t).slice(-4);
  return /^YC-\d{4,6}$/.test(t) ? t : null;
}

function pinMessage(code) {
  switch (code) {
    case 'bad_pin':
      return 'Wrong PIN.';
    case 'locked':
      return 'Too many wrong PINs. Wait 10 minutes.';
    case 'pin_not_set':
      return 'Check-in is off: set SCAN_PIN in Code.gs and deploy a New version.';
    case 'run setup first':
      return 'Run setup in Apps Script first.';
    default:
      return 'Could not unlock (' + (code || 'no reply') + ').';
  }
}

function netMessage(err) {
  const m = err && err.message;
  if (m === 'badjson') return describeNetError(err);
  if (err && err.name === 'AbortError') return 'The sheet took too long to answer. Try again.';
  return 'No connection to the sheet (' + (m || 'network error') + ').';
}

// One shared AudioContext. Browsers only allow sound after a tap, so it is created/resumed on the first tap or key press;
// reads from the camera happen without a tap and would otherwise be silent.
const audio = { ctx: null };
function unlockAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audio.ctx) audio.ctx = new AC();
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
  } catch {
    /* ignore */
  }
}
function tone(freq, start, dur, vol = 0.25) {
  const c = audio.ctx;
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.02);
}
const SOUNDS = {
  read: () => tone(1500, 0, 0.09), // a code was read (before the sheet answers)
  ok: () => {
    tone(880, 0, 0.12);
    tone(1320, 0.14, 0.2);
  },
  warn: () => {
    tone(660, 0, 0.14);
    tone(660, 0.22, 0.14);
  },
  bad: () => tone(200, 0, 0.4),
};
const VIBRATE = { read: 30, ok: 60, warn: [60, 50, 60], bad: [120, 60, 120] };
function play(kind) {
  try {
    SOUNDS[kind]();
  } catch {
    /* ignore */
  }
  try {
    if (navigator.vibrate) navigator.vibrate(VIBRATE[kind]);
  } catch {
    /* ignore */
  }
}

export default function Scanner() {
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [gateMsg, setGateMsg] = useState('');
  const [gateBusy, setGateBusy] = useState(false);
  const [counts, setCounts] = useState({ checkedIn: 0, total: 0 });
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null); // { cls, big, name, meta }
  const [log, setLog] = useState([]);
  const [camOn, setCamOn] = useState(false);
  const [camMsg, setCamMsg] = useState('');
  const [lastRead, setLastRead] = useState('');

  const pinRef = useRef('');
  const busyRef = useRef(false);
  const lastRef = useRef({ id: '', at: 0 });
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const zxRef = useRef(null);
  const camOnRef = useRef(false);
  const checkinRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const unlock = () => unlockAudio();
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    document.title = 'Youth Convene - Check-in';
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.content = 'noindex, nofollow';
  }, []);

  const applyCounts = (j) => {
    if (j && typeof j.checkedIn === 'number' && typeof j.total === 'number') {
      setCounts({ checkedIn: j.checkedIn, total: j.total });
    }
  };

  // ---- PIN gate
  const unlock = useCallback(async (p) => {
    setGateMsg('');
    setGateBusy(true);
    try {
      const j = await post({ action: 'stats', pin: p }, 20000);
      if (j && j.ok) {
        pinRef.current = p;
        try {
          sessionStorage.setItem('yc_pin', p);
        } catch {
          /* ignore */
        }
        applyCounts(j);
        setUnlocked(true);
      } else {
        try {
          sessionStorage.removeItem('yc_pin');
        } catch {
          /* ignore */
        }
        setGateMsg(pinMessage(j && j.error));
      }
    } catch (err) {
      console.error(err);
      setGateMsg(netMessage(err));
    } finally {
      setGateBusy(false);
    }
  }, []);

  useEffect(() => {
    let saved = '';
    try {
      saved = sessionStorage.getItem('yc_pin') || '';
    } catch {
      /* ignore */
    }
    if (saved) unlock(saved);
  }, [unlock]);

  useEffect(() => {
    if (unlocked && inputRef.current) inputRef.current.focus();
  }, [unlocked]);

  // ---- check-in
  async function checkin(text) {
    const raw = String(text || '').trim();
    const id = parseId(raw);
    const key = id || raw;
    const now = Date.now();
    // ignore the same code repeating while the camera is still pointed at it
    if (busyRef.current || (key === lastRef.current.id && now - lastRef.current.at < (id ? 4000 : 2500))) return;
    lastRef.current = { id: key, at: now };
    setLastRead(raw.slice(0, 60));
    if (!id) {
      setResult({ cls: 'bad', big: 'Not a valid pass', name: '', meta: raw.slice(0, 40) });
      play('bad');
      return;
    }
    busyRef.current = true;
    play('read');
    setResult({ cls: 'busy', big: 'Checking ' + id + '...', name: '', meta: '' });
    const addLog = (cls, t) =>
      setLog((l) =>
        [{ cls, text: t, t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...l].slice(0, 10)
      );
    try {
      const j = await post({ action: 'checkin', pin: pinRef.current, id }, 20000);
      lastRef.current.at = Date.now();
      applyCounts(j);
      if (j && j.ok && j.status === 'checked_in') {
        setResult({ cls: 'ok', big: 'Checked in', name: j.name, meta: j.sector + '  |  ' + j.id });
        play('ok');
        addLog('ok', j.name + ' (' + j.id + ')');
      } else if (j && j.ok && j.status === 'already') {
        setResult({
          cls: 'warn',
          big: 'Already checked in',
          name: j.name,
          meta: j.sector + '  |  ' + j.id + '  |  first scan ' + j.at,
        });
        play('warn');
        addLog('warn', j.name + ' (' + j.id + ') again');
      } else if (j && j.error === 'not_found') {
        setResult({ cls: 'bad', big: 'ID not found', name: id, meta: 'This pass is not in the registration sheet.' });
        play('bad');
        addLog('bad', id + ' not found');
      } else if (j && (j.error === 'bad_pin' || j.error === 'locked' || j.error === 'pin_not_set')) {
        setResult({ cls: 'bad', big: 'Locked', name: pinMessage(j.error), meta: '' });
        play('bad');
      } else {
        setResult({ cls: 'bad', big: 'Could not check in', name: (j && j.error) || 'no reply', meta: '' });
        play('bad');
      }
    } catch (err) {
      console.error(err);
      lastRef.current.id = '';
      setResult({ cls: 'bad', big: 'No connection', name: netMessage(err), meta: 'Scan again when the connection is back.' });
      play('bad');
    } finally {
      busyRef.current = false;
    }
  }
  checkinRef.current = checkin; // camera callbacks always call the latest version

  function onSubmit(e) {
    e.preventDefault();
    unlockAudio();
    const v = code;
    setCode('');
    lastRef.current = { id: '', at: 0 };
    checkin(v);
    if (inputRef.current) inputRef.current.focus();
  }

  // ---- camera
  const stopCam = useCallback(() => {
    camOnRef.current = false;
    clearTimeout(timerRef.current);
    try {
      if (zxRef.current && zxRef.current.reset) zxRef.current.reset();
    } catch {
      /* ignore */
    }
    zxRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamOn(false);
  }, []);

  useEffect(() => {
    const onHide = () => {
      if (document.hidden && camOnRef.current) stopCam();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      stopCam();
    };
  }, [stopCam]);

  function startZxing() {
    return new Promise((resolve, reject) => {
      const go = () => {
        try {
          const ZX = window.ZXing;
          const hints = new Map();
          hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [ZX.BarcodeFormat.CODE_128]);
          hints.set(ZX.DecodeHintType.TRY_HARDER, true);
          const reader = new ZX.BrowserMultiFormatReader(hints);
          zxRef.current = reader;
          reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } }, videoRef.current, (result) => {
            if (result) checkinRef.current(result.getText());
          });
          resolve();
        } catch (e) {
          reject(e);
        }
      };
      if (window.ZXing) {
        go();
        return;
      }
      const s = document.createElement('script');
      s.src = ZXING_URL;
      s.onload = go;
      s.onerror = () => reject(new Error('Could not load the scanner library. Check the internet connection.'));
      document.head.appendChild(s);
    });
  }

  async function startCam() {
    unlockAudio();
    if (camOnRef.current) {
      stopCam();
      return;
    }
    setCamMsg('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCamMsg(
        'This browser cannot use the camera here. The page must be opened over https. You can still use a scanner gun or type the ID.'
      );
      return;
    }
    camOnRef.current = true;
    setCamOn(true);
    try {
      if ('BarcodeDetector' in window) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        streamRef.current = stream;
        try {
          await stream.getVideoTracks()[0].applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
        } catch {
          /* not supported on this phone */
        }
        const v = videoRef.current;
        v.srcObject = stream;
        await v.play();
        const detector = new window.BarcodeDetector({ formats: ['code_128'] });
        const loop = async () => {
          if (!camOnRef.current) return;
          if (v.readyState >= 2) {
            try {
              const codes = await detector.detect(v);
              if (codes && codes.length) checkinRef.current(codes[0].rawValue);
            } catch {
              /* keep scanning */
            }
          }
          timerRef.current = setTimeout(loop, 200);
        };
        loop();
      } else {
        await startZxing();
      }
    } catch (err) {
      console.error(err);
      stopCam();
      setCamMsg(
        err && err.name === 'NotAllowedError'
          ? 'Camera permission was blocked. Allow the camera for this site, or use a scanner gun / type the ID.'
          : 'Camera could not start (' + ((err && err.message) || 'error') + '). You can still use a scanner gun or type the ID.'
      );
    }
  }

  return (
    <div className="scan-root">
      <main>
        <h1>Youth Convene: Check-in</h1>
        <p className="sub">Abu Dhabi Zone. Scan the barcode on the Councillor Pass.</p>

        {!unlocked && (
          <section>
            <input
              type="password"
              autoComplete="off"
              autoCapitalize="off"
              placeholder="Staff PIN"
              aria-label="Staff PIN"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (pinInput.trim()) unlock(pinInput.trim());
                }
              }}
            />
            <div className="row">
              <button
                type="button"
                style={{ flex: 1 }}
                disabled={gateBusy}
                onClick={() => pinInput.trim() && unlock(pinInput.trim())}
              >
                Unlock
              </button>
            </div>
            <div className="msg" role="alert">
              {gateMsg}
            </div>
          </section>
        )}

        {unlocked && (
          <section>
            <div className="count">
              <span>Checked in</span>
              <span>
                <b data-testid="cin">{counts.checkedIn}</b> / <span data-testid="ctot">{counts.total}</span>
              </span>
            </div>

            <div className={'cam' + (camOn ? ' on' : '')}>
              <video ref={videoRef} playsInline muted />
            </div>
            <div className="row">
              <button type="button" className="alt" style={{ flex: 1 }} onClick={startCam}>
                {camOn ? 'Stop camera' : 'Start camera'}
              </button>
            </div>
            <div className="msg" role="alert">
              {camMsg}
            </div>
            {camOn && !camMsg && (
              <div className="hint">
                Camera on. Hold the barcode inside the yellow box. {lastRead ? 'Last read: ' + lastRead : 'Nothing read yet.'}
              </div>
            )}

            <form onSubmit={onSubmit} autoComplete="off">
              <div className="row">
                <input
                  ref={inputRef}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Scan, or type ID (YC-0007)"
                  autoCapitalize="characters"
                  autoComplete="off"
                  aria-label="Pass ID"
                />
                <button type="submit">Check in</button>
              </div>
            </form>

            <div className={"result " + (result ? result.cls : "")} role="status" aria-live="polite" data-testid="result">
              {result && (
                <>
                  <div className="big">{result.big}</div>
                  {result.name && <div className="name">{result.name}</div>}
                  {result.meta && <div className="meta">{result.meta}</div>}
                </>
              )}
            </div>

            <h2>Recent</h2>
            <ul>
              {log.map((x, i) => (
                <li key={i} className={x.cls}>
                  <span>{x.text}</span>
                  <span className="t">{x.t}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
