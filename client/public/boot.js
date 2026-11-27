// A first visit to the sample inbox starts on the welcome's green, not a flash of beige.
// Live mode (the web.app build, the device flag, or #live) never shows the welcome.
// Build values come from attributes on <html>; an unset variable stays as its literal text, so each is compared with 'true'.
try {
  var d = document.documentElement;
  var liveBuild = d.getAttribute('data-demo') === 'true' && /^[^%\s]+$/.test(d.getAttribute('data-client-id') || '');
  var live = liveBuild && (d.getAttribute('data-live-default') === 'true' || location.hash === '#live' || localStorage.getItem('email_cards_live') === '1');
  if (!live && d.getAttribute('data-demo') === 'true' && !/^#k=/.test(location.hash) && !localStorage.getItem('email_cards_snapshot_key')) {
    var p = JSON.parse(localStorage.getItem('email_cards_progress_v1') || '{}');
    if (!p.welcomed) d.className = 'boot-welcome';
  }
} catch (e) {}
