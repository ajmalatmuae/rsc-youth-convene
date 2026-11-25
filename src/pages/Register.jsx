import { useEffect, useMemo, useRef, useState } from 'react';
import ycLogo from '../assets/youth-convene.png';
import rscLogo from '../assets/rsc.png';
import samasthaLogo from '../assets/samastha-centenary.png';
import beMoreLogo from '../assets/be-more.png';
import { DESIGNATIONS, NAMES, SECTORS } from '../lib/names.js';
import { normMobile } from '../lib/mobile.js';
import { code128B, barcodePayload } from '../lib/code128.js';
import { FRAME, initialView, minScale, panBy, zoomAt, prepareImage } from '../lib/photo.js';
import { drawPass } from '../lib/passImage.js';
import { post, describeNetError } from '../lib/api.js';
import { REG_KEY } from '../config.js';
import '../styles/register.css';

const CAL_URL =
  'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' +
  encodeURIComponent('Youth Convene - Abu Dhabi Zone') +
  '&dates=20261129T063000Z/20261129T090000Z&location=' +
  encodeURIComponent('Hamdan, Abu Dhabi') +
  '&details=' +
  encodeURIComponent('RSC Abu Dhabi City');
const MAP_URL = 'https://maps.app.goo.gl/MhReuex4oe3BqPLJ7';

function Icon({ children }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

function registerError(code) {
  switch (code) {
    case 'duplicate':
      return 'This mobile number is already registered. If it is yours, enter the same name and sector you used before.';
    case 'invalid_mobile':
      return 'Please check your mobile number and try again.';
    case 'invalid':
      return 'Please check your name and sector, then try again.';
    case 'forbidden':
      return 'The secret code in this page does not match the SECRET in Code.gs.';
    case 'run setup first':
      return 'The sheet is not set up yet. Run setup in Apps Script first.';
    default:
      return 'The registration was not saved (' + (code || 'no reply') + '). Please try again.';
  }
}

export default function Register() {
  const [name, setName] = useState('');
  const [sector, setSector] = useState('');
  const [designation, setDesignation] = useState(''); // label under the photo only, never sent to the sheet
  const [dlAttn, setDlAttn] = useState(false); // highlight the Download button after registering
  const [mobile, setMobile] = useState('');
  const [photo, setPhoto] = useState(null); // { src, w, h }
  const [view, setView] = useState(null); // { s, x, y }
  const [regId, setRegId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [mobMsg, setMobMsg] = useState('');

  const frameRef = useRef(null);
  const dlRef = useRef(null);
  const photoRef = useRef(null);
  const ptrs = useRef(new Map());
  const pinch = useRef({ d: 0, m: null });
  photoRef.current = photo;

  useEffect(() => {
    document.title = 'Youth Convene - Councillor Pass';
  }, []);

  const mobileNorm = normMobile(mobile);
  const ready = !!(name.trim() && sector && mobileNorm && photo);
  const payload = barcodePayload(regId, name, sector);
  const barcode = useMemo(() => {
    try {
      return code128B(payload);
    } catch {
      return null;
    }
  }, [payload]);

  // Name suggestions: this sector's names, or everyone's (with the sector shown) when no sector is chosen.
  const options = useMemo(
    () =>
      sector
        ? (NAMES[sector] || []).map((n) => ({ n, l: '' }))
        : Object.entries(NAMES).flatMap(([k, v]) => v.map((n) => ({ n, l: k }))),
    [sector]
  );

  function onName(e) {
    const v = e.target.value;
    setName(v);
    if (!sector) {
      const q = v.trim().toLowerCase();
      if (q) {
        const hits = Object.keys(NAMES).filter((k) => NAMES[k].some((x) => x.toLowerCase() === q));
        if (hits.length === 1) setSector(hits[0]);
      }
    }
  }

  // ---- photo: choose, move and zoom
  async function onFile(e) {
    const input = e.target;
    const f = input.files && input.files[0];
    if (!f) return;
    setMsg('');
    try {
      const p = await prepareImage(f);
      setPhoto(p);
      setView(initialView(p));
    } catch (err) {
      setMsg(
        err && err.message === 'format'
          ? 'This image format is not supported (for example HEIC). Please choose a JPG or PNG photo.'
          : 'Could not use this photo. Try another one.'
      );
    } finally {
      try {
        input.value = '';
      } catch {
        /* ignore */
      }
    }
  }

  const rel = (e) => {
    const r = frameRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  function onPointerDown(e) {
    if (!photo) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    ptrs.current.set(e.pointerId, rel(e));
    pinch.current = { d: 0, m: null };
    e.preventDefault();
  }
  function onPointerMove(e) {
    const map = ptrs.current;
    if (!photo || !map.has(e.pointerId)) return;
    const p = rel(e);
    if (map.size === 1) {
      const prev = map.get(e.pointerId);
      map.set(e.pointerId, p);
      setView((v) => panBy(v, photo, p.x - prev.x, p.y - prev.y));
    } else {
      map.set(e.pointerId, p);
      const [a, b] = [...map.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const last = pinch.current;
      setView((v) => {
        let nv = v;
        if (last.m) nv = panBy(nv, photo, mid.x - last.m.x, mid.y - last.m.y);
        if (last.d > 0 && d > 0) nv = zoomAt(nv, photo, (nv.s * d) / last.d, mid.x, mid.y);
        return nv;
      });
      pinch.current = { d, m: mid };
    }
    e.preventDefault();
  }
  function onPointerUp(e) {
    ptrs.current.delete(e.pointerId);
    pinch.current = { d: 0, m: null };
  }
  // The frame has different sizes on different screens: keep FRAME in step and rescale the position/zoom with it.
  useEffect(() => {
    const el = frameRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      const nw = el.clientWidth;
      const nh = el.clientHeight;
      if (!nw || !nh || (nw === FRAME.w && nh === FRAME.h)) return;
      const r = nw / FRAME.w;
      FRAME.w = nw;
      FRAME.h = nh;
      setView((v) => (v ? { s: v.s * r, x: v.x * r, y: v.y * r } : v));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // React attaches wheel listeners as passive, so this one is added by hand to be able to stop page scrolling.
  useEffect(() => {
    const el = frameRef.current;
    if (!el || !photo) return undefined;
    const h = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      setView((v) => zoomAt(v, photoRef.current, v.s * Math.exp(-e.deltaY * 0.002), x, y));
    };
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  }, [photo]);

  function removePhoto() {
    setPhoto(null);
    setView(null);
    setMsg('');
  }

  // After registering, bring the Download button into view and focus it.
  useEffect(() => {
    if (!regId || !dlAttn) return undefined;
    const t = setTimeout(() => {
      const el = dlRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
    }, 80);
    return () => clearTimeout(t);
  }, [regId, dlAttn]);

  // ---- register, then download
  async function register() {
    if (!ready || busy || regId) return;
    setMsg('');
    setBusy(true);
    try {
      const j = await post({ key: REG_KEY, name: name.trim(), sector, mobile: mobileNorm });
      if (j && j.ok && j.id) {
        setRegId(String(j.id));
        setDlAttn(true);
      }
      else setMsg(registerError(j && j.error));
    } catch (err) {
      console.error(err);
      setMsg(describeNetError(err));
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (!regId || !photo || !view) return;
    setDlAttn(false);
    try {
      const cv = await drawPass({ name: name.trim(), sector, designation, regId, payload, photo, view });
      const blob = await new Promise((resolve) => cv.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('blob');
      const url = URL.createObjectURL(blob);
      const nm = name.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Youth-Convene-Councillor-Pass' + (nm ? '-' + nm : '') + '.png';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 1500);
    } catch (err) {
      console.error(err);
      setMsg('Could not create the Councillor Pass image. Please try again.');
    }
  }

  const hint = regId
    ? photo
      ? ''
      : 'Add a photo to download your pass.'
    : ready
    ? ''
    : 'Add your name, sector, mobile number and photo to register.';
  const locked = !!regId;

  return (
    <div className="reg-root">
      <div className="head">
        <span className="plate plate-l">
          <img src={samasthaLogo} alt="Samastha Centenary" />
        </span>
        <img className="yc" src={ycLogo} alt="Youth Convene" />
        <span className="plate plate-r">
          <img src={beMoreLogo} alt="Be In, Be More" />
        </span>
      </div>
      <p className="sub">You're cleared for boarding. Your seat is reserved.</p>

      <div className="ticket">
        <div className="bar-top">
          <span>COUNCILLOR PASS</span>
        </div>
        <div className="main">
          <div className="photo-wrap">
            <div
              ref={frameRef}
              className={'photo' + (photo ? ' has' : '') + (designation ? ' tagged' : '')}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              data-testid="photo-frame"
            >
              {photo && view ? (
                <img
                  src={photo.src}
                  alt="Your photo"
                  draggable={false}
                  style={{
                    width: photo.w,
                    height: photo.h,
                    transform: `translate(${view.x}px,${view.y}px) scale(${view.s})`,
                  }}
                />
              ) : (
                'PHOTO'
              )}
            </div>
            {designation && <div className="photo-label">{designation}</div>}
          </div>
          <div className="route">
            <div className="r-from">
              <div>
                <small>FROM</small>
                <b>{(sector || 'YOUR SECTOR').toUpperCase()}</b>
              </div>
              <div className="plane">&#9992;</div>
            </div>
            <div className="r-to">
              <small>TO</small>
              <b>HAMDAN</b>
            </div>
          </div>
          <div className="pair r4">
            <div className="f f-name">
              <small>NAME</small>
              <span>{name.trim() || 'Sector Council Member'}</span>
            </div>
            <div className="f">
              <small>FLIGHT</small>
              <span>Abu Dhabi City Zone</span>
            </div>
          </div>
          <div className="pair r2">
            <div className="f">
              <small>DATE</small>
              <span>29 NOV 2026</span>
            </div>
            <div className="f">
              <small>DAY</small>
              <span>Sunday</span>
            </div>
          </div>
          <div className="pair r3">
            <div className="f">
              <small>BOARDING</small>
              <span>10:30 AM</span>
            </div>
            <div className="f">
              <small>GATE</small>
              <span>Fogg International</span>
            </div>
          </div>
        </div>
        <div className="tear" />
        <div className="foot">
          <div className="bcwrap">
          <div className="bar" role="img" aria-label={'Barcode: ' + payload} data-testid="barcode">
            {barcode && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox={`0 0 ${barcode.total} 1`}
                preserveAspectRatio="none"
                shapeRendering="crispEdges"
              >
                <rect width={barcode.total} height="1" fill="#fff" />
                <g fill="#000">
                  {barcode.bars.map(([x, w]) => (
                    <rect key={x} x={x} y="0" width={w} height="1" />
                  ))}
                </g>
              </svg>
            )}
          </div>
          {regId && <div className="idcap">ID {regId}</div>}
          </div>
          <div className="rsc-group">
            <img src={rscLogo} alt="RSC Risala Study Circle" />
            <span className="city">Abu Dhabi City</span>
          </div>
        </div>
      </div>

      <div className="form">
        <input
          value={name}
          onChange={onName}
          placeholder="Your name"
          maxLength={60}
          autoComplete="off"
          list="nm-list"
          disabled={locked}
          aria-label="Your name"
        />
        <datalist id="nm-list">
          {options.map((o) => (
            <option key={o.l + o.n} value={o.n} label={o.l || undefined} />
          ))}
        </datalist>
        <select value={designation} onChange={(e) => setDesignation(e.target.value)} aria-label="Designation">
          <option value="">Select designation</option>
          {DESIGNATIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select value={sector} onChange={(e) => setSector(e.target.value)} disabled={locked} aria-label="Your sector">
          <option value="">Select your sector</option>
          {SECTORS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="Mobile number (e.g. 05X XXX XXXX)"
          aria-label="Mobile number"
          value={mobile}
          disabled={locked}
          onChange={(e) => {
            setMobile(e.target.value);
            setMobMsg('');
          }}
          onBlur={() =>
            setMobMsg(
              mobile.trim() && !normMobile(mobile)
                ? 'Enter a UAE mobile like 05X XXX XXXX, or an international number starting with +.'
                : ''
            )
          }
        />

        <div className="pbtns">
          <label className="btn alt pbtn ib" title="Upload photo">
            <Icon>
              <path d="M12 16V4m0 0L7 9m5-5l5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
            </Icon>
            <input type="file" accept="image/*" onChange={onFile} aria-label="Upload photo" />
          </label>
          <label className="btn alt pbtn ib" title="Take photo">
            <Icon>
              <path d="M4 8h3l2-3h6l2 3h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" />
              <circle cx="12" cy="13" r="3.5" />
            </Icon>
            <input type="file" accept="image/*" capture="user" onChange={onFile} aria-label="Take photo" />
          </label>
        </div>

        {photo && view && (
          <>
            <div className="zrow">
              <span>Zoom</span>
              <input
                type="range"
                min="1"
                max="4"
                step="0.01"
                value={view.s / minScale(photo)}
                onChange={(e) =>
                  setView((v) => zoomAt(v, photo, minScale(photo) * parseFloat(e.target.value), FRAME.w / 2, FRAME.h / 2))
                }
                aria-label="Zoom photo"
              />
            </div>
            <div className="zhint">Drag the photo on the pass to move it. Pinch, scroll or use the slider to zoom.</div>
          </>
        )}
        {(msg || mobMsg) && (
          <div className="pmsg" role="alert">
            {msg || mobMsg}
          </div>
        )}
        {photo && (
          <button type="button" className="rm" onClick={removePhoto}>
            Remove photo
          </button>
        )}

        {!regId && (
          <button type="button" className="btn wide dl rg" disabled={!ready || busy} onClick={register}>
            <Icon>
              <path d="M15 19v-1.5a3.5 3.5 0 00-3.5-3.5h-4A3.5 3.5 0 004 17.5V19M9.5 11a3 3 0 100-6 3 3 0 000 6zM19 8v6M16 11h6" />
            </Icon>
            <span>{busy ? 'Registering...' : 'Register'}</span>
          </button>
        )}
        {regId && (
          <>
            <div className="rstat" role="status">
              Registered. Your ID: <b>{regId}</b>
            </div>
            <button
              type="button"
              className="rm"
              onClick={() => {
                setRegId(null);
                setDlAttn(false);
                setMsg('');
              }}
            >
              Edit details (a new ID will be issued)
            </button>
            <button
              type="button"
              ref={dlRef}
              className={'btn alt wide dl' + (dlAttn ? ' attn' : '')}
              disabled={!photo}
              onClick={download}
            >
              <Icon>
                <path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 20h14" />
              </Icon>
              <span>Download Councillor Pass</span>
            </button>
          </>
        )}
        <div className="zhint">
          Registering saves your name, sector and mobile number with the organisers. Your mobile number is not shown on
          the pass.
        </div>
        {hint && <div className="zhint">{hint}</div>}

        <a className="btn alt ib" href={CAL_URL} target="_blank" rel="noopener noreferrer" aria-label="Add to calendar" title="Add to calendar">
          <Icon>
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5" />
          </Icon>
        </a>
        <a className="btn alt ib" href={MAP_URL} target="_blank" rel="noopener noreferrer" aria-label="Open location" title="Open location">
          <Icon>
            <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" />
            <circle cx="12" cy="10" r="2.5" />
          </Icon>
        </a>
      </div>
    </div>
  );
}
