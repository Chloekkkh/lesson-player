/* ============================================================
   celebration.js — 完成庆祝页（纯 CSS confetti）
   被所有 graded 题型共享
   ============================================================ */

'use strict';

var Celebration = {
  _overlay: null,

  /**
   * show — 显示全屏庆祝动画（confetti）
   */
  show: function() {
    this.hide();
    this._showFull();
  },

  _createOverlay: function() {
    var el = document.createElement('div');
    el.id = 'celebration-overlay';
    el.style.cssText =
      'position:fixed;inset:0;z-index:9999;' +
      'display:flex;align-items:center;justify-content:center;' +
      'pointer-events:none;font-family:sans-serif;';
    document.body.appendChild(el);
    this._overlay = el;
    return el;
  },

  _showFull: function() {
    var el = this._createOverlay();
    el.style.background = 'rgba(0,0,0,0.3)';

    var colors = ['#4CAF50', '#2196F3', '#FF9800', '#E91E63', '#9C27B0', '#00BCD4'];
    var particles = '';
    for (var i = 0; i < 60; i++) {
      var color = colors[i % colors.length];
      var x = Math.random() * 100;
      var delay = Math.random() * 1.5;
      var dur = 2 + Math.random() * 2;
      var size = 6 + Math.random() * 8;
      particles += '<div style="position:absolute;width:' + size + 'px;height:' + size + 'px;' +
        'background:' + color + ';left:' + x + '%;top:-20px;' +
        'border-radius:' + (Math.random() > 0.5 ? '50%' : '2px') + ';' +
        'animation:confetti-fall ' + dur + 's ease-in ' + delay + 's forwards"></div>';
    }

    el.innerHTML =
      '<div style="text-align:center;animation:celeb-pop 0.5s ease">' +
        '<div style="font-size:4rem;color:#FFD700">🎉</div>' +
        '<div style="font-size:2rem;color:#fff;margin-top:12px;font-weight:700">Awesome!</div>' +
      '</div>' +
      particles +
      '<style>' +
      '@keyframes confetti-fall{' +
        '0%{transform:translateY(0) rotate(0deg);opacity:1}' +
        '100%{transform:translateY(100vh) rotate(720deg);opacity:0}' +
      '}' +
      '@keyframes celeb-pop{' +
        '0%{transform:scale(0.5);opacity:0}' +
        '50%{transform:scale(1.1)}' +
        '100%{transform:scale(1);opacity:1}' +
      '}' +
      '</style>';

    // 3 秒后自动消失
    var self = this;
    setTimeout(function() { self.hide(); }, 3000);
  },

  /**
   * hide — 移除庆祝动画
   */
  hide: function() {
    if (this._overlay && this._overlay.parentNode) {
      this._overlay.parentNode.removeChild(this._overlay);
    }
    this._overlay = null;
  }
};
