/* ============================================================
   dialogue.js — 情景对话页面逻辑
   课文精读 + 实战练习 + 结束反馈
   ============================================================ */

var audio = new Audio();          // 课文精读音频
var rpAudio = new Audio();         // 角色扮演音频
var showPinyin = true, showEnglish = true;
var vocabMap = {};
var speakerMap = {};               // id → speaker obj

// 录音相关
var mediaRecorder = null;
var audioChunks = [];
var recordedBlob = null;
var isRecording = false;

// 状态机
// INTRO | PRACTICE_SELECT | PRACTICE_PLAYING | PRACTICE_RESULT
var state = 'INTRO';
var myRole = null;                 // 'A' | 'B'
var rpIndex = 0;                   // 当前句子索引
var isTextFocused = false;          // 课文/场景互斥切换状态
var totalLines = 0;

// ── 入口 ────────────────────────────────────────────────
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'slideData') {
    document.documentElement.style.setProperty('--player-scale', e.data.data.scale || 1);
    init(e.data.data);
  }
  if (e.data && e.data.type === 'stopAudio') {
    audio.pause();
    rpAudio.pause();
  }
});

function init(data) {
  // 重置所有状态
  state = 'INTRO';
  myRole = null;
  rpIndex = 0;
  showView('text');
  showPinyin = data.showPinyin !== false;
  showEnglish = data.showEnglish !== false;

  // 词汇表
  vocabMap = {};
  if (data.vocabList) data.vocabList.forEach(function(v) { vocabMap[v.hanzi] = v; });

  // 说话人映射
  speakerMap = {};
  if (data.speakers) data.speakers.forEach(function(s) { speakerMap[s.id] = s; });

  totalLines = data.lines ? data.lines.length : 0;

  // ── 渲染左侧控制面板 ──────────────────────────────────
  var titleEl = document.getElementById('ctrlTitle');
  if (titleEl) titleEl.textContent = data.title || '';
  var subtitleEl = document.getElementById('ctrlSubtitle');
  if (subtitleEl) subtitleEl.textContent = data.subtitle || '';

  document.getElementById('pinyinToggle').checked = showPinyin;
  document.getElementById('englishToggle').checked = showEnglish;
  document.getElementById('rpPinyinToggle').checked = showPinyin;
  document.getElementById('rpEnglishToggle').checked = showEnglish;

  // ── 渲染场景图 ────────────────────────────────────────
  var sceneImg = document.getElementById('sceneImg');
  if (sceneImg) {
    if (data.sceneImage) {
      sceneImg.src = data.imgBase + data.sceneImage;
      sceneImg.style.display = 'block';
    } else {
      sceneImg.style.display = 'none';
    }
  }

  // ── 渲染说话人头像行 ──────────────────────────────────
  var speakersRow = document.getElementById('speakersRow');
  if (speakersRow) speakersRow.innerHTML = '';
  data.speakers.forEach(function(s) {
    var html = '<div class="speaker-badge" id="spk-' + s.id + '">' +
      '<img class="spk-avatar" src="' + data.imgBase + s.avatar + '">' +
      '<div class="spk-name">' + s.name + '</div>' +
      '<div class="spk-pinyin">' + (s.pinyin || '') + '</div>' +
      '</div>';
    speakersRow.insertAdjacentHTML('beforeend', html);
  });

  // ── 渲染课文文本行 ────────────────────────────────────
  var textList = document.getElementById('dlgTextList');
  if (textList) textList.innerHTML = '';
  data.lines.forEach(function(line, i) {
    var spk = speakerMap[line.speaker] || {};
    var wrapped = wrapVocab(line.hanzi, line.vocab);
    var avatar = spk.avatar
      ? '<img class="dlg-line-avatar" src="' + data.imgBase + spk.avatar + '">'
      : '';
    var html = '<div class="dlg-text-item" id="dlg-line-' + i + '">' +
      '<div class="dlg-text-avatar">' + avatar + '</div>' +
      '<div class="dlg-text-content">' +
      '<div class="dlg-text-pinyin">' + line.pinyin + '</div>' +
      '<div class="dlg-text-hanzi">' + wrapped + '</div>' +
      '<div class="dlg-text-en">' + line.en + '</div>' +
      '</div>' +
      '</div>';
    textList.insertAdjacentHTML('beforeend', html);
  });

  applyVisibility();

  // 默认锁定课文 — 听完音频后才解锁（但已听过则跳过）
  var listenedKey = 'dlg-listened-' + data.courseId + '-' + data.index;
  if (!sessionStorage.getItem(listenedKey)) {
    document.getElementById('textSection').classList.add('locked');
    var enterBtn = document.getElementById('enterPracticeBtn');
    if (enterBtn) enterBtn.disabled = true;
    var textToggle = document.getElementById('textToggle');
    if (textToggle) textToggle.disabled = true;
    var textLabel = document.getElementById('textToggleLabel');
    if (textLabel) textLabel.textContent = 'Show transcript';
  } else {
    // 已听过：保持解锁状态
    var enterBtn2 = document.getElementById('enterPracticeBtn');
    if (enterBtn2) enterBtn2.disabled = false;
    var textToggle2 = document.getElementById('textToggle');
    if (textToggle2) textToggle2.disabled = false;
  }

  // ── 音频设置 ──────────────────────────────────────────
  audio.src = data.audioBase + (data.dialogueAudio || data.audio || '');
  audio.playbackRate = 1.0;

  // 如果有逐句音频则设置，否则清除旧 src
  if (data.rolePlay && data.rolePlay.dialogueAudio) {
    rpAudio.src = data.audioBase + data.rolePlay.dialogueAudio;
  } else {
    rpAudio.src = '';
  }

  // ── 事件绑定 ──────────────────────────────────────────
  bindAudioEvents(data);
  bindToggles(data);
  bindToolbar(data);
  bindPracticeEvents(data);
}

/* ── 音频事件 ────────────────────────────────────────────── */
function bindAudioEvents(data) {
  var playBtn = document.getElementById('playBtn');
  if (playBtn) playBtn.onclick = function() {
    if (audio.paused) { audio.play(); }
    else { audio.pause(); }
  };

  audio.addEventListener('play', function() {
    document.getElementById('playIcon').textContent = '⏸';
    playBtn.classList.add('playing');
  });
  audio.addEventListener('pause', function() {
    document.getElementById('playIcon').textContent = '▶';
    playBtn.classList.remove('playing');
  });

  audio.addEventListener('timeupdate', function() {
    if (!audio.duration) return;
    var pct = (audio.currentTime / audio.duration) * 100;
    var fill = document.getElementById('audioProgressFill');
    var cur = document.getElementById('audioCurTime');
    if (fill) fill.style.width = pct + '%';
    if (cur) cur.textContent = fmtTime(audio.currentTime);

    // 同步高亮句子
    highlightLineForTime(audio.currentTime, data.lines);
  });

  audio.addEventListener('loadedmetadata', function() {
    var dur = document.getElementById('audioDur');
    if (dur) dur.textContent = fmtTime(audio.duration);
  });

  audio.addEventListener('ended', function() {
    // 解锁课文和练习按钮，解锁后自动显示课文内容（互斥切换）
    var textSection = document.getElementById('textSection');
    if (textSection) textSection.classList.remove('locked');
    var sceneCard = document.getElementById('sceneCard');
    if (sceneCard) sceneCard.classList.add('focus-mode');
    isTextFocused = true;
    var enterBtn = document.getElementById('enterPracticeBtn');
    if (enterBtn) enterBtn.disabled = false;
    var textToggle = document.getElementById('textToggle');
    if (textToggle) textToggle.disabled = false;
    var textLabel = document.getElementById('textToggleLabel');
    if (textLabel) textLabel.textContent = 'Hide transcript';
    // 记住已听过，下次进入直接解锁
    var listenedKey = 'dlg-listened-' + data.courseId + '-' + data.index;
    sessionStorage.setItem(listenedKey, '1');
    parent.postMessage({ type: 'playerMessage', action: 'displayComplete' }, '*');
  });

  // 进度条点击跳转
  var progressBar = document.querySelector('.ctrl-progress-bar');
  if (progressBar) {
    progressBar.onclick = function(e) {
      var rect = progressBar.getBoundingClientRect();
      var ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audio.currentTime = ratio * audio.duration;
    };
  }

  // 语速滑动条
  var speedSlider = document.getElementById('speedSlider');
  var speedCurrent = document.getElementById('speedCurrent');
  if (speedSlider) {
    speedSlider.oninput = function() {
      var speed = parseFloat(this.value);
      audio.playbackRate = speed;
      if (speedCurrent) speedCurrent.textContent = speed.toFixed(1) + 'x';
    };
  }
}

/* ── 同步高亮 ────────────────────────────────────────────── */
function highlightLineForTime(time, lines) {
  // 清除所有高亮
  document.querySelectorAll('.dlg-text-item').forEach(function(el) {
    el.classList.remove('active');
  });
  document.querySelectorAll('.speaker-badge').forEach(function(el) {
    el.classList.remove('active');
  });

  // 找到当前时间对应的句子
  var activeIdx = -1;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (time >= line.start && time < line.end) {
      activeIdx = i;
      break;
    }
  }

  if (activeIdx >= 0) {
    var line = lines[activeIdx];
    var itemEl = document.getElementById('dlg-line-' + activeIdx);
    var spkEl = document.getElementById('spk-' + line.speaker);
    if (itemEl) itemEl.classList.add('active');
    if (spkEl) spkEl.classList.add('active');
  }
}

/* ── 开关控件 ────────────────────────────────────────────── */
function bindToggles(data) {
  var pinyinToggle = document.getElementById('pinyinToggle');
  if (pinyinToggle) pinyinToggle.onchange = function() {
    showPinyin = this.checked;
    applyVisibility();
    // 同步到练习浮层
    var rpPy = document.getElementById('rpPinyinToggle');
    if (rpPy) rpPy.checked = showPinyin;
    applyRpVisibility();
  };

  var englishToggle = document.getElementById('englishToggle');
  if (englishToggle) englishToggle.onchange = function() {
    showEnglish = this.checked;
    applyVisibility();
    var rpEn = document.getElementById('rpEnglishToggle');
    if (rpEn) rpEn.checked = showEnglish;
    applyRpVisibility();
  };

  var rpPinyinToggle = document.getElementById('rpPinyinToggle');
  if (rpPinyinToggle) rpPinyinToggle.onchange = function() {
    showPinyin = this.checked;
    applyVisibility();
    var py = document.getElementById('pinyinToggle');
    if (py) py.checked = showPinyin;
    applyRpVisibility();
  };

  var rpEnglishToggle = document.getElementById('rpEnglishToggle');
  if (rpEnglishToggle) rpEnglishToggle.onchange = function() {
    showEnglish = this.checked;
    applyVisibility();
    var en = document.getElementById('englishToggle');
    if (en) en.checked = showEnglish;
    applyRpVisibility();
  };
}

function applyVisibility() {
  document.querySelectorAll('.dlg-text-pinyin').forEach(function(el) {
    el.classList.toggle('hidden', !showPinyin);
  });
  document.querySelectorAll('.dlg-text-en').forEach(function(el) {
    el.classList.toggle('hidden', !showEnglish);
  });
}

function applyRpVisibility() {
  var container = document.getElementById('chatContainer');
  if (!container) return;
  container.classList.toggle('pinyin-hidden', !showPinyin);
  container.classList.toggle('english-hidden', !showEnglish);
}

/* ── 工具栏事件 ─────────────────────────────────────────── */
function bindToolbar(data) {
  // 显示/隐藏课文 → 专注模式（仅在课文解锁后可用）
  var textToggle = document.getElementById('textToggle');
  var textLabel = document.getElementById('textToggleLabel');
  var sceneCard = document.getElementById('sceneCard');

  if (textToggle) textToggle.onclick = function() {
    // 锁定状态下不可切换
    var textSection = document.getElementById('textSection');
    if (textSection && textSection.classList.contains('locked')) return;
    isTextFocused = !isTextFocused;
    sceneCard.classList.toggle('focus-mode', isTextFocused);
    if (textLabel) textLabel.textContent = isTextFocused ? 'Show transcript' : 'Hide transcript';
  };

  // 进入对话练习
  var enterBtn = document.getElementById('enterPracticeBtn');
  if (enterBtn) enterBtn.onclick = function() {
    if (data.hasRolePlay === false) return;
    switchToPractice(data);
  };

  // 词汇点击弹层
  var textList = document.getElementById('dlgTextList');
  if (textList) {
    textList.onclick = function(e) {
      var hl = e.target.closest('.dlg-vocab-hl');
      if (!hl) return;
      var word = hl.dataset.word;
      var v = vocabMap[word];
      if (!v) return;
      showVocabPopup(hl, v);
      e.stopPropagation();
    };
  }

  document.getElementById('vocabPopup').onclick = function() { this.classList.remove('show'); };
  document.addEventListener('click', function() {
    document.getElementById('vocabPopup').classList.remove('show');
  });
}

function showVocabPopup(hl, v) {
  var popup = document.getElementById('vocabPopup');
  document.getElementById('vpHanzi').textContent = v.hanzi;
  document.getElementById('vpPinyin').textContent = v.pinyin;
  document.getElementById('vpPos').textContent = v.pos || '';
  document.getElementById('vpEn').textContent = v.en;
  var rect = hl.getBoundingClientRect();
  popup.style.left = rect.left + 'px';
  popup.style.top = (rect.bottom + 8) + 'px';
  popup.classList.add('show');
}

/* ═══════════════════════════════════════════════════════════
   实战练习 — 角色扮演
   ═══════════════════════════════════════════════════════════ */

function switchToPractice(data) {
  state = 'PRACTICE_SELECT';

  // 暂停精读音频
  audio.pause();

  // 设置角色选项
  document.getElementById('rpChooseAvatarA').src = data.imgBase + data.speakers[0].avatar;
  document.getElementById('rpChooseAvatarB').src = data.imgBase + data.speakers[1].avatar;
  document.getElementById('rpChooseNameA').textContent = data.speakers[0].name;
  document.getElementById('rpChooseNameB').textContent = data.speakers[1].name;
  document.getElementById('rpTotal').textContent = totalLines;
  document.getElementById('rpTotal2').textContent = totalLines;

  clearChat();
  showView('roleSelect');
}

function showView(viewId) {
  // viewId: 'text' | 'roleSelect' | 'practice'
  var textView = document.getElementById('dlgMainView');
  var roleView = document.getElementById('dlgRoleSelectView');
  var practiceView = document.getElementById('dlgPracticeView');
  if (textView) textView.style.display = (viewId === 'text') ? 'flex' : 'none';
  if (roleView) roleView.style.display = (viewId === 'roleSelect') ? 'flex' : 'none';
  if (practiceView) practiceView.style.display = (viewId === 'practice') ? 'flex' : 'none';
  updateBadge(viewId);
  updateNavBar(viewId);
}

function updateBadge(viewId) {
  var badge = document.getElementById('stageBadge');
  if (!badge) return;
  if (viewId === 'text') {
    badge.textContent = 'Intensive Reading · 精读课';
  } else if (viewId === 'roleSelect') {
    badge.textContent = 'Choose Your Role';
  } else if (viewId === 'practice') {
    badge.textContent = 'Role Play · 实战练习';
  }
}

function updateNavBar(viewId) {
  var backBtn = document.getElementById('navBackBtn');
  var progEl = document.getElementById('navProgress');

  if (viewId === 'text') {
    if (backBtn) backBtn.classList.add('hidden');
    if (progEl) progEl.textContent = '';
    if (backBtn) backBtn.onclick = null;
  } else if (viewId === 'roleSelect') {
    if (backBtn) backBtn.classList.remove('hidden');
    if (progEl) progEl.textContent = '';
    if (backBtn) backBtn.onclick = function() {
      rpAudio.pause();
      clearRecordingState();
      showView('text');
      state = 'INTRO';
    };
  } else if (viewId === 'practice') {
    if (backBtn) backBtn.classList.remove('hidden');
    if (progEl) progEl.textContent = '第 ' + (rpIndex + 1) + ' / ' + totalLines + ' 句';
    if (backBtn) backBtn.onclick = function() {
      rpAudio.pause();
      audio.pause();
      clearRecordingState();
      showView('roleSelect');
      state = 'PRACTICE_SELECT';
    };
  }
}

function showPracticeStage(stage) {
  // stage: 'select' | 'playing' | 'result' — 仅用于练习视图内部
  document.getElementById('rpPracticeControls').style.display = stage === 'playing' ? 'flex' : 'none';
  document.getElementById('rpResultOverlay').style.display = stage === 'result' ? 'flex' : 'none';
}

function clearChat() {
  var container = document.getElementById('chatContainer');
  if (container) container.innerHTML = '';
}

function bindPracticeEvents(data) {
  // 放弃练习 → 返回角色选择
  document.getElementById('rpGiveupBtn').onclick = function() {
    rpAudio.pause();
    audio.pause();
    clearRecordingState();
    showView('roleSelect');
    state = 'PRACTICE_SELECT';
  };

  // 选择角色 A / B
  document.getElementById('rpChooseA').onclick = function() { chooseRole('A', data); };
  document.getElementById('rpChooseB').onclick = function() { chooseRole('B', data); };

  // 录音按钮：按住录音，松开停止
  var recordBtn = document.getElementById('recordBtn');
  if (recordBtn) {
    recordBtn.onmousedown = function() { startRecording(); };
    recordBtn.onmouseup = function() { stopRecording(); };
    recordBtn.onmouseleave = function() { if (isRecording) stopRecording(); };
    // 移动端 touch
    recordBtn.ontouchstart = function(e) { e.preventDefault(); startRecording(); };
    recordBtn.ontouchend = function(e) { e.preventDefault(); stopRecording(); };
  }

  // 回放录音
  var playRecBtn = document.getElementById('playRecBtn');
  if (playRecBtn) playRecBtn.onclick = function() {
    if (recordedBlob) {
      new Audio(URL.createObjectURL(recordedBlob)).play();
    }
  };

  // 我读完了
  document.getElementById('rpActionDone').onclick = function() {
    onUserReadDone(data);
  };

  // 再次练习
  document.getElementById('rpAgainBtn').onclick = function() {
    resetPractice(data);
  };

  // 完成成果 → 弹出确认
  document.getElementById('rpDoneBtn').onclick = function() {
    var overlay = document.getElementById('rpFinishOverlay');
    if (overlay) overlay.style.display = 'flex';
  };

  // 确认弹窗 — 取消
  document.getElementById('rpFinishCancel').onclick = function() {
    var overlay = document.getElementById('rpFinishOverlay');
    if (overlay) overlay.style.display = 'none';
  };

  // 确认弹窗 — 确定完成
  document.getElementById('rpFinishConfirm').onclick = function() {
    clearRecordingState();
    showView('text');
    state = 'INTRO';
    var overlay = document.getElementById('rpFinishOverlay');
    if (overlay) overlay.style.display = 'none';
    parent.postMessage({ type: 'playerMessage', action: 'rolePlayComplete' }, '*');
  };
}

function chooseRole(roleId, data) {
  myRole = roleId;
  rpIndex = 0;

  // 更新左侧面板显示我的角色
  var spk = speakerMap[roleId];
  document.getElementById('rpMyAvatar').src = data.imgBase + spk.avatar;
  document.getElementById('rpMyName').textContent = spk.name;
  var pinyinEl = document.getElementById('rpMyPinyin');
  if (pinyinEl) pinyinEl.textContent = spk.pinyin || '';

  // 生成进度圆点
  buildProgressDots();

  state = 'PRACTICE_PLAYING';
  showView('practice');
  showPracticeStage('playing');
  applyRpVisibility();
  playRpLine(data);
}

function buildProgressDots() {
  var container = document.getElementById('rpProgressDots');
  if (!container) return;
  container.innerHTML = '';
  for (var i = 0; i < totalLines; i++) {
    var dot = document.createElement('span');
    dot.className = 'rp-dot';
    dot.id = 'rp-dot-' + i;
    container.appendChild(dot);
  }
}

function updateProgressDots() {
  for (var i = 0; i < totalLines; i++) {
    var dot = document.getElementById('rp-dot-' + i);
    if (!dot) continue;
    dot.className = 'rp-dot';
    if (i < rpIndex) dot.classList.add('done');
    if (i === rpIndex) dot.classList.add('current');
  }
}

function playRpLine(data) {
  var line = data.lines[rpIndex];
  var isMy = line.speaker === myRole;

  // 更新进度
  document.getElementById('rpCur').textContent = rpIndex + 1;
  updateProgressDots();
  // 更新导航条进度
  var navProg = document.getElementById('navProgress');
  if (navProg) navProg.textContent = '第 ' + (rpIndex + 1) + ' / ' + totalLines + ' 句';

  // 添加气泡
  addChatBubble(line, isMy, data);

  if (isMy) {
    // 轮到用户：显示录音 UI
    showRecordUI(line);
  } else {
    // 隐藏录音 UI（当前是对方在说话）
    var sentenceEl = document.getElementById('rpRecordSentence');
    var area = document.getElementById('rpRecordArea');
    var actions = document.getElementById('rpRecordActions');
    if (sentenceEl) sentenceEl.style.display = 'none';
    if (area) area.style.display = 'none';
    if (actions) actions.style.display = 'none';

    // 对方：自动播放音频，波纹效果
    var bubble = document.getElementById('bubble-' + rpIndex);
    if (bubble) bubble.classList.add('speaking');
    playLineAudio(line, data, function() {
      if (bubble) bubble.classList.remove('speaking');
      // 音频播完，自动进入下一句
      if (rpIndex < totalLines - 1) {
        rpIndex++;
        playRpLine(data);
      } else {
        onAllLinesComplete(data);
      }
    });
  }
}

function addChatBubble(line, isMy, data) {
  var container = document.getElementById('chatContainer');
  var spk = speakerMap[line.speaker];
  var side = (line.speaker === myRole) ? 'right' : 'left';

  var bubble = document.createElement('div');
  bubble.className = 'chat-bubble ' + side;
  bubble.id = 'bubble-' + rpIndex;
  bubble.dataset.side = side;

  var avatarHtml = '<img class="bubble-avatar" src="' + data.imgBase + spk.avatar + '">';
  var textHtml =
    '<div class="bubble-body">' +
      '<div class="bubble-hanzi">' + line.hanzi + '</div>' +
      '<div class="bubble-pinyin">' + line.pinyin + '</div>' +
      '<div class="bubble-en">' + line.en + '</div>' +
    '</div>';

  if (side === 'left') {
    bubble.innerHTML = avatarHtml + textHtml;
  } else {
    // 头像在右边：avatar 在 DOM 中放前面，row-reverse 使其在视觉上居右
    bubble.innerHTML = avatarHtml + textHtml;
    // 当前用户需要读的气泡加高亮边框
    if (isMy) bubble.classList.add('current');
  }

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function playLineAudio(line, data, onEnd) {
  // 全局 audio 已加载完成，单次 seek + play 即可
  var target = audio;

  function doPlay(targetEl) {
    targetEl.currentTime = line.start;
    var playPromise = targetEl.play();
    if (playPromise) {
      playPromise.then(function() {
        var timer = setInterval(function() {
          if (targetEl.currentTime >= line.end - 0.05) {
            clearInterval(timer);
            targetEl.pause();
            if (onEnd) onEnd();
          }
        }, 100);
        setTimeout(function() {
          clearInterval(timer);
          if (onEnd) onEnd();
        }, 30000);
      }).catch(function(err) {
        console.warn('playLineAudio play() rejected:', err && err.name, err && err.message);
        var actions = document.getElementById('rpRecordActions');
        var doneBtn = document.getElementById('rpActionDone');
        if (actions) actions.style.display = 'flex';
        if (doneBtn) {
          doneBtn.disabled = false;
          doneBtn.textContent = 'Next ▶';
        }
      });
    }
  }

  doPlay(target);
}

function onUserReadDone(data) {
  rpAudio.pause();
  audio.pause();

  function advance() {
    if (rpIndex < totalLines - 1) {
      rpIndex++;
      playRpLine(data);
    } else {
      onAllLinesComplete(data);
    }
  }

  // 等 MediaRecorder 完全停止、麦克风释放后再播放音频
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    var prevOnStop = mediaRecorder.onstop;
    mediaRecorder.onstop = function(e) {
      if (prevOnStop) prevOnStop.call(this, e);
      advance();
    };
    if (isRecording) {
      isRecording = false;
      mediaRecorder.stop();
    }
  } else {
    advance();
  }
}

function onAllLinesComplete(data) {
  state = 'PRACTICE_RESULT';
  // 所有圆点标记为完成
  for (var i = 0; i < totalLines; i++) {
    var dot = document.getElementById('rp-dot-' + i);
    if (dot) { dot.className = 'rp-dot done'; }
  }
  var navProg = document.getElementById('navProgress');
  if (navProg) navProg.textContent = '完成';
  showPracticeStage('result');
}

function resetPractice(data) {
  rpAudio.pause();
  audio.pause();
  rpIndex = 0;
  state = 'PRACTICE_PLAYING';
  clearChat();
  clearRecordingState();
  showPracticeStage('playing');
  // 重置进度圆点
  for (var i = 0; i < totalLines; i++) {
    var dot = document.getElementById('rp-dot-' + i);
    if (dot) { dot.className = 'rp-dot'; }
  }
  var navProg = document.getElementById('navProgress');
  if (navProg) navProg.textContent = '第 1 / ' + totalLines + ' 句';
  playRpLine(data);
}

function clearRecordingState() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
  }
  mediaRecorder = null;
  audioChunks = [];
  recordedBlob = null;
  isRecording = false;
}

function showRecordUI(line) {
  // 停止任何活跃录音，避免 MediaRecorder 泄漏
  if (mediaRecorder && isRecording) {
    isRecording = false;
    mediaRecorder.stop();
  }
  mediaRecorder = null;

  // 显示句子提示
  var sentenceEl = document.getElementById('rpRecordSentence');
  if (sentenceEl) {
    sentenceEl.style.display = 'flex';
    var hanziSpan = document.getElementById('rpRecordHanzi');
    if (hanziSpan) hanziSpan.textContent = line.hanzi;
  }
  // 显示录音区域
  var area = document.getElementById('rpRecordArea');
  if (area) area.style.display = 'flex';
  // 隐藏回放+完成按钮行
  var actions = document.getElementById('rpRecordActions');
  if (actions) actions.style.display = 'none';

  // 重置录音状态（每句话独立）
  audioChunks = [];
  recordedBlob = null;
  isRecording = false;
}

function startRecording() {
  // 防止重复点击
  if (isRecording) return;
  isRecording = true;

  var getMedia = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices))
      || (navigator.getUserMedia && navigator.getUserMedia.bind(navigator));
  if (!getMedia) {
    console.warn('Microphone API not available');
    isRecording = false;
    var actions = document.getElementById('rpRecordActions');
    var doneBtn = document.getElementById('rpActionDone');
    if (actions) actions.style.display = 'flex';
    if (doneBtn) doneBtn.disabled = false;
    return;
  }
  getMedia({ audio: true }).then(function(stream) {
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = function(e) {
      audioChunks.push(e.data);
    };
    mediaRecorder.onstop = function() {
      recordedBlob = new Blob(audioChunks, { type: 'audio/webm' });
      // 显示回放+完成按钮
      var actions = document.getElementById('rpRecordActions');
      var doneBtn = document.getElementById('rpActionDone');
      if (actions) actions.style.display = 'flex';
      if (doneBtn) {
        doneBtn.disabled = false;
      }
      // 停止所有 track
      stream.getTracks().forEach(function(t) { t.stop(); });
    };
    mediaRecorder.start();
    var recBtn = document.getElementById('recordBtn');
    if (recBtn) recBtn.classList.add('recording');
  }).catch(function(err) {
    console.warn('录音权限被拒绝:', err);
    isRecording = false;
    // 即使没权限，也让用户点"我读完了"
    var actions = document.getElementById('rpRecordActions');
    var doneBtn = document.getElementById('rpActionDone');
    if (actions) actions.style.display = 'flex';
    if (doneBtn) doneBtn.disabled = false;
  });
}

function stopRecording() {
  if (mediaRecorder && isRecording) {
    isRecording = false;
    mediaRecorder.stop();
    var recBtn = document.getElementById('recordBtn');
    if (recBtn) recBtn.classList.remove('recording');
  }
}

/* ── 词汇高亮 ────────────────────────────────────────────── */
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

/* ── 工具函数 ────────────────────────────────────────────── */
function fmtTime(sec) {
  sec = Math.floor(sec || 0);
  var m = Math.floor(sec / 60);
  var s = sec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}
