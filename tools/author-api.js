/**
 * author-api.js — HTTP API 路由层
 * 挂载到 serve.js，处理所有 /api/* 请求
 *
 * 模块结构：
 *   Helper 函数        — 响应封装、课程读写、路径工具
 *   课程管理 API       — 增删改查课程
 *   幻灯片管理 API     — 增删改重排、HTML 读写
 *   文件上传 API       — audio / pptimg 单文件及分块上传
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const templates = require('../js/templates.js');

// 项目根目录（hsk-player/）
const ROOT = path.resolve(__dirname, '..');

/* ═══ Helper 函数 ═══════════════════════════════════════ */

/**
 * 统一 JSON 响应
 * @param {http.ServerResponse} res
 * @param {*} data 返回数据
 * @param {number} status HTTP 状态码，默认 200
 */
function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

/**
 * 统一错误响应
 * @param {http.ServerResponse} res
 * @param {string} message 错误信息
 * @param {number} status HTTP 状态码，默认 400
 */
function error(res, message, status = 400) {
  json(res, { error: message }, status);
}

/** 从 course.json 读取课程数据 */
function readCourseJson(courseDir) {
  const p = path.join(courseDir, 'course.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** 将数据写回 course.json */
function writeCourseJson(courseDir, data) {
  const p = path.join(courseDir, 'course.json');
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * 防御路径穿越：确保 userInput 不会逃出 base 目录
 * @param {string} base 基础目录
 * @param {string} userInput 用户输入的路径
 * @returns {string|null} 合法路径，或 null（检测到穿越）
 */
function safePath(base, userInput) {
  const resolved = path.join(base, userInput);
  if (!resolved.startsWith(base)) return null; // path traversal 攻击
  return resolved;
}

/** 根据课程 id 返回课程目录路径 */
function getCourseDir(courseId) {
  return path.join(ROOT, 'courses', courseId);
}

/** 检查课程是否存在（course.json 是否存在） */
function courseExists(courseId) {
  return fs.existsSync(path.join(getCourseDir(courseId), 'course.json'));
}

/** 生成下一个 vocab id，例如已有 w1/w3 则返回 w4 */
function nextVocabId(vocab) {
  const nums = vocab
    .map(v => parseInt(v.id.replace(/^w/, ''), 10))
    .filter(n => !isNaN(n));
  return 'w' + ((nums.length ? Math.max(...nums) : 0) + 1);
}

/* ═══ API 路由入口 ═══════════════════════════════════════ */

/**
 * handleApi — 路由分发入口
 * @param {http.ServerRequest} req
 * @param {http.ServerResponse} res
 * @param {string} urlPath 去掉域名的路径部分，如 /api/courses/1/slides
 */
function handleApi(req, res, urlPath) {
  // 允许跨域（开发环境）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const m = req.method;
  const u = urlPath;

  /* ═══ GET /api/courses — 列出所有课程 ════════════════ */
  if (m === 'GET' && u === '/api/courses') {
    const coursesDir = path.join(ROOT, 'courses');
    if (!fs.existsSync(coursesDir)) return json(res, []);
    const dirs = fs.readdirSync(coursesDir).filter(f =>
      fs.statSync(path.join(coursesDir, f)).isDirectory()
    );
    const courses = dirs.map(id => {
      const jsonPath = path.join(coursesDir, id, 'course.json');
      if (!fs.existsSync(jsonPath)) return null;
      try {
        const c = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        return { id, title: c.title || id, description: c.description || '',
                 author: c.author || '', slideCount: (c.slides || []).length };
      } catch (_) { return null; }
    }).filter(Boolean);
    return json(res, courses);
  }

  /* ═══ POST /api/courses — 创建新课程 ════════════════ */
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

      // 创建课程目录结构
      fs.mkdirSync(path.join(courseDir, 'slides'), { recursive: true });
      fs.mkdirSync(path.join(courseDir, 'audio', 'narration'), { recursive: true });
      fs.mkdirSync(path.join(courseDir, 'audio', 'vocab'), { recursive: true });
      fs.mkdirSync(path.join(courseDir, 'audio', 'video'), { recursive: true });
      fs.mkdirSync(path.join(courseDir, 'audio', 'exercises'), { recursive: true });
      fs.mkdirSync(path.join(courseDir, 'pptimg'), { recursive: true });

      const courseJson = {
        id, title: title || id, description: description || '',
        author: 'teacher', created: new Date().toISOString().slice(0, 10), slides: [],
      };
      writeCourseJson(courseDir, courseJson);

      // 同时写入第 1 页占位幻灯片
      const slideHtml = templates.contentTemplate(1, courseJson.title);
      fs.writeFileSync(path.join(courseDir, 'slides', '1.html'), slideHtml, 'utf8');
      courseJson.slides.push(templates.buildSlideEntry('content', 1));
      writeCourseJson(courseDir, courseJson);

      return json(res, courseJson, 201);
    });
    return;
  }

  // 解析课程级别路由：/api/courses/:id/...
  const courseMatch = u.match(/^\/api\/courses\/([^/]+)(\/.*)?$/);
  if (!courseMatch) return false; // 非 API 路由，透传给静态文件处理
  const courseId = courseMatch[1];
  const rest = courseMatch[2] || '';
  const courseDir = getCourseDir(courseId);
  if (!courseExists(courseId)) return error(res, 'Course not found', 404);

  /* ═══ GET /api/courses/:id — 获取课程完整 JSON ══════ */
  if (m === 'GET' && rest === '') {
    return json(res, readCourseJson(courseDir));
  }

  /* ═══ PATCH /api/courses/:id — 修改课程标题/描述 ═══ */
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

  /* ═══ DELETE /api/courses/:id — 删除整门课程 ════════ */
  if (m === 'DELETE' && rest === '') {
    execSync(`rmdir /s /q "${courseDir}"`, { stdio: 'pipe' });
    return json(res, { ok: true }, 204);
  }

  /* ═══ GET /api/courses/:id/slides — 幻灯片列表 ═══════ */
  if (m === 'GET' && rest === '/slides') {
    return json(res, readCourseJson(courseDir).slides || []);
  }

  /* ═══ POST /api/courses/:id/slides — 新增幻灯片 ══════ */
  if (m === 'POST' && rest === '/slides') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let data;
      try { data = JSON.parse(body); } catch (e) { return error(res, 'Invalid JSON'); }
      const { type, index } = data;
      if (!['content', 'exercise', 'display', 'video'].includes(type))
        return error(res, 'Invalid slide type');

      const course = readCourseJson(courseDir);
      // 默认插入到末尾，index 冲突时顺移后续幻灯片
      let targetIndex = index || (course.slides.length
        ? Math.max(...course.slides.map(s => s.index)) + 1 : 1);

      if (course.slides.find(s => s.index === targetIndex)) {
        const slidesDir = path.join(courseDir, 'slides');
        course.slides.filter(s => s.index >= targetIndex).forEach(s => {
          const oldPath = path.join(slidesDir, `${s.index}.html`);
          const newPath = path.join(slidesDir, `${s.index + 1}.html`);
          if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
          s.index++;
        });
      }

      // 写入对应类型的 HTML 模板
      const slidesDir = path.join(courseDir, 'slides');
      let html;
      if (type === 'exercise') html = templates.exerciseTemplate(targetIndex, course.title || courseId);
      else if (type === 'video') html = templates.videoTemplate(targetIndex, course.title || courseId);
      else if (type === 'display') html = templates.displayTemplate(targetIndex, course.title || courseId);
      else html = templates.contentTemplate(targetIndex, course.title || courseId);
      fs.writeFileSync(path.join(slidesDir, `${targetIndex}.html`), html, 'utf8');

      // 插入课程 JSON 并按 index 排序
      const entry = templates.buildSlideEntry(type, targetIndex);
      if (type === 'content') entry.title = `第 ${targetIndex} 页`;
      course.slides.push(entry);
      course.slides.sort((a, b) => a.index - b.index);
      writeCourseJson(courseDir, course);
      return json(res, entry, 201);
    });
    return;
  }

  // 解析幻灯片级别路由：/api/courses/:id/slides/:index/...
  const slideMatch = rest.match(/^\/slides\/(\d+)(\/.*)?$/);
  if (slideMatch) {
    const slideIndex = parseInt(slideMatch[1], 10);
    const slideRest = slideMatch[2] || '';
    const course = readCourseJson(courseDir);
    const slide = course.slides.find(s => s.index === slideIndex);
    if (!slide) return error(res, 'Slide not found', 404);

    /* ═══ PATCH /api/courses/:id/slides/:index — 修改幻灯片字段 ══ */
    if (m === 'PATCH' && slideRest === '') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        let data;
        try { data = JSON.parse(body); } catch (e) { return error(res, 'Invalid JSON'); }
        const slideIdx = course.slides.findIndex(s => s.index === slideIndex);
        if (slideIdx === -1) return error(res, 'Slide not found', 404);
        // 合并字段（title, audio, subtitles, spotlights, questions, vocab 等）
        Object.assign(course.slides[slideIdx], data);
        writeCourseJson(courseDir, course);
        return json(res, course.slides[slideIdx]);
      });
      return;
    }

    /* ═══ DELETE /api/courses/:id/slides/:index — 删除幻灯片 ══ */
    if (m === 'DELETE' && slideRest === '') {
      const slidesDir = path.join(courseDir, 'slides');
      const htmlPath = path.join(slidesDir, `${slideIndex}.html`);
      if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);

      // 删除后后续幻灯片 index 前移
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

    /* ═══ POST /api/courses/:id/slides/:index/regenerate — 重新生成 HTML ══ */
    if (m === 'POST' && slideRest === '/regenerate') {
      const slide = course.slides.find(s => s.index === slideIndex);
      if (!slide) return error(res, 'Slide not found', 404);
      const slidesDir = path.join(courseDir, 'slides');
      let html;
      if (slide.type === 'exercise') html = templates.exerciseTemplate(slideIndex, course.title || courseId);
      else if (slide.type === 'video') html = templates.videoTemplate(slideIndex, course.title || courseId);
      else if (slide.type === 'display') html = templates.displayTemplate(slideIndex, course.title || courseId);
      else html = templates.contentTemplate(slideIndex, course.title || courseId);
      fs.writeFileSync(path.join(slidesDir, `${slideIndex}.html`), html, 'utf8');
      return json(res, { ok: true });
    }

    /* ═══ POST /api/courses/:id/slides/reorder — 拖拽重排顺序 ══ */
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

        // 从原位置移除
        course.slides = course.slides.filter(s => s.index !== fromIndex);

        // 受影响的幻灯片 index 顺移
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

      }

  /* ═══ GET /api/courses/:id/audio-files — 列出已上传的音频/图片文件 ══ */
  if (m === 'GET' && rest === '/audio-files') {
    const audioDir = path.join(courseDir, 'audio');
    const result = [];
    ['narration', 'vocab', 'video', 'exercises'].forEach(sub => {
      const subDir = path.join(audioDir, sub);
      if (!fs.existsSync(subDir)) return;
      fs.readdirSync(subDir).forEach(file =>
        result.push({ sub, file, path: `${sub}/${file}` })
      );
    });
    return json(res, result);
  }

  /* ═══ POST /api/courses/:id/audio-files — 上传音频或图片文件 ══
   *
   * 支持两种模式：
   *   - 单次上传：{ sub, filename, data: base64字符串 }
   *   - 分块上传：{ sub, filename, chunks: [base64], chunkIdx, totalChunks, end }
   *
   * sub 可选值：narration | vocab | video | exercises | pptimg
   *   narration/vocab/video → courses/<id>/audio/<sub>/<filename>
   *   pptimg              → courses/<id>/pptimg/<filename>
   */
  if (m === 'POST' && rest === '/audio-files') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let data;
      try { data = JSON.parse(body); } catch (e) { return error(res, 'Invalid JSON'); }
      const { sub, filename, data: base64, chunks, chunkIdx, end } = data;
      if (!['narration', 'vocab', 'video', 'exercises', 'pptimg'].includes(sub)) return error(res, 'Invalid sub directory');
      if (!filename) return error(res, 'Missing filename');

      const subDir = path.join(courseDir, sub === 'pptimg' ? 'pptimg' : 'audio', sub);
      if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
      const filePath = path.join(subDir, filename);

      // 分块上传：先将每块写入临时 .part.N 文件
      if (Array.isArray(chunks)) {
        const partPath = filePath + '.part.' + chunkIdx;
        fs.writeFileSync(partPath, Buffer.from(chunks[0], 'base64'));
        if (!end) return json(res, { ok: true, chunkIdx });

        // 最后一块：合并所有 .part.N 为最终文件，删除临时分片
        try {
          const total = parseInt(data.totalChunks || (chunkIdx + 1), 10);
          const buf = Buffer.concat(
            Array.from({ length: total }, (_, i) => {
              const p = filePath + '.part.' + i;
              const b = fs.readFileSync(p);
              try { execSync('del "' + p + '"', { stdio: 'pipe' }); } catch (_) {}
              return b;
            })
          );
          fs.writeFileSync(filePath, buf);
        } catch (e) { return error(res, 'Failed to assemble chunks: ' + e.message); }
        const prefix = sub === 'pptimg' ? 'pptimg/' : sub + '/';
        return json(res, { path: prefix + filename }, 201);
      }

      // 单次上传：直接写文件
      if (!base64) return error(res, 'Missing filename or data');
      fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
      const prefix = sub === 'pptimg' ? 'pptimg/' : sub + '/';
      return json(res, { path: prefix + filename }, 201);
    });
    return;
  }

  return false; // 未匹配任何路由，透传给静态文件服务器
}

module.exports = { handleApi };