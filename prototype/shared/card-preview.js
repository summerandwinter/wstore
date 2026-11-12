import { publicResources, productionFonts, fontStackForFamily } from '../../runtime/public-resources.js';
import { layoutCard as sharedLayoutCard } from '../../runtime/rendering/layout.js';
import { readableCard, READABLE_FONT_FAMILY } from '../../runtime/rendering/readable.js';
import { cardSkeleton, measureSkeletonText, skeletonLayout as sharedSkeletonLayout, skeletonColor as blend } from '../../runtime/rendering/skeleton.js';
export { READABLE_FONT_FAMILY };
let catalogRequest;
let rendererRequest;
let skeletonRequest;
const renderVersions = new WeakMap();
const presentations = new WeakMap();
const readableResizes = new WeakMap();
const displayedPreviews = new WeakMap();
const fontSubscriptions = new WeakMap();
const fontListeners = new Map();
let presentationGeneration = 0;
export async function loadCatalog() {
  if (!catalogRequest) {
    const pending = Promise.all([import('../../runtime/card-catalog.js'), publicResources.catalog()]).then(([{ templateDefinitions }, resources]) => {
      if (!Array.isArray(templateDefinitions) || new Set(templateDefinitions.map(row => row.id)).size !== templateDefinitions.length) throw new Error('共享目录格式不正确。');
      const ids = new Set(resources.fonts.map(row => row.id));
      if (templateDefinitions.some(row => [row.recommendedFont, row.longTextFont, ...(row.recommendedFonts || [])].filter(Boolean).some(id => !ids.has(id)))) throw new Error('版式推荐字体不在正式目录。');
      return { templates: templateDefinitions, fonts: resources.fonts.map(font => ({ ...font, licenseUrl: resources.documents.fonts.fonts.find(row => row.id === font.id)?.licenseUrl })), imagery: resources.imagery };
    });
    catalogRequest = pending;
    pending.catch(() => { if (catalogRequest === pending) catalogRequest = undefined; });
  }
  return catalogRequest;
}
// Candidates stay archived; never download or activate proposal/sample fonts.
export async function loadProposalFonts() { return []; }
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
export const backgroundImage = id => publicResources.resolve(`backgrounds/${['mist', 'sea', 'dusk'].includes(id) ? id : 'mist'}.png`);
export const resolveImage = id => publicResources.resolveImage(id);
export const resourceUrl = path => publicResources.resolve(path);
export async function loadPreviewFont(fontId, text = '') {
  const family = await productionFonts.ensureFont(fontId);
  const result = { family, state: productionFonts.stateFor(fontId, text), notice: productionFonts.noticeFor(fontId, text) };
  if (family) for (const listener of [...(fontListeners.get(fontId) || [])]) listener();
  return result;
}
export function previewFrame(attributes = '', label = '卡片预览') {
  return `<span class="card-preview" data-card-frame data-phase="loading" data-show-loading-hints="false" aria-busy="true"><canvas class="card-skeleton-layer" data-card-skeleton width="1080" height="1440" aria-hidden="true"></canvas><span class="card-readable" data-card-readable aria-hidden="true"></span><span class="card-result-layer" data-card-result-layer><canvas class="preview-canvas card-result" data-card-result ${attributes} width="1080" height="1440" role="img" aria-label="${escapeHTML(label)}" aria-hidden="true"></canvas></span><span class="card-readable-note" data-card-readable-note hidden>先读文字 · 原版准备中</span><span class="card-failure" data-card-error hidden></span></span>`;
}
/** Visibility only: keep this preference out of render inputs, timers and preview identities. */
export function setCardLoadingHints(frame, enabled = false) {
  frame.dataset.showLoadingHints = String(enabled === true);
  const note = frame.querySelector('[data-card-readable-note]');
  if (note) note.hidden = enabled !== true || frame.dataset.phase !== 'readable';
}
/** Shared physical-pixel projection only; image slots keep their fill until the original painter is ready. */
export function readableMarkup(card, options) {
  const projection = readableCard(card, options);
  return `<span class="card-readable-sheet" style="width:${projection.width}px;height:${projection.height}px;background:${escapeHTML(projection.background)};font-family:${escapeHTML(projection.fontFamily)}">${projection.layers.map(layer => `<span class="card-readable-layer" data-readable-kind="${layer.kind}" style="${escapeHTML(layer.style)}">${escapeHTML(layer.text)}</span>`).join('')}</span>`;
}
function prepareReadable(frame, card, options) {
  const layer = frame.querySelector('[data-card-readable]');
  if (!layer) return;
  layer.innerHTML = readableMarkup(card, options);
  const sheet = layer.firstElementChild;
  const fit = () => {
    if (frame.isConnected !== false && sheet) layer.style.setProperty('--card-readable-scale', String(frame.getBoundingClientRect().width / parseFloat(sheet.style.width)));
  };
  fit();
  readableResizes.get(frame)?.disconnect();
  if (globalThis.ResizeObserver) {
    const observer = new ResizeObserver(fit);
    observer.observe(frame); readableResizes.set(frame, observer);
  }
}
/** No per-template map, fonts, images or Canvas: generated lazily by the export selector. */
export function skeletonPreview(card, options) {
  const skeleton = cardSkeleton(sharedLayoutCard(card, { ...options, fontId: 'system' }, measureSkeletonText));
  return `<span class="card-template-skeleton" aria-hidden="true" style="background:${escapeHTML(skeleton.background)}">${skeleton.shapes.map(shape => `<span style="${escapeHTML(shape.style)}"></span>`).join('')}</span>`;
}
export function createLoadingPresentation(frame, { mode = 'auto', reduceMotion = false, onReadable, retain = false, paused = false } = {}) {
  const previous = presentations.get(frame);
  const inheritedPauses = previous?.pauseReasons() || [];
  previous?.cancel();
  const generation = ++presentationGeneration;
  const reduced = reduceMotion || Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const result = frame.querySelector('[data-card-result]');
  const readable = frame.querySelector('[data-card-readable]');
  const note = frame.querySelector('[data-card-readable-note]');
  const error = frame.querySelector('[data-card-error]');
  const document = frame.ownerDocument || globalThis.document;
  const pauses = new Set([...inheritedPauses, ...(paused ? ['demo'] : [])]);
  let cancelled = false, failed = false, revealing = false, readableShown = false;
  let waited = 0, waitingSince, timer, animation, cycle = 0, touch;
  let readableValue, finalValue, beforeReveal, readyTask, resolveReady, rejectReady;
  const current = () => !cancelled && frame.isConnected !== false && presentations.get(frame) === view;
  const visible = () => current() && !document?.hidden && !frame.hidden && !frame.closest?.('[hidden]');
  const allowed = () => visible() && pauses.size === 0;
  const elapsed = () => waited + (waitingSince === undefined ? 0 : Math.max(0, Date.now() - waitingSince));
  function clearTimer() { clearTimeout(timer); timer = undefined; }
  function trackWaiting() {
    if (waitingSince !== undefined) waited += Math.max(0, Date.now() - waitingSince);
    waitingSince = visible() && !revealing && !retain && frame.dataset.phase !== 'ready' ? Date.now() : undefined;
  }
  function stopAnimation() {
    const token = animation;
    if (!token) return;
    clearTimeout(token.timer);
    if (token.raf !== undefined) globalThis.cancelAnimationFrame?.(token.raf);
    token.layer.removeEventListener('animationstart', token.start);
    token.layer.removeEventListener('animationend', token.end);
    token.layer.style.animationPlayState = 'paused';
    animation = undefined;
  }
  function stopPending() {
    clearTimer(); stopAnimation(); waitingSince = undefined;
    readableResizes.get(frame)?.disconnect(); readableResizes.delete(frame);
  }
  function phase(value) {
    frame.dataset.phase = value;
    frame.setAttribute('aria-busy', String(['loading', 'readable', 'revealing'].includes(value)));
    result?.setAttribute('aria-hidden', String(!['revealing', 'ready'].includes(value)));
    readable?.setAttribute('aria-hidden', String(value !== 'readable'));
    if (note) note.hidden = value !== 'readable' || frame.dataset.showLoadingHints !== 'true';
  }
  function finish() {
    if (!allowed() || failed) return;
    phase('ready'); revealing = false; stopPending();
    resolveReady?.(true);
  }
  function matches(token) {
    return current() && revealing && animation === token && token.layer === frame.querySelector('[data-card-result-layer]') &&
      frame.dataset.generation === String(token.generation) && frame.dataset.revealCycle === String(token.cycle);
  }
  function armWatchdog(token) {
    if (!matches(token) || !token.acknowledged || !allowed() || token.timer !== undefined) return;
    token.since = Date.now();
    token.timer = setTimeout(() => {
      token.timer = undefined;
      if (!matches(token)) return;
      if (!allowed()) { sync(); return; }
      finish();
    }, Math.max(0, token.remaining));
  }
  function pauseAnimation() {
    const token = animation;
    if (!token || token.paused) return;
    if (token.playingSince !== undefined) token.played = Math.min(240, token.played + Math.max(0, Date.now() - token.playingSince));
    if (token.since !== undefined) token.remaining = Math.max(0, token.remaining - Math.max(0, Date.now() - token.since));
    token.playingSince = token.since = undefined;
    clearTimeout(token.timer); token.timer = undefined; token.paused = true;
    token.layer.style.animationPlayState = 'paused';
  }
  function startAnimation(previous) {
    stopAnimation();
    // A fresh wrapper owns each generation/cycle; a queued event on the old node cannot acknowledge it.
    const old = frame.querySelector('[data-card-result-layer]');
    const layer = document.createElement('span');
    layer.className = 'card-result-layer'; layer.dataset.cardResultLayer = '';
    layer.dataset.generation = String(generation); layer.dataset.revealCycle = String(++cycle);
    layer.append(result); old.replaceWith(layer);
    frame.dataset.revealCycle = String(cycle);
    const token = { generation, cycle, layer, acknowledged: false, started: false, completed: false, paused: false,
      played: previous?.played || 0, remaining: previous?.remaining ?? 1000 };
    animation = token;
    layer.style.animationDelay = `${-token.played}ms`;
    layer.style.animationPlayState = 'running';
    token.start = event => {
      if (!matches(token) || event.target !== layer || event.animationName !== 'card-result-reveal' || !visible() || token.started) return;
      token.started = true; token.acknowledged = true;
      // A late real start receives its own conservative budget, never a logical 240ms completion.
      token.remaining = Math.max(token.remaining, 1000);
      clearTimeout(token.timer); token.timer = undefined;
      if (!token.paused) token.playingSince = Date.now();
      armWatchdog(token);
    };
    token.end = event => {
      if (!matches(token) || event.target !== layer || event.animationName !== 'card-result-reveal' || !token.started || !visible()) return;
      token.completed = true;
      if (allowed()) finish();
    };
    layer.addEventListener('animationstart', token.start);
    layer.addEventListener('animationend', token.end);
    phase('revealing');
    const submitted = () => {
      token.raf = undefined;
      if (!matches(token) || token.acknowledged) return;
      token.acknowledged = true; armWatchdog(token);
    };
    // The DOM is mounted before this view receipt. Hidden documents pause rAF and the watchdog together.
    if (globalThis.requestAnimationFrame) token.raf = requestAnimationFrame(submitted);
    else token.timer = setTimeout(() => { token.timer = undefined; submitted(); }, 0);
  }
  function schedule() {
    clearTimer();
    if (!visible() || failed || revealing || mode === 'hold' || frame.dataset.phase === 'ready') return;
    const deadlines = [];
    if (readableValue && !readableShown && !retain) deadlines.push(900 - elapsed());
    if (finalValue && allowed()) {
      const delay = mode === 'slow' ? 2400 : ['replay', 'error'].includes(mode) ? 1100 : 0;
      deadlines.push(delay - elapsed());
    }
    if (deadlines.length) timer = setTimeout(() => { timer = undefined; sync(); }, Math.max(0, Math.min(...deadlines)));
  }
  function sync() {
    trackWaiting();
    if (!current()) { view.cancel(); return; }
    if (failed) { stopPending(); return; }
    if (revealing) {
      if (!allowed()) pauseAnimation();
      else if (animation?.completed) finish();
      else if (animation?.paused) startAnimation(animation);
      return;
    }
    if (!visible() || mode === 'hold' || frame.dataset.phase === 'ready' && !retain) { schedule(); return; }
    const delay = mode === 'slow' ? 2400 : ['replay', 'error'].includes(mode) ? 1100 : 0;
    if (finalValue && allowed() && elapsed() >= delay) {
      clearTimer();
      if (mode === 'error') { view.fail('卡片暂未准备好 · 失败演示', finalValue); return; }
      frame.dataset.revealFrom = retain ? 'ready' : readableShown ? 'readable' : 'loading';
      try { beforeReveal?.(); } catch (cause) { stopPending(); rejectReady?.(cause); return; }
      if (!current() || failed) return;
      finalValue = undefined;
      if (retain || readableShown || reduced || mode === 'instant' || mode === 'auto' && elapsed() < 100) finish();
      else { revealing = true; waitingSince = undefined; startAnimation(); }
      return;
    }
    if (readableValue && !readableShown && !retain && elapsed() >= 900) {
      onReadable?.(readableValue);
      if (!current() || failed) return;
      readableShown = true; phase('readable');
    }
    schedule();
  }
  const visibilityChanged = () => { sync(); };
  const pointerDown = event => { touch = event.pointerId; view.setPaused(true, 'touch'); };
  const pointerUp = event => { if (touch !== undefined && event.pointerId !== touch) return; touch = undefined; view.setPaused(false, 'touch'); };
  const view = {
    current,
    pauseReasons: () => [...pauses],
    readable(card) { readableValue = card; sync(); return readableShown; },
    ready(card, commit) {
      if (!current() || failed || mode === 'hold') return Promise.resolve(false);
      if (readyTask) return readyTask;
      readyTask = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
      finalValue = card; beforeReveal = commit; sync();
      return readyTask;
    },
    setPaused(value, reason = 'demo') {
      if (value) pauses.add(reason); else pauses.delete(reason);
      frame.dataset.animationPaused = String(pauses.size > 0);
      sync();
    },
    fail(message, card) {
      if (!current()) return;
      failed = true; stopPending(); resolveReady?.(false);
      if (retain) return;
      phase('error');
      if (error) {
        const text = card?.text ? `<span class="card-failure-quote">${escapeHTML(card.text)}</span><span class="card-failure-source">${escapeHTML([card.author, card.source].filter(Boolean).join(' · '))}</span>` : '';
        error.innerHTML = `${text}<span class="card-failure-notice">${escapeHTML(message)}</span>`;
        error.hidden = false;
      }
    },
    cancel() {
      cancelled = true; stopPending(); resolveReady?.(false);
      document?.removeEventListener('visibilitychange', visibilityChanged);
      document?.removeEventListener('pointerup', pointerUp);
      document?.removeEventListener('pointercancel', pointerUp);
      frame.removeEventListener('pointerdown', pointerDown);
      if (presentations.get(frame) === view) presentations.delete(frame);
    },
  };
  presentations.set(frame, view);
  frame.dataset.generation = String(generation); frame.dataset.revealCycle = '0';
  frame.dataset.reducedMotion = String(reduced); frame.dataset.animationPaused = String(pauses.size > 0);
  frame.dataset.revealFrom = retain ? 'ready' : 'loading';
  if (error) error.hidden = true;
  phase(retain ? 'ready' : 'loading');
  document?.addEventListener('visibilitychange', visibilityChanged);
  document?.addEventListener('pointerup', pointerUp);
  document?.addEventListener('pointercancel', pointerUp);
  frame.addEventListener('pointerdown', pointerDown);
  trackWaiting();
  return view;
}
export function setCardPreviewPaused(canvas, paused, reason = 'demo') {
  const frame = canvas?.closest?.('[data-card-frame]');
  if (frame) presentations.get(frame)?.setPaused(paused === true, reason);
}
export function cancelCardPreview(canvas) {
  if (!canvas) return;
  fontSubscriptions.get(canvas)?.(); fontSubscriptions.delete(canvas);
  renderVersions.set(canvas, (renderVersions.get(canvas) || 0) + 1);
  const frame = canvas.closest?.('[data-card-frame]');
  if (frame) presentations.get(frame)?.cancel();
}
function watchPreviewFont(canvas, fontId, listener) {
  const listeners = fontListeners.get(fontId) || new Set();
  listeners.add(listener); fontListeners.set(fontId, listeners);
  fontSubscriptions.set(canvas, () => {
    listeners.delete(listener);
    if (!listeners.size) fontListeners.delete(fontId);
  });
}
function skeletonRenderer() {
  if (!skeletonRequest) {
    const pending = Promise.all([import('../../runtime/rendering/layout.js'), import('../../runtime/rendering/painter.js')]);
    skeletonRequest = pending;
    pending.catch(() => { if (skeletonRequest === pending) skeletonRequest = undefined; });
  }
  return skeletonRequest;
}
/** The production painter owns all image paths, paper layers and rotations; only its text ink becomes bars. */
export function paintSkeletonLayout(canvas, layout, paint) {
  canvas.width = layout.width; canvas.height = layout.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建骨架画布');
  const paper = layout.template.background, ink = layout.template.muted;
  const skeleton = sharedSkeletonLayout(layout);
  const blocks = [layout.body, layout.attribution, layout.date, layout.dateMeta, layout.brand, ...layout.decorations.filter(row => row.kind === 'text').map(row => row.block)].filter(Boolean);
  const vertical = new Set(blocks.flatMap(block => (block.columns || []).flatMap(column => column.glyphs.map(glyph => `${glyph.x}:${glyph.y}`))));
  const adapter = new Proxy(context, {
    get(target, key) {
      if (key === 'fillText') return (text, x, y) => {
        if (!String(text).trim()) return;
        const size = parseFloat(target.font) || 40, upright = vertical.has(`${x}:${y}`);
        const width = upright ? size * .34 : Math.max(size * .32, target.measureText(text).width);
        const height = upright ? size * .76 : Math.max(8, size * .3);
        const left = upright ? x + size * .33 : x - (target.textAlign === 'center' ? width / 2 : target.textAlign === 'right' ? width : 0);
        target.fillStyle = blend(paper, ink, size >= 40 ? .32 : .22);
        target.beginPath();
        target.roundRect(left, y + size * .25, width, height, Math.min(height, width) / 2);
        target.fill();
      };
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, key, value) { return Reflect.set(target, key, value, target); },
  });
  paint(adapter, skeleton);
  canvas.dataset.template = layout.template.id;
  canvas.dataset.direction = layout.body.direction;
  canvas.dataset.variant = layout.template.variant || 'default';
  const frame = canvas.closest?.('[data-card-frame]');
  frame?.style.setProperty('--card-paper', paper);
  frame?.style.setProperty('--card-ink', layout.template.color);
  frame?.style.setProperty('--card-muted', ink);
}
function prepareSkeleton(canvas, card, options, family, layoutCard, paint) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建骨架画布');
  const stack = value => family && value.startsWith(`"${family}",`) ? fontStackForFamily(family) : value;
  const layout = layoutCard(card, options, (text, size, font) => {
    context.font = `${size}px ${stack(font)}`;
    return context.measureText(text).width;
  }, family);
  const applyStack = value => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.fontFamily === 'string') value.fontFamily = stack(value.fontFamily);
    for (const child of Object.values(value)) if (child && typeof child === 'object') applyStack(child);
  };
  applyStack(layout);
  paintSkeletonLayout(canvas, layout, paint);
}
/** Opt-in presentation for reader/cards only; studio keeps its original four-argument preview contract. */
export async function paintPreview(canvas, card, options, status, presentation) {
  fontSubscriptions.get(canvas)?.(); fontSubscriptions.delete(canvas);
  const version = (renderVersions.get(canvas) || 0) + 1;
  renderVersions.set(canvas, version);
  const frame = presentation ? canvas.closest?.('[data-card-frame]') : null;
  const key = JSON.stringify([card, options]);
  const previous = displayedPreviews.get(canvas);
  const retain = Boolean(frame && previous?.key === key && frame.dataset.phase === 'ready' && ['auto', 'instant'].includes(presentation.mode || 'auto'));
  const feedback = (message, loadingHint = false) => {
    if (!status) return;
    status.textContent = message;
    // Only reader-owned hint nodes opt in; cards diagnostics and the studio contract stay explicit.
    if (status.dataset?.loadingHint !== undefined) {
      status.dataset.loadingHint = String(loadingHint);
      status.hidden = loadingHint && frame?.dataset.showLoadingHints !== 'true';
    }
  };
  const view = frame ? createLoadingPresentation(frame, { ...presentation, onReadable: value => {
    feedback('先读文字 · 原版准备中', true);
    presentation.onReadable?.(value);
  }, retain }) : null;
  const current = () => renderVersions.get(canvas) === version && (!view || view.current());
  if (view && !retain) canvas.dataset.renderState = 'loading';
  if (!retain) feedback('正在加载正式 TTF 与同源排版…', true);
  let candidate;
  try {
    let skeleton, layoutCard, paintCardLayout;
    if (view) {
      if (!retain) { prepareReadable(frame, card, options); view.readable(card); }
      [{ layoutCard }, { paintCardLayout }] = await skeletonRenderer();
      if (!current()) return null;
      skeleton = frame.querySelector('[data-card-skeleton]');
      if (!retain) {
        // A cold font has provisional metrics. The exact loaded layout replaces it before the reveal.
        try { prepareSkeleton(skeleton, card, options, productionFonts.familyFor(options.fontId), layoutCard, paintCardLayout); }
        catch { frame.dataset.geometry = 'pending'; }
      }
    }
    const font = await loadPreviewFont(options.fontId, card.text);
    if (!current()) return null;
    if (view && !retain) { prepareSkeleton(skeleton, card, options, font.family, layoutCard, paintCardLayout); frame.dataset.geometry = 'measured'; }
    if (!rendererRequest) {
      const pending = import('../../runtime/browser-canvas.js');
      rendererRequest = pending;
      pending.catch(() => { if (rendererRequest === pending) rendererRequest = undefined; });
    }
    const { drawCard } = await rendererRequest;
    const imagePath = card.imageId ? await resolveImage(card.imageId) : card.imagePath || backgroundImage(card.background);
    if (!current()) return null;
    if (view) {
      // The shared renderer draws text before its image finishes. Keep that partial canvas off the displayed layer.
      candidate = (frame.ownerDocument || document).createElement('canvas');
      candidate.hidden = true; candidate.setAttribute('aria-hidden', 'true'); frame.append(candidate);
    }
    const result = await drawCard(candidate || canvas, { ...card, imagePath }, options, font.family);
    if (!current() || result.imageState === 'stale') return null;
    if (retain && (result.imageState !== 'ready' || !['system', 'loaded', 'partial'].includes(font.state))) {
      feedback('原版候选暂未准备好，保留当前可读图；可重试。');
      return { ...previous.result, displayReady: true };
    }
    const commit = () => {
      if (candidate) {
        const context = canvas.getContext('2d');
        if (!context) throw new Error('无法提交预览画布');
        // Copy the fully painted bitmap in one synchronous task; no fallback/original glyph overlap.
        canvas.width = candidate.width; canvas.height = candidate.height;
        context.drawImage(candidate, 0, 0);
      }
      if (view) {
        paintSkeletonLayout(skeleton, result, paintCardLayout);
        frame.dataset.fontState = font.state; frame.dataset.imageState = result.imageState;
      }
      canvas.dataset.template = result.template.id;
      canvas.dataset.fontState = font.state; canvas.dataset.renderState = 'ready';
    };
    if (!view) commit();
    const displayReady = view ? await view.ready(card, commit) : true;
    if (!current()) return null;
    if (view && frame.dataset.phase === 'error') {
      canvas.dataset.renderState = 'error';
      feedback('加载失败 · 演示状态；正文仍可阅读，可重试。');
      return null;
    }
    const output = view ? { ...result, displayReady } : result;
    if (view && displayReady) displayedPreviews.set(canvas, { key, result: output });
    feedback(`${view && !displayReady ? '骨架停留 · 演示状态 · ' : ''}${font.notice} · 1080 × 1440${result.imageState === 'failed' ? ' · 配图未加载，当前显示底色' : ' · 同源画布'}${result.fallback ? ` · ${result.fallback.message}` : ''}`, Boolean(view && !displayReady));
    if (view && displayReady) presentation.onReady?.(output);
    if (view && displayReady && font.state === 'fallback') {
      const upgrade = () => {
        if (!current() || !productionFonts.familyFor(options.fontId)) return;
        void paintPreview(canvas, card, options, status, { ...presentation, mode: 'auto' });
      };
      watchPreviewFont(canvas, options.fontId, upgrade);
      // A different mounted preview may have completed the same font while this candidate was rendering.
      upgrade();
    }
    return output;
  } catch (error) {
    if (!current()) return null;
    if (retain) {
      feedback(`原版候选未就绪，保留当前可读图：${error.message}`);
      return { ...previous.result, displayReady: true };
    }
    canvas.dataset.renderState = 'error';
    view?.fail(`卡片暂未准备好：${error.message}`, card);
    feedback(`无法生成预览：${error.message}。不会用独立示意图冒充渲染结果。`);
    return null;
  } finally { candidate?.remove(); }
}
export function bindTheme() {
  const query = new URLSearchParams(location.search);
  document.documentElement.dataset.theme = query.get('theme') === 'dark' ? 'dark' : 'light';
  document.querySelector('[data-theme-toggle]')?.addEventListener('click', event => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    event.currentTarget.setAttribute('aria-pressed', String(dark));
    const url = new URL(location.href);
    url.searchParams.set('theme', dark ? 'dark' : 'light');
    history.replaceState(null, '', url);
  });
}
export function wireDialog(dialog) {
  let previous;
  return {
    open() { previous = document.activeElement; dialog.showModal(); },
    close() { dialog.close(); if (previous?.isConnected) previous.focus(); },
  };
}
