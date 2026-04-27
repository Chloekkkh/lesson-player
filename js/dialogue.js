/* ============================================================
   dialogue.js — 情景对话页面逻辑
   被 dialogue 类型 slide HTML 引用（defer 加载）
   ============================================================ */

var audio = new Audio();
var showPinyin = true, showEnglish = true;
var vocabMap = {};
var myRole = null, rpIndex = 0;

window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'slideData') init(e.data.data);
});

function init(data) {
  // 防止重复初始化，先清空动态内容并重置翻转状态
  var speakersEl = document.getElementById('dlgSpeakers');
  var textList = document.getElementById('dlgTextList');
  var flipCard = document.getElementById('dlgFlipCard');
  if (speakersEl) speakersEl.innerHTML = '';
  if (textList) textList.innerHTML = '';
  if (flipCard) flipCard.classList.remove('flipped');

  // 标题 + 副标题
  var titleEl = document.getElementById('exerciseTitle');
  if (titleEl) titleEl.textContent = data.title || '情景对话';
  var subEl = document.getElementById('exerciseSubtitle');
  if (subEl) subEl.textContent = data.subtitle || '';

  showPinyin = data.showPinyin !== false;
  showEnglish = data.showEnglish !== false;
  document.getElementById('pinyinToggle').checked = showPinyin;
  document.getElementById('englishToggle').checked = showEnglish;

  // 音频
  audio.src = data.audioBase + data.audio;

  // 词汇表
  if (data.vocabList) {
    data.vocabList.forEach(function(v) { vocabMap[v.hanzi] = v; });
  }

  // ── 左侧：说话人卡片 ────────────────────────────────
  var speakersEl = document.getElementById('dlgSpeakers');
  var speakerNameMap = {};
  data.speakers.forEach(function(s) {
    speakerNameMap[s.id] = s;
    var pinyin = s.pinyin || '';
    var html = '<div class="speaker-card" data-id="' + s.id + '">' +
      '<img class="speaker-avatar" src="' + data.imgBase + s.avatar + '">' +
      '<div class="speaker-name">' + s.name + '</div>' +
      '<div class="speaker-pinyin">' + pinyin + '</div>' +
      '</div>';
    speakersEl.insertAdjacentHTML('beforeend', html);
  });

  // ── 右侧：翻转卡片正面（图片）──────────────────────
  var flipCard = document.getElementById('dlgFlipCard');
  var flipImg = document.getElementById('flipSceneImg');
  if (data.image) {
    flipImg.src = data.imgBase + data.image;
  } else {
    flipCard.style.display = 'none';
  }

  // ── 右侧：翻转卡片背面（文本）──────────────────────
  var textList = document.getElementById('dlgTextList');
  data.lines.forEach(function(line, i) {
    var speaker = speakerNameMap[line.speaker] || {};
    var wrapped = wrapVocab(line.hanzi, line.vocab);
    var html = '<div class="dlg-text-item" data-i="' + i + '">' +
      '<div class="dlg-text-speaker">' + (speaker.name || line.speaker) + '</div>' +
      '<div class="dlg-text-hanzi">' + wrapped + '</div>' +
      '<div class="dlg-text-pinyin">' + line.pinyin + '</div>' +
      '<div class="dlg-text-en">' + line.en + '</div>' +
      '</div>';
    textList.insertAdjacentHTML('beforeend', html);
  });

  applyVisibility();

  // ── 翻转卡片点击 ──────────────────────────────────
  flipCard.addEventListener('click', function() {
    flipCard.classList.toggle('flipped');
    var isFlipped = flipCard.classList.contains('flipped');
    document.getElementById('textToggle').textContent = isFlipped ? 'Hide Text' : 'Show Text';
  });

// ── 事件绑定 ──────────────────────────────────────
  // 播放按钮
  document.getElementById('playBtn').onclick = function() {
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  };

  audio.addEventListener('play', function() {
    document.getElementById('playIcon').textContent = '⏸';
    document.getElementById('playBtn').classList.add('playing');
  });
  audio.addEventListener('pause', function() {
    document.getElementById('playIcon').textContent = '▶';
    document.getElementById('playBtn').classList.remove('playing');
  });

  audio.addEventListener('timeupdate', function() {
    if (!audio.duration) return;
    var pct = (audio.currentTime / audio.duration) * 100;
    document.getElementById('audioProgressFill').style.width = pct + '%';
    document.getElementById('audioCurTime').textContent = fmtTime(audio.currentTime);
  });
  audio.addEventListener('loadedmetadata', function() {
    document.getElementById('audioDur').textContent = fmtTime(audio.duration);
  });

  document.querySelector('.audio-progress-bar').addEventListener('click', function(e) {
    var bar = e.currentTarget;
    var rect = bar.getBoundingClientRect();
    var ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * audio.duration;
  });

  document.getElementById('textToggle').onclick = function() {
    var isFlipped = flipCard.classList.contains('flipped');
    if (isFlipped) {
      flipCard.classList.remove('flipped');
      this.textContent = 'Show Text';
    } else {
      flipCard.classList.add('flipped');
      this.textContent = 'Hide Text';
    }
  };

  document.getElementById('pinyinToggle').onchange = function() {
    showPinyin = this.checked;
    applyVisibility();
  };

  document.getElementById('englishToggle').onchange = function() {
    showEnglish = this.checked;
    applyVisibility();
  };

  document.getElementById('nextBtn').onclick = function() {
    parent.postMessage({ type: 'playerMessage', action: 'displayComplete' }, '*');
  };

  // 词汇点击弹层（背面文本中）
  textList.addEventListener('click', function(e) {
    var hl = e.target.closest('.dlg-vocab-hl');
    if (!hl) return;
    var word = hl.dataset.word;
    var v = vocabMap[word];
    if (!v) return;
    var popup = document.getElementById('vocabPopup');
    document.getElementById('vpHanzi').textContent = v.hanzi;
    document.getElementById('vpPinyin').textContent = v.pinyin;
    document.getElementById('vpPos').textContent = v.pos || '';
    document.getElementById('vpEn').textContent = v.en;
    var rect = hl.getBoundingClientRect();
    popup.style.left = rect.left + 'px';
    popup.style.top = (rect.bottom + 8) + 'px';
    popup.classList.add('show');
    e.stopPropagation();
  });

  document.getElementById('vocabPopup').onclick = function() { this.classList.remove('show'); };
  document.addEventListener('click', function() {
    document.getElementById('vocabPopup').classList.remove('show');
  });

  // 音频结束 → 自动翻页
  audio.onended = function() {
    parent.postMessage({ type: 'playerMessage', action: 'displayComplete' }, '*');
  };

  // ── 角色扮演 ──────────────────────────────────────
  document.getElementById('practiceBtn').onclick = function() {
    if (data.hasRolePlay === false) return;
    document.getElementById('rpAvatarA').src = data.imgBase + data.speakers[0].avatar;
    document.getElementById('rpAvatarB').src = data.imgBase + data.speakers[1].avatar;
    document.getElementById('rpTotal').textContent = data.lines.length;
    document.getElementById('rpCur').textContent = '1';
    document.getElementById('rpStatus').textContent = 'Choose your role';
    document.getElementById('rpRoleBtns').style.display = 'flex';
    document.getElementById('rpPlayAnswer').style.display = 'none';
    document.getElementById('rpNextLine').style.display = 'none';
    rpIndex = 0;
    myRole = null;
    document.getElementById('rpOverlay').classList.add('show');
  };

  document.getElementById('rpChooseA').onclick = function() { chooseRole('A', data); };
  document.getElementById('rpChooseB').onclick = function() { chooseRole('B', data); };

  document.getElementById('rpPlayHint').onclick = function() {
    audio.currentTime = data.lines[rpIndex].start;
    audio.play();
  };
  document.getElementById('rpPlayAnswer').onclick = function() {
    audio.currentTime = data.lines[rpIndex].start;
    audio.play();
  };
  document.getElementById('rpNextLine').onclick = function() {
    if (rpIndex < data.lines.length - 1) { rpIndex++; showRpLine(data); }
    else {
      document.getElementById('rpOverlay').classList.remove('show');
      parent.postMessage({ type: 'playerMessage', action: 'rolePlayComplete' }, '*');
    }
  };
  document.getElementById('rpExit').onclick = function() {
    document.getElementById('rpOverlay').classList.remove('show');
    audio.pause();
  };
}

function chooseRole(role, data) {
  myRole = role;
  rpIndex = 0;
  showRpLine(data);
}

function showRpLine(data) {
  var line = data.lines[rpIndex];
  var isMy = line.speaker === myRole;
  var isLast = rpIndex === data.lines.length - 1;
  document.getElementById('rpCur').textContent = rpIndex + 1;

  var prompt = isMy ? 'Your turn, say:' : 'Wait for partner...';
  document.getElementById('rpStatus').innerHTML =
    '<div class="rp-status-prompt">' + prompt + '</div>' +
    '<div class="rp-current-hanzi">' + line.hanzi + '</div>' +
    '<div class="rp-current-pinyin">' + line.pinyin + '</div>';

  document.getElementById('rpPlayAnswer').style.display =
    (!isMy && !isLast) ? 'inline-block' : 'none';
  document.getElementById('rpNextLine').style.display =
    (isMy || isLast) ? 'inline-block' : 'none';
}

function wrapVocab(hanzi, vocabArr) {
  if (!vocabArr || !vocabArr.length) return hanzi;
  var result = '', last = 0;
  vocabArr.forEach(function(v) {
    var word = hanzi.substring(v.start, v.end);
    result += hanzi.slice(last, v.start) +
      '<span class="dlg-vocab-hl" data-word="' + word + '">' + word + '</span>';
    last = v.end;
  });
  return result + hanzi.slice(last);
}

function fmtTime(sec) {
  sec = Math.floor(sec);
  var m = Math.floor(sec / 60);
  var s = sec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function applyVisibility() {
  document.querySelectorAll('.dlg-text-pinyin').forEach(function(el) {
    el.classList.toggle('hidden', !showPinyin);
  });
  document.querySelectorAll('.dlg-text-en').forEach(function(el) {
    el.classList.toggle('hidden', !showEnglish);
  });
}
