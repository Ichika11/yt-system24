/* demo-mode.js — make YouTube screenshot-safe.
 *
 * Replaces video titles, channel names and thumbnails with generated
 * placeholders so you can photograph the theme without publishing your feed,
 * subscriptions or watch history.
 *
 * Paste into the browser console on any YouTube page, then screenshot.
 * Nothing is saved and nothing is sent anywhere — it only rewrites the DOM in
 * front of you. Reload to get the real page back.
 *
 * YouTube re-renders as you scroll, so newly loaded cards come back real:
 * re-run it, or call s24demo() again from the console.
 *
 * NOTE: logged-out YouTube in a private window is simpler if the page you want
 * exists there — it shows generic trending content with nothing personal in it.
 * This script is for the pages that only exist while signed in: history,
 * Watch Later, subscriptions, playlists.
 */
(() => {
  const TITLES = [
    'Building a mechanical keyboard from scratch',
    'The engineering behind suspension bridges',
    'Why this 1970s synth still sounds modern',
    'A quiet morning in the workshop — no talking',
    'Every terminal multiplexer, ranked',
    'How typefaces are actually drawn',
    'Restoring a 40-year-old film camera',
    'The physics of skipping stones',
    'I rewrote it in Rust so you do not have to',
    'Field recording: rain on a tin roof (3 hours)',
    'What makes a good map projection?',
    'Sourdough, explained properly this time',
    'The lost art of hand-cut dovetails',
    'Debugging a race condition for six hours',
    'Colour theory for people who hate theory',
    'One pot, thirty minutes, no regrets',
  ];
  const CHANNELS = [
    'Workshop Notes', 'Slow Engineering', 'The Type Foundry', 'Analog Corner',
    'Field & Signal', 'Plain Text', 'Second Draft', 'Northline Studio',
    'Paper Machines', 'Quiet Hours', 'The Long Way', 'Bench Test',
  ];
  const RAMPS = [
    ['#3b4a6b', '#7aa2f7'], ['#4a3b5c', '#bb9af7'], ['#2f4858', '#7dcfff'],
    ['#5c4a3b', '#e0af68'], ['#3b5c4a', '#9ece6a'], ['#5c3b4a', '#f7768e'],
  ];

  const swatch = (i) => {
    const [a, b] = RAMPS[i % RAMPS.length];
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 18">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/>` +
      `</linearGradient></defs><rect width="32" height="18" fill="url(%23g)"/></svg>`
        .replace('%23g', '%23g'));
  };

  const setText = (el, s) => {
    el.textContent = s;
    for (const a of ['title', 'aria-label']) if (el.hasAttribute(a)) el.setAttribute(a, s);
  };

  window.s24demo = function s24demo() {
    let n = 0;

    document.querySelectorAll(
      '#video-title, h3 a, a.ytLockupMetadataViewModelTitle, ' +
      '.shortsLockupViewModelHostMetadataTitle, yt-formatted-string#video-title'
    ).forEach((el, i) => { setText(el, TITLES[i % TITLES.length]); n++; });

    document.querySelectorAll(
      'ytd-channel-name a, #channel-name a, #text.ytd-channel-name, ' +
      '.ytLockupMetadataViewModelMetadata a, #owner-text a, #author-text'
    ).forEach((el, i) => { setText(el, CHANNELS[i % CHANNELS.length]); n++; });

    document.querySelectorAll('img').forEach((img, i) => {
      const r = img.getBoundingClientRect();
      if (r.width < 24 || r.height < 24) return;      // leave tiny UI icons alone
      img.src = swatch(i);
      img.srcset = '';
      n++;
    });

    console.log(`s24demo: replaced ${n} elements. Re-run after scrolling.`);
  };

  window.s24demo();
})();
