/**
 * Spotlight - Pure HTML/JS Spotlight Effect
 *
 * Usage:
 *   Spotlight.init(options);
 *   // Options:
 *   //   dimness: 0-1, background dimness (default: 0.7)
 *   //   autoClearDelay: auto clear delay in ms (default: 0, no auto clear)
 *   //   container: container element to measure (default: document.body)
 *   //   selector: clickable elements selector (default: '[data-spotlight]')
 *
 * Auto Play API:
 *   Spotlight.play(['id1', 'id2', 'id3'], 2000); // start auto play with IDs and interval (ms)
 *   Spotlight.stop(); // stop auto play
 *   Spotlight.pause(); // pause auto play
 *   Spotlight.resume(); // resume auto play
 */

const Spotlight = (function() {
  'use strict';

  let container = null;
  let overlay = null;
  let svg = null;
  let maskRect = null;
  let options = {};
  let currentElementId = null; //当前高亮元素id
  let autoClearTimeout = null;
  let rafId = null;
  // 自动播放相关
  let autoPlayTimer = null;
  let autoPlayIds = [];
  let autoPlayIndex = 0;
  let autoPlayInterval = 2000;
  let isPaused = false;

  const defaults = {
    dimness: 0.7,
    autoClearDelay: 0,
    container: null,
    selector: '[data-spotlight]',
    autoPlay: false,
    autoPlayIds: [],
    autoPlayInterval: 2000,
  };

  function nextAutoPlay() {
    if (autoPlayIds.length === 0) return;
    if (isPaused) return;

    const id = autoPlayIds[autoPlayIndex];
    const el = document.getElementById(id);
    if (el) {
      spotlight(el);
    }

    autoPlayIndex = (autoPlayIndex + 1) % autoPlayIds.length;
  }

  function play(ids, interval) {
    stop();
    if (!ids || ids.length === 0) return;

    autoPlayIds = ids;
    autoPlayInterval = interval || 2000;
    autoPlayIndex = 0;
    isPaused = false;

    // 立即执行第一个
    nextAutoPlay();

    // 启动定时器
    autoPlayTimer = setInterval(nextAutoPlay, autoPlayInterval);
  }

  function stop() {
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer);
      autoPlayTimer = null;
    }
    autoPlayIds = [];
    autoPlayIndex = 0;
    isPaused = false;
  }

  function pause() {
    isPaused = true;
  }

  function resume() {
    isPaused = false;
  }

  function init(opts) {
    options = { ...defaults, ...opts };
    container = options.container || document.body;

    // Create overlay container
    overlay = document.createElement('div');
    overlay.className = 'spotlight-overlay';
    overlay.style.cssText = `
      position: absolute;
      inset: 0;
      z-index: 9999;
      pointer-events: none;
      overflow: hidden;
    `;

    // Create SVG
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = 'position: absolute; inset: 0;';

    // Create defs with mask
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
    mask.setAttribute('id', 'spotlight-mask');

    // White background = visible
    const maskBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    maskBg.setAttribute('x', '0');
    maskBg.setAttribute('y', '0');
    maskBg.setAttribute('width', '100');
    maskBg.setAttribute('height', '100');
    maskBg.setAttribute('fill', 'white');

    // Black rect = cutout (animated)
    maskRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    maskRect.setAttribute('fill', 'black');
    maskRect.style.cssText = `
      transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    mask.appendChild(maskBg);
    mask.appendChild(maskRect);
    defs.appendChild(mask);

    svg.appendChild(defs);

    // Dimmed background
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', '100');
    bg.setAttribute('height', '100');
    bg.setAttribute('fill', `rgba(0,0,0,${options.dimness})`);
    bg.setAttribute('mask', 'url(#spotlight-mask)');

    // No blur - sharp edges

    svg.appendChild(bg);
    overlay.appendChild(svg);

    // Add to container (ensure it's positioned)
    container.style.position = container.style.position || 'relative';
    container.appendChild(overlay);

    // Hide initially
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';

    // Bind click events
    bindEvents();
  }

  function bindEvents() {
    document.addEventListener('click', handleClick);
  }

  function handleClick(e) {
    const target = e.target.closest(options.selector);
    if (target) {
      e.preventDefault();
      e.stopPropagation();
      spotlight(target);
    } else if (options.autoClearDelay > 0) {
      // Click on non-spotlight element triggers clear
      clear();
    }
  }

  function measureRect(el) {
    const containerRect = container.getBoundingClientRect();
    const targetRect = el.getBoundingClientRect();

    if (containerRect.width === 0 || containerRect.height === 0) {
      return null;
    }

    return {
      x: ((targetRect.left - containerRect.left) / containerRect.width) * 100,
      y: ((targetRect.top - containerRect.top) / containerRect.height) * 100,
      w: (targetRect.width / containerRect.width) * 100,
      h: (targetRect.height / containerRect.height) * 100,
    };
  }

  function spotlight(el) {
    // Resolve string ID to DOM element (called with string from postMessage)
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return;
    const rect = measureRect(el);
    if (!rect) return;

    // Generate unique ID for this element
    const elementId = el.id || 'spotlight-' + Math.random().toString(36).substr(2, 9);

    // Clear any existing timeout
    if (autoClearTimeout) {
      clearTimeout(autoClearTimeout);
      autoClearTimeout = null;
    }

    // Cancel any pending RAF from previous spotlight call
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    const prevElementId = currentElementId;
    currentElementId = elementId;

    overlay.style.opacity = '1';

    // Step 1 (RAF): 清除 transition，立刻设成大框（瞬间完成，无插值）
    rafId = requestAnimationFrame(function() {
      maskRect.style.transition = 'none';
      maskRect.setAttribute('x', (rect.x - 8).toString());
      maskRect.setAttribute('y', (rect.y - 8).toString());
      maskRect.setAttribute('width', (rect.w + 16).toString());
      maskRect.setAttribute('height', (rect.h + 16).toString());
      maskRect.setAttribute('rx', '4');

      // Step 2 (下一 RAF): 开启 transition，设成精确目标，CSS 自动从大框插值到小框
      rafId = requestAnimationFrame(function() {
        maskRect.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
        maskRect.setAttribute('x', rect.x.toString());
        maskRect.setAttribute('y', rect.y.toString());
        maskRect.setAttribute('width', rect.w.toString());
        maskRect.setAttribute('height', rect.h.toString());
        maskRect.setAttribute('rx', '1');
      });
    });

    if (options.autoClearDelay > 0) {
      autoClearTimeout = setTimeout(clear, options.autoClearDelay);
    }
  }

  function clear() {
    if (autoClearTimeout) {
      clearTimeout(autoClearTimeout);
      autoClearTimeout = null;
    }

    overlay.style.opacity = '0';

    // Reset rects after fade
    setTimeout(function() {
      if (!currentElementId) {
        maskRect.setAttribute('x', '0');
        maskRect.setAttribute('y', '0');
        maskRect.setAttribute('width', '0');
        maskRect.setAttribute('height', '0');
      }
    }, 300);

    currentElementId = null;
  }

  function destroy() {
    document.removeEventListener('click', handleClick);
    if (autoClearTimeout) clearTimeout(autoClearTimeout);
    if (rafId) cancelAnimationFrame(rafId);
    stop();
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    overlay = null;
    svg = null;
    maskRect = null;
  }

  return {
    init,
    spotlight,
    clear,
    destroy,
    play,
    stop,
    pause,
    resume,
  };
})();

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Spotlight;
} else if (typeof window !== 'undefined') {
  window.Spotlight = Spotlight;
}