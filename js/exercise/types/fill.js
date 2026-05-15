/* ============================================================
   fill.js — 选词填空题（多题版）
   N道题，M个共享选项词池，点击空格激活后选词填入
   ============================================================ */

'use strict';

registerType('fill', FillHandler);

function FillHandler() {}

FillHandler.prototype = {
  _config:         null,
  _callbacks:      null,
  _questions:      [],
  _sharedOptions:  [],
  _filled:         {},       // questionIdx → [answers]
  _activeSlot:     null,    // { qIdx, slotIdx }
  _submitted:      false,
  _slotCounts:     {},

  /* ── init ─────────────────────────────────────────────── */
  init: function(config, callbacks) {
    this._config    = config;
    this._callbacks = callbacks;
    this._questions = (config.questions && config.questions[0] && config.questions[0].type === 'fill' && config.questions[0].questions)
      ? config.questions[0].questions
      : (config.questions || []);
    this._sharedOptions = config.sharedOptions || [];
    this._filled    = {};
    this._activeSlot = null;
    this._submitted = false;
    this._slotCounts = {};
    window._fillHandler = this;   // 供 slot 点击事件访问
    this._render();
  },

  /* ── 渲染 ─────────────────────────────────────────────── */
  _render: function() {
    var self = this;
    this._submitted = false;
    this._filled   = {};
    this._slotCounts = {};

    var area = document.getElementById('fillArea');
    if (!area) return;
    area.style.display = '';
    area.innerHTML = '';

    var submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.style.display = '';
      submitBtn.className = 'submit-btn';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submit';
    }

    var optsHtml =
      '<div class="fill-shared-options">' +
        '<div class="fill-options-grid" id="fillOptionsGrid">';
    this._sharedOptions.forEach(function(word) {
      optsHtml += '<button class="fill-opt-card" data-word="' + word + '">' + word + '</button>';
    });
    optsHtml += '</div></div>';

    var listHtml = '<div class="fill-blank-list" id="fillBlankList">';
    this._questions.forEach(function(q, qIdx) {
      listHtml +=
        '<div class="fill-blank-item" id="fi-' + qIdx + '">' +
          '<span class="fill-q-num">' + (qIdx + 1) + '.</span>' +
          '<span class="fill-blank-q" id="fq-' + qIdx + '">' +
            self._renderQuestion(q.question || '', qIdx) +
          '</span>' +
        '</div>';
    });
    listHtml += '</div>';

    area.innerHTML = optsHtml + listHtml;

    // 绑定选项卡点击
    area.querySelectorAll('.fill-opt-card').forEach(function(card) {
      card.addEventListener('click', function() {
        self._selectOption(card.dataset.word, card);
      });
    });

    // 默认激活第一题第一空
    this._setActiveSlot(0, 0);
  },

  /* ── 将 question 文本中的占位符转为可点击空格 ──────── */
  _renderQuestion: function(text, qIdx) {
    var self = this;
    return text.replace(/_____+/g, function() {
      var idx = self._slotCounts[qIdx] || 0;
      self._slotCounts[qIdx] = idx + 1;
      var id = 'slot-' + qIdx + '-' + idx;
      return '<span class="blank-slot" id="' + id + '" data-q="' + qIdx + '" data-si="' + idx + '">___</span>';
    });
  },

  /* ── 激活空格 ─────────────────────────────────────────── */
  _setActiveSlot: function(qIdx, slotIdx) {
    document.querySelectorAll('.blank-slot.active').forEach(function(el) {
      el.classList.remove('active');
    });
    var slot = document.getElementById('slot-' + qIdx + '-' + slotIdx);
    if (slot) {
      slot.classList.add('active');
      slot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    this._activeSlot = { qIdx: qIdx, slotIdx: slotIdx };
  },

  /* ── 点击选项词 ─────────────────────────────────────── */
  _selectOption: function(word, card) {
    if (this._submitted) return;
    if (card.classList.contains('used')) return;
    if (!this._activeSlot) return;

    var qIdx  = this._activeSlot.qIdx;
    var sIdx  = this._activeSlot.slotIdx;
    var slot  = document.getElementById('slot-' + qIdx + '-' + sIdx);
    if (!slot) return;

    // 填词
    slot.textContent = word;
    slot.classList.remove('blank-slot', 'active');
    slot.classList.add('filled-slot');

    card.classList.add('used');

    if (!this._filled[qIdx]) this._filled[qIdx] = [];
    this._filled[qIdx][sIdx] = word;

    // 找下一空
    var total = this._slotCounts[qIdx] || 0;
    var found = false;
    for (var i = 0; i < total; i++) {
      var s = document.getElementById('slot-' + qIdx + '-' + i);
      if (s && s.classList.contains('blank-slot')) {
        this._setActiveSlot(qIdx, i);
        found = true;
        break;
      }
    }
    if (!found) {
      // 本题填满，移至下一题第一空
      var nextQ = qIdx + 1;
      if (nextQ < this._questions.length) {
        this._setActiveSlot(nextQ, 0);
      } else {
        this._activeSlot = null;
      }
    }

    this._updateSubmitButton();
  },

  /* ── 激活空格（外部调用） ───────────────────────────── */
  activateSlot: function(qIdx, slotIdx) {
    if (this._submitted) return;
    var slot = document.getElementById('slot-' + qIdx + '-' + slotIdx);
    if (!slot || slot.classList.contains('filled-slot')) return;
    this._setActiveSlot(qIdx, slotIdx);
  },

  /* ── 更新 Submit 按钮 ───────────────────────────────── */
  _updateSubmitButton: function() {
    var self = this;
    var allDone = this._questions.every(function(q, qIdx) {
      var total = self._slotCounts[qIdx] || 0;
      var count = 0;
      var arr = self._filled[qIdx] || [];
      for (var i = 0; i < total; i++) {
        if (arr[i]) count++;
      }
      return count === total;
    });
    var btn = document.getElementById('submitBtn');
    if (btn) {
      btn.disabled = !allDone;
      btn.classList.toggle('enabled', allDone);
    }
  },

  /* ── 提交 ───────────────────────────────────────────── */
  _submitAll: function() {
    if (this._submitted) return;
    this._submitted = true;

    var self = this;
    var allCorrect = true;

    this._questions.forEach(function(q, qIdx) {
      var filled = self._filled[qIdx] || [];
      var answers = Array.isArray(q.answer)
        ? q.answer
        : (q.answer || '').toString().trim().split(',').map(function(s) { return s.trim(); });

      answers.forEach(function(correctWord, si) {
        var slot = document.getElementById('slot-' + qIdx + '-' + si);
        if (!slot) return;
        var userWord = (filled[si] || '').trim();
        if (userWord === correctWord) {
          slot.classList.add('opt-correct');
        } else {
          slot.classList.add('opt-wrong');
          slot.title = 'Correct: ' + correctWord;
          allCorrect = false;
        }
      });
    });

    Sound.play(allCorrect ? 'correct' : 'wrong');

    var btn = document.getElementById('submitBtn');
    if (btn) btn.style.display = 'none';

    this._callbacks.onDone({ correct: allCorrect });
    this._callbacks.onComplete({ correct: allCorrect });
  }
};

/* ── slot 点击事件（委托到 document 级别）─────────────── */
document.addEventListener('click', function(e) {
  var h = window._fillHandler;
  if (!h) return;

  // 点击已填空格 → 退回选项池
  var filledSlot = e.target.closest('.filled-slot');
  if (filledSlot && !h._submitted) {
    var qIdx = parseInt(filledSlot.dataset.q, 10);
    var sIdx = parseInt(filledSlot.dataset.si, 10);
    var word = filledSlot.textContent.trim();

    // 恢复选项卡
    var card = document.querySelector('.fill-opt-card[data-word="' + word + '"].used');
    if (card) card.classList.remove('used');

    // 清空 slot
    filledSlot.textContent = '___';
    filledSlot.classList.remove('filled-slot', 'opt-correct', 'opt-wrong');
    filledSlot.classList.add('blank-slot');
    filledSlot.title = '';

    // 清除 filled 记录
    if (h._filled[qIdx]) h._filled[qIdx][sIdx] = undefined;

    h.activateSlot(qIdx, sIdx);
    h._updateSubmitButton();
    return;
  }

  // 点击空白格 → 激活
  var blankSlot = e.target.closest('.blank-slot');
  if (blankSlot) {
    var qIdx2 = parseInt(blankSlot.dataset.q, 10);
    var sIdx2 = parseInt(blankSlot.dataset.si, 10);
    h.activateSlot(qIdx2, sIdx2);
  }
});