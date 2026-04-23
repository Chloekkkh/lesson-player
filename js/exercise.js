/* ============================================================
   exercise.js — 练习题通用交互逻辑
   被 exercise 类型 slide HTML 引用
   ============================================================ */

'use strict';

/* ── slideData（在 player 发送 postMessage 后填充）────────── */
var slideData   = null;
var selectedId   = null;    // choice / truefalse
var enteredVal   = '';      // fill
var matchedPairs = {};     // matching: { leftIndex: rightVal }
var leftSelected = null;    // matching: 当前选中的左侧项

/* ─────────────────────────────────────────────────────────
   RENDER
   ───────────────────────────────────────────────────────── */
function render() {
  if (!slideData) return;

  var qEl = document.getElementById('questionText');
  if (qEl) qEl.textContent = slideData.question || '';

  var type = slideData.type;
  if (type === 'read' || type === 'listen') {
    renderChoice();
  } else if (type === 'fill') {
    renderFill();
  } else if (type === 'matching') {
    renderMatching();
  }
}

function renderChoice() {
  var container = document.getElementById('optionsContainer');
  if (!container) return;
  container.innerHTML = '';

  (slideData.options || []).forEach(function(opt) {
    var btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = (opt.id ? opt.id + '. ' : '') + opt.text;
    btn.dataset.id = opt.id;
    btn.addEventListener('click', function() { select(opt.id, btn); });
    container.appendChild(btn);
  });
}

function select(id, btn) {
  selectedId = id;
  document.querySelectorAll('.option-btn').forEach(function(b) {
    b.classList.toggle('selected', b === btn);
  });
  var submitBtn = document.getElementById('submitBtn');
  if (submitBtn) submitBtn.classList.add('enabled');
}

/* ─────────────────────────────────────────────────────────
   FILL
   ───────────────────────────────────────────────────────── */
function renderFill() {
  var input = document.getElementById('answerInput');
  if (!input) return;
  if (slideData.placeholder) input.placeholder = slideData.placeholder;
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') submit();
  });
}

/* ─────────────────────────────────────────────────────────
   MATCHING
   ───────────────────────────────────────────────────────── */
function renderMatching() {
  var area = document.getElementById('matchingArea');
  if (!area || !slideData.pairs) return;
  area.innerHTML = '';

  var leftCol  = document.createElement('div');
  leftCol.className = 'matching-col';
  var rightCol = document.createElement('div');
  rightCol.className = 'matching-col';

  slideData.pairs.forEach(function(pair, i) {
    var lb = document.createElement('button');
    lb.className = 'match-btn';
    lb.textContent = pair.left;
    lb.dataset.side = 'left';
    lb.dataset.i = i;
    lb.addEventListener('click', function() { selectLeft(i, pair.left, lb); });
    leftCol.appendChild(lb);
  });

  // Right side: shuffled
  var shuffled = slideData.pairs.slice().sort(function() { return 0.5 - Math.random(); });
  shuffled.forEach(function(pair, i) {
    var rb = document.createElement('button');
    rb.className = 'match-btn';
    rb.textContent = pair.right;
    rb.dataset.side = 'right';
    rb.dataset.i = i;
    rb.addEventListener('click', function() { selectRight(i, pair.right, rb); });
    rightCol.appendChild(rb);
  });

  area.appendChild(leftCol);
  area.appendChild(rightCol);
}

function selectLeft(i, val, btn) {
  document.querySelectorAll('.match-btn[data-side="left"]').forEach(function(b) {
    b.style.borderColor = '';
  });
  btn.style.borderColor = 'var(--blue)';
  leftSelected = { i: i, val: val, leftBtn: btn };
}

function selectRight(i, val, btn) {
  if (!leftSelected) return;
  matchedPairs[leftSelected.i] = val;
  leftSelected.leftBtn.classList.add('paired');
  leftSelected.leftBtn.style.borderColor = 'var(--green)';
  btn.classList.add('paired');
  btn.style.borderColor = 'var(--green)';
  leftSelected = null;
}

/* ─────────────────────────────────────────────────────────
   SUBMIT
   ───────────────────────────────────────────────────────── */
function submit() {
  var type = slideData.type;
  var payload;

  if (type === 'read' || type === 'listen') {
    if (!selectedId) return;
    showResult();
    payload = { selected: selectedId };

  } else if (type === 'fill') {
    var input = document.getElementById('answerInput');
    if (!input) return;
    enteredVal = input.value.trim();
    if (!enteredVal) return;
    var correct = enteredVal === slideData.answer;
    input.classList.add(correct ? 'correct' : 'wrong');
    input.classList.remove(correct ? 'wrong' : 'correct');
    payload = { entered: enteredVal };

  } else if (type === 'matching') {
    payload = { pairs: matchedPairs };
  }

  // 通知 player
  postToParent('exerciseDone', payload);
}

function showResult() {
  document.querySelectorAll('.option-btn').forEach(function(b) {
    if (b.dataset.id === slideData.answer) b.classList.add('correct');
    else if (b.dataset.id === selectedId && b.dataset.id !== slideData.answer) b.classList.add('wrong');
  });
}

/* ─────────────────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────────────────── */
function init() {
  // 监听 player 发送的 slideData
  window.addEventListener('message', function handler(e) {
    var msg = e.data;
    if (msg && msg.type === 'slideData') {
      slideData = msg.data;
      window.removeEventListener('message', handler);
      render();
    }
  });

  // 确认按钮
  var submitBtn = document.getElementById('submitBtn');
  if (submitBtn) submitBtn.addEventListener('click', submit);
}

init();
