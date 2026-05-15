/* ============================================================
   match.js — 连线配对题
   中英文卡片点击配对，Canvas 画线

   支持三种模式（通过 config.leftType / config.rightType 区分）：
   - text / text   ：传统文本连线（默认）
   - audio / image ：听音配图片（点击音频播放，选中后再点图片配对）
   - text  / image ：文本配图片

   交互：支持双向点击（先点左再点右，或先点右再点左）
         全部连完才显示 Submit，统一校验对错
   ============================================================ */

'use strict';

registerType('match', MatchHandler);

function MatchHandler() {}

MatchHandler.prototype = {
  _config:         null,
  _callbacks:      null,
  _pairs:          [],
  _leftBtns:       {},
  _rightBtns:      {},
  _matchedLeft:    {},    // pairIdx → rightPairIdx（已验证正确）
  _matchedRight:   {},    // pairIdx → leftPairIdx（已验证正确）
  _connectedLeft:  {},    // pairIdx → rightPairIdx（待验证 / 错误连接）
  _connectedRight: {},    // pairIdx → leftPairIdx（待验证 / 错误连接）
  _selected:       null,  // { side: 'left'|'right', pairIdx: N } | null
  _lines:          [],    // [{leftIdx, rightIdx}, ...] 已确认正确的线
  _canvas:         null,
  _ctx:            null,
  _pinyinMap:      {},
  _leftType:       'text',
  _rightType:      'text',
  _audioBase:      '',
  _playingAudio:   null,
  _direction:      'vertical',
  _submitted:      false,

  /* ── init ─────────────────────────────────────────────── */
  init: function(config, callbacks) {
    this._config    = config;
    this._callbacks = callbacks;
    this._pairs     = config.pairs || (config.questions && config.questions[0] && config.questions[0].pairs) || [];
    this._matchedLeft  = {};
    this._matchedRight = {};
    this._connectedLeft  = {};
    this._connectedRight = {};
    this._selected = null;
    this._lines = [];
    this._resizeHandler = null;
    this._playingAudio = null;
    this._submitted = false;

    var q0 = config.questions && config.questions[0];
    this._leftType  = (q0 && q0.leftType)  || config.leftType  || 'text';
    this._rightType = (q0 && q0.rightType) || config.rightType || 'text';
    this._audioBase = (q0 && q0.audioBase) || config.audioBase || '';
    this._imgBase   = (q0 && q0.imgBase)   || config.imgBase   || '';
    this._direction = (q0 && q0.direction) || config.direction || 'vertical';

    if (config.pinyinMap) {
      this._pinyinMap = config.pinyinMap;
    } else if (q0 && q0.pinyinMap) {
      this._pinyinMap = q0.pinyinMap;
    }

    this._render();
    this._initCanvas();
  },

  /* ── 渲染 ─────────────────────────────────────────────── */
  _render: function() {
    var area = document.getElementById('matchArea');
    if (!area) return;
    area.style.display = '';
    area.innerHTML = '';

    var canvasWrap = document.createElement('div');
    canvasWrap.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1;';
    var canvas = document.createElement('canvas');
    canvas.id = 'matchCanvas';
    canvas.style.cssText = 'width:100%;height:100%;';
    canvasWrap.appendChild(canvas);
    this._canvas = canvas;

    var colsWrap = document.createElement('div');
    if (this._direction === 'horizontal') {
      colsWrap.style.cssText = 'position:relative;z-index:2;display:flex;flex-direction:row;gap:80px;justify-content:center;align-items:center;';
    } else {
      colsWrap.style.cssText = 'position:relative;z-index:2;display:flex;flex-direction:column;gap:48px;justify-content:center;';
    }

    var leftCol = document.createElement('div');
    leftCol.className = 'match-col';
    if (this._direction === 'horizontal') {
      leftCol.style.cssText = 'display:flex;flex-direction:column;gap:16px;';
    } else {
      leftCol.style.cssText = 'display:flex;flex-direction:row;gap:12px;min-width:160px;justify-content:center;';
    }

    var rightCol = document.createElement('div');
    rightCol.className = 'match-col';
    if (this._direction === 'horizontal') {
      rightCol.style.cssText = 'display:flex;flex-direction:column;gap:16px;';
    } else {
      rightCol.style.cssText = 'display:flex;flex-direction:row;gap:12px;min-width:160px;justify-content:center;';
    }

    var self = this;

    // 左列渲染
    if (this._leftType === 'audio') {
      this._pairs.forEach(function(pair, i) {
        var btn = self._makeAudioBtn(pair, 'left', i);
        leftCol.appendChild(btn);
        self._leftBtns[i] = btn;
      });
    } else {
      this._pairs.forEach(function(pair, i) {
        var btn = self._makeTextBtn(pair.left, 'left', i, self._config.showPinyin && self._pinyinMap[pair.left]);
        leftCol.appendChild(btn);
        self._leftBtns[i] = btn;
      });
    }

    // 右列渲染（乱序）
    var shuffled = this._shuffle(this._pairs.map(function(_, i) { return i; }));
    shuffled.forEach(function(pairIdx) {
      var pair = self._pairs[pairIdx];
      var btn;
      if (self._rightType === 'image') {
        btn = self._makeImageBtn(pair.right, 'right', pairIdx);
      } else {
        btn = self._makeTextBtn(pair.right, 'right', pairIdx, false);
      }
      rightCol.appendChild(btn);
      self._rightBtns[pairIdx] = btn;
    });

    colsWrap.appendChild(leftCol);
    colsWrap.appendChild(rightCol);

    area.style.position = 'relative';
    area.appendChild(colsWrap);
    area.appendChild(canvasWrap);

    // 隐藏 submitBtn（全部连完才显示）
    var submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.style.display = 'none';

    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    this._resizeHandler = function() { self._resizeCanvas(); };
    window.addEventListener('resize', this._resizeHandler);
  },

  /* ── 文本按钮 ─────────────────────────────────────────── */
  _makeTextBtn: function(text, side, pairIdx, pinyinText) {
    var btn = document.createElement('button');
    btn.className = 'match-btn';
    btn.dataset.side = side;
    btn.dataset.pairIdx = pairIdx;
    if (pinyinText) {
      btn.innerHTML = '<span class="match-pinyin">' + pinyinText + '</span>' +
                      '<span class="match-text">' + text + '</span>';
    } else {
      btn.innerHTML = '<span class="match-text">' + text + '</span>';
    }
    var self = this;
    btn.addEventListener('click', function() {
      self._onBtnClick(side, pairIdx, btn);
    });
    return btn;
  },

  /* ── 图片按钮 ─────────────────────────────────────────── */
  _makeImageBtn: function(src, side, pairIdx) {
    var btn = document.createElement('button');
    btn.className = 'match-btn match-btn-img';
    btn.dataset.side = side;
    btn.dataset.pairIdx = pairIdx;
    var img = document.createElement('img');
    img.src = this._imgBase + src;
    img.style.cssText = 'max-width:80px;max-height:80px;border-radius:8px;pointer-events:none;';
    btn.appendChild(img);
    var self = this;
    btn.addEventListener('click', function() {
      self._onBtnClick(side, pairIdx, btn);
    });
    return btn;
  },

  /* ── 音频卡片按钮 ─────────────────────────────────────── */
  _makeAudioBtn: function(pair, side, pairIdx) {
    var btn = document.createElement('button');
    btn.className = 'match-btn match-btn-audio';
    btn.dataset.side = side;
    btn.dataset.pairIdx = pairIdx;

    if (pair.text) {
      btn.innerHTML = '<span class="match-audio-icon">&#9658;</span>' +
                      '<span class="match-text">' + pair.text + '</span>';
    } else {
      btn.innerHTML = '<span class="match-audio-icon">&#9658;</span>';
    }

    var self = this;
    btn.addEventListener('click', function() { self._onAudioClick(pairIdx, btn, pair.left); });
    return btn;
  },

  /* ── 音频点击 ─────────────────────────────────────────── */
  _onAudioClick: function(pairIdx, btn, audioPath) {
    if (this._matchedLeft[pairIdx]) return;

    // 已连接 → 断开
    if (this._isConnected('left', pairIdx)) {
      this._disconnect('left', pairIdx);
      this._redrawLines();
      return;
    }

    // 播放音频
    if (this._playingAudio) {
      this._playingAudio.pause();
      this._playingAudio = null;
    }
    if (audioPath) {
      var audio = new Audio(this._audioBase + audioPath);
      audio.addEventListener('ended', function() { btn.classList.remove('audio-playing'); });
      btn.classList.add('audio-playing');
      audio.play();
      this._playingAudio = audio;
    }

    // 统一选中 / 连接逻辑
    this._onBtnClick('left', pairIdx, btn);
  },

  /* ── 统一点击处理 ────────────────────────────────────── */
  _onBtnClick: function(side, pairIdx, btn) {
    // 已验证正确 → 忽略
    if (side === 'left' && this._matchedLeft[pairIdx] !== undefined) return;
    if (side === 'right' && this._matchedRight[pairIdx] !== undefined) return;

    // 已连接（待验证或错误）→ 断开
    if (this._isConnected(side, pairIdx)) {
      this._disconnect(side, pairIdx);
      this._redrawLines();
      return;
    }

    // 无选中 → 选中此按钮
    if (!this._selected) {
      this._selected = { side: side, pairIdx: pairIdx };
      btn.style.borderColor = 'var(--yellow)';
      this._redrawLines();
      return;
    }

    // 同侧已选中 → 切换选中
    if (this._selected.side === side) {
      var prevBtn = this._getBtn(this._selected.side, this._selected.pairIdx);
      if (prevBtn) prevBtn.style.borderColor = '';
      this._selected = { side: side, pairIdx: pairIdx };
      btn.style.borderColor = 'var(--yellow)';
      this._redrawLines();
      return;
    }

    // 另一侧已选中 → 连接
    var leftIdx, rightIdx;
    if (side === 'left') {
      leftIdx = pairIdx;
      rightIdx = this._selected.pairIdx;
    } else {
      leftIdx = this._selected.pairIdx;
      rightIdx = pairIdx;
    }

    // 任一侧已有旧连接 → 先断开
    if (this._connectedLeft[leftIdx] !== undefined) {
      this._disconnect('left', leftIdx);
    }
    if (this._connectedRight[rightIdx] !== undefined) {
      this._disconnect('right', rightIdx);
    }

    this._connect(leftIdx, rightIdx);
    this._clearSelection();
    this._redrawLines();

    // 检查是否全部连接完成
    if (this._allConnected()) {
      this._showSubmitButton();
    }
  },

  /* ── 连接两个按钮 ────────────────────────────────────── */
  _connect: function(leftIdx, rightIdx) {
    this._connectedLeft[leftIdx] = rightIdx;
    this._connectedRight[rightIdx] = leftIdx;

    var leftBtn = this._leftBtns[leftIdx];
    var rightBtn = this._rightBtns[rightIdx];
    if (leftBtn) leftBtn.classList.add('connected');
    if (rightBtn) rightBtn.classList.add('connected');
  },

  /* ── 断开连接 ────────────────────────────────────────── */
  _disconnect: function(side, pairIdx) {
    var leftIdx, rightIdx;
    if (side === 'left') {
      leftIdx = pairIdx;
      rightIdx = this._connectedLeft[leftIdx];
    } else {
      rightIdx = pairIdx;
      leftIdx = this._connectedRight[rightIdx];
    }

    if (leftIdx !== undefined) {
      delete this._connectedLeft[leftIdx];
      var lb = this._leftBtns[leftIdx];
      if (lb) { lb.classList.remove('connected', 'wrong'); lb.style.borderColor = ''; }
    }
    if (rightIdx !== undefined) {
      delete this._connectedRight[rightIdx];
      var rb = this._rightBtns[rightIdx];
      if (rb) { rb.classList.remove('connected', 'wrong'); rb.style.borderColor = ''; }
    }

    // 清除选中态
    this._clearSelection();

    // 断开后隐藏提交按钮
    var submitBtn = document.getElementById('submitBtn');
    if (submitBtn && submitBtn.style.display !== 'none') {
      submitBtn.style.display = 'none';
    }
    this._submitted = false;
  },

  /* ── 是否已连接（待验证或错误） ──────────────────────── */
  _isConnected: function(side, pairIdx) {
    if (side === 'left') return this._connectedLeft[pairIdx] !== undefined;
    return this._connectedRight[pairIdx] !== undefined;
  },

  /* ── 清除选中态 ──────────────────────────────────────── */
  _clearSelection: function() {
    if (this._selected) {
      var btn = this._getBtn(this._selected.side, this._selected.pairIdx);
      if (btn) btn.style.borderColor = '';
      this._selected = null;
    }
  },

  /* ── 获取按钮 ────────────────────────────────────────── */
  _getBtn: function(side, pairIdx) {
    if (side === 'left') return this._leftBtns[pairIdx];
    return this._rightBtns[pairIdx];
  },

  /* ── 是否全部配对已完成（含已确认 + 待验证） ────────── */
  _allConnected: function() {
    return (Object.keys(this._connectedLeft).length + Object.keys(this._matchedLeft).length) >= this._pairs.length;
  },

  /* ── 显示 Submit 按钮 ───────────────────────────────── */
  _showSubmitButton: function() {
    var submitBtn = document.getElementById('submitBtn');
    if (!submitBtn) return;
    submitBtn.style.display = '';
    submitBtn.className = 'submit-btn enabled';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit';
    var self = this;
    submitBtn.onclick = function() { self._submitAll(); };
  },

  /* ── 统一校验所有连接 ───────────────────────────────── */
  _submitAll: function() {
    // 未全部连接 → 忽略
    if (!this._allConnected()) return;

    var self = this;

    // 清除上一轮的错误样式
    Object.keys(this._connectedLeft).forEach(function(leftIdx) {
      var lb = self._leftBtns[leftIdx];
      var rb = self._rightBtns[self._connectedLeft[leftIdx]];
      if (lb) lb.classList.remove('wrong');
      if (rb) rb.classList.remove('wrong');
    });

    var allCorrect = true;
    var correctPairs = []; // [{leftIdx, rightIdx}]

    Object.keys(this._connectedLeft).forEach(function(leftIdx) {
      var rightIdx = self._connectedLeft[leftIdx];
      if (parseInt(leftIdx) === rightIdx) {
        correctPairs.push({ leftIdx: parseInt(leftIdx), rightIdx: rightIdx });
      } else {
        allCorrect = false;
      }
    });

    // 正确的移到 matched，从 connected 移除
    correctPairs.forEach(function(pair) {
      self._matchedLeft[pair.leftIdx] = pair.rightIdx;
      self._matchedRight[pair.rightIdx] = pair.leftIdx;
      delete self._connectedLeft[pair.leftIdx];
      delete self._connectedRight[pair.rightIdx];

      var lb = self._leftBtns[pair.leftIdx];
      var rb = self._rightBtns[pair.rightIdx];
      if (lb) { lb.classList.remove('connected', 'wrong'); lb.classList.add('paired'); }
      if (rb) { rb.classList.remove('connected', 'wrong'); rb.classList.add('paired'); }
    });

    if (allCorrect) {
      Sound.play('correct');
      var submitBtn = document.getElementById('submitBtn');
      if (submitBtn) submitBtn.style.display = 'none';
      this._submitted = true;
      this._callbacks.onDone({ correct: true });
      this._callbacks.onComplete({ correct: true });
    } else {
      // 标记错误
      Object.keys(self._connectedLeft).forEach(function(leftIdx) {
        var lb = self._leftBtns[leftIdx];
        var rb = self._rightBtns[self._connectedLeft[leftIdx]];
        if (lb) { lb.classList.add('wrong'); lb.style.borderColor = 'var(--red)'; }
        if (rb) { rb.classList.add('wrong'); rb.style.borderColor = 'var(--red)'; }
      });

      Sound.play('wrong');
      this._submitted = false;

      // 保持按钮可用，改为 Check Again
      var submitBtn = document.getElementById('submitBtn');
      if (submitBtn) {
        submitBtn.textContent = 'Check Again';
        submitBtn.className = 'submit-btn enabled';
        submitBtn.disabled = false;
        submitBtn.onclick = function() { self._submitAll(); };
      }
    }

    this._redrawLines();
  },

  /* ── Canvas 初始化 ────────────────────────────────────── */
  _initCanvas: function() {
    var canvas = this._canvas;
    if (!canvas) return;
    this._ctx = canvas.getContext('2d');
    this._resizeCanvas();
  },

  _resizeCanvas: function() {
    var canvas = this._canvas;
    if (!canvas) return;
    var rect = canvas.parentNode.getBoundingClientRect();
    canvas.width  = rect.width;
    canvas.height = rect.height;
    this._redrawLines();
  },

  /* ── 画线（根据 direction 动态计算控制点）─────────────── */
  _redrawLines: function() {
    var ctx = this._ctx;
    if (!ctx) return;
    var canvas = this._canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    var self = this;

    // 已确认正确的线（绿色实线）
    Object.keys(this._matchedLeft).forEach(function(leftIdx) {
      var rightIdx = self._matchedLeft[leftIdx];
      var leftBtn = self._leftBtns[leftIdx];
      var rightBtn = self._rightBtns[rightIdx];
      if (!leftBtn || !rightBtn) return;
      self._drawLine(leftBtn, rightBtn, '#4CAF50', 2.5, false);
    });

    // 待验证 / 错误连接
    Object.keys(self._connectedLeft).forEach(function(leftIdx) {
      var rightIdx = self._connectedLeft[leftIdx];
      var leftBtn = self._leftBtns[leftIdx];
      var rightBtn = self._rightBtns[rightIdx];
      if (!leftBtn || !rightBtn) return;

      var isWrong = leftBtn.classList.contains('wrong');
      var color = isWrong ? '#F44336' : 'rgba(212,160,23,0.7)';
      self._drawLine(leftBtn, rightBtn, color, 2, true);
    });

    // 当前选中的临时指示线
    if (this._selected) {
      var selBtn = this._getBtn(this._selected.side, this._selected.pairIdx);
      if (selBtn) {
        var r = selBtn.getBoundingClientRect();
        var cr = canvas.getBoundingClientRect();
        var x1, y1, x2, y2;
        if (this._direction === 'horizontal') {
          y1 = r.top + r.height / 2 - cr.top;
          y2 = y1;
          if (this._selected.side === 'left') {
            x1 = r.right - cr.left;
            x2 = x1 + 20;
          } else {
            x1 = r.left - cr.left;
            x2 = x1 - 20;
          }
        } else {
          x1 = r.left + r.width / 2 - cr.left;
          x2 = x1;
          if (this._selected.side === 'left' || this._selected.side === 'top') {
            y1 = r.bottom - cr.top;
            y2 = y1 + 20;
          } else {
            y1 = r.top - cr.top;
            y2 = y1 - 20;
          }
        }
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(212,160,23,0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  },

  /* ── 单条曲线绘制 ────────────────────────────────────── */
  _drawLine: function(leftBtn, rightBtn, color, width, dashed) {
    var ctx = this._ctx;
    var canvas = this._canvas;
    if (!ctx || !canvas) return;

    var lRect = leftBtn.getBoundingClientRect();
    var rRect = rightBtn.getBoundingClientRect();
    var cRect = canvas.getBoundingClientRect();

    var isH = this._direction === 'horizontal';
    var x1, y1, x2, y2, cp1x, cp1y, cp2x, cp2y;

    if (isH) {
      x1 = lRect.right - cRect.left;
      y1 = lRect.top + lRect.height / 2 - cRect.top;
      x2 = rRect.left - cRect.left;
      y2 = rRect.top + rRect.height / 2 - cRect.top;
      cp1x = x1 + 40;  cp1y = y1;
      cp2x = x2 - 40;  cp2y = y2;
    } else {
      x1 = lRect.left + lRect.width / 2 - cRect.left;
      y1 = lRect.bottom - cRect.top;
      x2 = rRect.left + rRect.width / 2 - cRect.left;
      y2 = rRect.top - cRect.top;
      cp1x = x1;  cp1y = y1 + 30;
      cp2x = x2;  cp2y = y2 - 30;
    }

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    if (dashed) ctx.setLineDash([8, 5]);
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
    ctx.stroke();
    if (dashed) ctx.setLineDash([]);
  },

  /* ── 刷新按钮拼音显示 ─────────────────────────────── */
  _refreshButtons: function() {
    var self = this;
    if (this._leftType === 'audio') return;
    this._pairs.forEach(function(pair, i) {
      var btn = self._leftBtns[i];
      if (!btn) return;
      var pinyinText = self._config.showPinyin && self._pinyinMap[pair.left];
      if (pinyinText) {
        btn.innerHTML = '<span class="match-pinyin">' + pinyinText + '</span>' +
                        '<span class="match-text">' + pair.left + '</span>';
      } else {
        btn.innerHTML = '<span class="match-text">' + pair.left + '</span>';
      }
    });
  },

  /* ── 重玩（洗牌） ─────────────────────────────────────── */
  _reshuffle: function() {
    this._matchedLeft  = {};
    this._matchedRight = {};
    this._connectedLeft  = {};
    this._connectedRight = {};
    this._lines = [];
    this._selected = null;
    this._submitted = false;

    // 隐藏提交按钮
    var submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.style.display = 'none';
    }

    var area = document.getElementById('matchArea');
    if (area) {
      var colsWrap = area.querySelector('div[style*="z-index:2"]');
      if (colsWrap) {
        var leftCol  = colsWrap.querySelectorAll('.match-col')[0];
        var rightCol = colsWrap.querySelectorAll('.match-col')[1];
        var self = this;

        if (leftCol && self._leftType !== 'audio') {
          var shuffledLeft = this._shuffle(this._pairs.map(function(_, i) { return i; }));
          leftCol.innerHTML = '';
          self._leftBtns = {};
          shuffledLeft.forEach(function(pairIdx) {
            var pair = self._pairs[pairIdx];
            var pinyinText = self._config.showPinyin && self._pinyinMap[pair.left];
            var btn = self._makeTextBtn(pair.left, 'left', pairIdx, pinyinText);
            leftCol.appendChild(btn);
            self._leftBtns[pairIdx] = btn;
          });
        }

        if (rightCol) {
          var shuffledRight = this._shuffle(this._pairs.map(function(_, i) { return i; }));
          rightCol.innerHTML = '';
          self._rightBtns = {};
          shuffledRight.forEach(function(pairIdx) {
            var pair = self._pairs[pairIdx];
            var btn;
            if (self._rightType === 'image') {
              btn = self._makeImageBtn(pair.right, 'right', pairIdx);
            } else {
              btn = self._makeTextBtn(pair.right, 'right', pairIdx, false);
            }
            rightCol.appendChild(btn);
            self._rightBtns[pairIdx] = btn;
          });
        }
      }
    }

    document.querySelectorAll('.match-btn').forEach(function(b) {
      b.classList.remove('paired', 'connected', 'wrong');
      b.style.borderColor = '';
    });
    this._redrawLines();
  },

  /* ── 洗牌 ─────────────────────────────────────────────── */
  _shuffle: function(arr) {
    arr = arr.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }
};
