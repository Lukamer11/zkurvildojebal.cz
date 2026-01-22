(function () {
  function ensureWrapper() {
    var body = document.body;
    if (!body) return;

    // Allow opting out per-page
    if (body.getAttribute('data-sf-scale') === 'off') return;

    var viewport = document.getElementById('viewport');
    var game = document.getElementById('game');

    if (!viewport || !game) {
      viewport = document.createElement('div');
      viewport.id = 'viewport';

      game = document.createElement('div');
      game.id = 'game';

      // Move existing body children into #game
      // Keep script tags that load this file running fine.
      var nodes = Array.prototype.slice.call(body.childNodes);
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        // Skip the viewport if already present
        if (n === viewport) continue;
        // Don't move <script> elements that might be needed at end of body? It's safe to move,
        // but to avoid edge cases, keep scripts in place if they have src and are async/defer.
        // We'll still move most markup.
        if (n.nodeType === 1 && n.tagName === 'SCRIPT') {
          // Keep scripts in body to preserve execution order.
          continue;
        }
        game.appendChild(n);
      }

      viewport.appendChild(game);
      // Put viewport first in body so later scripts still find their elements.
      body.insertBefore(viewport, body.firstChild);
    }

    // Apply per-page design size if provided
    var dw = body.getAttribute('data-design-width');
    var dh = body.getAttribute('data-design-height');
    if (dw) game.style.setProperty('--design-width', dw + (String(dw).match(/px|vh|vw|%|rem|em$/) ? '' : 'px'));
    if (dh) game.style.setProperty('--design-height', dh + (String(dh).match(/px|vh|vw|%|rem|em$/) ? '' : 'px'));

    function resize() {
      var w = parseFloat(getComputedStyle(game).width);
      var h = parseFloat(getComputedStyle(game).height);
      if (!w || !h) {
        // fallback if computed style fails
        w = dw ? parseFloat(dw) : 1920;
        h = dh ? parseFloat(dh) : 1080;
      }

      var scaleX = window.innerWidth / w;
      var scaleY = window.innerHeight / h;
      var scale = Math.min(scaleX, scaleY);

      // Allow upscaling on large screens; cap with data-max-scale (default 2.25) and optional multiplier data-ui-scale (default 1).
      var uiScale = parseFloat(document.body.getAttribute('data-ui-scale') || '1');
      if (!isFinite(uiScale) || uiScale <= 0) uiScale = 1;
      var maxScale = parseFloat(document.body.getAttribute('data-max-scale') || '2.25');
      if (!isFinite(maxScale) || maxScale <= 0) maxScale = 2.25;
      scale = Math.min(scale * uiScale, maxScale);

      // Center using translate so scaled-down layouts remain centered correctly.
      game.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
    }

    window.addEventListener('resize', resize);
    resize();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureWrapper);
  } else {
    ensureWrapper();
  }
})();