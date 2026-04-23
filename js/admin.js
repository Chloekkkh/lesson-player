/**
 * admin.js — HSK 课程制作工具 SPA
 */

'use strict';

/* ─────────────────────────────────────────
   AdminAPI — fetch wrapper
   ───────────────────────────────────────── */
class AdminAPI {
  constructor() {
    this.base = '';
  }

  async get(url) {
    const r = await fetch(this.base + url);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  async post(url, data) {
    const r = await fetch(this.base + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  async patch(url, data) {
    const r = await fetch(this.base + url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  async postRaw(url, data) {
    const r = await fetch(this.base + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  async regenerateSlide(courseId, slideIndex) {
    return this.postRaw('/api/courses/' + courseId + '/slides/' + slideIndex + '/regenerate', {});
  }

  async put(url, data) {
    const r = await fetch(this.base + url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  async del(url) {
    const r = await fetch(this.base + url, { method: 'DELETE' });
    if (!r.ok && r.status !== 204) throw new Error(await r.text());
    return r.status === 204 ? {} : r.json();
  }
}

const api = new AdminAPI();

/* ─────────────────────────────────────────
   Toast
   ───────────────────────────────────────── */
let toastTimer;
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type !== 'info' ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

/* ─────────────────────────────────────────
   Router
   ───────────────────────────────────────── */
const routes = {};

function route(pattern, handler) {
  routes[pattern] = handler;
}

function navigate(hash) {
  location.hash = hash;
}

function getRoute() {
  const hash = location.hash || '#courses';
  const path = hash.replace(/^#\/?/, '');
  return '/' + path;
}

async function dispatch() {
  const path = getRoute();
  const view = document.getElementById('view');
  view.innerHTML = '<div class="loading">加载中…</div>';

  // Sidebar
  await renderNav();

  // Match route
  for (const [pattern, handler] of Object.entries(routes)) {
    const re = new RegExp('^' + pattern.replace(/\//g, '\\/').replace(/:[^/]+/g, '([^/]+)') + '$');
    const m = path.match(re);
    if (m) {
      try {
        await handler.call(null, ...m.slice(1));
      } catch (e) {
        view.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">加载失败：` + e.message + `</div></div>`;
        console.error(e);
      }
      return;
    }
  }

  // Fallback
  view.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⁉️</div><div class="empty-state-text">页面不存在</div></div>';
}

/* ─────────────────────────────────────────
   Nav
   ───────────────────────────────────────── */
let allCourses = [];

async function renderNav() {
  const nav = document.getElementById('courseNav');
  try {
    allCourses = await api.get('/api/courses');
  } catch (e) {
    allCourses = [];
  }

  const currentPath = getRoute();
  const courseMatch = currentPath.match(/^\/course\/([^/]+)/);

  let html = `<div class="nav-item new-course" id="navNewCourse">+ 新建课程</div>`;

  allCourses.forEach(c => {
    const active = courseMatch && courseMatch[1] === c.id ? ' active' : '';
    html += `<div class="nav-item${active}" data-hash="#course/${c.id}">${escHtml(c.title)}</div>`;
  });

  nav.innerHTML = html;

  nav.querySelector('#navNewCourse').addEventListener('click', () => openModalNewCourse());

  nav.querySelectorAll('.nav-item[data-hash]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.hash));
  });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─────────────────────────────────────────
   Modal helpers
   ───────────────────────────────────────── */
function openModal(title, bodyHtml, footerHtml) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-title">${title}</div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-footer">${footerHtml}</div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  return overlay;
}

function closeModal(overlay) {
  if (overlay) overlay.remove();
}

function modalCloseOn(overlay, btn) {
  btn.addEventListener('click', () => closeModal(overlay));
}

/* ─────────────────────────────────────────
   Routes
   ───────────────────────────────────────── */
route('/courses', coursesView);
route('/course/:id', courseView);
route('/course/:id/slide/:index', slideView);

/* ── #courses ─────────────────────────────── */
async function coursesView() {
  const view = document.getElementById('view');
  try {
    const courses = await api.get('/api/courses');
    if (!courses.length) {
      view.innerHTML = `
        <div class="view-header">
          <div><h1 class="view-title">课程列表</h1></div>
          <button class="btn btn-primary" id="btnNew">+ 新建课程</button>
        </div>
        <div class="empty-state">
          <div class="empty-state-icon">📚</div>
          <div class="empty-state-text">暂无课程</div>
          <button class="btn btn-primary" id="btnNewEmpty">创建第一个课程</button>
        </div>`;
      } else {
      let cards = '';
      courses.forEach(c => {
        cards += `
          <div class="course-card" data-id="${escAttr(c.id)}">
            <div class="course-card-title">${escHtml(c.title)}</div>
            <div class="course-card-id">${escHtml(c.id)}</div>
            <div class="course-card-desc">${escHtml(c.description || '')}</div>
            <div class="course-card-meta">
              <span>${c.slideCount || 0} 页</span>
              <span>${escHtml(c.author || '')}</span>
            </div>
            <div class="course-card-actions">
              <button class="btn btn-sm btn-danger btn-delete-course">删除</button>
            </div>
          </div>`;
      });
      view.innerHTML = `
        <div class="view-header">
          <div><h1 class="view-title">课程列表</h1></div>
          <button class="btn btn-primary" id="btnNew">+ 新建课程</button>
        </div>
        <div class="course-grid">${cards}</div>`;
    }

    document.getElementById('btnNew')?.addEventListener('click', openModalNewCourse);
    document.getElementById('btnNewEmpty')?.addEventListener('click', openModalNewCourse);

    view.querySelectorAll('.course-card[data-id]').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.classList.contains('btn-delete-course')) {
          e.stopPropagation();
          deleteCourse(card.dataset.id);
          return;
        }
        navigate('#course/' + card.dataset.id);
      });
    });
  } catch (e) {
    view.innerHTML = '<div class="empty-state">加载失败: ' + escHtml(e.message) + '</div>';
  }
}

function openModalNewCourse() {
  const overlay = openModal('新建课程', `
    <div class="form-group">
      <label class="form-label">课程 ID（唯一标识，用于 URL）</label>
      <input class="form-input" id="newCourseId" placeholder="例如: lesson-greeting">
    </div>
    <div class="form-group">
      <label class="form-label">课程标题</label>
      <input class="form-input" id="newCourseTitle" placeholder="例如: 问候语">
    </div>
    <div class="form-group">
      <label class="form-label">描述</label>
      <textarea class="form-textarea" id="newCourseDesc" placeholder="可选"></textarea>
    </div>`, `
    <button class="btn btn-secondary" id="cancelBtn">取消</button>
    <button class="btn btn-primary" id="createBtn">创建</button>`);

  modalCloseOn(overlay, document.getElementById('cancelBtn'));

  document.getElementById('createBtn').addEventListener('click', async () => {
    const id = document.getElementById('newCourseId').value.trim();
    const title = document.getElementById('newCourseTitle').value.trim();
    const description = document.getElementById('newCourseDesc').value.trim();
    if (!id || !title) { showToast('请填写 ID 和标题', 'error'); return; }
    try {
      await api.post('/api/courses', { id, title, description });
      closeModal(overlay);
      showToast('课程已创建', 'success');
      navigate('#course/' + id);
    } catch (e) {
      showToast(e.message, 'error');
    }
  });
}

async function deleteCourse(id) {
  if (!confirm('确定要删除课程 "' + id + '" 吗？此操作不可撤销。')) return;
  try {
    await api.del('/api/courses/' + id);
    showToast('课程已删除', 'success');
    dispatch();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

/* ── #course/:id ─────────────────────────── */
async function courseView(courseId) {
  const view = document.getElementById('view');
  try {
    const course = await api.get('/api/courses/' + courseId);

    // Get unconfigured slides
    let unconfigured = [];
    try { unconfigured = await api.get('/api/courses/' + courseId + '/unconfigured'); } catch(e) {}

    // Build slide list
    let slideListHtml = '';
    (course.slides || []).forEach(s => {
      const typeClass = 'type-' + (s.type || 'content');
      const typeIcon = { content: '📄', exercise: '✏️', display: '📖', video: '🎬' }[s.type] || '📄';
      const meta = buildSlideMeta(s);
      slideListHtml += `
        <div class="slide-item ${typeClass}" data-index="${s.index}">
          <span class="slide-index">${s.index}</span>
          <span class="slide-type-icon">${typeIcon}</span>
          <div class="slide-info">
            <div class="slide-title">${escHtml(s.title || '无标题')}</div>
            <div class="slide-meta">${meta}</div>
          </div>
          <div class="slide-actions">
            <button class="btn btn-sm btn-ghost btn-preview-slide" title="预览">▶</button>
            <button class="btn btn-sm btn-ghost btn-regen-slide" title="重新生成HTML">↻</button>
            <button class="btn btn-sm btn-danger btn-delete-slide" title="删除">🗑</button>
          </div>
        </div>`;
    });

    let unconfiguredHtml = '';
    if (unconfigured.length) {
      unconfiguredHtml = `
        <div class="unconfigured-area">
          <h3>📁 未配置幻灯片</h3>
          ${unconfigured.map(f => `
            <div class="unconfigured-item">
              <span>${escHtml(f.name)}</span>
              <button class="btn btn-sm btn-ghost btn-import-slide" data-name="${escAttr(f.name)}">导入</button>
            </div>`).join('')}
        </div>`;
    }

    view.innerHTML = `
      <div class="view-header">
        <div>
          <div class="breadcrumb"><a onclick="history.back()">← 返回</a></div>
          <h1 class="view-title" id="courseTitleDisplay">${escHtml(course.title || courseId)}</h1>
        </div>
        <div class="btn-group">
          <button class="btn btn-danger btn-sm" id="btnDeleteCourse">删除课程</button>
        </div>
      </div>

      <!-- Metadata -->
      <div class="card">
        <div class="card-title">课程信息</div>
        <div class="form-group">
          <label class="form-label">标题</label>
          <input class="form-input" id="editTitle" value="${escAttr(course.title || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">描述</label>
          <textarea class="form-textarea" id="editDesc">${escHtml(course.description || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">作者</label>
          <input class="form-input" value="${escAttr(course.author || 'teacher')}" disabled>
        </div>
        <button class="btn btn-primary btn-sm" id="btnSaveMeta">保存</button>
      </div>

      <!-- Slides -->
      <div class="card">
        <div class="card-title">幻灯片（${(course.slides || []).length} 页）</div>
        <div class="slide-list" id="slideList">
          ${slideListHtml || '<div class="empty-state" style="padding:20px">暂无幻灯片，点击下方添加</div>'}
        </div>
        <div class="add-slide-area" id="btnAddSlide">+ 添加幻灯片</div>
        ${unconfiguredHtml}
      </div>`;

    // Save metadata
    document.getElementById('btnSaveMeta').addEventListener('click', async () => {
      const title = document.getElementById('editTitle').value.trim();
      const description = document.getElementById('editDesc').value.trim();
      try {
        await api.patch('/api/courses/' + courseId, { title, description });
        showToast('已保存', 'success');
        document.getElementById('courseTitleDisplay').textContent = title;
      } catch (e) { showToast(e.message, 'error'); }
    });

    // Delete course
    document.getElementById('btnDeleteCourse').addEventListener('click', () => {
      if (confirm('确定删除整个课程？')) {
        api.del('/api/courses/' + courseId).then(() => {
          showToast('已删除', 'success');
          navigate('#courses');
        }).catch(e => showToast(e.message, 'error'));
      }
    });

    // Add slide
    document.getElementById('btnAddSlide').addEventListener('click', () => openModalAddSlide(courseId));

    // Slide item clicks
    view.querySelectorAll('.slide-item[data-index]').forEach(item => {
      item.addEventListener('click', e => {
        if (e.target.closest('.slide-actions')) return;
        navigate('#course/' + courseId + '/slide/' + item.dataset.index);
      });
    });

    view.querySelectorAll('.btn-preview-slide').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const idx = btn.closest('.slide-item').dataset.index;
        window.open('/player.html?course=' + courseId + '&slide=' + idx, '_blank');
      });
    });

    view.querySelectorAll('.btn-regen-slide').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const idx = parseInt(btn.closest('.slide-item').dataset.index, 10);
        try {
          await api.regenerateSlide(courseId, idx);
          showToast('HTML 已重新生成', 'success');
        } catch (e) { showToast(e.message, 'error'); }
      });
    });

    view.querySelectorAll('.btn-delete-slide').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const idx = parseInt(btn.closest('.slide-item').dataset.index, 10);
        if (!confirm('删除第 ' + idx + ' 页？后续页面会自动前移。')) return;
        try {
          await api.del('/api/courses/' + courseId + '/slides/' + idx);
          showToast('已删除', 'success');
          courseView.call(null, courseId);
        } catch (e) { showToast(e.message, 'error'); }
      });
    });

    // Import unconfigured slides
    view.querySelectorAll('.btn-import-slide').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.name;
        try {
          const entry = await api.post('/api/courses/' + courseId + '/unconfigured/' + encodeURIComponent(name) + '/import', {});
          showToast('已导入为第 ' + entry.index + ' 页', 'success');
          courseView.call(null, courseId);
        } catch (e) { showToast(e.message, 'error'); }
      });
    });

  } catch (e) {
    view.innerHTML = '<div class="empty-state">加载失败: ' + escHtml(e.message) + '</div>';
  }
}

function buildSlideMeta(slide) {
  if (slide.type === 'exercise') return (slide.questions || []).length + ' 题';
  if (slide.type === 'display') return (slide.vocab || []).length + ' 词汇';
  if (slide.type === 'content') return slide.audio || '无音频';
  if (slide.type === 'video') return slide.video || '无视频';
  return '';
}

function openModalAddSlide(courseId) {
  const overlay = openModal('添加幻灯片', `
    <div class="type-grid">
      <div class="type-option" data-type="content">
        <div class="type-option-icon">📄</div>
        <div class="type-option-name">内容页</div>
        <div class="type-option-desc">带音频、字幕、聚光灯</div>
      </div>
      <div class="type-option" data-type="exercise">
        <div class="type-option-icon">✏️</div>
        <div class="type-option-name">练习页</div>
        <div class="type-option-desc">选择题、填空、连词等</div>
      </div>
      <div class="type-option" data-type="display">
        <div class="type-option-icon">📖</div>
        <div class="type-option-name">生词页</div>
        <div class="type-option-desc">词汇展示学习</div>
      </div>
      <div class="type-option" data-type="video">
        <div class="type-option-icon">🎬</div>
        <div class="type-option-name">视频页</div>
        <div class="type-option-desc">视频播放</div>
      </div>
    </div>`, `
    <button class="btn btn-secondary" id="cancelBtn">取消</button>`);

  modalCloseOn(overlay, document.getElementById('cancelBtn'));

  overlay.querySelectorAll('.type-option').forEach(opt => {
    opt.addEventListener('click', async () => {
      const type = opt.dataset.type;
      closeModal(overlay);
      try {
        const entry = await api.post('/api/courses/' + courseId + '/slides', { type });
        showToast('已添加第 ' + entry.index + ' 页', 'success');
        navigate('#course/' + courseId + '/slide/' + entry.index);
      } catch (e) { showToast(e.message, 'error'); }
    });
  });
}

/* ── #course/:id/slide/:index ─────────────────── */
async function slideView(courseId, index) {
  const view = document.getElementById('view');
  const idx = parseInt(index, 10);
  try {
    const [course, audioFiles] = await Promise.all([
      api.get('/api/courses/' + courseId),
      api.get('/api/courses/' + courseId + '/audio-files').catch(() => []),
    ]);
    const slide = (course.slides || []).find(s => s.index === idx);
    if (!slide) { view.innerHTML = '<div class="empty-state">幻灯片不存在</div>'; return; }

    renderSlideEditor(view, courseId, slide, audioFiles);
  } catch (e) {
    view.innerHTML = '<div class="empty-state">加载失败: ' + escHtml(e.message) + '</div>';
  }
}

function renderSlideEditor(view, courseId, slide, audioFiles) {
  const type = slide.type || 'content';
  const typeBadgeClass = type;
  const typeName = { content: '内容页', exercise: '练习页', display: '生词页', video: '视频页' }[type] || type;

  let bodyHtml = '';

  if (type === 'content') {
    bodyHtml = renderContentEditor(slide, courseId, audioFiles);
  } else if (type === 'exercise') {
    bodyHtml = renderExerciseEditor(slide, courseId, audioFiles);
  } else if (type === 'display') {
    bodyHtml = renderDisplayEditor(slide, courseId);
  } else if (type === 'video') {
    bodyHtml = renderVideoEditor(slide, courseId, audioFiles);
  }

  view.innerHTML = `
    <div class="view-header">
      <div>
        <div class="breadcrumb">
          <a onclick="navigate('#course/${courseId}')">← ${escHtml(courseId)}</a> / 第 ${slide.index} 页
        </div>
        <h1 class="view-title">${escHtml(slide.title || typeName)}</h1>
      </div>
      <div class="btn-group">
        <button class="btn btn-ghost" id="btnPreview">▶ 预览</button>
        <button class="btn btn-secondary" id="btnRegenHtml">重新生成 HTML</button>
        <button class="btn btn-primary" id="btnSaveSlide">保存</button>
      </div>
    </div>

    <div class="card">
      <div class="slide-editor-header">
        <span class="slide-type-badge ${typeBadgeClass}">${typeName}</span>
        <input class="slide-title-input" id="slideTitleInput" value="${escAttr(slide.title || '')}" placeholder="幻灯片标题">
      </div>
      ${bodyHtml}
    </div>`;

  attachEditorHandlers(view, courseId, slide, audioFiles);
}

/* ── Content Editor ─────────────────────────── */
function renderContentEditor(slide, courseId, audioFiles) {
  const narrationFiles = (audioFiles || []).filter(f => f.sub === 'narration');
  let audioOptions = '<option value="">无音频</option>';
  narrationFiles.forEach(f => {
    audioOptions += `<option value="${escAttr(f.path)}" ${slide.audio === f.path ? 'selected' : ''}>${escHtml(f.file)}</option>`;
  });

  return `
    <div class="section-title">音频</div>
    <div class="audio-picker-row">
      <select class="form-select" id="slideAudio">
        <option value="">无音频</option>
        ${audioOptions}
      </select>
      <button class="btn btn-secondary btn-sm" id="btnUploadAudio">上传到 narration/</button>
      <input type="file" id="audioFileInput" accept="audio/*" style="display:none">
    </div>

    <div class="section-title">字幕（伴学助手）</div>
    <div id="subtitleList">
      ${((slide.subtitles || []).map((s, i) => `
        <div class="subtitle-row" data-i="${i}">
          <input class="form-input" type="number" step="0.1" value="${s.at}" placeholder="时间(s)" style="width:70px">
          <input class="form-input" value="${escAttr(s.text)}" placeholder="字幕文本">
          <button class="btn btn-sm btn-danger btn-remove-sub">🗑</button>
        </div>`).join('')) || ''}
    </div>
    <button class="btn btn-secondary btn-sm" id="btnAddSub">+ 添加字幕</button>

    <div class="section-title">聚光灯</div>
    <div id="spotlightList">
      ${((slide.spotlights || []).map((sp, i) => `
        <div class="spotlight-row" data-i="${i}">
          <input class="form-input" value="${escAttr(sp.elementId)}" placeholder="元素 ID">
          <input class="form-input" type="number" step="0.1" value="${sp.at}" placeholder="触发时间(s)" style="width:70px">
          <input class="form-input" type="number" step="0.1" value="${sp.duration || 1.5}" placeholder="持续(s)" style="width:60px">
          <button class="btn btn-sm btn-danger btn-remove-sp">🗑</button>
        </div>`).join('')) || ''}
    </div>
    <button class="btn btn-secondary btn-sm" id="btnAddSp">+ 添加聚光灯</button>

    <div class="section-title">幻灯片 HTML</div>
    <textarea class="form-textarea" id="slideHtmlRaw" style="font-family:monospace;min-height:120px" placeholder="点击"加载 HTML"按钮加载..."></textarea>
    <button class="btn btn-secondary btn-sm" id="btnLoadHtml">加载 HTML</button>
    <button class="btn btn-secondary btn-sm" id="btnSaveHtml">保存 HTML</button>`;
}

/* ── Display Editor ─────────────────────────── */
function renderDisplayEditor(slide, courseId, audioFiles) {
  const vocab = slide.vocab || [];
  const vocabFiles = (audioFiles || []).filter(f => f.sub === 'vocab');
  let vocabOptions = '<option value="">无音频</option>';
  vocabFiles.forEach(f => {
    vocabOptions += `<option value="${escAttr(f.path)}">${escHtml(f.file)}</option>`;
  });

  const toggle = (name, checked) => `
    <div class="toggle-row">
      <label class="toggle">
        <input type="checkbox" id="display-${name}" ${checked ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
      <span class="toggle-label">显示${name === 'showPinyin' ? '拼音' : name === 'showEnglish' ? '英文' : '录音按钮'}</span>
    </div>`;

  return `
    <div class="toggle-row">${toggle('showPinyin', slide.showPinyin !== false)}</div>
    <div class="toggle-row">${toggle('showEnglish', slide.showEnglish !== false)}</div>
    <div class="toggle-row">${toggle('hasRecording', slide.hasRecording)}</div>

    <div class="section-title">词汇列表</div>
    <table class="vocab-table">
      <thead><tr>
        <th>ID</th><th>汉字</th><th>拼音</th><th>词性</th><th>英文</th><th>音频</th><th></th>
      </tr></thead>
      <tbody id="vocabTbody">
        ${vocab.map((v, i) => `
          <tr data-i="${i}">
            <td><input class="form-input" value="${escAttr(v.id)}" style="width:50px"></td>
            <td><input class="form-input" value="${escAttr(v.hanzi)}"></td>
            <td><input class="form-input" value="${escAttr(v.pinyin)}"></td>
            <td><input class="form-input" value="${escAttr(v.pos)}" style="width:60px"></td>
            <td><input class="form-input" value="${escAttr(v.en)}"></td>
            <td>
              <div style="display:flex;gap:4px;align-items:center">
                <select class="form-select v-audio" style="width:110px">
                  ${vocabOptions}
                </select>
                <button class="btn btn-xs btn-ghost btn-vocab-audio-upload" title="上传音频">📎</button>
              </div>
            </td>
            <td><button class="btn btn-sm btn-danger btn-remove-v">🗑</button></td>
          </tr>`).join('')}
      </tbody>
    </table>
    <button class="btn btn-secondary btn-sm" id="btnAddVocab">+ 添加词汇</button>
    <input type="file" id="vocabAudioInput" accept="audio/*" style="display:none">`;
}

/* ── Exercise Editor ─────────────────────────── */
const QUESTION_TYPES = ['read', 'listen', 'arrange', 'match', 'fill', 'trace'];

function renderExerciseEditor(slide, courseId, audioFiles) {
  const questions = slide.questions || [];

  let questionsHtml = '';
  questions.forEach((q, i) => {
    questionsHtml += renderQuestionCard(q, i, audioFiles);
  });

  if (!questions.length) {
    questionsHtml = '<div class="empty-state" style="padding:20px">暂无题目，点击下方添加</div>';
  }

  return `
    <div class="section-title">题目列表</div>
    <div id="questionList">
      ${questionsHtml}
    </div>
    <div style="margin-top:12px">
      <select id="newQType" class="form-select" style="width:auto;display:inline-block">
        ${QUESTION_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
      </select>
      <button class="btn btn-secondary btn-sm" id="btnAddQ">+ 添加题目</button>
    </div>`;
}

function renderQuestionCard(q, index, audioFiles) {
  const typeLabel = q.type || 'read';
  let innerForm = '';

  if (typeLabel === 'read' || typeLabel === 'listen') {
    const opts = ['A','B','C','D'].map((oid, oi) => {
      const opt = (q.options || [])[oi] || { id: oid, text: '' };
      return `
      <div class="q-option-row">
        <span style="width:24px;font-weight:700;color:#888">${oid}.</span>
        <input class="form-input" value="${escAttr(opt.text)}" data-oi="${oi}" placeholder="选项${oid}">
      </div>`;
    }).join('');

    let audioPickerHtml = '';
    if (typeLabel === 'listen') {
      const exerciseFiles = (audioFiles || []).filter(f => f.sub === 'exercise');
      let audioOptions = '<option value="">无音频</option>';
      exerciseFiles.forEach(f => {
        audioOptions += `<option value="${escAttr(f.path)}" ${q.audio === f.path ? 'selected' : ''}>${escHtml(f.file)}</option>`;
      });
      audioPickerHtml = `
      <div class="form-group">
        <label class="form-label">音频</label>
        <div class="audio-picker-row">
          <select class="form-select q-audio" style="width:160px">
            <option value="">无音频</option>
            ${audioOptions}
          </select>
          <button class="btn btn-secondary btn-sm btn-upload-q-audio">上传</button>
          <input type="file" class="q-audio-file-input" accept="audio/*" style="display:none">
        </div>
      </div>`;
    }

    innerForm = `
      <div class="form-group">
        <label class="form-label">题目</label>
        <input class="form-input q-question" value="${escAttr(q.question || '')}">
      </div>
      ${audioPickerHtml}
      <div class="form-group">
        <label class="form-label">选项</label>
        <div class="q-options-list">${opts}</div>
      </div>
      <div class="form-group">
        <label class="form-label">正确答案（A / B / C / D）</label>
        <select class="form-select q-answer" style="width:100px">
          ${['A','B','C','D'].map(o => `<option value="${o}" ${q.answer === o ? 'selected' : ''}>${o}</option>`).join('')}
        </select>
      </div>`;
  } else if (typeLabel === 'arrange') {
    const words = (q.words || []).map((w, wi) => {
      const py = (q.pinyinMap && q.pinyinMap[w]) || '';
      return `
      <div class="q-option-row">
        <input class="form-input" value="${escAttr(w)}" data-wi="${wi}" placeholder="词语">
        <input class="form-input" value="${escAttr(py)}" data-wi="${wi}" placeholder="拼音" style="width:90px">
        <button class="btn btn-sm btn-danger btn-remove-w" data-wi="${wi}">🗑</button>
      </div>`;
    }).join('');
    innerForm = `
      <div class="form-group"><label class="form-label">词语（按正确顺序排列）</label>
        <div>${words}</div>
        <button class="btn btn-sm btn-secondary btn-add-w">+ 添加词语</button>
      </div>`;
  } else if (typeLabel === 'match') {
    const pairs = (q.pairs || []).map((p, pi) => {
      const py = (q.pinyinMap && q.pinyinMap[p.left]) || '';
      return `
      <div class="q-option-row">
        <input class="form-input q-left" value="${escAttr(p.left)}" placeholder="左">
        <input class="form-input q-pinyin" value="${escAttr(py)}" placeholder="拼音" style="width:80px">
        <input class="form-input q-right" value="${escAttr(p.right)}" placeholder="右">
        <button class="btn btn-sm btn-danger btn-remove-pair" data-pi="${pi}">🗑</button>
      </div>`;
    }).join('');
    innerForm = `
      <div class="form-group"><label class="form-label">配对（左 / 拼音 / 右）</label>
        <div>${pairs}</div>
        <button class="btn btn-sm btn-secondary btn-add-pair">+ 添加配对</button>
      </div>`;
  } else if (typeLabel === 'fill') {
    innerForm = `
      <div class="form-group"><label class="form-label">题目（含 _____）</label>
        <input class="form-input q-question" value="${escAttr(q.question || '')}">
      </div>
      <div class="form-group"><label class="form-label">正确答案</label>
        <input class="form-input q-answer" value="${escAttr(q.answer || '')}">
      </div>`;
  } else if (typeLabel === 'trace') {
    innerForm = `
      <div class="form-group"><label class="form-label">汉字</label><input class="form-input q-char" value="${escAttr(q.char || '')}" style="width:80px"></div>
      <div class="form-group"><label class="form-label">拼音</label><input class="form-input q-pinyin" value="${escAttr(q.pinyin || '')}"></div>
      <div class="form-group"><label class="form-label">英文</label><input class="form-input q-en" value="${escAttr(q.en || '')}"></div>
      <div class="form-group"><label class="form-label">星级阈值（1星/2星/3星）</label>
        <div style="display:flex;gap:8px">
          <input class="form-input" type="number" step="0.01" value="${q.stars?.['1'] || 0.3}" style="width:80px" placeholder="1星">
          <input class="form-input" type="number" step="0.01" value="${q.stars?.['2'] || 0.6}" style="width:80px" placeholder="2星">
          <input class="form-input" type="number" step="0.01" value="${q.stars?.['3'] || 0.85}" style="width:80px" placeholder="3星">
        </div>
      </div>`;
  }

  return `
    <div class="question-card" data-qi="${index}">
      <div class="question-card-header">
        <span class="q-number">#${index + 1}</span>
        <span class="q-type-badge">${typeLabel}</span>
        <span class="q-summary">${escHtml(q.question || q.char || '(空)')}</span>
        <span class="q-delete" title="删除">🗑</span>
      </div>
      <div class="question-card-body">${innerForm}</div>
    </div>`;
}

/* ── Video Editor ─────────────────────────── */
function renderVideoEditor(slide, courseId, audioFiles) {
  const videoFiles = (audioFiles || []).filter(f => f.sub === 'video');
  let videoOptions = '<option value="">无视频</option>';
  videoFiles.forEach(f => {
    videoOptions += `<option value="${escAttr(f.path)}" ${slide.video === f.path ? 'selected' : ''}>${escHtml(f.file)}</option>`;
  });

  return `
    <div class="form-group">
      <label class="form-label">视频文件</label>
      <select class="form-select" id="slideVideo">
        <option value="">无视频</option>
        ${videoOptions}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">上传视频到 video/</label>
      <button class="btn btn-secondary btn-sm" id="btnUploadVideo">选择视频文件</button>
      <input type="file" id="videoFileInput" accept="video/*" style="display:none">
    </div>`;
}

/* ── Editor handlers ─────────────────────────── */
function attachEditorHandlers(view, courseId, slide, audioFiles) {
  const idx = slide.index;

  // Preview
  document.getElementById('btnPreview')?.addEventListener('click', () => {
    window.open('/player.html?course=' + courseId + '&slide=' + idx, '_blank');
  });

  // Regenerate HTML from template
  document.getElementById('btnRegenHtml')?.addEventListener('click', async () => {
    try {
      await api.regenerateSlide(courseId, idx);
      showToast('HTML 已重新生成', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  });

  // Save (PATCH slide config)
  document.getElementById('btnSaveSlide')?.addEventListener('click', async () => {
    const newTitle = document.getElementById('slideTitleInput')?.value || '';

    // Collect slide data based on type
    const data = { title: newTitle };

    if (slide.type === 'content') {
      data.audio = document.getElementById('slideAudio')?.value || '';
      data.subtitles = collectSubtitles(view);
      data.spotlights = collectSpotlights(view);
    } else if (slide.type === 'display') {
      data.showPinyin = document.getElementById('display-showPinyin')?.checked ?? true;
      data.showEnglish = document.getElementById('display-showEnglish')?.checked ?? true;
      data.hasRecording = document.getElementById('display-hasRecording')?.checked ?? true;
      data.vocab = collectVocab(view);
    } else if (slide.type === 'exercise') {
      data.questions = collectQuestions(view);
      data.showPinyin = true;
    } else if (slide.type === 'video') {
      data.video = document.getElementById('slideVideo')?.value || '';
    }

    try {
      await api.patch('/api/courses/' + courseId + '/slides/' + idx, data);
      showToast('已保存', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  });

  // Content: add subtitle
  document.getElementById('btnAddSub')?.addEventListener('click', () => {
    const list = document.getElementById('subtitleList');
    list.insertAdjacentHTML('beforeend', `
      <div class="subtitle-row">
        <input class="form-input" type="number" step="0.1" value="0" style="width:70px" placeholder="时间(s)">
        <input class="form-input" value="" placeholder="字幕文本">
        <button class="btn btn-sm btn-danger btn-remove-sub">🗑</button>
      </div>`);
  });

  // Content: remove subtitle
  view.querySelectorAll('.btn-remove-sub').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.subtitle-row')?.remove());
  });

  // Content: add spotlight
  document.getElementById('btnAddSp')?.addEventListener('click', () => {
    const list = document.getElementById('spotlightList');
    list.insertAdjacentHTML('beforeend', `
      <div class="spotlight-row">
        <input class="form-input" value="" placeholder="元素 ID">
        <input class="form-input" type="number" step="0.1" value="1" style="width:70px">
        <input class="form-input" type="number" step="0.1" value="1.5" style="width:60px">
        <button class="btn btn-sm btn-danger btn-remove-sp">🗑</button>
      </div>`);
  });

  view.querySelectorAll('.btn-remove-sp').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.spotlight-row')?.remove());
  });

  // Display: add vocab
  document.getElementById('btnAddVocab')?.addEventListener('click', () => {
    const tbody = document.getElementById('vocabTbody');
    const nextId = 'w' + (tbody.querySelectorAll('tr').length + 1);
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td><input class="form-input" value="${nextId}" style="width:50px"></td>
        <td><input class="form-input" value=""></td>
        <td><input class="form-input" value=""></td>
        <td><input class="form-input" value="" style="width:60px"></td>
        <td><input class="form-input" value=""></td>
        <td><input class="form-input" value="" style="width:100px"></td>
        <td><button class="btn btn-sm btn-danger btn-remove-v">🗑</button></td>
      </tr>`);
  });

  view.querySelectorAll('.btn-remove-v').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('tr')?.remove());
  });

  // Exercise: add question
  document.getElementById('btnAddQ')?.addEventListener('click', () => {
    const type = document.getElementById('newQType')?.value || 'read';
    const list = document.getElementById('questionList');
    const qi = list.querySelectorAll('.question-card').length;
    const blankQ = buildBlankQuestion(type);
    const html = renderQuestionCard({ id: 'q' + (qi + 1), type, ...blankQ }, qi, audioFiles || []);
    list.insertAdjacentHTML('beforeend', html);
    attachQuestionHandlers(list.lastElementChild, courseId);
  });

  // Attach handlers to existing question cards
  view.querySelectorAll('.question-card').forEach((card) => {
    attachQuestionHandlers(card, courseId);
  });

  // Content: load/save HTML
  document.getElementById('btnLoadHtml')?.addEventListener('click', async () => {
    try {
      const data = await api.get('/api/courses/' + courseId + '/slides/' + idx + '/html');
      document.getElementById('slideHtmlRaw').value = data.html || '';
    } catch (e) { showToast(e.message, 'error'); }
  });

  document.getElementById('btnSaveHtml')?.addEventListener('click', async () => {
    const html = document.getElementById('slideHtmlRaw')?.value || '';
    try {
      await api.put('/api/courses/' + courseId + '/slides/' + idx + '/html', { html });
      showToast('HTML 已保存', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  });

  // Content: audio upload
  document.getElementById('btnUploadAudio')?.addEventListener('click', () => {
    document.getElementById('audioFileInput')?.click();
  });
  document.getElementById('audioFileInput')?.addEventListener('change', async function() {
    const file = this.files && this.files[0];
    if (!file) return;
    try {
      const result = await uploadFileChunked(file, 'narration', courseId);
      const select = document.getElementById('slideAudio');
      const opt = document.createElement('option');
      opt.value = result.path || 'narration/' + file.name;
      opt.textContent = file.name;
      opt.selected = true;
      select.appendChild(opt);
      showToast('上传成功', 'success');
    } catch (e) { showToast('上传失败: ' + e.message, 'error'); }
    this.value = '';
  });

  // Video: upload
  document.getElementById('btnUploadVideo')?.addEventListener('click', () => {
    document.getElementById('videoFileInput')?.click();
  });
  document.getElementById('videoFileInput')?.addEventListener('change', async function() {
    const file = this.files && this.files[0];
    if (!file) return;
    try {
      const result = await uploadFileChunked(file, 'video', courseId);
      const select = document.getElementById('slideVideo');
      const opt = document.createElement('option');
      opt.value = result.path || 'video/' + file.name;
      opt.textContent = file.name;
      opt.selected = true;
      select.appendChild(opt);
      showToast('上传成功', 'success');
    } catch (e) { showToast('上传失败: ' + e.message, 'error'); }
    this.value = '';
  });

  // Display: vocab audio upload
  view.querySelectorAll('.btn-vocab-audio-upload').forEach((btn, ri) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    const fileInput = document.getElementById('vocabAudioInput');
    btn.addEventListener('click', () => {
      if (!fileInput) return;
      fileInput.dataset.targetRow = ri;
      fileInput.click();
    });
  });
  document.getElementById('vocabAudioInput')?.addEventListener('change', async function() {
    const file = this.files && this.files[0];
    if (!file) return;
    const ri = parseInt(this.dataset.targetRow || '0', 10);
    try {
      const result = await uploadFileChunked(file, 'vocab', courseId);
      const path = result.path || 'vocab/' + file.name;
      // Update all vocab audio selects
      view.querySelectorAll('.v-audio').forEach(select => {
        const opt = document.createElement('option');
        opt.value = path;
        opt.textContent = file.name;
        select.appendChild(opt);
      });
      // Set the select in the row that triggered the upload
      const rows = view.querySelectorAll('#vocabTbody tr');
      const targetSelect = rows[ri]?.querySelector('.v-audio');
      if (targetSelect) {
        const opt = document.createElement('option');
        opt.value = path;
        opt.textContent = file.name;
        opt.selected = true;
        targetSelect.appendChild(opt);
      }
      showToast('上传成功', 'success');
    } catch (e) { showToast('上传失败: ' + e.message, 'error'); }
    this.value = '';
  });
}

function attachQuestionHandlers(card, courseId) {
  card.querySelector('.q-delete')?.addEventListener('click', () => {
    card.remove();
  });

  // arrange: remove word
  card.querySelectorAll('.btn-remove-w').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.q-option-row')?.remove());
  });

  // arrange: add word
  card.querySelector('.btn-add-w')?.addEventListener('click', () => {
    const container = card.querySelector('.btn-add-w').parentElement.querySelector('div');
    const wi = container.querySelectorAll('.q-option-row').length;
    const html = `<div class="q-option-row">
      <input class="form-input" value="" data-wi="${wi}" placeholder="词语">
      <input class="form-input" value="" data-wi="${wi}" placeholder="拼音" style="width:90px">
      <button class="btn btn-sm btn-danger btn-remove-w" data-wi="${wi}">🗑</button>
    </div>`;
    container.insertAdjacentHTML('beforeend', html);
    card.querySelectorAll('.btn-remove-w').forEach(b => {
      b.addEventListener('click', () => b.closest('.q-option-row')?.remove());
    });
  });

  // match: remove pair
  card.querySelectorAll('.btn-remove-pair').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.q-option-row')?.remove());
  });

  // match: add pair
  card.querySelector('.btn-add-pair')?.addEventListener('click', () => {
    const container = card.querySelector('.btn-add-pair').parentElement.querySelector('div');
    const pi = container.querySelectorAll('.q-option-row').length;
    const html = `<div class="q-option-row">
      <input class="form-input q-left" value="" placeholder="左">
      <input class="form-input q-pinyin" value="" placeholder="拼音" style="width:80px">
      <input class="form-input q-right" value="" placeholder="右">
      <button class="btn btn-sm btn-danger btn-remove-pair" data-pi="${pi}">🗑</button>
    </div>`;
    container.insertAdjacentHTML('beforeend', html);
    card.querySelectorAll('.btn-remove-pair').forEach(b => {
      b.addEventListener('click', () => b.closest('.q-option-row')?.remove());
    });
  });

  // listen: audio upload per question card
  card.querySelectorAll('.btn-upload-q-audio').forEach(btn => {
    btn.addEventListener('click', () => {
      const fileInput = card.querySelector('.q-audio-file-input');
      fileInput?.click();
    });
  });
  card.querySelectorAll('.q-audio-file-input').forEach(fileInput => {
    fileInput.addEventListener('change', async function() {
      const file = this.files && this.files[0];
      if (!file) return;
      try {
        const result = await uploadFileChunked(file, 'exercise', courseId);
        const select = card.querySelector('.q-audio');
        if (select) {
          const opt = document.createElement('option');
          opt.value = result.path || 'exercise/' + file.name;
          opt.textContent = file.name;
          opt.selected = true;
          select.appendChild(opt);
        }
        showToast('上传成功', 'success');
      } catch (e) { showToast('上传失败: ' + e.message, 'error'); }
      this.value = '';
    });
  });
}

/* ── Collect data helpers ─────────────────── */
function collectSubtitles(view) {
  return Array.from(view.querySelectorAll('.subtitle-row')).map(row => {
    const inputs = row.querySelectorAll('input');
    return { at: parseFloat(inputs[0]?.value || 0), text: inputs[1]?.value || '' };
  }).filter(s => s.text);
}

function collectSpotlights(view) {
  return Array.from(view.querySelectorAll('.spotlight-row')).map(row => {
    const inputs = row.querySelectorAll('input');
    return {
      elementId: inputs[0]?.value || '',
      at: parseFloat(inputs[1]?.value || 0),
      duration: parseFloat(inputs[2]?.value || 1.5),
    };
  }).filter(s => s.elementId);
}

function collectVocab(view) {
  return Array.from(view.querySelectorAll('#vocabTbody tr')).map(row => {
    const inputs = row.querySelectorAll('input');
    return {
      id: inputs[0]?.value || '',
      hanzi: inputs[1]?.value || '',
      pinyin: inputs[2]?.value || '',
      pos: inputs[3]?.value || '',
      en: inputs[4]?.value || '',
      audio: inputs[5]?.value || '',
    };
  }).filter(v => v.hanzi);
}

function collectQuestions(view) {
  return Array.from(view.querySelectorAll('.question-card')).map((card, qi) => {
    const type = card.querySelector('.q-type-badge')?.textContent?.trim() || 'read';
    const q = { id: 'q' + (qi + 1), type };

    if (type === 'read' || type === 'listen') {
      q.question = card.querySelector('.q-question')?.value || '';
      q.audio = card.querySelector('.q-audio')?.value || '';
      const optionIds = ['A', 'B', 'C', 'D'];
      q.options = optionIds.map((id, oi) => {
        const row = card.querySelectorAll('.q-option-row')[oi];
        const text = row ? row.querySelector('input')?.value || '' : '';
        return { id, text };
      });
      q.answer = card.querySelector('.q-answer')?.value || '';
    } else if (type === 'arrange') {
      const rows = card.querySelectorAll('.q-option-row');
      const pinyinMap = {};
      const words = Array.from(rows).map(row => {
        const inputs = row.querySelectorAll('input');
        const word = inputs[0]?.value || '';
        const py = inputs[1]?.value || '';
        if (word && py) pinyinMap[word] = py;
        return word;
      }).filter(Boolean);
      q.words = words;
      q.answer = [...words];
      q.pinyinMap = pinyinMap;
    } else if (type === 'match') {
      const rows = card.querySelectorAll('.q-option-row');
      const pinyinMap = {};
      q.pairs = Array.from(rows).map(row => {
        const inp = row.querySelectorAll('input');
        const left = inp[0]?.value || '';
        const py = inp[1]?.value || '';
        const right = inp[2]?.value || '';
        if (left && py) pinyinMap[left] = py;
        return { left, right };
      }).filter(p => p.left);
      q.pinyinMap = pinyinMap;
    } else if (type === 'fill') {
      q.question = card.querySelector('.q-question')?.value || '';
      q.answer = card.querySelector('.q-answer')?.value || '';
    } else if (type === 'trace') {
      q.char = card.querySelector('.q-char')?.value || '';
      q.pinyin = card.querySelector('.q-pinyin')?.value || '';
      q.en = card.querySelector('.q-en')?.value || '';
      const starInputs = card.querySelectorAll('input[type="number"]');
      q.stars = { '1': parseFloat(starInputs[0]?.value || 0.3), '2': parseFloat(starInputs[1]?.value || 0.6), '3': parseFloat(starInputs[2]?.value || 0.85) };
    }
    return q;
  });
}

function buildBlankQuestion(type) {
  if (type === 'read' || type === 'listen') {
    return { question: '', options: [{ id: 'A', text: '选项 A' }, { id: 'B', text: '选项 B' }, { id: 'C', text: '选项 C' }, { id: 'D', text: '选项 D' }], answer: 'A' };
  } else if (type === 'arrange') {
    return { words: ['词语1', '词语2'], answer: ['词语1', '词语2'], pinyinMap: {} };
  } else if (type === 'match') {
    return { pairs: [{ left: '左', right: '右' }], pinyinMap: {} };
  } else if (type === 'fill') {
    return { question: '请填空 _____', answer: '' };
  } else if (type === 'trace') {
    return { char: '谢', pinyin: 'xiè', en: 'thanks', stars: { '1': 0.3, '2': 0.6, '3': 0.85 } };
  }
  return {};
}

function escAttr(s) {
  return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Synchronous base64 encode for ArrayBuffer chunks
function base64Encode(arr) {
  let result = '', i = 0;
  const b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  while (i < arr.length) {
    const b0 = arr[i++] || 0;
    const b1 = arr[i++] || 0;
    const b2 = arr[i++] || 0;
    result += b64chars[b0 >> 2];
    result += b64chars[((b0 & 3) << 4) | (b1 >> 4)];
    result += b64chars[((b1 & 15) << 2) | (b2 >> 6)];
    result += b64chars[b2 & 63];
  }
  const pad = (3 - (arr.length % 3)) % 3;
  return result.slice(0, result.length - pad) + '=='.slice(0, pad);
}

// Read file as ArrayBuffer (small files only)
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsArrayBuffer(file);
  });
}

// Chunked upload — reads file in 2MB slices, sends chunks progressively
// Returns the server's final response ({ path }) after all chunks complete
async function uploadFileChunked(file, sub, courseId, onProgress) {
  const CHUNK = 2 * 1024 * 1024; // 2MB per chunk
  const totalSize = file.size;
  let offset = 0;
  let chunkIdx = 0;
  let uploaded = 0;
  let result;

  while (offset < totalSize) {
    const chunk = file.slice(offset, Math.min(offset + CHUNK, totalSize));
    const buf = await readFileAsArrayBuffer(chunk);
    const encoded = base64Encode(new Uint8Array(buf));
    const isLast = offset + CHUNK >= totalSize;

    result = await api.post('/api/courses/' + courseId + '/audio-files', {
      sub,
      filename: file.name,
      chunks: [encoded],
      chunkIdx,
      end: isLast,
      totalChunks: Math.ceil(totalSize / CHUNK),
    });

    offset += CHUNK;
    chunkIdx++;
    uploaded += chunk.size;
    if (onProgress) onProgress(Math.round(uploaded / totalSize * 100));
  }
  return result;
}

/* ─────────────────────────────────────────
   Boot
   ───────────────────────────────────────── */
window.addEventListener('hashchange', dispatch);
document.querySelector('.sidebar-logo')?.addEventListener('click', () => navigate('#courses'));
dispatch();