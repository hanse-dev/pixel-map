'use strict';
// Counting without cookies (GoatCounter): page views and a few events (building opened, walk started or
// finished, theme, search, read aloud). Nothing is sent unless config/analytics.json names a code,
// and nothing that identifies a person: only what was used, never by whom.
window.pixelMapCount = (path, title) => {
  try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: 'event/' + path, title: title || path, event: true }) } catch {}
};
