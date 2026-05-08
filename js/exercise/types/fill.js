/* ============================================================
   fill.js — 填空题
   支持两种模式：
   - options 有值：选词填空（词卡点击选择）
   - options 为空：自由输入（原有行为）
   ============================================================ */

'use strict';

registerType('fill', FillHandler);

function FillHandler() {}

FillHandler.prototype = {
  _config:     null,
  _callbacks:  null,
  _q:          null,
  _submitted:  false,
  _selectedOpt: null,   // 选词模式下选中的词

  /* ── init ─────────────────────────────────────────────── */
  init: function(config, callbacks) {
    this._config    = config;
    this._callbacks = callbacks;
    this._q        = config.questions[0] || null;
    this._submitted = false;
    this._selectedOpt = null;
    this._render();
  },

  /* ── 渲染 ─────────────────────────────────────────────── */
  _render: function() {
    var q = this._q;
    if (!q) return;

    this._submitted = false;
    this._selectedOpt = null;

    var area = document.getElementById('fillArea');
    if (!area) return;
    area.style.display = '';
    area.innerHTML = '';

    var self = this;

    if (q.options && q.options.length > 0) {
      // ── 选词填空模式 ──────────────────────────────
      area.innerHTML =
        '<div class="question-text">' +
        '<p class="question-main fill-blank-q">' + (q.question || '') + '</p>' +
        '</div>' +
        '<div class="fill-options-grid" id="fillOptions"></div>';

      var grid = document.getElementById('fillOptions');
      q.options.forEach(function(word) {
        var card = document.createElement('button');
        card.className = 'fill-opt-card';
        card.textContent = word;
        card.dataset.word = word;
        card.addEventListener('click', function() { self._selectOpt(word, card); });
        grid.appendChild(card);
      });

      var submitBtn = document.getElementById('submitBtn');
      if (submitBtn) {
        submitBtn.className = 'submit-btn';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submit';
        submitBtn.style.display = '';
        submitBtn.onclick = function() { self._submitWordChoice(); };
      }
    } else {
      // ── 自由输入模式（原有行为）────────────────
      area.innerHTML =
        '<div class="question-text" id="questionText">' +
        '<p class="question-main">' + (q.question || '') + '</p>' +
        '</div>' +
        '<div class="fill-input-wrap">' +
        '<input type="text" class="fill-input" id="fillInput" placeholder="Type your answer">' +
        '</div>';

      var input = document.getElementById('fillInput');
      if (input) {
        input.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') self._submitText();
        });
        input.addEventListener('input', function() {
          var btn = document.getElementById('submitBtn');
          if (btn) {
            btn.disabled = !input.value.trim();
            btn.classList.toggle('enabled', !!input.value.trim());
          }
        });
        setTimeout(function() { input.focus(); }, 100);
      }

      var submitBtn = document.getElementById('submitBtn');
      if (submitBtn) {
        submitBtn.className = 'submit-btn';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submit';
        submitBtn.style.display = '';
        submitBtn.onclick = function() { self._submitText(); };
      }
    }
  },

  /* ── 选词 ─────────────────────────────────────────────── */
  _selectOpt: function(word, card) {
    if (this._submitted) return;
    var prev = document.querySelector('.fill-opt-card.selected');
    if (prev) prev.classList.remove('selected');
    card.classList.add('selected');
    this._selectedOpt = word;
    var submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.add('enabled');
    }
  },

  /* ── 提交（选词模式）─────────────────────────────────── */
  _submitWordChoice: function() {
    if (this._submitted || !this._q) return;
    if (!this._selectedOpt) return;

    this._submitted = true;
    var q = this._q;
    var correct = this._selectedOpt === (q.answer || '').trim();

    Sound.play(correct ? 'correct' : 'wrong');
    this._showWordChoiceResult(correct);

    if (correct) {
      this._callbacks.onDone({
        selected: this._selectedOpt,
        answer:   q.answer,
        correct:  true
      });
      this._callbacks.onComplete({ correct: true });
    } else {
      // 选错：取消选中，允许重选
      var card = document.querySelector('.fill-opt-card.selected');
      if (card) card.classList.remove('selected');
      this._selectedOpt = null;
      var submitBtn = document.getElementById('submitBtn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.remove('enabled');
      }
      this._submitted = false;
    }
  },

  /* ── 显示对错样式（选词模式）────────────────────────── */
  _showWordChoiceResult: function(correct) {
    var selectedCard = document.querySelector('.fill-opt-card.selected');
    var answerWord = (this._q.answer || '').trim();

    if (correct) {
      if (selectedCard) selectedCard.classList.add('opt-correct');
      var submitBtn = document.getElementById('submitBtn');
      if (submitBtn) submitBtn.style.display = 'none';
    } else {
      if (selectedCard) selectedCard.classList.add('opt-wrong');
      // 高亮正确答案
      var allCards = document.querySelectorAll('.fill-opt-card');
      allCards.forEach(function(c) {
        if (c.dataset.word === answerWord) c.classList.add('opt-reveal');
      });
    }
  },

  /* ── 提交（输入模式）─────────────────────────────────── */
  _submitText: function() {
    if (this._submitted || !this._q) return;
    var input = document.getElementById('fillInput');
    if (!input) return;

    var userAnswer = input.value.trim();
    if (!userAnswer) return;

    this._submitted = true;

    var q = this._q;
    var correct = userAnswer === (q.answer || '').trim();

    Sound.play(correct ? 'correct' : 'wrong');
    this._showResult(input, correct);

    if (correct) {
      this._callbacks.onDone({
        selected: userAnswer,
        answer:   q.answer,
        correct:  true
      });
      this._callbacks.onComplete({ correct: true });
    } else {
      var submitBtn = document.getElementById('submitBtn');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.add('enabled');
        submitBtn.textContent = 'Submit';
      }
      this._submitted = false;
    }
  },

  /* ── 显示对错样式（输入模式）────────────────────────── */
  _showResult: function(input, correct) {
    input.classList.add(correct ? 'correct' : 'wrong');
    if (correct) {
      input.readOnly = true;
      var submitBtn = document.getElementById('submitBtn');
      if (submitBtn) submitBtn.style.display = 'none';
    }
  }
};
