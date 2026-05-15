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

  async reorderSlides(courseId, fromIndex, toIndex) {
    return this.post('/api/courses/' + courseId + '/slides/reorder', { fromIndex, toIndex });
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

    // Build slide list
    let slideListHtml = '';
    (course.slides || []).forEach(s => {
      const typeClass = 'type-' + (s.type || 'content');
      const typeIcon = { content: '📄', exercise: '✏️', vocab: '📖', display: '📋', video: '🎬', dialogue: '💬' }[s.type] || '📄';
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
            <button class="btn btn-sm btn-ghost btn-move-up" title="上移"${s.index <= 1 ? ' disabled' : ''}>⬆</button>
            <button class="btn btn-sm btn-ghost btn-move-down" title="下移"${s.index >= (course.slides || []).length ? ' disabled' : ''}>⬇</button>
            <button class="btn btn-sm btn-ghost btn-preview-slide" title="预览">▶</button>
            <button class="btn btn-sm btn-ghost btn-regen-slide" title="重新生成HTML">↻</button>
            <button class="btn btn-sm btn-danger btn-delete-slide" title="删除">🗑</button>
          </div>
        </div>`;
    });

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

    // Move up
    view.querySelectorAll('.btn-move-up').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const idx = parseInt(btn.closest('.slide-item').dataset.index, 10);
        try {
          await api.reorderSlides(courseId, idx, idx - 1);
          showToast('已上移', 'success');
          courseView(courseId);
        } catch (e) { showToast(e.message, 'error'); }
      });
    });

    // Move down
    view.querySelectorAll('.btn-move-down').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const idx = parseInt(btn.closest('.slide-item').dataset.index, 10);
        try {
          await api.reorderSlides(courseId, idx, idx + 1);
          showToast('已下移', 'success');
          courseView(courseId);
        } catch (e) { showToast(e.message, 'error'); }
      });
    });

    
  } catch (e) {
    view.innerHTML = '<div class="empty-state">加载失败: ' + escHtml(e.message) + '</div>';
  }
}

function buildSlideMeta(slide) {
  if (slide.type === 'exercise') return (slide.questions || []).length + ' 题';
  if (slide.type === 'vocab') return (slide.vocab || []).length + ' 词汇';
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
      <div class="type-option" data-type="vocab">
        <div class="type-option-icon">📖</div>
        <div class="type-option-name">生词页</div>
        <div class="type-option-desc">词汇展示学习</div>
      </div>
      <div class="type-option" data-type="display">
        <div class="type-option-icon">📋</div>
        <div class="type-option-name">生词例句页</div>
        <div class="type-option-desc">生词+例句双栏</div>
      </div>
      <div class="type-option" data-type="video">
        <div class="type-option-icon">🎬</div>
        <div class="type-option-name">视频页</div>
        <div class="type-option-desc">视频播放</div>
      </div>
      <div class="type-option" data-type="dialogue">
        <div class="type-option-icon">💬</div>
        <div class="type-option-name">Dialogue</div>
        <div class="type-option-desc">对话练习</div>
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
  const typeName = { content: '内容页', exercise: '练习页', vocab: '生词页', display: '生词例句页', video: '视频页', dialogue: 'Dialogue' }[type] || type;

  let bodyHtml = '';

  if (type === 'content') {
    bodyHtml = renderContentEditor(slide, courseId, audioFiles);
  } else if (type === 'exercise') {
    bodyHtml = renderExerciseEditor(slide, courseId, audioFiles);
  } else if (type === 'vocab') {
    bodyHtml = renderVocabEditor(slide, courseId, audioFiles);
  } else if (type === 'display') {
    bodyHtml = renderDisplay2Editor(slide, courseId, audioFiles);
  } else if (type === 'video') {
    bodyHtml = renderVideoEditor(slide, courseId, audioFiles);
  } else if (type === 'dialogue') {
    bodyHtml = renderDialogueEditor(slide, courseId, audioFiles);
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

  const imgFiles = (audioFiles || []).filter(f => f.sub === 'pptimg');
  let imgOptions = '<option value="">无背景图</option>';
  imgFiles.forEach(f => {
    imgOptions += `<option value="${escAttr(f.path)}" ${slide.backgroundImage === f.path ? 'selected' : ''}>${escHtml(f.file)}</option>`;
  });

  return `
    <div class="section-title">音频</div>
    <div class="audio-picker-row">
      <select class="form-select" id="slideAudio">
        <option value="">无音频</option>
        ${audioOptions}
      </select>
      <button class="btn btn-secondary btn-sm" id="btnRefreshNarration" title="刷新音频列表">🔄</button>
    </div>
    <div class="audio-preview-row" id="audioPreviewRow" style="display:none;margin-top:8px">
      <audio id="audioPreview" controls style="height:36px;width:100%"></audio>
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

    <div class="section-title">热区（背景图热点）</div>
    <div class="hotspot-editor-row">
      <div class="hotspot-canvas-wrap" id="hotspotCanvasWrap">
        <img id="hotspotBgImg" src="/courses/${courseId}/${slide.backgroundImage || ''}" alt="背景图" style="display:none">
        <div id="hotspotRects"></div>
        <div id="hotspotDrawOverlay"></div>
      </div>
      <div class="hotspot-zone-list" id="hotspotZoneList">
        ${((slide.spotlightZones || []).map((z, i) => `
          <div class="hotspot-zone-row" data-i="${i}">
            <input class="form-input" value="${escAttr(z.elementId)}" placeholder="ID" style="width:70px">
            <span class="zone-coords">x:<input class="form-input" type="number" value="${z.x}" step="0.1" style="width:50px">%
             y:<input class="form-input" type="number" value="${z.y}" step="0.1" style="width:50px">%
             w:<input class="form-input" type="number" value="${z.w}" step="0.1" style="width:50px">%
             h:<input class="form-input" type="number" value="${z.h}" step="0.1" style="width:50px">%</span>
            <button class="btn btn-sm btn-danger btn-remove-hz">🗑</button>
          </div>`).join('')) || '<div class="empty-hint">上传背景图后，在图上拖拽添加热区</div>'}
      </div>
    </div>
    <div class="hotspot-toolbar">
      <select class="form-select" id="bgImgSelect" style="width:200px">${imgOptions}</select>
      <button class="btn btn-secondary btn-sm" id="btnRefreshBgImg" title="刷新背景图">🔄</button>
      <button class="btn btn-secondary btn-sm" id="btnAddHotspot">+ 添加热区</button>
      <button class="btn btn-ghost btn-sm" id="btnPreviewSpotlight">▶ 预览 Spotlight</button>
    </div>`;
}

/* ── Vocab Editor ─────────────────────────── */
function renderVocabEditor(slide, courseId, audioFiles) {
  const vocab = slide.vocab || [];
  const vocabFiles = (audioFiles || []).filter(f => f.sub === 'vocab');
  const narrationFiles = (audioFiles || []).filter(f => f.sub === 'narration');
  let narrationOptions = '<option value="">无音频</option>';
  narrationFiles.forEach(f => {
    narrationOptions += `<option value="${escAttr(f.path)}" ${slide.audio === f.path ? 'selected' : ''}>${escHtml(f.file)}</option>`;
  });

  const buildVocabOptions = (v) =>
    '<option value="">无音频</option>' +
    vocabFiles.map(f => `<option value="${escAttr(f.path)}" ${v.audio === f.path ? 'selected' : ''}>${escHtml(f.file)}</option>`).join('');

  const toggle = (name, checked) => `
    <div class="toggle-row">
      <label class="toggle">
        <input type="checkbox" id="display-${name}" ${checked ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
      <span class="toggle-label">显示${name === 'showPinyin' ? '拼音' : name === 'showEnglish' ? '英文' : '录音按钮'}</span>
    </div>`;

  return `
    <div class="section-title">旁白音频</div>
    <div class="audio-picker-row">
      <select class="form-select" id="slideAudio">
        <option value="">无音频</option>
        ${narrationOptions}
      </select>
      <button class="btn btn-secondary btn-sm" id="btnRefreshNarration" title="刷新音频列表">🔄</button>
    </div>
    <div class="audio-preview-row" id="audioPreviewRow" style="display:none;margin-top:8px">
      <audio id="audioPreview" controls style="height:36px;width:100%"></audio>
    </div>

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
            <td><input class="form-input" value="${escAttr(v.id)}" style="width:50px" data-field="id"></td>
            <td><input class="form-input" value="${escAttr(v.hanzi)}" data-field="hanzi"></td>
            <td><input class="form-input" value="${escAttr(v.pinyin)}" data-field="pinyin"></td>
            <td><input class="form-input" value="${escAttr(v.pos)}" style="width:60px" data-field="pos"></td>
            <td><input class="form-input" value="${escAttr(v.en)}" data-field="en"></td>
            <td>
              <div style="display:flex;gap:4px;align-items:center">
                <select class="form-select v-audio" data-field="audio" style="width:110px">
                  ${buildVocabOptions(v)}
                </select>
                <button class="btn btn-xs btn-ghost btn-refresh-vocab-audio" title="刷新音频">🔄</button>
              </div>
            </td>
            <td><button class="btn btn-sm btn-danger btn-remove-v">🗑</button></td>
          </tr>`).join('')}
      </tbody>
    </table>
    <button class="btn btn-secondary btn-sm" id="btnAddVocab">+ 添加词汇</button>`;
}

/* ── Display2 Editor (生词+例句) ─────────────── */
function renderDisplay2Editor(slide, courseId, audioFiles) {
  const vocab = slide.vocab || [];
  const examples = slide.examples || [];
  const vocabFiles = (audioFiles || []).filter(f => f.sub === 'vocab');
  const exampleFiles = (audioFiles || []).filter(f => f.sub === 'display');
  const narrationFiles = (audioFiles || []).filter(f => f.sub === 'narration');
  let narrationOptions = '<option value="">无音频</option>';
  narrationFiles.forEach(f => {
    narrationOptions += `<option value="${escAttr(f.path)}" ${slide.audio === f.path ? 'selected' : ''}>${escHtml(f.file)}</option>`;
  });
  let vocabOptions = '<option value="">无音频</option>';
  vocabFiles.forEach(f => { vocabOptions += `<option value="${escAttr(f.path)}">${escHtml(f.file)}</option>`; });
  let exampleOptions = '<option value="">无音频</option>';
  exampleFiles.forEach(f => { exampleOptions += `<option value="${escAttr(f.path)}">${escHtml(f.file)}</option>`; });

  const buildVocabOptions = (v) =>
    '<option value="">无音频</option>' +
    vocabFiles.map(f => `<option value="${escAttr(f.path)}" ${v.audio === f.path ? 'selected' : ''}>${escHtml(f.file)}</option>`).join('');
  const buildExampleOptions = (ex) =>
    '<option value="">无音频</option>' +
    exampleFiles.map(f => `<option value="${escAttr(f.path)}" ${ex.audio === f.path ? 'selected' : ''}>${escHtml(f.file)}</option>`).join('');

  return `
    <div class="section-title">旁白音频</div>
    <div class="audio-picker-row">
      <select class="form-select" id="slideAudio">
        <option value="">无音频</option>
        ${narrationOptions}
      </select>
      <button class="btn btn-secondary btn-sm" id="btnRefreshNarration" title="刷新音频列表">🔄</button>
    </div>
    <div class="audio-preview-row" id="audioPreviewRow" style="display:none;margin-top:8px">
      <audio id="audioPreview" controls style="height:36px;width:100%"></audio>
    </div>

    <div class="toggle-row">
      <label class="toggle">
        <input type="checkbox" id="display-showPinyin" ${slide.showPinyin !== false ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
      <span class="toggle-label">显示拼音</span>
    </div>
    <div class="toggle-row">
      <label class="toggle">
        <input type="checkbox" id="display-showEnglish" ${slide.showEnglish !== false ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
      <span class="toggle-label">显示英文</span>
    </div>

    <div class="section-title">词汇列表</div>
    <table class="vocab-table">
      <thead><tr>
        <th>ID</th><th>汉字</th><th>拼音</th><th>词性</th><th>英文</th><th>图片</th><th>音频</th><th></th>
      </tr></thead>
      <tbody id="display2VocabTbody">
        ${vocab.map((v, i) => `
          <tr data-i="${i}">
            <td><input class="form-input" value="${escAttr(v.id)}" style="width:50px" data-field="id"></td>
            <td><input class="form-input" value="${escAttr(v.hanzi)}" data-field="hanzi"></td>
            <td><input class="form-input" value="${escAttr(v.pinyin)}" data-field="pinyin"></td>
            <td><input class="form-input" value="${escAttr(v.pos)}" style="width:60px" data-field="pos"></td>
            <td><input class="form-input" value="${escAttr(v.en)}" data-field="en"></td>
            <td><input class="form-input" value="${escAttr(v.image || '')}" data-field="image" style="width:80px"></td>
            <td>
              <div style="display:flex;gap:4px;align-items:center">
                <select class="form-select v-audio" data-field="audio" style="width:110px">${buildVocabOptions(v)}</select>
                <button class="btn btn-xs btn-ghost btn-refresh-vocab-audio" title="刷新音频">🔄</button>
              </div>
            </td>
            <td><button class="btn btn-sm btn-danger btn-remove-display2-v">🗑</button></td>
          </tr>`).join('')}
      </tbody>
    </table>
    <button class="btn btn-secondary btn-sm" id="btnAddDisplay2Vocab">+ 添加词汇</button>

    <div class="section-title" style="margin-top:24px">例句列表</div>
    <table class="vocab-table">
      <thead><tr>
        <th>ID</th><th>汉字</th><th>拼音</th><th>英文</th><th>音频</th><th></th>
      </tr></thead>
      <tbody id="display2ExampleTbody">
        ${examples.map((ex, i) => `
          <tr data-i="${i}">
            <td><input class="form-input" value="${escAttr(ex.id)}" style="width:50px" data-field="id"></td>
            <td><input class="form-input" value="${escAttr(ex.hanzi)}" data-field="hanzi"></td>
            <td><input class="form-input" value="${escAttr(ex.pinyin)}" data-field="pinyin"></td>
            <td><input class="form-input" value="${escAttr(ex.en)}" data-field="en"></td>
            <td>
              <div style="display:flex;gap:4px;align-items:center">
                <select class="form-select v-audio" data-field="audio" style="width:110px">${buildExampleOptions(ex)}</select>
                <button class="btn btn-xs btn-ghost btn-refresh-example-audio" title="刷新音频">🔄</button>
              </div>
            </td>
            <td><button class="btn btn-sm btn-danger btn-remove-display2-ex">🗑</button></td>
          </tr>`).join('')}
      </tbody>
    </table>
    <button class="btn btn-secondary btn-sm" id="btnAddDisplay2Example">+ 添加例句</button>`;
}

/* ── Exercise Editor ─────────────────────────── */
const QUESTION_TYPES = ['read', 'listen', 'arrange', 'match', 'fill', 'trace'];

function renderExerciseEditor(slide, courseId, audioFiles) {
  const questions = slide.questions || [];
  const narrationFiles = (audioFiles || []).filter(f => f.sub === 'narration');
  let narrationOptions = '<option value="">无音频</option>';
  narrationFiles.forEach(f => {
    narrationOptions += `<option value="${escAttr(f.path)}" ${slide.audio === f.path ? 'selected' : ''}>${escHtml(f.file)}</option>`;
  });

  let questionsHtml = '';
  questions.forEach((q, i) => {
    questionsHtml += renderQuestionCard(q, i, audioFiles);
  });

  if (!questions.length) {
    questionsHtml = '<div class="empty-state" style="padding:20px">暂无题目，点击下方添加</div>';
  }

  return `
    <div class="section-title">旁白音频</div>
    <div class="audio-picker-row">
      <select class="form-select" id="slideAudio">
        <option value="">无音频</option>
        ${narrationOptions}
      </select>
      <button class="btn btn-secondary btn-sm" id="btnRefreshNarration" title="刷新音频列表">🔄</button>
    </div>
    <div class="audio-preview-row" id="audioPreviewRow" style="display:none;margin-top:8px">
      <audio id="audioPreview" controls style="height:36px;width:100%"></audio>
    </div>

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
    const optCount = Math.max(2, q.options ? q.options.length : 3);
    const opts = Array.from({ length: optCount }, (_, oi) => {
      const oid = String.fromCharCode(65 + oi);
      const opt = (q.options || [])[oi] || { id: oid, text: '' };
      const showRemove = optCount > 2;
      return `
      <div class="q-option-row">
        <span style="width:24px;font-weight:700;color:#888">${oid}.</span>
        <input class="form-input q-opt-text" value="${escAttr(opt.text)}" data-oi="${oi}" placeholder="文字">
        <select class="form-select q-opt-image" data-oi="${oi}" data-current="${escAttr(opt.image || '')}" style="flex:0 0 160px"><option value="">无图片</option></select>
        ${showRemove ? `<button class="btn btn-sm btn-danger btn-remove-option" data-oi="${oi}">🗑</button>` : ''}
      </div>`;
    }).join('');

    const answerOpts = Array.from({ length: optCount }, (_, oi) => {
      const oid = String.fromCharCode(65 + oi);
      return `<option value="${oid}" ${q.answer === oid ? 'selected' : ''}>${oid}</option>`;
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
          <button class="btn btn-secondary btn-sm btn-refresh-q-audio">🔄</button>
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
        <button class="btn btn-sm btn-secondary btn-add-option">+ 添加选项</button>
      </div>
      <div class="form-group">
        <label class="form-label">选项排列</label>
        <select class="form-select q-layout" style="width:120px">
          <option value="vertical" ${q.layout !== 'horizontal' ? 'selected' : ''}>纵向</option>
          <option value="horizontal" ${q.layout === 'horizontal' ? 'selected' : ''}>横向</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">正确答案</label>
        <select class="form-select q-answer" style="width:100px">
          ${answerOpts}
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
    const lt = q.leftType || 'text';
    const rt = q.rightType || 'text';
    const dr = q.direction || 'vertical';

    function leftValHtml(p, lt) {
      if (lt === 'audio') {
        return `<select class="form-select q-left-val" data-oi="${p._pi}" data-current="${escAttr(p.left)}" style="flex:1"><option value="">加载中...</option></select>`;
      }
      return `<input class="form-input q-left" value="${escAttr(p.left)}" placeholder="左" style="flex:1">`;
    }
    function rightValHtml(p, rt) {
      if (rt === 'image') {
        return `<select class="form-select q-right-val" data-oi="${p._pi}" data-current="${escAttr(p.right)}" style="flex:1"><option value="">加载中...</option></select>`;
      }
      return `<input class="form-input q-right" value="${escAttr(p.right)}" placeholder="右" style="flex:1">`;
    }

    const pairs = (q.pairs || []).map((p, pi) => {
      p._pi = pi;
      const py = (q.pinyinMap && q.pinyinMap[p.left]) || '';
      return `
      <div class="q-option-row" style="display:flex;gap:4px;align-items:center">
        ${leftValHtml(p, lt)}
        ${lt !== 'audio' ? `<input class="form-input q-pinyin" value="${escAttr(py)}" placeholder="拼音" style="width:80px">` : ''}
        ${rightValHtml(p, rt)}
        <button class="btn btn-sm btn-danger btn-remove-pair" data-pi="${pi}">🗑</button>
      </div>`;
    }).join('');

    innerForm = `
      <div class="form-group"><label class="form-label">配对</label>
        <div>${pairs}</div>
        <button class="btn btn-sm btn-secondary btn-add-pair">+ 添加配对</button>
      </div>
      <div class="form-group" style="display:flex;gap:16px;flex-wrap:wrap">
        <div>
          <label class="form-label">左侧类型</label>
          <select class="form-select q-left-type" style="width:90px">
            <option value="text" ${lt === 'text' ? 'selected' : ''}>文本</option>
            <option value="audio" ${lt === 'audio' ? 'selected' : ''}>音频</option>
          </select>
        </div>
        <div>
          <label class="form-label">右侧类型</label>
          <select class="form-select q-right-type" style="width:90px">
            <option value="text" ${rt === 'text' ? 'selected' : ''}>文本</option>
            <option value="image" ${rt === 'image' ? 'selected' : ''}>图片</option>
          </select>
        </div>
        <div>
          <label class="form-label">排列方向</label>
          <select class="form-select q-direction" style="width:90px">
            <option value="vertical" ${dr === 'vertical' ? 'selected' : ''}>纵向</option>
            <option value="horizontal" ${dr === 'horizontal' ? 'selected' : ''}>横向</option>
          </select>
        </div>
      </div>`;
  } else if (typeLabel === 'fill') {
    const subQuestions = q.questions || [];
    const sharedOpts = q.sharedOptions || [];
    let subHtml = '';
    subQuestions.forEach((sq, si) => {
      subHtml += `
        <div class="q-option-row fill-sub-row" data-si="${si}" style="display:flex;gap:6px;align-items:center">
          <span style="width:24px;font-weight:700;color:#888;flex-shrink:0">${si + 1}.</span>
          <input class="form-input fill-sub-q" value="${escAttr(sq.question || '')}" placeholder="题目（含 _____）" style="flex:1">
          <input class="form-input fill-sub-a" value="${escAttr((sq.answer || []).join(', '))}" placeholder="答案" style="width:100px;flex-shrink:0">
          <button class="btn btn-sm btn-danger btn-remove-fillsub" data-si="${si}">🗑</button>
        </div>`;
    });
    innerForm = `
      <div class="form-group">
        <label class="form-label">共享选项词池（每行一个词）</label>
        <textarea class="form-input fill-shared-opts" rows="3" placeholder="词语1&#10;词语2&#10;词语3">${sharedOpts.join('\n')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">子题目列表</label>
        <div class="fill-sub-list">${subHtml}</div>
        <button class="btn btn-sm btn-secondary btn-add-fillsub" style="margin-top:6px">+ 添加子题</button>
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
        <span class="q-summary">${escHtml((q.questions && q.questions[0] && q.questions[0].question) || q.question || q.char || '(空)')}</span>
        <span class="q-delete" title="删除">🗑</span>
      </div>
      <div class="question-card-body">${innerForm}</div>
    </div>`;
}

/* ── Dialogue Editor ─────────────────────────── */
function renderDialogueEditor(slide, courseId, audioFiles) {
  const speakers = slide.speakers || [];
  const lines = slide.lines || [];
  const vocabList = slide.vocabList || [];
  const dialogueFiles = (audioFiles || []).filter(f => f.sub === 'dialogue');
  const narrationFiles = (audioFiles || []).filter(f => f.sub === 'narration');
  let dialogueOptions = '<option value="">无音频</option>';
  dialogueFiles.forEach(f => { dialogueOptions += `<option value="${escAttr(f.path)}" ${slide.dialogueAudio === f.path ? 'selected' : ''}>${escHtml(f.file)}</option>`; });
  let narrationOptions = '<option value="">无音频</option>';
  narrationFiles.forEach(f => { narrationOptions += `<option value="${escAttr(f.path)}" ${slide.audio === f.path ? 'selected' : ''}>${escHtml(f.file)}</option>`; });

  return `
    <div class="form-group">
      <label class="form-label">旁白音频</label>
      <div style="display:flex;gap:8px;align-items:center">
        <select class="form-select" id="slideAudio" style="flex:1">
          <option value="">无音频</option>
          ${narrationOptions}
        </select>
        <button class="btn btn-secondary btn-sm" id="btnRefreshDialogueNarration" title="刷新旁白列表">🔄</button>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">对话音频</label>
      <div style="display:flex;gap:8px;align-items:center">
        <select class="form-select" id="dialogueAudioSelect" style="flex:1">
          <option value="">无音频</option>
          ${dialogueOptions}
        </select>
        <button class="btn btn-secondary btn-sm" id="btnRefreshDialogue" title="刷新音频">🔄</button>
      </div>
    </div>

    <div class="toggle-row">
      <label class="toggle">
        <input type="checkbox" id="dialogue-showText" ${slide.showText !== false ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
      <span class="toggle-label">显示文本</span>
    </div>
    <div class="toggle-row">
      <label class="toggle">
        <input type="checkbox" id="dialogue-showPinyin" ${slide.showPinyin !== false ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
      <span class="toggle-label">显示拼音</span>
    </div>
    <div class="toggle-row">
      <label class="toggle">
        <input type="checkbox" id="dialogue-showEnglish" ${slide.showEnglish === true ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
      <span class="toggle-label">显示英文</span>
    </div>
    <div class="toggle-row">
      <label class="toggle">
        <input type="checkbox" id="dialogue-hasRolePlay" ${slide.hasRolePlay !== false ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
      <span class="toggle-label">角色扮演</span>
    </div>

    <div class="section-title">角色（Speakers）</div>
    <table class="vocab-table">
      <thead><tr><th>ID</th><th>名称</th><th>拼音</th><th>头像</th><th></th></tr></thead>
      <tbody id="dialogueSpeakersTbody">
        ${speakers.map((sp, i) => `
          <tr data-i="${i}">
            <td><input class="form-input" value="${escAttr(sp.id)}" style="width:50px" data-field="id"></td>
            <td><input class="form-input" value="${escAttr(sp.name)}" data-field="name"></td>
            <td><input class="form-input" value="${escAttr(sp.pinyin)}" data-field="pinyin"></td>
            <td><input class="form-input" value="${escAttr(sp.avatar || '')}" data-field="avatar" style="width:120px"></td>
            <td><button class="btn btn-sm btn-danger btn-remove-speaker">🗑</button></td>
          </tr>`).join('')}
      </tbody>
    </table>
    <button class="btn btn-secondary btn-sm" id="btnAddDialogueSpeaker">+ 添加角色</button>

    <div class="section-title" style="margin-top:24px">对话行（Lines）</div>
    <table class="vocab-table">
      <thead><tr><th>角色</th><th>开始(s)</th><th>结束(s)</th><th>汉字</th><th>拼音</th><th>英文</th><th></th></tr></thead>
      <tbody id="dialogueLinesTbody">
        ${lines.map((ln, i) => `
          <tr data-i="${i}">
            <td>
              <select class="form-select" data-field="speaker" style="width:70px">
                ${speakers.map(sp => `<option value="${sp.id}" ${ln.speaker === sp.id ? 'selected' : ''}>${sp.id}</option>`).join('')}
              </select>
            </td>
            <td><input class="form-input" type="number" step="0.1" value="${ln.start}" data-field="start" style="width:60px"></td>
            <td><input class="form-input" type="number" step="0.1" value="${ln.end}" data-field="end" style="width:60px"></td>
            <td><input class="form-input" value="${escAttr(ln.hanzi)}" data-field="hanzi"></td>
            <td><input class="form-input" value="${escAttr(ln.pinyin)}" data-field="pinyin"></td>
            <td><input class="form-input" value="${escAttr(ln.en || '')}" data-field="en"></td>
            <td><button class="btn btn-sm btn-danger btn-remove-line">🗑</button></td>
          </tr>`).join('')}
      </tbody>
    </table>
    <button class="btn btn-secondary btn-sm" id="btnAddDialogueLine">+ 添加行</button>

    <div class="section-title" style="margin-top:24px">词汇表（Vocab List）</div>
    <table class="vocab-table">
      <thead><tr><th>汉字</th><th>拼音</th><th>词性</th><th>英文</th><th></th></tr></thead>
      <tbody id="dialogueVocabTbody">
        ${vocabList.map((v, i) => `
          <tr data-i="${i}">
            <td><input class="form-input" value="${escAttr(v.hanzi)}" data-field="hanzi"></td>
            <td><input class="form-input" value="${escAttr(v.pinyin)}" data-field="pinyin"></td>
            <td><input class="form-input" value="${escAttr(v.pos)}" style="width:60px" data-field="pos"></td>
            <td><input class="form-input" value="${escAttr(v.en)}" data-field="en"></td>
            <td><button class="btn btn-sm btn-danger btn-remove-vocab">🗑</button></td>
          </tr>`).join('')}
      </tbody>
    </table>
    <button class="btn btn-secondary btn-sm" id="btnAddDialogueVocab">+ 添加词汇</button>`;
}

/* ── Video Editor ─────────────────────────── */
function renderVideoEditor(slide, courseId, audioFiles) {
  const videoFiles = (audioFiles || []).filter(f => f.sub === 'video');
  let videoOptions = '<option value="">无视频</option>';
  videoFiles.forEach(f => {
    videoOptions += `<option value="${escAttr(f.path)}" ${slide.video === f.path ? 'selected' : ''}>${escHtml(f.file)}</option>`;
  });
  const narrationFiles = (audioFiles || []).filter(f => f.sub === 'narration');
  let narrationOptions = '<option value="">无音频</option>';
  narrationFiles.forEach(f => {
    narrationOptions += `<option value="${escAttr(f.path)}" ${slide.audio === f.path ? 'selected' : ''}>${escHtml(f.file)}</option>`;
  });

  return `
    <div class="section-title">旁白音频</div>
    <div class="audio-picker-row">
      <select class="form-select" id="slideAudio">
        <option value="">无音频</option>
        ${narrationOptions}
      </select>
      <button class="btn btn-secondary btn-sm" id="btnRefreshNarration" title="刷新音频列表">🔄</button>
    </div>
    <div class="audio-preview-row" id="audioPreviewRow" style="display:none;margin-top:8px">
      <audio id="audioPreview" controls style="height:36px;width:100%"></audio>
    </div>

    <div class="form-group">
      <label class="form-label">视频文件</label>
      <div style="display:flex;gap:8px;align-items:center">
        <select class="form-select" id="slideVideo">
          <option value="">无视频</option>
          ${videoOptions}
        </select>
        <button class="btn btn-secondary btn-sm" id="btnRefreshVideo" title="刷新视频">🔄</button>
      </div>
    </div>`;
}

/* ── Editor helpers ─────────────────────────── */
async function refreshFileDropdown(sub, selectEl, courseId, currentValue) {
  if (!selectEl) return;
  const selIdx = selectEl.selectedIndex;
  selectEl.innerHTML = '<option value="">无文件</option>';
  try {
    const files = await api.get('/api/courses/' + courseId + '/audio-files').catch(() => []);
    files.filter(f => f.sub === sub).forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.path;
      opt.textContent = f.file;
      selectEl.appendChild(opt);
    });
    if (currentValue) {
      selectEl.value = currentValue;
    } else if (selIdx > 0 && selectEl.options[selIdx]) {
      selectEl.selectedIndex = selIdx;
    }
  } catch (e) { console.warn('refreshFileDropdown failed', e); }
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
      data.spotlightZones = collectSpotlightZones(view);
      data.backgroundImage = document.getElementById('bgImgSelect')?.value || '';
    } else if (slide.type === 'vocab') {
      data.audio = document.getElementById('slideAudio')?.value || '';
      data.showPinyin = document.getElementById('display-showPinyin')?.checked ?? true;
      data.showEnglish = document.getElementById('display-showEnglish')?.checked ?? true;
      data.hasRecording = document.getElementById('display-hasRecording')?.checked ?? true;
      data.vocab = collectVocab(view);
    } else if (slide.type === 'display') {
      data.audio = document.getElementById('slideAudio')?.value || '';
      data.showPinyin = document.getElementById('display-showPinyin')?.checked ?? true;
      data.showEnglish = document.getElementById('display-showEnglish')?.checked ?? true;
      data.vocab = collectDisplay2Vocab(view);
      data.examples = collectDisplay2Examples(view);
    } else if (slide.type === 'exercise') {
      data.audio = document.getElementById('slideAudio')?.value || '';
      data.questions = collectQuestions(view);
      data.showPinyin = true;
    } else if (slide.type === 'video') {
      data.audio = document.getElementById('slideAudio')?.value || '';
      data.video = document.getElementById('slideVideo')?.value || '';
    } else if (slide.type === 'dialogue') {
      data.audio = document.getElementById('slideAudio')?.value || '';
      data.dialogueAudio = document.getElementById('dialogueAudioSelect')?.value || '';
      data.showText = document.getElementById('dialogue-showText')?.checked ?? true;
      data.showPinyin = document.getElementById('dialogue-showPinyin')?.checked ?? true;
      data.showEnglish = document.getElementById('dialogue-showEnglish')?.checked ?? false;
      data.hasRolePlay = document.getElementById('dialogue-hasRolePlay')?.checked ?? true;
      data.speakers = collectDialogueSpeakers(view);
      data.lines = collectDialogueLines(view);
      data.vocabList = collectDialogueVocabList(view);
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

  // ── Hotspot Editor ──────────────────────────
  let isDrawing = false, drawStartX, drawStartY;
  const canvas = document.getElementById('hotspotDrawOverlay');

  function syncBgImg() {
    const imgEl = document.getElementById('hotspotBgImg');
    if (!imgEl) return;
    const zones = (slide.spotlightZones || []).map(z => z);
    // If we have a backgroundImage, show it
    const bgPath = document.getElementById('bgImgSelect')?.value || window._currentBgImage || slide.backgroundImage;
    if (bgPath) {
      imgEl.src = '/courses/' + courseId + '/' + bgPath;
      imgEl.style.display = 'block';
      imgEl.onload = () => syncRectsToCanvas(zones);
    } else {
      imgEl.style.display = 'none';
    }
  }

  function syncRectsToCanvas(zones) {
    const container = document.getElementById('hotspotCanvasWrap');
    const img = document.getElementById('hotspotBgImg');
    if (!container || !img || !img.naturalWidth) return;
    const rectsEl = document.getElementById('hotspotRects');
    if (!rectsEl) return;
    const scaleX = container.offsetWidth / 1200;
    const scaleY = container.offsetHeight / 675;
    rectsEl.innerHTML = zones.map((z, i) => {
      const left = z.x * 12 * scaleX; // 1200 * 0.01 = 12px per percent
      const top = z.y * 6.75 * scaleY; // 675 * 0.01 = 6.75px per percent
      const w = z.w * 12 * scaleX;
      const h = z.h * 6.75 * scaleY;
      return `<div class="hz-rect" data-i="${i}" style="left:${left}px;top:${top}px;width:${w}px;height:${h}px;${z.elementId ? '' : 'border-color:#f00'}">
        <span class="hz-label">${escHtml(z.elementId || '?')}</span>
      </div>`;
    }).join('');
  }

  // Background image refresh
  document.getElementById('btnRefreshBgImg')?.addEventListener('click', async () => {
    const sel = document.getElementById('bgImgSelect');
    await refreshFileDropdown('pptimg', sel, courseId, sel?.value);
  });
  document.getElementById('bgImgSelect')?.addEventListener('change', function() {
    window._currentBgImage = this.value;
    const img = document.getElementById('hotspotBgImg');
    if (this.value) {
      img.src = '/courses/' + courseId + '/' + this.value;
      img.style.display = 'block';
    } else {
      img.style.display = 'none';
    }
  });

  // Draw hotspot on canvas
  canvas?.addEventListener('mousedown', e => {
    const rect = canvas.getBoundingClientRect();
    drawStartX = e.clientX - rect.left;
    drawStartY = e.clientY - rect.top;
    isDrawing = true;
  });
  canvas?.addEventListener('mousemove', e => {
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;
    // Draw preview rect
    let preview = canvas.querySelector('.draw-preview');
    if (!preview) {
      preview = document.createElement('div');
      preview.className = 'draw-preview';
      canvas.appendChild(preview);
    }
    const left = Math.min(drawStartX, curX);
    const top = Math.min(drawStartY, curY);
    const w = Math.abs(curX - drawStartX);
    const h = Math.abs(curY - drawStartY);
    preview.style.cssText = 'position:absolute;left:' + left + 'px;top:' + top + 'px;width:' + w + 'px;height:' + h + 'px;border:2px dashed #0b5fff;background:rgba(11,95,255,0.15);pointer-events:none;';
  });
  canvas?.addEventListener('mouseup', e => {
    if (!isDrawing) return;
    isDrawing = false;
    const rect = canvas.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;
    const left = Math.min(drawStartX, curX);
    const top = Math.min(drawStartY, curY);
    const w = Math.abs(curX - drawStartX);
    const h = Math.abs(curY - drawStartY);
    canvas.querySelector('.draw-preview')?.remove();
    if (w < 10 || h < 10) return;

    // Convert to percent of canvas size
    const pX = left / rect.width * 100;
    const pY = top / rect.height * 100;
    const pW = w / rect.width * 100;
    const pH = h / rect.height * 100;
    const zoneList = document.getElementById('hotspotZoneList');
    const i = zoneList.querySelectorAll('.hotspot-zone-row').length;
    zoneList.insertAdjacentHTML('beforeend', `
      <div class="hotspot-zone-row" data-i="${i}">
        <input class="form-input" value="zone-${i + 1}" placeholder="ID" style="width:70px">
        <span class="zone-coords">x:<input class="form-input" type="number" value="${pX.toFixed(1)}" step="0.1" style="width:50px">%
         y:<input class="form-input" type="number" value="${pY.toFixed(1)}" step="0.1" style="width:50px">%
         w:<input class="form-input" type="number" value="${pW.toFixed(1)}" step="0.1" style="width:50px">%
         h:<input class="form-input" type="number" value="${pH.toFixed(1)}" step="0.1" style="width:50px">%</span>
        <button class="btn btn-sm btn-danger btn-remove-hz">🗑</button>
      </div>`);
    // Sync visual rects
    updateVisualRects();
    // Bind remove
    zoneList.lastElementChild.querySelector('.btn-remove-hz')?.addEventListener('click', () => {
      zoneList.lastElementChild.remove();
      updateVisualRects();
    });
    // Re-render visual rects on input change
    zoneList.querySelectorAll('.hotspot-zone-row').forEach(row => {
      row.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', updateVisualRects);
      });
    });
  });

  function updateVisualRects() {
    const rows = document.querySelectorAll('.hotspot-zone-row');
    const container = document.getElementById('hotspotCanvasWrap');
    const bgEl = document.getElementById('hotspotBgImg');
    if (!container || !bgEl) return;
    const w = container.offsetWidth;
    const h = container.offsetHeight;
    const rectsEl = document.getElementById('hotspotRects');
    rectsEl.innerHTML = Array.from(rows).map(row => {
      const inputs = row.querySelectorAll('input');
      const x = parseFloat(inputs[1]?.value || 0);
      const y = parseFloat(inputs[2]?.value || 0);
      const wP = parseFloat(inputs[3]?.value || 0);
      const hP = parseFloat(inputs[4]?.value || 0);
      const id = inputs[0]?.value || '?';
      return `<div class="hz-rect" style="left:${x * w / 100}px;top:${y * h / 100}px;width:${wP * w / 100}px;height:${hP * h / 100}px">
        <span class="hz-label">${escHtml(id)}</span>
      </div>`;
    }).join('');
  }

  // Remove hotspot zone
  view.querySelectorAll('.btn-remove-hz').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.hotspot-zone-row')?.remove();
      updateVisualRects();
    });
  });

  // Sync on input changes
  view.querySelectorAll('.hotspot-zone-row input').forEach(inp => {
    inp.addEventListener('input', updateVisualRects);
  });

  // Preview spotlight
  document.getElementById('btnPreviewSpotlight')?.addEventListener('click', () => {
    const previewWin = window.open('/player.html?course=' + courseId + '&slide=' + idx, '_blank');
    // Notify the player slide to show spotlights without waiting for slideData
    let notified = false;
    const check = setInterval(() => {
      if (notified || !previewWin || previewWin.closed) { clearInterval(check); return; }
      try {
        previewWin.postMessage({ type: '_hotspotPreview', courseId, slideIndex: idx }, '*');
        notified = true;
      } catch(e) {}
    }, 500);
  });

  // Init: sync bg img and rects
  syncBgImg();
  setTimeout(updateVisualRects, 200);

  // Init: sync audio preview if already selected
  (function() {
    const sel = document.getElementById('slideAudio');
    const previewRow = document.getElementById('audioPreviewRow');
    if (sel?.value) {
      const previewAudio = document.getElementById('audioPreview');
      if (previewAudio) {
        previewAudio.src = '/courses/' + courseId + '/' + sel.value;
        previewRow.style.display = 'flex';
      }
    }
  })();


  // Display: add vocab
  document.getElementById('btnAddVocab')?.addEventListener('click', () => {
    const tbody = document.getElementById('vocabTbody');
    const nextId = 'w' + (tbody.querySelectorAll('tr').length + 1);
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td><input class="form-input" value="${nextId}" style="width:50px" data-field="id"></td>
        <td><input class="form-input" value="" data-field="hanzi"></td>
        <td><input class="form-input" value="" data-field="pinyin"></td>
        <td><input class="form-input" value="" style="width:60px" data-field="pos"></td>
        <td><input class="form-input" value="" data-field="en"></td>
        <td>
          <div style="display:flex;gap:4px;align-items:center">
            <select class="form-select v-audio" data-field="audio" style="width:110px"><option value="">无音频</option></select>
            <button class="btn btn-xs btn-ghost btn-refresh-vocab-audio" title="刷新音频">🔄</button>
          </div>
        </td>
        <td><button class="btn btn-sm btn-danger btn-remove-v">🗑</button></td>
      </tr>`);
    // Auto-refresh audio dropdown for the new row
    const newRow = tbody.lastElementChild;
    const newSelect = newRow.querySelector('.v-audio');
    const newRefreshBtn = newRow.querySelector('.btn-refresh-vocab-audio');
    newRefreshBtn?.addEventListener('click', async () => {
      await refreshFileDropdown('vocab', newSelect, courseId, '');
    });
    refreshFileDropdown('vocab', newSelect, courseId, '');
  });

  view.querySelectorAll('.btn-remove-v').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('tr')?.remove());
  });

  // Display2: add vocab row
  document.getElementById('btnAddDisplay2Vocab')?.addEventListener('click', () => {
    const tbody = document.getElementById('display2VocabTbody');
    const nextId = 'w' + (tbody.querySelectorAll('tr').length + 1);
    tbody.insertAdjacentHTML('beforeend', `<tr>
      <td><input class="form-input" value="${nextId}" style="width:50px" data-field="id"></td>
      <td><input class="form-input" value="" data-field="hanzi"></td>
      <td><input class="form-input" value="" data-field="pinyin"></td>
      <td><input class="form-input" value="" style="width:60px" data-field="pos"></td>
      <td><input class="form-input" value="" data-field="en"></td>
      <td><input class="form-input" value="" style="width:80px" data-field="image"></td>
      <td><div style="display:flex;gap:4px;align-items:center"><select class="form-select v-audio" data-field="audio" style="width:110px"><option value="">无音频</option></select><button class="btn btn-xs btn-ghost btn-refresh-vocab-audio" title="刷新音频">🔄</button></div></td>
      <td><button class="btn btn-sm btn-danger btn-remove-display2-v">🗑</button></td>
    </tr>`);
    const newRow = tbody.lastElementChild;
    const newSelect = newRow.querySelector('.v-audio');
    const newRefreshBtn = newRow.querySelector('.btn-refresh-vocab-audio');
    newRefreshBtn?.addEventListener('click', async () => {
      await refreshFileDropdown('vocab', newSelect, courseId, '');
    });
    refreshFileDropdown('vocab', newSelect, courseId, '');
  });
  view.querySelectorAll('.btn-remove-display2-v').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('tr')?.remove());
  });

  // Display2: add example row
  document.getElementById('btnAddDisplay2Example')?.addEventListener('click', () => {
    const tbody = document.getElementById('display2ExampleTbody');
    const nextId = 'e' + (tbody.querySelectorAll('tr').length + 1);
    tbody.insertAdjacentHTML('beforeend', `<tr>
      <td><input class="form-input" value="${nextId}" style="width:50px" data-field="id"></td>
      <td><input class="form-input" value="" data-field="hanzi"></td>
      <td><input class="form-input" value="" data-field="pinyin"></td>
      <td><input class="form-input" value="" data-field="en"></td>
      <td><div style="display:flex;gap:4px;align-items:center"><select class="form-select v-audio" data-field="audio" style="width:110px"><option value="">无音频</option></select><button class="btn btn-xs btn-ghost btn-refresh-example-audio" title="刷新音频">🔄</button></div></td>
      <td><button class="btn btn-sm btn-danger btn-remove-display2-ex">🗑</button></td>
    </tr>`);
    const newRow = tbody.lastElementChild;
    const newSelect = newRow.querySelector('.v-audio');
    const newRefreshBtn = newRow.querySelector('.btn-refresh-example-audio');
    newRefreshBtn?.addEventListener('click', async () => {
      await refreshFileDropdown('display', newSelect, courseId, '');
    });
    refreshFileDropdown('display', newSelect, courseId, '');
  });
  view.querySelectorAll('.btn-remove-display2-ex').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('tr')?.remove());
  });

  // Dialogue: add speaker
  document.getElementById('btnAddDialogueSpeaker')?.addEventListener('click', () => {
    const tbody = document.getElementById('dialogueSpeakersTbody');
    const i = tbody.querySelectorAll('tr').length;
    tbody.insertAdjacentHTML('beforeend', `
      <tr data-i="${i}">
        <td><input class="form-input" value="" style="width:50px" data-field="id"></td>
        <td><input class="form-input" value="" data-field="name"></td>
        <td><input class="form-input" value="" data-field="pinyin"></td>
        <td><input class="form-input" value="" style="width:120px" data-field="avatar"></td>
        <td><button class="btn btn-sm btn-danger btn-remove-speaker">🗑</button></td>
      </tr>`);
  });
  view.querySelectorAll('.btn-remove-speaker').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('tr')?.remove());
  });

  // Dialogue: add line
  document.getElementById('btnAddDialogueLine')?.addEventListener('click', () => {
    const tbody = document.getElementById('dialogueLinesTbody');
    const i = tbody.querySelectorAll('tr').length;
    tbody.insertAdjacentHTML('beforeend', `
      <tr data-i="${i}">
        <td><select class="form-select" data-field="speaker" style="width:70px"><option value="A">A</option></select></td>
        <td><input class="form-input" type="number" step="0.1" value="0" data-field="start" style="width:60px"></td>
        <td><input class="form-input" type="number" step="0.1" value="1" data-field="end" style="width:60px"></td>
        <td><input class="form-input" value="" data-field="hanzi"></td>
        <td><input class="form-input" value="" data-field="pinyin"></td>
        <td><input class="form-input" value="" data-field="en"></td>
        <td><button class="btn btn-sm btn-danger btn-remove-line">🗑</button></td>
      </tr>`);
  });
  view.querySelectorAll('.btn-remove-line').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('tr')?.remove());
  });

  // Dialogue: add vocab
  document.getElementById('btnAddDialogueVocab')?.addEventListener('click', () => {
    const tbody = document.getElementById('dialogueVocabTbody');
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td><input class="form-input" value="" data-field="hanzi"></td>
        <td><input class="form-input" value="" data-field="pinyin"></td>
        <td><input class="form-input" value="" style="width:60px" data-field="pos"></td>
        <td><input class="form-input" value="" data-field="en"></td>
        <td><button class="btn btn-sm btn-danger btn-remove-vocab">🗑</button></td>
      </tr>`);
  });
  view.querySelectorAll('.btn-remove-vocab').forEach(btn => {
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

  // Content: narration audio refresh
  document.getElementById('btnRefreshNarration')?.addEventListener('click', async () => {
    const sel = document.getElementById('slideAudio');
    await refreshFileDropdown('narration', sel, courseId, sel?.value);
  });

  // Content: sync audio preview on select change
  document.getElementById('slideAudio')?.addEventListener('change', function() {
    const previewAudio = document.getElementById('audioPreview');
    const previewRow = document.getElementById('audioPreviewRow');
    if (this.value) {
      previewAudio.src = '/courses/' + courseId + '/' + this.value;
      previewRow.style.display = 'flex';
    } else {
      previewAudio.src = '';
      previewRow.style.display = 'none';
    }
  });

  // Video: refresh
  document.getElementById('btnRefreshVideo')?.addEventListener('click', async () => {
    const sel = document.getElementById('slideVideo');
    await refreshFileDropdown('video', sel, courseId, sel?.value);
  });
  // Vocab audio: refresh all
  view.querySelectorAll('.btn-refresh-vocab-audio').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targets = document.querySelectorAll('.v-audio');
      const vals = Array.from(targets).map(s => s.value);
      await Promise.all(Array.from(targets).map(s => refreshFileDropdown('vocab', s, courseId, '')));
      targets.forEach((s, i) => { if (vals[i]) s.value = vals[i]; });
    });
  });

  // Example audio: refresh per row
  view.querySelectorAll('.btn-refresh-example-audio').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sel = btn.closest('tr')?.querySelector('.v-audio');
      await refreshFileDropdown('display', sel, courseId, sel?.value);
    });
  });

  // Dialogue narration audio: refresh
  document.getElementById('btnRefreshDialogueNarration')?.addEventListener('click', async () => {
    const sel = document.getElementById('slideAudio');
    await refreshFileDropdown('narration', sel, courseId, sel?.value);
  });

  // Dialogue audio: refresh
  document.getElementById('btnRefreshDialogue')?.addEventListener('click', async () => {
    const sel = document.getElementById('dialogueAudioSelect');
    await refreshFileDropdown('dialogue', sel, courseId, sel?.value);
  });
}

function _refreshOptionRemoveButtons(container) {
  const rows = container.querySelectorAll('.q-option-row');
  rows.forEach((row, i) => {
    const btn = row.querySelector('.btn-remove-option');
    if (!btn) return;
    btn.style.display = rows.length > 2 ? '' : 'none';
  });
}

function _refreshAnswerSelect(card, optCount) {
  const select = card.querySelector('.q-answer');
  if (!select) return;
  const currentAnswer = select.value;
  select.innerHTML = Array.from({ length: optCount }, (_, oi) => {
    const oid = String.fromCharCode(65 + oi);
    return `<option value="${oid}">${oid}</option>`;
  }).join('');
  if (currentAnswer && currentAnswer.charCodeAt(0) < 65 + optCount) {
    select.value = currentAnswer;
  }
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
    const lt = card.querySelector('.q-left-type')?.value || 'text';
    const rt = card.querySelector('.q-right-type')?.value || 'text';
    const leftHtml = lt === 'audio'
      ? `<select class="form-select q-left-val" data-oi="${pi}" style="flex:1"><option value="">选择音频...</option></select>`
      : `<input class="form-input q-left" value="" placeholder="左" style="flex:1">`;
    const rightHtml = rt === 'image'
      ? `<select class="form-select q-right-val" data-oi="${pi}" style="flex:1"><option value="">选择图片...</option></select>`
      : `<input class="form-input q-right" value="" placeholder="右" style="flex:1">`;
    const pyHtml = lt !== 'audio'
      ? `<input class="form-input q-pinyin" value="" placeholder="拼音" style="width:80px">`
      : '';
    const html = `<div class="q-option-row" style="display:flex;gap:4px;align-items:center">
      ${leftHtml}
      ${pyHtml}
      ${rightHtml}
      <button class="btn btn-sm btn-danger btn-remove-pair" data-pi="${pi}">🗑</button>
    </div>`;
    container.insertAdjacentHTML('beforeend', html);
    card.querySelectorAll('.btn-remove-pair').forEach(b => {
      b.addEventListener('click', () => b.closest('.q-option-row')?.remove());
    });
    // load file options if needed
    if (lt === 'audio') {
      const sel = container.querySelectorAll('.q-left-val')[pi];
      if (sel) refreshFileDropdown('exercise', sel, courseId, '');
    }
    if (rt === 'image') {
      const sel = container.querySelectorAll('.q-right-val')[pi];
      if (sel) refreshFileDropdown('exercise-img', sel, courseId, '');
    }
  });

  // fill: remove sub-question
  card.querySelectorAll('.btn-remove-fillsub').forEach(btn => {
    btn.addEventListener('click', () => {
      const list = card.querySelector('.fill-sub-list');
      if (list.querySelectorAll('.fill-sub-row').length <= 1) return;
      btn.closest('.fill-sub-row')?.remove();
    });
  });

  // fill: add sub-question
  card.querySelector('.btn-add-fillsub')?.addEventListener('click', () => {
    const list = card.querySelector('.fill-sub-list');
    const si = list.querySelectorAll('.fill-sub-row').length;
    const html = `<div class="q-option-row fill-sub-row" data-si="${si}" style="display:flex;gap:6px;align-items:center">
      <span style="width:24px;font-weight:700;color:#888;flex-shrink:0">${si + 1}.</span>
      <input class="form-input fill-sub-q" value="" placeholder="题目（含 _____）" style="flex:1">
      <input class="form-input fill-sub-a" value="" placeholder="答案" style="width:100px;flex-shrink:0">
      <button class="btn btn-sm btn-danger btn-remove-fillsub" data-si="${si}">🗑</button>
    </div>`;
    list.insertAdjacentHTML('beforeend', html);
    list.querySelectorAll('.btn-remove-fillsub').forEach(b => {
      b.addEventListener('click', () => {
        const rows = list.querySelectorAll('.fill-sub-row');
        if (rows.length <= 1) return;
        b.closest('.fill-sub-row')?.remove();
      });
    });
  });

  // choice (listen/read): add option
  card.querySelector('.btn-add-option')?.addEventListener('click', () => {
    const container = card.querySelector('.q-options-list');
    const rows = container.querySelectorAll('.q-option-row');
    const oi = rows.length;
    const oid = String.fromCharCode(65 + oi);
    const html = `<div class="q-option-row">
      <span style="width:24px;font-weight:700;color:#888">${oid}.</span>
      <input class="form-input q-opt-text" value="" data-oi="${oi}" placeholder="文字">
      <select class="form-select q-opt-image" data-oi="${oi}" style="flex:0 0 160px"><option value="">无图片</option></select>
      <button class="btn btn-sm btn-danger btn-remove-option" data-oi="${oi}">🗑</button>
    </div>`;
    container.insertAdjacentHTML('beforeend', html);
    const newImgSel = container.querySelectorAll('select.q-opt-image')[oi];
    if (newImgSel) refreshFileDropdown('exercise-img', newImgSel, courseId, '');
    _refreshOptionRemoveButtons(container);
    // update answer select
    _refreshAnswerSelect(card, oi + 1);
    // rebind remove handlers
    container.querySelectorAll('.btn-remove-option').forEach(b => {
      b.addEventListener('click', () => {
        const rows2 = container.querySelectorAll('.q-option-row');
        if (rows2.length <= 2) return;
        b.closest('.q-option-row')?.remove();
        _refreshOptionRemoveButtons(container);
        _refreshAnswerSelect(card, container.querySelectorAll('.q-option-row').length);
      });
    });
  });

  // choice (listen/read): remove option
  card.querySelectorAll('.btn-remove-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const container = card.querySelector('.q-options-list');
      const rows = container.querySelectorAll('.q-option-row');
      if (rows.length <= 2) return;
      btn.closest('.q-option-row')?.remove();
      _refreshOptionRemoveButtons(container);
      _refreshAnswerSelect(card, container.querySelectorAll('.q-option-row').length);
    });
  });

  // listen: audio refresh per question card
  card.querySelectorAll('.btn-refresh-q-audio').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sel = card.querySelector('.q-audio');
      await refreshFileDropdown('exercise', sel, courseId, sel?.value);
    });
  });

  // match: load audio/image file dropdowns on init
  const lt = card.querySelector('.q-left-type')?.value || 'text';
  const rt = card.querySelector('.q-right-type')?.value || 'text';
  if (lt === 'audio') {
    card.querySelectorAll('.q-left-val').forEach(sel => {
      refreshFileDropdown('exercise', sel, courseId, sel?.dataset?.current || sel?.value);
    });
  }
  if (rt === 'image') {
    card.querySelectorAll('.q-right-val').forEach(sel => {
      refreshFileDropdown('exercise-img', sel, courseId, sel?.dataset?.current || sel?.value);
    });
  }

  // choice (listen/read): populate image option dropdowns on init
  card.querySelectorAll('select.q-opt-image').forEach(sel => {
    refreshFileDropdown('exercise-img', sel, courseId, sel.dataset.current || '');
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

function collectSpotlightZones(view) {
  return Array.from(view.querySelectorAll('.hotspot-zone-row')).map(row => {
    const inputs = row.querySelectorAll('input');
    return {
      elementId: inputs[0]?.value || '',
      x: parseFloat(inputs[1]?.value || 0),
      y: parseFloat(inputs[2]?.value || 0),
      w: parseFloat(inputs[3]?.value || 0),
      h: parseFloat(inputs[4]?.value || 0),
    };
  }).filter(z => z.elementId);
}

function collectVocab(view) {
  return Array.from(view.querySelectorAll('#vocabTbody tr')).map(row => {
    const fields = {};
    row.querySelectorAll('[data-field]').forEach(el => { fields[el.dataset.field] = el.value || ''; });
    return {
      id: fields.id || '',
      hanzi: fields.hanzi || '',
      pinyin: fields.pinyin || '',
      pos: fields.pos || '',
      en: fields.en || '',
      audio: fields.audio || '',
    };
  }).filter(v => v.hanzi);
}

function collectDisplay2Vocab(view) {
  return Array.from(view.querySelectorAll('#display2VocabTbody tr')).map(row => {
    const fields = {};
    row.querySelectorAll('[data-field]').forEach(el => { fields[el.dataset.field] = el.value || ''; });
    return {
      id: fields.id || '',
      hanzi: fields.hanzi || '',
      pinyin: fields.pinyin || '',
      pos: fields.pos || '',
      en: fields.en || '',
      image: fields.image || '',
      audio: fields.audio || '',
    };
  }).filter(v => v.hanzi);
}

function collectDisplay2Examples(view) {
  return Array.from(view.querySelectorAll('#display2ExampleTbody tr')).map(row => {
    const fields = {};
    row.querySelectorAll('[data-field]').forEach(el => { fields[el.dataset.field] = el.value || ''; });
    return {
      id: fields.id || '',
      hanzi: fields.hanzi || '',
      pinyin: fields.pinyin || '',
      en: fields.en || '',
      audio: fields.audio || '',
    };
  }).filter(ex => ex.hanzi);
}

function collectQuestions(view) {
  return Array.from(view.querySelectorAll('.question-card')).map((card, qi) => {
    const type = card.querySelector('.q-type-badge')?.textContent?.trim() || 'read';
    const q = { id: 'q' + (qi + 1), type };

    if (type === 'read' || type === 'listen') {
      q.question = card.querySelector('.q-question')?.value || '';
      q.audio = card.querySelector('.q-audio')?.value || '';
      const rows = card.querySelectorAll('.q-option-row');
      q.options = Array.from(rows).map((row, oi) => {
        const id = String.fromCharCode(65 + oi);
        const text = row.querySelector('input.q-opt-text')?.value || '';
        const image = row.querySelector('select.q-opt-image')?.value || '';
        return { id, text, ...(image && { image }) };
      }).filter(opt => opt.text);
      q.answer = card.querySelector('.q-answer')?.value || '';
      q.layout = card.querySelector('.q-layout')?.value || 'vertical';
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
      const lt = card.querySelector('.q-left-type')?.value || 'text';
      const rt = card.querySelector('.q-right-type')?.value || 'text';
      const rows = card.querySelectorAll('.q-option-row');
      const pinyinMap = {};
      q.pairs = Array.from(rows).map(row => {
        let left, py, right;
        if (lt === 'audio') {
          left = row.querySelector('.q-left-val')?.value || '';
          py = '';
        } else {
          const inp = row.querySelectorAll('input');
          left = inp[0]?.value || '';
          py = inp[1]?.value || '';
        }
        if (rt === 'image') {
          right = row.querySelector('.q-right-val')?.value || '';
        } else {
          const allInp = row.querySelectorAll('input');
          right = lt === 'audio' ? allInp[1]?.value || '' : allInp[2]?.value || '';
        }
        if (left && py) pinyinMap[left] = py;
        return { left, right };
      }).filter(p => p.left);
      q.pinyinMap = pinyinMap;
      q.leftType = lt;
      q.rightType = rt;
      q.direction = card.querySelector('.q-direction')?.value || 'vertical';
    } else if (type === 'fill') {
      q.sharedOptions = (card.querySelector('.fill-shared-opts')?.value || '').split('\n').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
      q.questions = [];
      card.querySelectorAll('.fill-sub-row').forEach(function(row, si) {
        var sqId = q.id ? q.id + '-' + (si + 1) : '';
        var ansRaw = row.querySelector('.fill-sub-a')?.value || '';
        var answers = ansRaw.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
        q.questions.push({
          id: sqId,
          question: row.querySelector('.fill-sub-q')?.value || '',
          answer: answers
        });
      });
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
    return { pairs: [{ left: '左', right: '右' }], pinyinMap: {}, leftType: 'text', rightType: 'text', direction: 'vertical' };
  } else if (type === 'fill') {
    return {
      sharedOptions: ['词语1', '词语2', '词语3'],
      questions: [
        { id: '', question: '请填空 _____。', answer: ['词语1'] },
        { id: '', question: '请填空 _____。', answer: ['词语2'] }
      ]
    };
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

function collectDialogueSpeakers(view) {
  return Array.from(view.querySelectorAll('#dialogueSpeakersTbody tr')).map(row => {
    const fields = {};
    row.querySelectorAll('[data-field]').forEach(el => { fields[el.dataset.field] = el.value || ''; });
    return {
      id: fields.id || '',
      name: fields.name || '',
      pinyin: fields.pinyin || '',
      avatar: fields.avatar || '',
    };
  }).filter(sp => sp.id);
}

function collectDialogueLines(view) {
  return Array.from(view.querySelectorAll('#dialogueLinesTbody tr')).map(row => {
    const fields = {};
    row.querySelectorAll('[data-field]').forEach(el => { fields[el.dataset.field] = el.value || ''; });
    return {
      speaker: fields.speaker || 'A',
      start: parseFloat(fields.start || 0),
      end: parseFloat(fields.end || 0),
      hanzi: fields.hanzi || '',
      pinyin: fields.pinyin || '',
      en: fields.en || '',
    };
  }).filter(ln => ln.hanzi);
}

function collectDialogueVocabList(view) {
  return Array.from(view.querySelectorAll('#dialogueVocabTbody tr')).map(row => {
    const fields = {};
    row.querySelectorAll('[data-field]').forEach(el => { fields[el.dataset.field] = el.value || ''; });
    return {
      hanzi: fields.hanzi || '',
      pinyin: fields.pinyin || '',
      pos: fields.pos || '',
      en: fields.en || '',
    };
  }).filter(v => v.hanzi);
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