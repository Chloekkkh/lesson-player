/* ============================================================
   fill.js — 填空题
   输入文本框作答，提交后判分
   ============================================================ */

'use strict';

registerType('fill', FillHandler);

function FillHandler() {}

FillHandler.prototype = {
  _config:     null,
  _callbacks:  null,
  _q:          null,   // 单题（_questions[0]）
  _submitted:  false,

  /* ── init ─────────────────────────────────────────────── */
  init: function(config, callbacks) {
    this._config    = config;
    this._callbacks = callbacks;
    this._q        = config.questions[0] || null;
    this._submitted = false;
    this._render();
  },

  /* ── 渲染 ─────────────────────────────────────────────── */
  _render: function() {
    var q = this._q;
    if (!q) return;

    this._submitted = false;

    var area = document.getElementById('fillArea');
    if (!area) return;
    area.style.display = '';
    area.innerHTML =
      '<div class="question-text" id="questionText">' +
      '<p class="question-main">' + (q.question || '') + '</p>' +
      '</div>' +
      '<div class="fill-input-wrap">' +
      '<input type="text" class="fill-input" id="fillInput" placeholder="Type your answer">' +
      '</div>';

    var self = this;
    var input = document.getElementById('fillInput');
    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') self._submit();
      });
      input.addEventListener('input', function() {
        var submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
          submitBtn.disabled = !input.value.trim();
          submitBtn.classList.toggle('enabled', !!input.value.trim());
        }
      });
      setTimeout(function() { input.focus(); }, 100);
    }

    // 确认按钮
    var submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.className = 'submit-btn';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submit';
      submitBtn.style.display = '';
      submitBtn.onclick = function() { self._submit(); };
    }
  },

  /* ── 提交 ─────────────────────────────────────────────── */
  _submit: function() {
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
      // 答错：标记红色，允许继续输入重试
      var submitBtn = document.getElementById('submitBtn');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.add('enabled');
        submitBtn.textContent = 'Submit';
      }
      this._submitted = false;
    }
  },

  /* ── 显示对错样式 ─────────────────────────────────────── */
  _showResult: function(input, correct) {
    input.classList.add(correct ? 'correct' : 'wrong');
    if (correct) {
      input.readOnly = true;
      var submitBtn = document.getElementById('submitBtn');
      if (submitBtn) submitBtn.style.display = 'none';
    }
    // 答错：不清空、不锁定、不隐藏按钮，允许继续输入重试
  }
};
