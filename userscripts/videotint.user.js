// ==UserScript==
// @name         YouTube VideoTint
// @namespace    ichika
// @version      1.10
// @description  Retint the YouTube Pywal theme from the current video's thumbnail — or, on channel pages, from the channel's banner + avatar; sync YouTube's native dark mode to palette luminance; tint the "Next" tooltip from the upcoming video's thumbnail
// @match        https://www.youtube.com/*
// @grant        GM_registerMenuCommand
// @grant        GM.getValue
// @grant        GM.setValue
// @run-at       document-idle
// ==/UserScript==
(async () => {
  const root = document.documentElement;
  const VARS = ['--yt-bg','--yt-panel','--yt-line','--yt-line-soft',
                '--yt-hot','--yt-hot-lime','--yt-hot-rose','--yt-text','--yt-muted'];
  let enabled = await GM.getValue('videotint', true);
  const hex = c => '#' + [c.r,c.g,c.b].map(v =>
    Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
  const rgba = (c,a) => `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${a})`;
  const mix = (a,b,t) => ({r:a.r*(1-t)+b.r*t, g:a.g*(1-t)+b.g*t, b:a.b*(1-t)+b.b*t});
  const BLACK = {r:0,g:0,b:0}, WHITE = {r:255,g:255,b:255};
  const lum = c => (0.2126*c.r + 0.7152*c.g + 0.0722*c.b) / 255;
  const sat = c => { const mx=Math.max(c.r,c.g,c.b), mn=Math.min(c.r,c.g,c.b); return mx ? (mx-mn)/mx : 0; };
  // ── mode sync: flip YouTube's native dark attr to match the active palette ──
  const parseColor = s => {
    s = s.trim();
    let m = s.match(/^#([0-9a-f]{6})$/i);
    if (m) return {r:parseInt(m[1].slice(0,2),16), g:parseInt(m[1].slice(2,4),16), b:parseInt(m[1].slice(4,6),16)};
    m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) return {r:+m[1], g:+m[2], b:+m[3]};
    return null;
  };
  function syncMode() {
    const bg = parseColor(getComputedStyle(root).getPropertyValue('--yt-bg') || '');
    if (!bg) return;                              // Stylus not injected yet: leave as-is
    const wantDark = lum(bg) <= 0.5;
    if (wantDark === root.hasAttribute('dark')) return;  // already correct: no write, no observer echo
    wantDark ? root.setAttribute('dark', '') : root.removeAttribute('dark');
  }
  // YouTube re-asserts the attr on SPA navigation and app boot: re-sync when it does
  new MutationObserver(syncMode).observe(root, {attributes: true, attributeFilter: ['dark']});
  const clearVars = () => { VARS.forEach(v => root.style.removeProperty(v)); syncMode(); };
  // ── image sources per page type ──
  // watch page -> video thumbnail; channel page -> banner + avatar; else -> pywal
  function urlsForPage() {
    const vid = new URLSearchParams(location.search).get('v');
    if (vid) return [`https://i.ytimg.com/vi/${vid}/mqdefault.jpg`];
    if (/^\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)/.test(location.pathname)) {
      const urls = [];
      const banner = document.querySelector('yt-image-banner-view-model img');
      if (banner && banner.src) urls.push(banner.src);
      const avatar = document.querySelector(
        'yt-decorated-avatar-view-model img, ytd-tabbed-page-header #avatar img, ytd-c4-tabbed-header-renderer #avatar img');
      if (avatar && avatar.src) urls.push(avatar.src);
      if (!urls.length) {                          // header not mounted yet: og fallback
        const link = document.querySelector('link[rel="image_src"]');
        if (link && link.href) urls.push(link.href);
      }
      return urls.length ? urls : null;
    }
    return null;
  }
  const loadImg = url => new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';                   // DOM imgs are tainted; reload clean
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
  // ── extraction: one or more images drawn side-by-side into one sample canvas ──
  function extract(imgs) {
    const w=64, h=36, cv=document.createElement('canvas');
    cv.width=w; cv.height=h;
    const x = cv.getContext('2d');
    const n = imgs.length;
    imgs.forEach((im, i) => x.drawImage(im, i*w/n, 0, w/n, h));
    const d = x.getImageData(0, 0, w, h).data;
    const buckets = {};
    for (let i=0; i<d.length; i+=4) {
      const key = ((d[i]>>5)<<10) | ((d[i+1]>>5)<<5) | (d[i+2]>>5);
      const k = (buckets[key] ??= [0,0,0,0]);
      k[0]+=d[i]; k[1]+=d[i+1]; k[2]+=d[i+2]; k[3]++;
    }
    const cols = Object.values(buckets)
      .map(([r,g,b,n]) => ({r:r/n, g:g/n, b:b/n, n}))
      .sort((a,b) => b.n - a.n);
    const dom = cols[0];
    const vivid = cols.filter(c => c.n > 8)
      .sort((a,b) => sat(b)*Math.sqrt(b.n) - sat(a)*Math.sqrt(a.n))[0] || dom;
    return {dom, vivid};
  }
  function palette({dom, vivid}) {
    const DARK_ONLY = true;                      // clamp: never produce a light theme
    let bg    = mix(dom, BLACK, 0.80);
    let panel = mix(dom, BLACK, 0.73);
    if (DARK_ONLY) {
      for (let i = 0; i < 24 && lum(bg) > 0.30; i++)    bg    = mix(bg, BLACK, 0.2);
      for (let i = 0; i < 24 && lum(panel) > 0.38; i++) panel = mix(panel, BLACK, 0.2);
    }
    // Accents must clear whichever surface they can land on. Chips, buttons and
    // cards are painted --yt-panel, not --yt-bg, and panel is the LIGHTER of the
    // two: with bright artwork the DARK_ONLY clamps can leave bg at ~0.05 and
    // panel at ~0.38, so a bg-only constraint permitted a 0.02 gap against the
    // surface the text actually sits on. Measure against the lighter one.
    const surface = Math.max(lum(bg), lum(panel));
    let accent = mix(vivid, WHITE, 0.25);
    for (let i = 0; i < 24 && lum(accent) - surface < 0.35; i++)
      accent = mix(accent, WHITE, 0.15);
    const lime = mix(accent, WHITE, 0.25);       // tier 2
    const rose = mix(accent, WHITE, 0.45);       // tier 3 — comments/sidebar, brightest
    let text = mix(vivid, WHITE, 0.85);
    for (let i = 0; i < 24 && lum(text) - surface < 0.55; i++)
      text = mix(text, WHITE, 0.2);
    return {
      '--yt-bg': hex(bg), '--yt-panel': hex(panel),
      '--yt-line': rgba(accent, 0.5), '--yt-line-soft': rgba(accent, 0.22),
      '--yt-hot': hex(accent), '--yt-hot-lime': hex(lime), '--yt-hot-rose': hex(rose),
      '--yt-text': hex(text), '--yt-muted': rgba(text, 0.6),
    };
  }
  let tintSeq = 0;                                // stale-async guard across SPA navs
  async function retint() {
    if (!enabled) { syncMode(); return; }
    const urls = urlsForPage();
    if (!urls) { clearVars(); return; }
    const seq = ++tintSeq;
    const results = await Promise.allSettled(urls.map(loadImg));
    if (seq !== tintSeq) return;                  // user navigated away mid-load
    const imgs = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    if (!imgs.length) { syncMode(); return; }     // CORS/decode failure: keep pywal colors
    try {
      const p = palette(extract(imgs));
      for (const [k,v] of Object.entries(p)) root.style.setProperty(k, v, 'important');
    } catch (e) { /* tainted canvas or decode issue: keep pywal colors */ }
    syncMode();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NEXT-TOOLTIP TINT  (v1.4)
  // CSS cannot read colours out of an image, so the "Next  SHIFT+N" strip is
  // tinted here instead. YouTube already paints the upcoming video's thumbnail
  // as a background-image on .ytp-tooltip-bg — we read that URL rather than
  // guessing the next video id, so it stays correct for queues, mixes and
  // autoplay alike.
  //
  // Contract with the stylesheet: we set --yt-next-tint / --yt-next-ink and a
  // data-s24-tint attribute ON THAT TOOLTIP ONLY. Without this script nothing
  // carries the attribute, no rule matches, and the tooltip renders plain — the
  // theme keeps working standalone with no JS dependency.
  // ══════════════════════════════════════════════════════════════════════════
  const tintCache = new Map();                    // url -> {fill, ink} | null

  const urlFromBg = el => {
    const m = getComputedStyle(el).backgroundImage.match(/url\(["']?(.*?)["']?\)/);
    return m && m[1] && m[1] !== 'none' ? m[1] : null;
  };

  async function sampleTint(url) {
    if (tintCache.has(url)) return tintCache.get(url);
    let out = null;
    try {
      const {vivid} = extract([await loadImg(url)]);
      // pull the fill down so theme ink can sit on it, the same move `palette`
      // makes for --yt-bg; then pick whichever ink actually clears it
      const fill = mix(vivid, BLACK, 0.55);
      const ink  = lum(fill) > 0.45 ? BLACK : WHITE;
      out = {fill: hex(fill), ink: hex(ink)};
    } catch (e) { out = null; }                   // CORS/decode: leave it plain
    tintCache.set(url, out);
    return out;
  }

  // YouTube serves the Next preview as hqdefault.jpg — 480x360, 4:3, with black
  // bars PADDED IN around anything that isn't 16:9 (square album art especially).
  // Those bars are pixels in the file, so no amount of background-size can crop
  // them predictably. mqdefault.jpg is a true 16:9 crop with no padding, so swap
  // to it and every card fills edge to edge. Verified to load before swapping,
  // so a 404 silently leaves YouTube's own image in place.
  function normaliseThumb(bgEl, url) {
    const id = (url.match(/\/vi\/([^/?#]+)\//) || [])[1];
    if (!id || /mqdefault/.test(url)) return;
    const clean = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
    loadImg(clean)
      .then(() => bgEl.style.setProperty('background-image', `url("${clean}")`, 'important'))
      .catch(() => {});
  }

  function clearTint(tip) {
    delete tip.dataset.s24Tint;
    delete tip.dataset.s24TintUrl;
    delete tip.dataset.s24Fill;
    tip.style.removeProperty('--yt-next-tint');
    tip.style.removeProperty('--yt-next-ink');
    // normaliseThumb() wrote an inline !important background-image on the image
    // layer. YouTube reuses ONE .ytp-tooltip element for every control, so
    // leaving it set made the next video's thumbnail appear inside the Pause /
    // Subtitles / Full-screen tooltips.
    const bg = tip.querySelector('.ytp-tooltip-bg');
    if (bg) bg.style.removeProperty('background-image');
  }
  // every .ytp-tooltip, not just ones still flagged: the flag can be dropped
  // while the injected background-image lingers
  const clearAllTints = () =>
    document.querySelectorAll('.ytp-tooltip').forEach(clearTint);

  let nextHover = false;          // is the pointer on the next button RIGHT NOW
  let tintTimers = [];

  async function tintNextTooltip() {
    if (!enabled || !nextHover) return;   // pointer left before this fired
    for (const tip of document.querySelectorAll('.ytp-tooltip')) {
      if (getComputedStyle(tip).display === 'none') continue;
      const bgEl = tip.querySelector('.ytp-tooltip-bg');
      if (!bgEl) continue;
      const url = urlFromBg(bgEl);
      if (!url) continue;
      if (tip.dataset.s24TintUrl === url) return;  // already tinted for this frame
      const c = await sampleTint(url);
      if (!c) return;
      tip.style.setProperty('--yt-next-tint', c.fill);
      tip.style.setProperty('--yt-next-ink',  c.ink);
      tip.dataset.s24Tint = '1';
      tip.dataset.s24TintUrl = url;
      // Seek/chapter previews are a STORYBOARD SPRITE: one big sheet cropped to
      // a cell with background-position, and background-repeat is `repeat`.
      // Resizing those tiles in the neighbouring frames. Only a single-image
      // thumbnail (/vi/...) is safe to full-bleed, so flag that case and let
      // the stylesheet key its edge-to-edge rules off this attribute.
      if (!/\/sb\/|storyboard/i.test(url)) {
        tip.dataset.s24Fill = '1';
        normaliseThumb(bgEl, url);
      }
      return;
    }
  }

  // delegated so it survives the player re-rendering its control bar
  document.addEventListener('mouseover', e => {
    const t = e.target;
    if (t && t.closest && t.closest('.ytp-next-button')) {
      nextHover = true;
      tintTimers.forEach(clearTimeout);
      tintTimers = [
        setTimeout(tintNextTooltip, 60),           // tooltip mounts a frame later
        setTimeout(tintNextTooltip, 240),          // ...and the image can lag it
      ];
    }
  }, true);
  document.addEventListener('mouseout', e => {
    const t = e.target;
    if (t && t.closest && t.closest('.ytp-next-button')) {
      nextHover = false;
      tintTimers.forEach(clearTimeout);            // a pending 240ms re-tint would
      tintTimers = [];                             // otherwise land on whatever
      clearAllTints();                             // tooltip is showing by then
    }
  }, true);

  GM_registerMenuCommand('Toggle VideoTint', async () => {
    enabled = !enabled;
    await GM.setValue('videotint', enabled);
    if (enabled) { retint(); } else { clearVars(); clearAllTints(); }
  });
  // channel header mounts after navigate-finish: fire now and once more when it's up
  window.addEventListener('yt-navigate-finish', () => { retint(); setTimeout(retint, 900); clearAllTints(); });
  retint();
  syncMode();
})();
