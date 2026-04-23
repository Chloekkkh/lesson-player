/**
 * author-api.js — HTTP API 路由层
 * 挂载到 serve.js，处理所有 /api/* 请求
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const templates = require('../js/templates.js');

const ROOT = path.resolve(__dirname, '..');

// ── Helper ────────────────────────────────────────────────

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function error(res, message, status = 400) {
  json(res, { error: message }, status);
}

function readCourseJson(courseDir) {
  const p = path.join(courseDir, 'course.json');
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

function writeCourseJson(courseDir, data) {
  const p = path.join(courseDir, 'course.json');
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

function safePath(base, userInput) {
  const resolved = path.join(base, userInput);
  if (!resolved.startsWith(base)) return null; // path traversal
  return resolved;
}

// 获取课程目录（不存在返回 null）
function getCourseDir(courseId) {
  return path.join(ROOT, 'courses', courseId);
}

function courseExists(courseId) {
  return fs.existsSync(path.join(getCourseDir(courseId), 'course.json'));
}

// 生成 vocab id: w1, w2, ...
function nextVocabId(vocab) {
  const nums = vocab
    .map(v => parseInt(v.id.replace(/^w/, ''), 10))
    .filter(n => !isNaN(n));
  return 'w' + ((nums.length ? Math.max(...nums) : 0) + 1);
}

// ── API Handlers ──────────────────────────────────────────

function handleApi(req, res, urlPath) {
  // CORS for dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Dispatch
  const m = req.method;
  const u = urlPath;

  // ── GET /api/courses ───────────────────────────────────
  if (m === 'GET' && u === '/api/courses') {
    const coursesDir = path.join(ROOT, 'courses');
    if (!fs.existsSync(coursesDir)) {
      return json(res, []);
    }
    const dirs = fs.readdirSync(coursesDir).filter(f => {
      return fs.statSync(path.join(coursesDir, f)).isDirectory();
    });
    const courses = dirs
      .map(id => {
        const jsonPath = path.join(coursesDir, id, 'course.json');
        if (!fs.existsSync(jsonPath)) return null;
        try {
          const c = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          return {
            id,
            title: c.title || id,
            description: c.description || '',
            author: c.author || '',
            slideCount: (c.slides || []).length,
          };
        } catch (e) { return null; }
      })
      .filter(Boolean);
    return json(res, courses);
  }

  // ── POST /api/courses ──────────────────────────────────
  if (m === 'POST' && u === '/api/courses') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let data;
      try { data = JSON.parse(body); } catch (e) { return error(res, 'Invalid JSON'); }
      const { id, title, description } = data;
      if (!id) return error(res, 'Missing id');
      const courseDir = getCourseDir(id);
      if (fs.existsSync(courseDir)) return error(res, 'Course already exists', 409);

      fs.mkdirSync(path.join(courseDir, 'slides'), { recursive: true });
      fs.mkdirSync(path.join(courseDir, 'audio', 'narration'), { recursive: true });
      fs.mkdirSync(path.join(courseDir, 'audio', 'vocab'), { recursive: true });
      fs.mkdirSync(path.join(courseDir, 'audio', 'video'), { recursive: true });
      fs.mkdirSync(path.join(courseDir, 'originals'), { recursive: true });

      const courseJson = {
        id,
        title: title || id,
        description: description || '',
        author: 'teacher',
        created: new Date().toISOString().slice(0, 10),
        slides: [],
      };
      writeCourseJson(courseDir, courseJson);

      // Write placeholder slide 1
      const slideHtml = templates.contentTemplate(1, courseJson.title);
      fs.writeFileSync(path.join(courseDir, 'slides', '1.html'), slideHtml, 'utf8');
      courseJson.slides.push(templates.buildSlideEntry('content', 1));
      writeCourseJson(courseDir, courseJson);

      return json(res, courseJson, 201);
    });
    return;
  }

  // Course-level ops: /api/courses/:id/...
  const courseMatch = u.match(/^\/api\/courses\/([^/]+)(\/.*)?$/);
  if (!courseMatch) return false; // not an API route, let static handler take it
  const courseId = courseMatch[1];
  const rest = courseMatch[2] || '';
  const courseDir = getCourseDir(courseId);

  if (!courseExists(courseId)) return error(res, 'Course not found', 404);

  // ── GET /api/courses/:id ──────────────────────────────
  if (m === 'GET' && rest === '') {
    return json(res, readCourseJson(courseDir));
  }

  // ── PATCH /api/courses/:id ─────────────────────────────
  if (m === 'PATCH' && rest === '') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let data;
      try { data = JSON.parse(body); } catch (e) { return error(res, 'Invalid JSON'); }
      const course = readCourseJson(courseDir);
      if (data.title !== undefined) course.title = data.title;
      if (data.description !== undefined) course.description = data.description;
      writeCourseJson(courseDir, course);
      return json(res, course);
    });
    return;
  }

  // ── DELETE /api/courses/:id ───────────────────────────
  if (m === 'DELETE' && rest === '') {
    execSync(`rmdir /s /q "${courseDir}"`, { stdio: 'pipe' });
    return json(res, { ok: true }, 204);
  }

  // ── GET /api/courses/:id/slides ───────────────────────
  if (m === 'GET' && rest === '/slides') {
    const course = readCourseJson(courseDir);
    return json(res, course.slides || []);
  }

  // ── POST /api/courses/:id/slides ───────────────────────
  if (m === 'POST' && rest === '/slides') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let data;
      try { data = JSON.parse(body); } catch (e) { return error(res, 'Invalid JSON'); }
      const { type, index } = data;
      if (!['content', 'exercise', 'display', 'video'].includes(type)) {
        return error(res, 'Invalid slide type');
      }

      const course = readCourseJson(courseDir);
      let targetIndex = index || (course.slides.length ? Math.max(...course.slides.map(s => s.index)) + 1 : 1);

      // Handle index collision: shift existing
      if (course.slides.find(s => s.index === targetIndex)) {
        const slidesDir = path.join(courseDir, 'slides');
        course.slides.filter(s => s.index >= targetIndex).forEach(s => {
          const oldPath = path.join(slidesDir, `${s.index}.html`);
          const newPath = path.join(slidesDir, `${s.index + 1}.html`);
          if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
          s.index++;
        });
      }

      // Write slide HTML
      const slidesDir = path.join(courseDir, 'slides');
      let html;
      if (type === 'exercise') {
        html = templates.exerciseTemplate(targetIndex, course.title || courseId);
      } else if (type === 'video') {
        html = templates.videoTemplate(targetIndex, course.title || courseId);
      } else if (type === 'display') {
        html = templates.displayTemplate(targetIndex, course.title || courseId);
      } else {
        html = templates.contentTemplate(targetIndex, course.title || courseId);
      }
      fs.writeFileSync(path.join(slidesDir, `${targetIndex}.html`), html, 'utf8');

      // Build and insert slide entry
      const entry = templates.buildSlideEntry(type, targetIndex);
      if (type === 'content') entry.title = `第 ${targetIndex} 页`;
      course.slides.push(entry);
      course.slides.sort((a, b) => a.index - b.index);
      writeCourseJson(courseDir, course);

      return json(res, entry, 201);
    });
    return;
  }

  // Slide-level ops: /api/courses/:id/slides/:index/...
  const slideMatch = rest.match(/^\/slides\/(\d+)(\/.*)?$/);
  if (slideMatch) {
    const slideIndex = parseInt(slideMatch[1], 10);
    const slideRest = slideMatch[2] || '';
    const course = readCourseJson(courseDir);
    const slide = course.slides.find(s => s.index === slideIndex);
    if (!slide && slideRest !== '/html') return error(res, 'Slide not found', 404);

    // ── PATCH /api/courses/:id/slides/:index ─────────────
    if (m === 'PATCH' && slideRest === '') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        let data;
        try { data = JSON.parse(body); } catch (e) { return error(res, 'Invalid JSON'); }
        const slideIdx = course.slides.findIndex(s => s.index === slideIndex);
        if (slideIdx === -1) return error(res, 'Slide not found', 404);
        // Merge fields (title, audio, subtitles, spotlights, questions, vocab, etc.)
        Object.assign(course.slides[slideIdx], data);
        writeCourseJson(courseDir, course);
        return json(res, course.slides[slideIdx]);
      });
      return;
    }

    // ── DELETE /api/courses/:id/slides/:index ────────────
    if (m === 'DELETE' && slideRest === '') {
      const slidesDir = path.join(courseDir, 'slides');
      const htmlPath = path.join(slidesDir, `${slideIndex}.html`);
      if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);

      course.slides.filter(s => s.index > slideIndex).forEach(s => {
        const oldPath = path.join(slidesDir, `${s.index}.html`);
        const newPath = path.join(slidesDir, `${s.index - 1}.html`);
        if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
        s.index--;
      });

      course.slides = course.slides.filter(s => s.index !== slideIndex);
      writeCourseJson(courseDir, course);
      return json(res, { ok: true }, 204);
    }

    // ── POST /api/courses/:id/slides/:index/regenerate ──
    if (m === 'POST' && slideRest === '/regenerate') {
      const slide = course.slides.find(s => s.index === slideIndex);
      if (!slide) return error(res, 'Slide not found', 404);

      const slidesDir = path.join(courseDir, 'slides');
      let html;
      if (slide.type === 'exercise') {
        html = templates.exerciseTemplate(slideIndex, course.title || courseId);
      } else if (slide.type === 'video') {
        html = templates.videoTemplate(slideIndex, course.title || courseId);
      } else if (slide.type === 'display') {
        html = templates.displayTemplate(slideIndex, course.title || courseId);
      } else {
        html = templates.contentTemplate(slideIndex, course.title || courseId);
      }
      fs.writeFileSync(path.join(slidesDir, `${slideIndex}.html`), html, 'utf8');
      return json(res, { ok: true });
    }

    // ── POST /api/courses/:id/slides/reorder ────────────
    if (m === 'POST' && slideRest === '/reorder') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        let data;
        try { data = JSON.parse(body); } catch (e) { return error(res, 'Invalid JSON'); }
        const { fromIndex, toIndex } = data;
        if (fromIndex == null || toIndex == null) return error(res, 'Missing fromIndex or toIndex');

        const slidesDir = path.join(courseDir, 'slides');
        const fromSlide = course.slides.find(s => s.index === fromIndex);
        if (!fromSlide) return error(res, 'Source slide not found', 404);

        // Remove from original position
        course.slides = course.slides.filter(s => s.index !== fromIndex);

        // Shift affected slides
        const direction = fromIndex < toIndex ? 1 : -1;
        course.slides.forEach(s => {
          if (direction > 0 && s.index > fromIndex && s.index <= toIndex) {
            const oldPath = path.join(slidesDir, `${s.index}.html`);
            const newPath = path.join(slidesDir, `${s.index - 1}.html`);
            if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
            s.index--;
          } else if (direction < 0 && s.index >= toIndex && s.index < fromIndex) {
            const oldPath = path.join(slidesDir, `${s.index}.html`);
            const newPath = path.join(slidesDir, `${s.index + 1}.html`);
            if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
            s.index++;
          }
        });

        fromSlide.index = toIndex;
        course.slides.push(fromSlide);
        course.slides.sort((a, b) => a.index - b.index);
        writeCourseJson(courseDir, course);
        return json(res, course.slides);
      });
      return;
    }

    // ── GET /api/courses/:id/slides/:index/html ──────────
    if (m === 'GET' && slideRest === '/html') {
      const slidesDir = path.join(courseDir, 'slides');
      const htmlPath = path.join(slidesDir, `${slideIndex}.html`);
      if (!fs.existsSync(htmlPath)) return error(res, 'HTML file not found', 404);
      const html = fs.readFileSync(htmlPath, 'utf8');
      return json(res, { html });
    }

    // ── PUT /api/courses/:id/slides/:index/html ──────────
    if (m === 'PUT' && slideRest === '/html') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        let data;
        try { data = JSON.parse(body); } catch (e) {
          // Allow raw HTML string as text/plain fallback
          data = { html: body };
        }
        const slidesDir = path.join(courseDir, 'slides');
        const htmlPath = path.join(slidesDir, `${slideIndex}.html`);
        fs.writeFileSync(htmlPath, data.html, 'utf8');
        return json(res, { ok: true });
      });
      return;
    }
  }

  // ── GET /api/courses/:id/audio-files ──────────────────
  if (m === 'GET' && rest === '/audio-files') {
    const audioDir = path.join(courseDir, 'audio');
    const result = [];
    ['narration', 'vocab', 'video'].forEach(sub => {
      const subDir = path.join(audioDir, sub);
      if (!fs.existsSync(subDir)) return;
      fs.readdirSync(subDir).forEach(file => {
        result.push({ sub, file, path: `${sub}/${file}` });
      });
    });
    return json(res, result);
  }

  // ── POST /api/courses/:id/audio-files ─────────────────
  if (m === 'POST' && rest === '/audio-files') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let data;
      try { data = JSON.parse(body); } catch (e) { return error(res, 'Invalid JSON'); }
      const { sub, filename, data: base64, chunks, chunkIdx, end } = data;
      if (!['narration', 'vocab', 'video'].includes(sub)) return error(res, 'Invalid sub directory');
      if (!filename) return error(res, 'Missing filename');

      const subDir = path.join(courseDir, 'audio', sub);
      if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
      const filePath = path.join(subDir, filename);

      // ── Chunked upload ──────────────────────────
      if (Array.isArray(chunks)) {
        // Write this chunk to a temp part file
        const partPath = filePath + '.part.' + chunkIdx;
        const buf = Buffer.from(chunks[0], 'base64');
        fs.writeFileSync(partPath, buf);
        if (!end) return json(res, { ok: true, chunkIdx });

        // Last chunk: assemble all parts into final file, then delete parts
        try {
          const totalChunks = parseInt(data.totalChunks || (chunkIdx + 1), 10);
          const finalBuf = Buffer.concat(
            Array.from({ length: totalChunks }, (_, i) => {
              const p = filePath + '.part.' + i;
              const b = fs.readFileSync(p);
              try { execSync('del "' + p + '"', { stdio: 'pipe' }); } catch (_) {}
              return b;
            })
          );
          fs.writeFileSync(filePath, finalBuf);
        } catch (e) {
          return error(res, 'Failed to assemble chunks: ' + e.message);
        }
        return json(res, { path: `${sub}/${filename}` }, 201);
      }

      // ── Single-shot upload (small files) ───────
      if (!base64) return error(res, 'Missing filename or data');
      const buf = Buffer.from(base64, 'base64');
      fs.writeFileSync(filePath, buf);
      return json(res, { path: `${sub}/${filename}` }, 201);
    });
    return;
  }

  // ── GET /api/courses/:id/unconfigured ─────────────────
  if (m === 'GET' && rest === '/unconfigured') {
    const slidesDir = path.join(courseDir, 'slides');
    if (!fs.existsSync(slidesDir)) return json(res, []);
    const allFiles = fs.readdirSync(slidesDir).filter(f => f.endsWith('.html'));
    const configuredIndices = new Set((readCourseJson(courseDir).slides || []).map(s => s.index));
    const unconfigured = allFiles
      .filter(f => {
        const n = parseInt(f.replace('.html', ''), 10);
        return isNaN(n) || !configuredIndices.has(n);
      })
      .map(f => ({ name: f, index: parseInt(f.replace('.html', ''), 10) || null }));
    return json(res, unconfigured);
  }

  // ── POST /api/courses/:id/unconfigured/:name/import ───
  const importMatch = rest.match(/^\/unconfigured\/([^/]+)\/import$/);
  if (m === 'POST' && importMatch) {
    const originalName = decodeURIComponent(importMatch[1]);
    const slidesDir = path.join(courseDir, 'slides');
    const originalPath = path.join(slidesDir, originalName);
    if (!fs.existsSync(originalPath)) return error(res, 'File not found', 404);

    const course = readCourseJson(courseDir);
    const maxIndex = course.slides.length
      ? Math.max(...course.slides.map(s => s.index))
      : 0;
    const newIndex = maxIndex + 1;
    const newPath = path.join(slidesDir, `${newIndex}.html`);

    fs.renameSync(originalPath, newPath);

    const entry = templates.buildSlideEntry('content', newIndex);
    course.slides.push(entry);
    course.slides.sort((a, b) => a.index - b.index);
    writeCourseJson(courseDir, course);

    return json(res, entry, 201);
  }

  return false; // not handled, fall through
}

module.exports = { handleApi };