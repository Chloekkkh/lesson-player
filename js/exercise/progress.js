/* ============================================================
   progress.js — 多题进度条
   被 listen / read / arrange 等多题题型共享
   ============================================================ */

'use strict';

var Progress = {
  _container: null,
  _fill: null,
  _text: null,
  _total: 0,

  /**
   * init — 创建进度条 DOM 并显示
   * @param {number} total  总题数
   * @param {HTMLElement} container  可选，自定义容器
   */
  init: function(total, container) {
    this._total = total || 1;

    // 如果已存在，先移除
    this.hide();

    // 创建容器
    var wrap = document.createElement('div');
    wrap.className = 'ex-progress-wrap';

    var bar = document.createElement('div');
    bar.className = 'ex-progress-bar';

    var fill = document.createElement('div');
    fill.className = 'ex-progress-fill';
    fill.style.width = '0%';

    var text = document.createElement('span');
    text.className = 'ex-progress-text';
    text.textContent = '1 / ' + this._total;

    bar.appendChild(fill);
    wrap.appendChild(bar);
    wrap.appendChild(text);

    var parent = container || document.body;
    parent.appendChild(wrap);

    this._container = wrap;
    this._fill = fill;
    this._text = text;
  },

  /**
   * setProgress — 更新进度
   * @param {number} current  当前题号（从 1 开始）
   * @param {number} total    总题数
   */
  setProgress: function(current, total) {
    if (!this._fill) return;
    this._total = total || this._total;
    var pct = (current / this._total) * 100;
    this._fill.style.width = pct + '%';
    if (this._text) {
      this._text.textContent = current + ' / ' + this._total;
    }
  },

  /**
   * hide — 移除进度条
   */
  hide: function() {
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
    this._container = null;
    this._fill = null;
    this._text = null;
  }
};
