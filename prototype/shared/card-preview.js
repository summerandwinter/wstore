import { publicResources, productionFonts, fontStackForFamily } from '../../runtime/public-resources.js';
import { fontCoverageText } from '../../runtime/font-coverage.js';
import { layoutCard as sharedLayoutCard } from '../../runtime/rendering/layout.js';
import { readableCard, READABLE_FONT_FAMILY } from '../../runtime/rendering/readable.js';
import { cardSkeleton, measureSkeletonText, skeletonLayout as sharedSkeletonLayout, skeletonColor as blend } from '../../runtime/rendering/skeleton.js';
export { READABLE_FONT_FAMILY };
let catalogRequest;
let rendererRequest;
let skeletonRequest;
let templateVisualConfigRequest;
let templateVisualApi;
let formalTemplateVisualConfig;
let activeTemplateVisualConfig;
let templateIds = [];
const renderVersions = new WeakMap();
const presentations = new WeakMap();
const readableResizes = new WeakMap();
const displayedPreviews = new WeakMap();
const fontSubscriptions = new WeakMap();
const fontListeners = new Map();
let presentationGeneration = 0;
const fontFailureCodes = Object.freeze({ metadata: 'FONT_METADATA_FAILED', ttf: 'FONT_TTF_INVALID', license: 'FONT_LICENSE_INVALID', fontface: 'FONT_FACE_LOAD_FAILED', registration: 'FONT_REGISTRATION_FAILED', coverage: 'FONT_GLYPHS_MISSING' });
function safeFontFailure(failure) {
  if (!failure || !Object.hasOwn(fontFailureCodes, failure.stage) || fontFailureCodes[failure.stage] !== failure.code) return null;
  return { stage: failure.stage, code: failure.code, ...(failure.stage === 'coverage' && Number.isSafeInteger(failure.count) && failure.count > 0 ? { count: failure.count } : {}) };
}
export async function loadCatalog() {
  if (!catalogRequest) {
    const pending = Promise.all([import('../../runtime/card-catalog.js'), ensureTemplateVisualConfig()]).then(([{ templateDefinitions }, resources]) => {
      if (!Array.isArray(templateDefinitions) || new Set(templateDefinitions.map(row => row.id)).size !== templateDefinitions.length) throw new Error('共享目录格式不正确。');
      const ids = new Set(resources.fonts.map(row => row.id));
      if (templateDefinitions.some(row => [row.recommendedFont, row.longTextFont, ...(row.recommendedFonts || [])].filter(Boolean).some(id => !ids.has(id)))) throw new Error('版式推荐字体不在正式目录。');
      templateIds = templateDefinitions.map(row => row.id);
      const fonts = resources.fonts.map(font => {
        const resource = resources.documents.fonts.fonts.find(row => row.id === font.id);
        if (!resource) return { ...font };
        const { nativeUrl, nativeBytes, nativeSha256, licenseUrl, licenseSha256 } = resource;
        return { ...font, nativeUrl, nativeBytes, nativeSha256, licenseUrl, licenseSha256 };
      });
      return { templates: templateDefinitions, fonts, imagery: resources.imagery, visualDefaults: resources.visualDefaults, ...(resources.templateConfig ? { templateConfig: resources.templateConfig } : {}) };
    });
    catalogRequest = pending;
    pending.catch(() => { if (catalogRequest === pending) catalogRequest = undefined; });
  }
  return catalogRequest;
}
function ensureTemplateVisualConfig() {
  if (!templateVisualConfigRequest) {
    const pending = Promise.all([import('../../runtime/domain/template-config.js'), import('../../runtime/rendering/templates.js'), import('../../runtime/card-catalog.js'), publicResources.catalog()]).then(([visualApi, renderer, catalog, resources]) => {
      templateVisualApi = visualApi;
      templateIds = catalog.TEMPLATE_IDS;
      formalTemplateVisualConfig = resources.templateConfig;
      activeTemplateVisualConfig = resources.templateConfig;
      const visualDefaults = Object.fromEntries(templateIds.map(id => {
        const template = renderer.getTemplate(id, 24);
        return [id, { paper: template.background, ink: template.color, muted: template.muted, accent: template.accent }];
      }));
      return { ...resources, visualDefaults };
    });
    templateVisualConfigRequest = pending;
    pending.catch(() => { if (templateVisualConfigRequest === pending) templateVisualConfigRequest = undefined; });
  }
  return templateVisualConfigRequest;
}
export function getTemplateVisualConfig() { return activeTemplateVisualConfig; }
export function setTemplateVisualConfig(config) {
  if (config === undefined) { activeTemplateVisualConfig = undefined; return undefined; }
  if (!templateVisualApi) throw new Error('正式模板视觉校验器尚未加载。');
  activeTemplateVisualConfig = templateVisualApi.validateTemplateVisualConfig(config);
  return activeTemplateVisualConfig;
}
export function updateTemplateVisualToken(templateId, field, value, enabled = true) {
  if (!templateVisualApi || !templateIds.includes(templateId)) throw new Error('模板视觉配置不可用。');
  const fields = ['paper', 'ink', 'muted', 'accent', 'fontScale', 'lineHeightScale'];
  if (!fields.includes(field)) throw new Error('模板视觉字段不可用。');
  const templates = Object.fromEntries(Object.entries(activeTemplateVisualConfig?.templates || {}).map(([id, tokens]) => [id, { ...tokens }]));
  const tokens = { ...(templates[templateId] || {}) };
  if (!enabled || (field === 'fontScale' || field === 'lineHeightScale') && Number(value) === 1) delete tokens[field];
  else tokens[field] = field === 'fontScale' || field === 'lineHeightScale' ? Number(value) : value;
  if (Object.keys(tokens).length) templates[templateId] = tokens; else delete templates[templateId];
  return setTemplateVisualConfig(Object.keys(templates).length ? templateVisualApi.buildTemplateVisualConfig(templates) : undefined);
}
export function resetTemplateVisualTokens(templateId) {
  if (!templateVisualApi || !templateIds.includes(templateId)) throw new Error('模板视觉配置不可用。');
  const templates = Object.fromEntries(Object.entries(activeTemplateVisualConfig?.templates || {}).map(([id, tokens]) => [id, { ...tokens }]));
  const original = formalTemplateVisualConfig?.templates[templateId];
  if (original) templates[templateId] = { ...original }; else delete templates[templateId];
  return setTemplateVisualConfig(Object.keys(templates).length ? templateVisualApi.buildTemplateVisualConfig(templates) : undefined);
}
export function applyTemplateVisualTokens(templateId, tokens) {
  if (!templateVisualApi || !templateIds.includes(templateId)) throw new Error('模板视觉配置不可用。');
  const templates = Object.fromEntries(Object.entries(activeTemplateVisualConfig?.templates || {}).filter(([id]) => id !== templateId).map(([id, value]) => [id, { ...value }]));
  if (tokens && Object.keys(tokens).length) templates[templateId] = { ...tokens };
  return setTemplateVisualConfig(Object.keys(templates).length ? templateVisualApi.buildTemplateVisualConfig(templates) : undefined);
}
const visualColorDefaults = { paper: '#f6f2e9', ink: '#293c33', muted: '#647369', accent: '#84927d' };
export function templateVisualControlsMarkup(templateId, defaults = {}) {
  const config = activeTemplateVisualConfig, tokens = config?.templates?.[templateId] || {};
  const colors = [['paper', '纸色'], ['ink', '正文色'], ['muted', '次要文字'], ['accent', '强调色']].map(([field, label]) => `<label class="visual-token-color"><span><input type="checkbox" data-visual-enabled="${field}"${tokens[field] ? ' checked' : ''} aria-label="启用${label}覆盖">${label}</span><input type="color" data-visual-token="${field}" value="${tokens[field] || defaults[field] || visualColorDefaults[field]}"${tokens[field] ? '' : ' disabled'} aria-label="${label}覆盖颜色"></label>`).join('');
  const scales = [['fontScale', '字号比例', .8, 1.2, tokens.fontScale ?? 1], ['lineHeightScale', '行高比例', .85, 1.15, tokens.lineHeightScale ?? 1]].map(([field, label, min, max, value]) => `<label class="visual-token-scale"><span>${label} <output>${Number(value).toFixed(3)}</output></span><input type="range" data-visual-token="${field}" min="${min}" max="${max}" step="0.001" value="${value}" aria-label="${label}，生产值为 1.000"></label>`).join('');
  return `<details class="template-visual-controls" data-visual-controls open><summary>正式模板视觉参数 · 仅本页预演</summary><p>颜色、字号与行高由正式配置校验；这里的修改仅作用于当前页面内存，不保存正式配置。</p><div class="visual-token-colors">${colors}</div><div class="visual-token-scales">${scales}</div><div class="visual-token-footer"><span data-visual-revision>${config ? `当前预览修订 ${config.revision.slice(0, 12)}` : '沿用共享生产默认'}</span><button type="button" class="quiet small" data-visual-reset="${escapeHTML(templateId)}">还原正式值</button></div></details>`;
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
  // Only expose the renderer's finite, user-safe failure vocabulary.  Preview
  // surfaces must never surface a fetch URL, exception text, or response body.
  const failure = typeof productionFonts.failureFor === 'function' ? safeFontFailure(productionFonts.failureFor(fontId, text)) : null;
  if (failure) result.failure = failure;
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
  const visualOptions = activeTemplateVisualConfig ? { ...options, templateConfig: activeTemplateVisualConfig } : options;
  const skeleton = cardSkeleton(sharedLayoutCard(card, { ...visualOptions, fontId: 'system' }, measureSkeletonText));
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
  const visualConfig = activeTemplateVisualConfig;
  const previewCard = visualConfig ? { ...card, templateConfig: visualConfig } : card;
  const previewOptions = visualConfig ? { ...options, templateConfig: visualConfig } : options;
  const key = JSON.stringify([card, options, visualConfig?.revision || 'baseline']);
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
      if (!retain) { prepareReadable(frame, previewCard, previewOptions); view.readable(previewCard); }
      [{ layoutCard }, { paintCardLayout }] = await skeletonRenderer();
      if (!current()) return null;
      skeleton = frame.querySelector('[data-card-skeleton]');
      if (!retain) {
        // A cold font has provisional metrics. The exact loaded layout replaces it before the reveal.
        try { prepareSkeleton(skeleton, previewCard, previewOptions, productionFonts.familyFor(options.fontId), layoutCard, paintCardLayout); }
        catch { frame.dataset.geometry = 'pending'; }
      }
    }
    // The production renderer can place promotion attribution in a separate text
    // run. Check the body first; only a missing attribution glyph may use the
    // renderer's documented system-font attribution fallback.
    const bodyText = fontCoverageText(card, { ...options, attributionSystemFallback: true });
    const productionText = fontCoverageText(card, { ...options, attributionSystemFallback: false });
    const font = await loadPreviewFont(options.fontId, bodyText);
    if (!current()) return null;
    let fontFailure = safeFontFailure(font.failure), attributionSystemFallback = false;
    if (!fontFailure && options.productionFontGate === true && !['system', 'loaded'].includes(font.state)) {
      fontFailure = safeFontFailure(font.state === 'partial' ? { stage: 'coverage', code: 'FONT_GLYPHS_MISSING' } : { stage: 'registration', code: 'FONT_REGISTRATION_FAILED' });
    }
    if (!fontFailure && productionText !== bodyText) {
      const completeFont = await loadPreviewFont(options.fontId, productionText);
      if (!current()) return null;
      const completeFailure = safeFontFailure(completeFont.failure);
      if (!fontFailure && completeFailure?.stage === 'coverage' && options.productionFontGate === true) attributionSystemFallback = true;
      else if (completeFailure) fontFailure = completeFailure;
    }
    const { productionFontGate: _productionFontGate, attributionSystemFallback: _unusedAttributionFallback, ...basePreviewOptions } = previewOptions;
    const renderOptions = attributionSystemFallback ? { ...basePreviewOptions, attributionSystemFallback: true } : basePreviewOptions;
    if (view && !retain) { prepareSkeleton(skeleton, previewCard, renderOptions, font.family, layoutCard, paintCardLayout); frame.dataset.geometry = 'measured'; }
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
    const result = await drawCard(candidate || canvas, { ...previewCard, imagePath }, renderOptions, font.family);
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
    const output = { ...result, ...(view ? { displayReady } : {}), fontState: font.state, ...(fontFailure ? { fontFailure } : {}), ...(attributionSystemFallback ? { attributionSystemFallback: true } : {}) };
    if (view && displayReady) displayedPreviews.set(canvas, { key, result: output });
    feedback(`${view && !displayReady ? '骨架停留 · 演示状态 · ' : ''}${font.notice} · 1080 × 1440${result.imageState === 'failed' ? ' · 配图未加载，当前显示底色' : ' · 同源画布'}${attributionSystemFallback ? ' · 署名使用系统字体；正文使用所选生产字体。' : ''}${result.fallback ? ` · ${result.fallback.message}` : ''}`, Boolean(view && !displayReady));
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
      feedback('原版候选未就绪，保留当前可读图；可重试。');
      return { ...previous.result, displayReady: true };
    }
    canvas.dataset.renderState = 'error';
    view?.fail('卡片暂未准备好，请检查资源后重试。', card);
    feedback('无法生成预览，请检查资源后重试。');
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

// Prototype-only HTML samples. No Canvas, font loading, DOM, network or production export.
// The private receipt is attached to the new value, not kept in mutable module state:
// transports accept only unchanged samples from this restricted serializer.
const templateHtmlReceipt = Symbol('template-html-sample');
const TEMPLATE_HTML_LIMIT = 256 * 1024;
const templateHtmlWarnings = Object.freeze([
  'HTML 版式示例 · 使用估算文字宽度，不代表原生画布或微信中的精确视觉效果。',
  '系统字体回退 · 不嵌入或下载 TTF；字形、换行及间距可能不同。',
  '微信兼容提示 · 定位、裁切、旋转及渐变 CSS 可能被过滤；外链图片须在微信编辑器手动替换为已授权素材。',
]);
const htmlSampleError = message => new Error(message);
function sampleText(value, limit, label, required = false) {
  if (value === undefined) value = '';
  if (typeof value !== 'string' || value.length > 4096 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value) ||
      Array.from(value).some(point => point.codePointAt(0) >= 0xd800 && point.codePointAt(0) <= 0xdfff)) throw htmlSampleError(`${label}格式无效，请检查后重试。`);
  const text = value.replace(/\r\n?/g, '\n');
  if (Array.from(text).length > limit) throw htmlSampleError(`${label}最多支持${limit}个字符，不会截断文字。`);
  if (required && !text.trim()) throw htmlSampleError(`请填写有效的${label}。`);
  return text;
}
function sampleDate(value) {
  const date = sampleText(value, 10, '日期');
  if (!date) return date;
  const match = /^(\d{4})[-/.](\d{2})[-/.](\d{2})$/.exec(date);
  if (!match) throw htmlSampleError('日期须使用有效的年、月、日格式。');
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) throw htmlSampleError('日期须使用有效的年、月、日格式。');
  return date;
}
function samplePublicUrl(value) {
  const fail = () => { throw htmlSampleError('图片只能使用批准公开资源根内的 HTTP(S) 地址，不能包含私有路径或凭据。'); };
  if (typeof value !== 'string' || value.length > 2048 || !/^https?:\/\//i.test(value) || /[\s\\%\u0000-\u001f\u007f-\u009f]/u.test(value)) fail();
  let url;
  try { url = new URL(value); } catch { fail(); }
  const host = url.hostname.toLowerCase();
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash ||
      !/^[a-z0-9.-]+$/.test(host) || !host.includes('.') || host.endsWith('.') || host.includes('..') ||
      /(?:^|\.)(?:localhost|local|internal|lan|home|arpa)$/.test(host)) fail();
  if (/^[\d.]+$/.test(host)) {
    const parts = host.split('.').map(Number), [a, b] = parts;
    if (parts.length !== 4 || parts.some(n => n < 0 || n > 255) || a === 0 || a === 10 || a === 127 || a >= 224 ||
        (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && (b === 0 || b === 168)) || (a === 198 && [18, 19, 51].includes(b)) || (a === 203 && b === 0)) fail();
  }
  // Validate the raw path too: URL parsing must not silently erase dot segments.
  const rawPath = value.replace(/^https?:\/\/[^/]+/i, '') || '/';
  if (!/^\/[A-Za-z0-9._/-]*$/.test(rawPath) || rawPath.slice(1).replace(/\/$/, '').split('/').some(part => part === '.' || part === '..' || !part && rawPath !== '/') ||
      /(?:^|\/)(?:api|editor|content|private|node|runtime|prototype|credentials|keys|accounts?)(?:\/|$)/i.test(rawPath)) fail();
  return url;
}
function sampleImage(card, options) {
  const hasRoot = options.publicResourceRoot !== undefined;
  if (!card.imagePath && !hasRoot) return undefined;
  const root = samplePublicUrl(options.publicResourceRoot);
  if (!root.pathname.endsWith('/') || typeof options.resolve !== 'function') throw htmlSampleError('请提供批准的公开资源根及同步图片解析函数。');
  let path = card.imagePath || `backgrounds/${['mist', 'sea', 'dusk'].includes(card.background) ? card.background : 'mist'}.png`;
  if (typeof path !== 'string') throw htmlSampleError('图片引用无效，请先选择批准的公开素材。');
  if (/^https?:\/\//i.test(path)) {
    const absolute = samplePublicUrl(path);
    if (absolute.origin !== root.origin || !absolute.pathname.startsWith(root.pathname)) throw htmlSampleError('图片不能来自批准公开资源根之外。');
    path = absolute.pathname.slice(root.pathname.length);
  }
  if (!/^(?:imagery\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.(?:png|jpe?g|webp)|backgrounds\/(?:mist|sea|dusk)\.png)$/i.test(path)) throw htmlSampleError('图片引用无效，只支持批准公开图库或背景图片。');
  let resolved;
  try { resolved = options.resolve(path); } catch { throw htmlSampleError('公开图片解析失败，请检查资源设置。'); }
  const url = samplePublicUrl(resolved);
  if (url.href !== new URL(path, root).href) throw htmlSampleError('图片不能来自批准公开资源根之外。');
  return url.href;
}
function sampleNumber(value, min = -4096, max = 4096) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw htmlSampleError('版式几何无效，不能生成 HTML 示例。');
  return String(Object.is(value, -0) ? 0 : value);
}
function sampleColor(value) {
  let channels, alpha = 1;
  if (/^#[\da-f]{6}$/i.test(value)) channels = [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16));
  else {
    const match = typeof value === 'string' && /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*\)$/.exec(value);
    if (!match) throw htmlSampleError('版式颜色无效，不能生成 HTML 示例。');
    channels = match.slice(1, 4).map(Number); alpha = Number(match[4]);
  }
  return `rgba(${channels.map(n => sampleNumber(n, 0, 255)).join(',')},${sampleNumber(alpha, 0, 1)})`;
}
/**
 * Synchronous deterministic sample from shared layout/glyphs and estimated metrics.
 * options: existing ExportOptions + { publicResourceRoot, resolve(path): string }.
 * No image/root means a labelled image-fill placeholder; image IDs must be resolved
 * by the caller beforehand. Never put a local preview URL in a clipboard sample.
 * Returns a frozen { html, plainText, warnings }; never truncates or clips text.
 */
export function createTemplateHtmlExample(card, options = {}) {
  if (!card || typeof card !== 'object' || !options || typeof options !== 'object') throw htmlSampleError('请先准备有效的卡片与版式。');
  const input = {
    text: sampleText(card.text, 240, '正文', true), author: sampleText(card.author, 45, '作者'),
    source: sampleText(card.source, 90, '出处'), date: sampleDate(card.date),
    background: card.background, imagePath: card.imagePath,
  };
  const templateConfig = options.templateConfig === undefined ? activeTemplateVisualConfig : options.templateConfig;
  if (templateConfig !== undefined) {
    if (!templateVisualApi) throw htmlSampleError('正式模板视觉校验器尚未加载。');
    try { templateVisualApi.validateTemplateVisualConfig(templateConfig); }
    catch { throw htmlSampleError('正式模板视觉配置无效；不会生成不一致的 HTML 示例。'); }
  }
  const attribution = [input.author, input.source].filter(Boolean).join(' · ');
  if (Array.from(input.author).length + Array.from(input.source).length > 90) throw htmlSampleError('作者与出处合计最多支持90个字符，不会截断文字。');
  if (typeof options.template !== 'string' || options.template.length > 40 ||
      ['showDate', 'showBrand'].some(key => options[key] !== undefined && typeof options[key] !== 'boolean')) throw htmlSampleError('版式或页脚选项无效，请重新选择。');
  const image = sampleImage(input, options);
  let layout;
  try { layout = sharedLayoutCard(input, { template: options.template, fontId: 'system', showDate: options.showDate === true, showBrand: options.showBrand === true, ...(templateConfig ? { templateConfig } : {}) }, measureSkeletonText); }
  catch { throw htmlSampleError('正文、署名或页脚无法放入所选共享版式，请调整文字或换行；不会截断文字。'); }
  const width = Number(sampleNumber(layout.width, 1, 1080)), height = Number(sampleNumber(layout.height, 1, 1440));
  let elements = 0;
  const plain = [];
  const node = (tag, style, content = '', attributes = '') => {
    if (!['section', 'p', 'span', 'img', 'br', 'strong'].includes(tag) || ++elements > 2048) throw htmlSampleError('HTML 示例超过安全大小限制。');
    return `<${tag}${style ? ` style="${escapeHTML(style)}"` : ''}${attributes}>${content}</${tag}>`;
  };
  function rectStyle(rect, rotation = rect.rotation, origin = rect.rotationOrigin) {
    const { x, y, width: w, height: h } = rect;
    [x, y, w, h].forEach(n => sampleNumber(n));
    if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > width + .001 || y + h > height + .001) throw htmlSampleError('版式图层溢出，不能生成 HTML 示例。');
    let style = `position:absolute;box-sizing:border-box;left:${sampleNumber(x)}px;top:${sampleNumber(y)}px;width:${sampleNumber(w)}px;height:${sampleNumber(h)}px;margin:0;padding:0`;
    if (rect.shape && !['rect', 'circle', 'arch'].includes(rect.shape)) throw htmlSampleError('版式图片形状无效。');
    const radius = Number(sampleNumber(rect.radius || 0, 0));
    if (rect.shape === 'circle') style += ';border-radius:50%';
    else if (rect.shape === 'arch') style += `;border-radius:50% 50% ${radius}px ${radius}px / 50% 50% ${radius}px ${radius}px`;
    else if (radius) style += `;border-radius:${radius}px`;
    if (rotation) {
      style += `;transform:rotate(${sampleNumber(rotation, -360, 360)}deg)`;
      if (origin) style += `;transform-origin:${sampleNumber(origin.x - x)}px ${sampleNumber(origin.y - y)}px`;
    }
    return style;
  }
  function text(block, original) {
    if (!block) return '';
    if (!['left', 'center', 'right'].includes(block.align) || !['horizontal', 'vertical-rl'].includes(block.direction) || !Array.isArray(block.lines)) throw htmlSampleError('版式文字图层无效。');
    const base = `${rectStyle(block)};color:${sampleColor(block.color)};font-family:system-ui,sans-serif;font-size:${sampleNumber(block.fontSize, 1, 256)}px;font-weight:400;line-height:${sampleNumber(block.lineHeight, 1, 512)}px;white-space:pre;text-align:${block.align}`;
    let offset = 0, markup = '', recovered = '';
    function lineEnd(line) {
      recovered += line;
      if (original !== undefined) {
        if (original.slice(offset, offset + line.length) !== line) throw htmlSampleError('版式文字不完整，不能生成 HTML 示例。');
        offset += line.length;
        if (original[offset] === '\n') { offset++; recovered += '\n'; return '<br>'; }
      }
      return '';
    }
    if (block.direction === 'vertical-rl') {
      if (!Array.isArray(block.columns) || block.columns.length !== block.lines.length) throw htmlSampleError('竖排字形缺失，不能生成 HTML 示例。');
      for (const [columnIndex, column] of block.columns.entries()) {
        let line = '';
        for (const glyph of column.glyphs) {
          sampleText(glyph.text, 240, '字形');
          if (glyph.x < block.x || glyph.y < block.y || glyph.x + glyph.width > block.x + block.width + .001 || glyph.y + glyph.height > block.y + block.height + .001) throw htmlSampleError('竖排字形溢出，不能生成 HTML 示例。');
          // Shared glyphs use absolute sheet coordinates, not a CSS writing-mode map.
          const local = { ...glyph, x: glyph.x - block.x, y: glyph.y - block.y };
          markup += node('span', `${rectStyle(local)};line-height:${sampleNumber(glyph.height, 1)}px;text-align:left`, escapeHTML(glyph.text));
          line += glyph.text;
        }
        if (line !== block.lines[columnIndex]) throw htmlSampleError('竖排字形文字不完整，不能生成 HTML 示例。');
        markup += lineEnd(line);
      }
    } else {
      block.lines.forEach((line, index) => {
        sampleText(line, 240, '文字行');
        if (measureSkeletonText(line, block.fontSize, block.fontFamily) > block.width + .001 || (index + 1) * block.lineHeight > block.height + .001) throw htmlSampleError('文字图层溢出，不能生成 HTML 示例。');
        markup += node('span', `${rectStyle({ x: 0, y: index * block.lineHeight, width: block.width, height: block.lineHeight })};display:block`, escapeHTML(line));
        markup += lineEnd(line);
      });
    }
    if (original !== undefined && (offset !== original.length || recovered !== original)) throw htmlSampleError('版式文字不完整，不能生成 HTML 示例。');
    plain.push(recovered);
    return node('p', base, markup);
  }
  function decorations(layer) {
    return layout.decorations.filter(item => item.layer === layer).map(item => {
      if (item.kind === 'text') return text(item.block);
      if (item.kind !== 'rect') throw htmlSampleError('版式装饰图层无效。');
      let style = `${rectStyle(item.rect, item.rotation, item.rotationOrigin)};background:${sampleColor(item.fill)}`;
      if (item.stroke) style += `;box-shadow:inset 0 0 0 ${sampleNumber(item.lineWidth || 1, 0, 256)}px ${sampleColor(item.stroke)}`;
      return node('span', style);
    }).join('');
  }
  let layers = decorations('beforeImage');
  const imageRect = layout.template.image;
  const position = imageRect.objectPosition || { x: .5, y: .5 };
  const imageStyle = `${rectStyle(imageRect)};background:${sampleColor(layout.template.imageFill)}`;
  if (image) {
    // img/br are void elements; no arbitrary attributes or CSS are accepted.
    elements++;
    layers += `<img style="${escapeHTML(`${imageStyle};object-fit:cover;object-position:${sampleNumber(position.x, 0, 1) * 100}% ${sampleNumber(position.y, 0, 1) * 100}%`)}" src="${escapeHTML(image)}" alt="">`;
  } else layers += node('span', imageStyle);
  if (layout.template.id === 'light') layers += node('span', `${rectStyle({ x: 0, y: 0, width, height })};background:linear-gradient(180deg,rgba(8,22,18,0.52),rgba(8,22,18,0.83))`);
  layers += decorations('afterImage');
  layers += text(layout.body, input.text) + text(layout.attribution, attribution);
  layers += text(layout.date) + text(layout.dateMeta) + text(layout.brand);
  const warnings = Object.freeze([...templateHtmlWarnings, ...(!image ? ['配图占位底色 · 未提供批准的公开图片；请手动替换，不代表图片已加载。'] : []), ...(layout.fallback ? [layout.fallback.message] : [])]);
  const sheet = node('section', `position:relative;box-sizing:border-box;width:${width}px;height:${height}px;margin:0;padding:0;background:${sampleColor(layout.template.background)}`, layers);
  const notes = warnings.map(warning => node('p', 'margin:0;padding:0;font-family:system-ui,sans-serif;font-size:14px;line-height:21px', escapeHTML(warning))).join('');
  const html = node('section', 'margin:0;padding:0', sheet + notes);
  const plainText = [...plain, ...warnings].join('\n');
  if (html.length > TEMPLATE_HTML_LIMIT || plainText.length > 4096 || elements > 2048) throw htmlSampleError('HTML 示例超过安全大小限制。');
  const example = { html, plainText, warnings };
  Object.defineProperty(example, templateHtmlReceipt, { value: Object.freeze({ html, plainText, warnings }) });
  return Object.freeze(example);
}
function validateTemplateHtmlExample(example) {
  const receipt = example?.[templateHtmlReceipt];
  if (!receipt || example.html !== receipt.html || example.plainText !== receipt.plainText || example.warnings !== receipt.warnings ||
      typeof example.html !== 'string' || !example.html || example.html.length > TEMPLATE_HTML_LIMIT || typeof example.plainText !== 'string' || !example.plainText || example.plainText.length > 4096) throw htmlSampleError('HTML 示例无效或已被修改，请重新生成后重试。');
  return receipt;
}
function sampleClipboard(method) {
  const clipboard = globalThis.navigator?.clipboard;
  if (globalThis.isSecureContext !== true || !clipboard || typeof clipboard[method] !== 'function') throw htmlSampleError('安全剪贴板当前不可用；请手动选择 HTML 源码或下载当前 HTML。');
  return clipboard;
}
/** Call directly in a user gesture with a previously prepared sample; no font await. */
export async function copyTemplateRichText(example) {
  const { html, plainText } = validateTemplateHtmlExample(example);
  const clipboard = sampleClipboard('write');
  if (typeof globalThis.ClipboardItem !== 'function' || typeof globalThis.Blob !== 'function') throw htmlSampleError('当前浏览器不支持 HTML 富文本复制，可尝试复制 HTML 源码。');
  try {
    if (typeof globalThis.ClipboardItem.supports === 'function' && (!globalThis.ClipboardItem.supports('text/html') || !globalThis.ClipboardItem.supports('text/plain'))) throw htmlSampleError('当前浏览器不支持 HTML 富文本复制，可尝试复制 HTML 源码。');
  } catch { throw htmlSampleError('当前浏览器不支持 HTML 富文本复制，可尝试复制 HTML 源码。'); }
  try {
    const item = new globalThis.ClipboardItem({ 'text/html': new globalThis.Blob([html], { type: 'text/html' }), 'text/plain': new globalThis.Blob([plainText], { type: 'text/plain' }) });
    const written = clipboard.write([item]);
    if (!written || typeof written.then !== 'function') throw htmlSampleError('剪贴板未确认写入。');
    await written;
  } catch { throw htmlSampleError('富文本复制未完成，请检查剪贴板权限后重试。'); }
}
/** Source copy is explicit, never a silent rich-text fallback. */
export async function copyTemplateHtmlSource(example) {
  const { html } = validateTemplateHtmlExample(example);
  const clipboard = sampleClipboard('writeText');
  try {
    const written = clipboard.writeText(html);
    if (!written || typeof written.then !== 'function') throw htmlSampleError('剪贴板未确认写入。');
    await written;
  } catch { throw htmlSampleError('HTML 源码复制未完成，请检查剪贴板权限后重试。'); }
}
/** Starts a local download only; the browser owns saving and any save/cancel UI. */
export async function downloadTemplateHtml(example, filename = 'daylight-template.html') {
  const { html } = validateTemplateHtmlExample(example);
  if (typeof filename !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}\.html$/i.test(filename) || filename.includes('..')) throw htmlSampleError('下载文件名无效，请使用简短的 HTML 文件名。');
  const document = globalThis.document, urls = globalThis.URL;
  if (!document?.body || typeof document.createElement !== 'function' || typeof globalThis.Blob !== 'function' || typeof urls?.createObjectURL !== 'function' || typeof urls?.revokeObjectURL !== 'function') throw htmlSampleError('当前环境不支持本地 HTML 下载。');
  let url, link, failed = false;
  try {
    const htmlDocument = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>HTML 版式示例</title></head><body>${html}</body></html>`;
    url = urls.createObjectURL(new globalThis.Blob([htmlDocument], { type: 'text/html;charset=utf-8' }));
    link = document.createElement('a'); link.href = url; link.download = filename; link.hidden = true;
    document.body.append(link); link.click();
  } catch { failed = true; }
  finally {
    try { link?.remove(); } catch { failed = true; }
    try { if (url) urls.revokeObjectURL(url); } catch { failed = true; }
  }
  if (failed) throw htmlSampleError('HTML 下载未能发起或清理，请检查浏览器设置后重试。');
}
