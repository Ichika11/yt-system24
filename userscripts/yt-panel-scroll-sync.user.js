// ==UserScript==
// @name         yt-panel-scroll-sync
// @namespace    ichika.rice
// @version      2.1.2
// @description  Dismisses YouTube's hover preview while a system24 panel scrolls and re-triggers it once scrolling stops, and draws the card's hover ring above the preview so it is never covered.
// @match        https://www.youtube.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
 * WHY THIS EXISTS
 *
 * On stock YouTube the feed scrolls the DOCUMENT and the hover preview is
 * positioned in document coordinates, so the two move together. The system24
 * theme replaces that: every browse surface is a position:fixed panel with
 * overflow-y:auto, so content scrolls INSIDE the box and the document never
 * moves. YouTube positions ytd-video-preview once, at ytd-app level, from
 * coordinates captured at hover time, and never learns the card slid away.
 *
 * TWO JOBS, and they are independent:
 *
 *   1. Keep the preview from being left behind by a panel scroll.
 *   2. Keep the card's hover ring visible while a preview is playing.
 *
 * Job 2 needs the script because the preview is a child of ytd-app, outside
 * the fixed panel's stacking context, so it paints above everything in the
 * panel including the CSS hover ring. No z-index on that ring can win — it is
 * not in the same stacking contest. CSS 2.6.1 worked around it by drawing a
 * ring on the preview itself, inset by the preview's measured 12px pop-out,
 * which only holds where the card IS the thumbnail; on a search row, five
 * times wider than its thumbnail, that ring landed mid-row as a divider.
 * Here the script knows which CARD the preview belongs to and draws one ring
 * at that card's real box, above everything, on every surface.
 *
 * WHY JOB 1 IS DONE BY HIDING, NOT GLUING
 *
 * 2.0.0 tried to glue the preview to its card with a per-frame transform.
 * It is the obvious fix and it does not work: scrolling runs on the
 * compositor at full refresh rate while JS repositioning lands a frame later,
 * so the preview visibly shakes against the card, and a scroll that ends
 * between frames leaves it stranded until something else fires. That is
 * inherent to scroll-linked JS, not a tuning problem. Do not re-attempt it
 * without a fundamentally different mechanism — reparenting the preview into
 * the card so it scrolls natively is the only real candidate, and that risks
 * breaking YouTube's own player handling.
 *
 * So job 1 is 1.9's approach, which is honest about the limitation: hide on
 * scroll, re-trigger under the cursor once scrolling stops.
 *
 * ROLLBACK: 1.9 for script-only issues. CSS template 2.6.11 expects the ring
 * to come from here; template-2.6.10.css is the last one that drew its own.
 */

(() => {
  'use strict';

  const CARD_SEL = [
    'yt-lockup-view-model',
    'ytd-rich-item-renderer',
    'ytd-video-renderer',
    'ytd-compact-video-renderer',
    'ytd-playlist-panel-video-renderer',
    'ytd-grid-video-renderer',
  ].join(',');

  // yt-collection-thumbnail-view-model is the playlist/mix thumbnail (the one
  // with the stacked sheets); without it, playlist cards find no thumb and the
  // re-trigger falls back to the card itself, which YT ignores.
  const THUMB_SEL = [
    'yt-thumbnail-view-model',
    'yt-collection-thumbnail-view-model',
    'a.yt-lockup-view-model-wiz__content-image',
    'a.ytLockupViewModelContentImage',
    'ytd-thumbnail',
    'a#thumbnail',
    'a[href*="/watch"]',
    'a[href*="list="]',
  ].join(',');

  const SETTLE = 250;   // ms of quiet before the preview is re-triggered
  const RING_Z = 2000;  // above the panels, below masthead (2350) and popups (2360)

  let mx = 0, my = 0;
  let hoverCard = null;   // card the cursor is over
  let anchor = null;      // card the visible preview belongs to
  let settleTimer = 0, poll = 0, frame = 0;
  let dismissed = false;

  const previewEl = () => document.querySelector('ytd-video-preview');

  const isVisible = (p) => {
    if (!p || p.style.display === 'none') return false;
    const r = p.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };

  // The panel a card scrolls inside. Found by walking up for a real scroller
  // rather than matching a list of page selectors — that list would have to be
  // kept in sync with the CSS, and this cannot drift out of step with it.
  const scrollParent = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 1) return p;
    }
    return null;
  };

  // ONLY THE OUTERMOST CARD RINGS — the same rule §9 of the template follows.
  //
  // 2.1.0 used closest(CARD_SEL) directly, which returns the NEAREST match
  // walking up. On a feed playlist card that is the inner yt-lockup-view-model,
  // not the ytd-rich-item-renderer wrapping it, so the script ringed the inner
  // host while the CSS ringed the larger #content box and every playlist card
  // showed two borders. Climb to the wrapper whenever there is one.
  const cardFrom = (el) => {
    if (!el || !el.closest) return null;
    const c = el.closest(CARD_SEL);
    if (!c) return null;
    return c.closest('ytd-rich-item-renderer') || c;
  };

  // The box the CSS draws its ring on, so ours lands exactly on top of it
  // instead of a few px out. Mirrors §9 of the template: #content inside a
  // rich-item, the inner host inside a lockup, the element itself otherwise.
  const ringBox = (card) =>
    card.querySelector(':scope > #content.ytd-rich-item-renderer') ||
    card.querySelector(':scope .ytLockupViewModelHost') ||
    card;

  const ring = document.createElement('div');
  ring.id = 's24-preview-ring';
  Object.assign(ring.style, {
    position: 'fixed',
    boxSizing: 'border-box',
    pointerEvents: 'none',
    display: 'none',
    zIndex: String(RING_Z),
    // var() resolves against :root, so this tracks the pywal palette and the
    // --s24-ring knob with no JS involvement.
    border: 'var(--s24-ring, 2px) solid var(--yt-hot, #fff)',
  });
  document.body.appendChild(ring);

  const hideRing = () => { ring.style.display = 'none'; };

  const drawRing = () => {
    frame = 0;
    const p = previewEl();
    if (dismissed || !anchor || !anchor.isConnected || !p || !isVisible(p)) { hideRing(); return; }

    const r = ringBox(anchor).getBoundingClientRect();
    const panel = scrollParent(anchor);
    const pane = panel
      ? panel.getBoundingClientRect()
      : { top: 0, left: 0, right: innerWidth, bottom: innerHeight };

    if (r.bottom <= pane.top || r.top >= pane.bottom) { hideRing(); return; }

    Object.assign(ring.style, {
      display: 'block',
      top: r.top + 'px',
      left: r.left + 'px',
      width: r.width + 'px',
      height: r.height + 'px',
      // the card can be half-scrolled out; clip so the ring never escapes the
      // panel and paints over the masthead
      clipPath: `inset(${Math.max(0, pane.top - r.top)}px ${Math.max(0, r.right - pane.right)}px ` +
                `${Math.max(0, r.bottom - pane.bottom)}px ${Math.max(0, pane.left - r.left)}px)`,
    });
  };

  const schedule = () => { if (!frame) frame = requestAnimationFrame(drawRing); };

  /* THE RING MUST TRACK THE ROW'S SIZE, NOT JUST THE SCROLL.
   *
   * 2.1.1 repositioned only on scroll, mousemove and window resize. A search
   * row whose chapters/AI-summary strip opens or closes changes height with
   * none of those firing, so the div kept its old top/left/width/height and
   * left a border stranded at the row's previous bottom edge until the next
   * mouse movement cleared it.
   *
   * That artifact was chased across two sessions as a CSS problem — blamed on
   * the :hover lifecycle, then on the max-height transition, then on paint
   * invalidation. It survived zeroing the CSS ring's border-width, which is
   * what finally ruled the stylesheet out: the line was always this element.
   *
   * A ResizeObserver fires per frame during a transition, so the ring now
   * animates with the row instead of snapping after it. */
  const ro = ('ResizeObserver' in window) ? new ResizeObserver(() => schedule()) : null;

  const watchAnchor = () => {
    if (!ro) return;
    ro.disconnect();
    if (!anchor) return;
    ro.observe(anchor);
    const box = ringBox(anchor);
    if (box !== anchor) ro.observe(box);
  };

  // YouTube shows the preview about a second after hover, so watch for it for
  // a bounded window rather than running a global MutationObserver.
  const watchForPreview = () => {
    clearInterval(poll);
    if (!hoverCard) return;
    let tries = 20;                        // ~4s at 200ms
    poll = setInterval(() => {
      const p = previewEl();
      if (p && isVisible(p)) { anchor = hoverCard; watchAnchor(); clearInterval(poll); schedule(); }
      else if (--tries <= 0) clearInterval(poll);
    }, 200);
  };

  const dismiss = () => {
    const p = previewEl();
    if (!p || p.style.display === 'none') return;
    p.querySelector('video')?.pause();
    p.style.display = 'none';
    p.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
  };

  const fireHover = (target) => {
    const base = { bubbles: true, cancelable: true, composed: true, clientX: mx, clientY: my, view: window };
    if (window.PointerEvent) {
      for (const type of ['pointerover', 'pointerenter', 'pointermove']) {
        target.dispatchEvent(new PointerEvent(type, { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
      }
    }
    for (const type of ['mouseover', 'mouseenter', 'mousemove']) {
      target.dispatchEvent(new MouseEvent(type, base));
    }
  };

  const rehover = () => {
    // Clear the flag and restore display BEFORE anything that can return
    // early, or a preview hidden here stays hidden with nothing to clear it.
    dismissed = false;
    const p = previewEl();
    if (p) p.style.display = '';

    const card = cardFrom(document.elementFromPoint(mx, my));
    if (!card) { hoverCard = null; anchor = null; watchAnchor(); hideRing(); return; }

    hoverCard = card;
    anchor = null;
    watchAnchor();
    hideRing();
    fireHover(card.querySelector(THUMB_SEL) || card);
    watchForPreview();
  };

  const onScroll = () => {
    dismissed = true;
    dismiss();
    hideRing();
    clearInterval(poll);
    clearTimeout(settleTimer);
    // rehover() always re-arms from here, so `dismissed` cannot stick: every
    // path that sets it also schedules the call that clears it.
    settleTimer = setTimeout(rehover, SETTLE);
  };

  document.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    if (dismissed) return;

    const card = cardFrom(e.target);
    if (card !== hoverCard) {
      hoverCard = card;
      anchor = null;
      watchAnchor();
      hideRing();
      watchForPreview();
    } else if (anchor) {
      schedule();
    }
  }, { passive: true });

  // capture:true so the horizontal shelf carousels are caught too — those
  // scroll their own container and the event never reaches window.
  addEventListener('wheel', onScroll, { passive: true, capture: true });
  document.addEventListener('scroll', onScroll, { passive: true, capture: true });
  addEventListener('resize', () => { hideRing(); schedule(); }, { passive: true });
})();
