import { loadCatalog, previewFrame, paintPreview, cancelCardPreview, setCardPreviewPaused, setCardLoadingHints, skeletonPreview, backgroundImage, resourceUrl, escapeHTML as h, bindTheme, getTemplateVisualConfig, setTemplateVisualConfig, updateTemplateVisualToken, resetTemplateVisualTokens, templateVisualControlsMarkup } from './shared/card-preview.js';

bindTheme();
const TODAY = '2026-11-05';
const CODE_URL = resourceUrl('mini-program-code.png');
const poems = [
  { text: '行到水穷处，\n坐看云起时。', author: '王维', source: '终南别业', background: 'mist', template: 'paper', font: 'wenkai' },
  { text: '明月松间照，\n清泉石上流。', author: '王维', source: '山居秋暝', background: 'dusk', template: 'window', font: 'notoserif' },
  { text: '采菊东篱下，\n悠然见南山。', author: '陶渊明', source: '饮酒·其五', background: 'sea', template: 'horizon', font: 'wenkai' },
];
const longText = '夫君子之行，静以修身，俭以养德。非淡泊无以明志，非宁静无以致远。夫学须静也，才须学也；非学无以广才，非志无以成学。淫慢则不能励精，险躁则不能治性。年与时驰，意与日去，遂成枯落，多不接世，悲守穷庐，将复何及！';
const state = { date: TODAY, scenario: 'normal', readerTemplate: 'follow', loadScenario: 'auto', loadingMode: 'auto', loadingPaused: false, reduceMotion: false, showLoadingHints: false, sheet: '', exportTab: 'layout', template: 'paper', fontId: 'system', showDate: true, showBrand: true, exportFromDraft: false, draftText: '给日子留一点空白，让喜欢的事慢慢发生。', draftAuthor: '此刻的我', draftSource: '原创设计样例', draftPhoto: false, privacy: false, nextPrivacyAction: '', saved: false };
const $ = selector => document.querySelector(selector);
let catalog;
let priorFocus;
let swipeStart;
let dailyGeneration = 0;
let sheetGeneration = 0;
let exportGeneration = 0;
let dailyResize;
let exportReady;
let pendingSave;
const templateThumbnails = new Map();
const titles = { dates: '翻到某一天', create: '写一张', export: '保存卡片', fulltext: '展开全文', about: '关于拾光撷语', privacy: '保护你的隐私', guide: '隐私保护指引 · 设计说明', share: '聊天分享示意' };

function dateOffset(value, offset) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
function announce(text) { $('#reader-announcement').textContent = text; }
function readingCard() {
  const index = Math.abs(Math.round((Date.parse(`${state.date}T12:00:00Z`) - Date.parse(`${TODAY}T12:00:00Z`)) / 86400000)) % poems.length;
  const card = { ...poems[index], ...(state.scenario === 'long' ? { text: longText, author: '诸葛亮', source: '诫子书' } : {}), date: state.date };
  const selected = catalog?.templates.find(row => row.id === state.readerTemplate);
  return selected ? { ...card, template: selected.id, font: (state.scenario === 'long' && selected.longTextFont) || selected.recommendedFont || card.font } : card;
}
function exportCard() {
  return state.exportFromDraft ? { text: state.draftText, author: state.draftAuthor, source: state.draftSource, background: state.draftPhoto ? 'dusk' : 'mist', date: state.date } : readingCard();
}
function presentationOptions(mode = state.loadingMode) { return { mode, reduceMotion: state.reduceMotion, paused: state.loadingPaused }; }
function previewPayload(card, imageError = state.scenario === 'image-error') {
  // An empty in-memory image exercises the real renderer's image fallback without a failed network request.
  return imageError ? { ...card, imagePath: 'data:,' } : card;
}
function updateDemoStatus() {
  $('[data-action="loading-hold"]').setAttribute('aria-pressed', String(state.loadingMode === 'hold'));
  const pause = $('[data-action="loading-pause"]');
  pause.setAttribute('aria-pressed', String(state.loadingPaused));
  pause.textContent = state.loadingPaused ? '继续交接' : '暂停交接';
  const messages = { auto: '正常 · 900ms 可见等待先读系统文字；骨架到原版单层淡入 240ms，已可读文字到原版直接替换；快速命中不等待。', hold: 'DEMO · 骨架已停留；真实资源仍在准备，不可保存此状态。', replay: 'DEMO · 900ms 先读文字；至少 1.1 秒后原版就绪即不透明替换，不叠字。', slow: 'DEMO · 900ms 先读文字；至少 2.4 秒后原版就绪即替换，不代表真实加载性能。', instant: 'DEMO · 等待时仍可先读文字；原版就绪后直接显示，不播放淡入。', error: 'DEMO · 先读文字，随后演示失败；保留正文、出处与重试入口。' };
  $('#reader-demo-status').textContent = messages[state.loadingMode] + (state.loadingPaused ? ' DEMO · 交接已暂停，900ms 首读不受影响；点“继续交接”恢复。' : '');
}
function imageReady(image) {
  if (!image) return Promise.resolve(false);
  return new Promise(resolve => {
    let timer;
    const finish = () => {
      clearTimeout(timer);
      image.removeEventListener('load', finish); image.removeEventListener('error', finish);
      resolve(image.complete && image.naturalWidth > 0);
    };
    if (image.complete) { finish(); return; }
    image.addEventListener('load', finish); image.addEventListener('error', finish);
    timer = setTimeout(finish, 8000);
  }).then(async ready => {
    if (!ready) return false;
    try { await image.decode?.(); return image.naturalWidth > 0; } catch { return false; }
  });
}
function cancelDaily() {
  ++dailyGeneration;
  swipeStart = undefined;
  dailyResize?.disconnect(); dailyResize = undefined;
  cancelCardPreview($('#reader-layout-canvas'));
}
function syncLoadingHints() {
  const phone = $('#reader-phone');
  phone.dataset.showLoadingHints = String(state.showLoadingHints);
  phone.querySelectorAll('[data-card-frame]').forEach(frame => setCardLoadingHints(frame, state.showLoadingHints));
  phone.querySelectorAll('[data-loading-hint="true"]').forEach(node => { node.hidden = !state.showLoadingHints || !node.textContent; });
  const toggle = $('#reader-show-loading-hints');
  if (toggle) toggle.checked = state.showLoadingHints;
}
function setLoadingHints(enabled) {
  // Memory-only prototype preference: no remount, render, resource request or identity change.
  state.showLoadingHints = enabled === true;
  syncLoadingHints();
}
function dailyFeedback(message, retry = false, actionable = false) {
  const status = $('#reader-card-status');
  const button = $('[data-action="retry-card"]');
  if (status) {
    status.textContent = message;
    status.dataset.loadingHint = String(!actionable);
    status.hidden = !message || (!actionable && !state.showLoadingHints);
  }
  if (button) button.hidden = !retry;
  const summary = $('#reader-resource-summary');
  if (summary) summary.textContent = resourceSummary();
  syncLocalResourceState();
}
async function prepareDaily(canvas, card, version, options) {
  const result = await paintPreview(canvas, previewPayload(card), { template: card.template, fontId: card.font, showDate: true, showBrand: true }, null, options);
  if (version !== dailyGeneration || !canvas.isConnected) return;
  if (!result) dailyFeedback('卡片暂未准备好，全文仍可阅读。', true, true);
  else if (!result.displayReady) dailyFeedback('骨架停留 · DEMO，全文仍可阅读。');
  else {
    const fallback = [result.imageState === 'failed' ? '配图暂不可用' : '', ['fallback', 'partial'].includes(canvas.dataset.fontState) ? '部分字体使用系统回退' : ''].filter(Boolean);
    dailyFeedback(fallback.length ? `${fallback.join(' · ')}，文字仍可阅读。` : '', Boolean(fallback.length));
  }
}
function renderSharedVisualControls() {
  const host = $('[data-shared-visual-controls]');
  if (!host || !catalog) return;
  const selected = catalog.templates.find(row => row.id === (state.readerTemplate === 'follow' ? readingCard().template : state.readerTemplate));
  if (!selected) { host.innerHTML = '<p class="caption">跟随样例卡片正式配置；在“保存卡片”中可选版式并预演视觉参数。</p>'; return; }
  const defaults = catalog.visualDefaults?.[selected.id] || {};
  host.innerHTML = `<p class="caption">${h(selected.name)} · 应用正式渲染器视觉值，不修改阅读配置或内容。</p>${templateVisualControlsMarkup(selected.id, defaults)}`;
}
function renderDaily(mode = state.loadingMode) {
  cancelDaily();
  const version = dailyGeneration;
  const card = readingCard();
  const attribution = [card.author, card.source ? `《${card.source}》` : ''].filter(Boolean).join(' · ');
  const options = { ...presentationOptions(mode), onReadable: () => {
    if (version !== dailyGeneration) return;
    dailyFeedback('先读文字 · 原版准备中');
  }, onReady: result => {
    if (version !== dailyGeneration) return;
    const canvas = $('#reader-layout-canvas');
    const fallback = result.imageState === 'failed' || ['fallback', 'partial'].includes(canvas?.dataset.fontState);
    dailyFeedback(fallback ? '部分资源使用回退，文字仍可阅读。' : '', fallback);
  } };
  const date = new Date(`${state.date}T12:00:00Z`);
  const [year, month, day] = state.date.split('-');
  const heading = `<div class="reader-date-row"><button class="reader-date" type="button" data-action="dates" aria-label="选择日期 ${h(state.date)}"><span class="reader-day">${day}</span><span class="reader-date-meta"><span>${month}月 · 周${'日一二三四五六'[date.getUTCDay()]}</span><small>${year}　⌄</small></span></button>${state.date === TODAY ? '<span class="reader-today">今日</span>' : '<button class="quiet small" type="button" data-action="today">回到今天 ↗</button>'}</div>`;
  const tools = `<div class="reader-card-tools"><button type="button" class="quiet reader-fulltext-link" data-action="fulltext" aria-label="阅读全文，${h(card.author)}，${h(card.source)}">阅读全文 ↗</button><button type="button" class="quiet" data-action="retry-card" hidden>重试</button></div><p class="reader-card-status" id="reader-card-status" data-loading-hint="true" role="status" aria-live="polite" hidden></p>`;
  const body = state.scenario === 'empty' ? '<div class="reader-empty"><h2>这一天，还没有写下。</h2><p class="caption">可以先做一张属于自己的卡片。</p><button class="primary" data-action="create">写一张</button></div>' : `<div class="reader-layout-stage">${previewFrame('id="reader-layout-canvas"', `${card.text} ${attribution}`)}</div>${tools}`;
  const daily = $('#reader-daily');
  daily.dataset.template = card.template;
  $('#reader-underlay').dataset.template = card.template;
  daily.innerHTML = heading + (state.date > TODAY ? '<p class="reader-reading-status">未来排期预览 · 不在今日阅读中</p>' : '') + body;
  syncLoadingHints();
  renderSharedVisualControls();
  $('[data-action="export-daily"]').disabled = state.scenario === 'empty';
  $('.swipe-hint').disabled = state.scenario === 'empty';
  if (state.scenario === 'empty') return;
  dailyFeedback('卡片准备中…');
  const stage = daily.querySelector('.reader-layout-stage');
  const frame = stage.querySelector('[data-card-frame]');
  // Only the complete 1080×1440 frame scales; text and image geometry stay with the shared renderer.
  const fit = () => { if (stage.isConnected) frame.style.width = `${Math.max(1, Math.min(stage.clientWidth, stage.clientHeight * .75))}px`; };
  fit(); dailyResize = new ResizeObserver(fit); dailyResize.observe(stage);
  void prepareDaily($('#reader-layout-canvas'), card, version, options);
}
function invalidateSheetPreview() {
  ++exportGeneration;
  exportReady = undefined;
  cancelCardPreview($('#reader-export-canvas'));
}
function openSheet(name) {
  if (state.sheet === 'about' && name !== 'about') stopResourceDiagnostics('离开诊断面板', false);
  if (!state.sheet) priorFocus = document.activeElement;
  if (!['privacy', 'guide'].includes(name)) pendingSave = undefined;
  state.sheet = name;
  setCardPreviewPaused($('#reader-layout-canvas'), true, 'sheet');
  swipeStart = undefined;
  $('#reader-overlay').hidden = false;
  $('#reader-underlay').inert = true;
  renderSheet();
  $('.reader-sheet-head [data-action="close"]').focus({ preventScroll: true });
}
function closeSheet() {
  stopResourceDiagnostics('关闭诊断面板', false);
  state.sheet = '';
  ++sheetGeneration; invalidateSheetPreview();
  pendingSave = undefined;
  state.nextPrivacyAction = '';
  $('#reader-overlay').hidden = true;
  $('#reader-sheet-body').replaceChildren();
  $('#reader-underlay').inert = false;
  setCardPreviewPaused($('#reader-layout-canvas'), false, 'sheet');
  if (priorFocus?.isConnected) priorFocus.focus({ preventScroll: true });
}
function datesBody() {
  const recent = Array.from({ length: 7 }, (_, index) => dateOffset(TODAY, -index));
  return `<label class="field">选择日期<input type="date" id="reader-date-picker" value="${state.date}" min="2026-10-01" max="2026-11-12"></label><p class="caption">设计样例覆盖 2026-10-01 至 2026-11-12；已排期的未来日期也可单独查看。</p><h3 class="small">最近几日</h3><div class="recent-days">${recent.map((date, index) => `<button type="button" data-date="${date}" class="recent-row ${date === state.date ? 'active' : ''}"><span>${date}</span><span>${h(poems[index % poems.length].text.replace(/\n/g, ''))}</span></button>`).join('')}</div>`;
}
function createBody() {
  return `<p class="caption">一句话，一张图。写成自己的一页。</p><label class="field"><span class="row between"><span>写下文字</span><span id="draft-count">${Array.from(state.draftText).length} / 240</span></span><textarea id="reader-draft-text" data-draft="draftText" maxlength="240" placeholder="写下你想留下的一句话…">${h(state.draftText)}</textarea></label><div class="field-pair"><label class="field">作者 · 选填<input data-draft="draftAuthor" maxlength="45" value="${h(state.draftAuthor)}" placeholder="作者"></label><label class="field">出处 · 选填<input data-draft="draftSource" maxlength="45" value="${h(state.draftSource)}" placeholder="作品 / 你的落款"></label></div><button type="button" class="reader-photo-demo" data-action="photo">${state.draftPhoto ? `<img src="${backgroundImage('dusk')}" alt="示例照片">` : '<span aria-hidden="true">＋</span>'}<span>${state.draftPhoto ? '更换照片 · 示例' : '选择自己的照片 · 示例'}<small>不打开文件选择器，只用内置图片演示</small></span></button>${state.draftPhoto ? '<button class="quiet small" type="button" data-action="remove-photo">移除照片</button>' : ''}<p class="reader-error" id="create-error" role="alert"></p><button type="button" class="primary wide" data-action="export-draft">选个模板，看看效果 →</button><p class="caption center">本页只在内存保留输入，关闭面板不清空；刷新后重置。不上传，不持久保存。</p>`;
}
function openExport() {
  const card = readingCard();
  // 每次打开日签保存时版式与字体均跟随当前卡片；只沿用日期/品牌选项，面板内仍可主动修改。
  if (!state.exportFromDraft) {
    state.template = card.template || 'paper';
    state.fontId = card.font || 'system';
  }
  openSheet('export');
}
function openExportDraft() {
  state.template = 'paper';
  state.exportFromDraft = true;
  openSheet('export');
}
function miniLayout(id) {
  if (!templateThumbnails.has(id)) {
    // Same canonical sample as the mini-program; no work until the first export selector opens.
    const sample = { ...poems[0], date: TODAY };
    templateThumbnails.set(id, skeletonPreview(sample, { template: id, showDate: true, showBrand: true }));
  }
  return templateThumbnails.get(id);
}
function exportBody() {
  const templates = state.exportTab === 'layout' ? `<div class="reader-strip-head"><strong class="small">版式</strong><span class="caption">左右滑动查看全部 ${catalog.templates.length} 款 · 当前：${h(catalog.templates.find(row => row.id === state.template)?.name || '')}</span></div><div class="reader-template-strip" role="group" aria-label="${catalog.templates.length}款制卡模板">${catalog.templates.map(row => `<button type="button" data-template="${row.id}" aria-pressed="${state.template === row.id}">${miniLayout(row.id)}<span class="strip-name">${h(row.name)}</span><small>${h(row.description)}</small></button>`).join('')}</div>` : '';
  const fonts = state.exportTab === 'font' ? `<div class="row between"><strong class="small">卡片字体</strong><span class="caption">点击预览图可放大</span></div><div class="reader-font-options" role="group" aria-label="${catalog.fonts.length}种卡片字体">${catalog.fonts.map(row => `<button type="button" data-font="${row.id}" aria-pressed="${state.fontId === row.id}">${h(row.name)}</button>`).join('')}</div>` : '';
  const details = state.exportTab === 'details' ? `<div class="reader-options"><label><input type="checkbox" data-export-option="showDate" ${state.showDate ? 'checked' : ''}>日期</label><label><input type="checkbox" data-export-option="showBrand" ${state.showBrand ? 'checked' : ''}>品牌落款</label><span class="caption">1080 × 1800</span></div><p class="caption">底部统一拼接固定小程序码，长按识别打开小程序，不定位卡片日期。日期与品牌落款可单独设置。</p>` : '';
  const tabs = [['layout', '版式'], ['font', '字体'], ['details', '细节']].map(([id, label]) => `<button type="button" class="reader-export-tab ${state.exportTab === id ? 'active' : ''}" data-export-tab="${id}" aria-selected="${state.exportTab === id}">${label}</button>`).join('');
  return `<figure class="reader-export-preview" data-action="zoom" tabindex="-1" role="button" aria-disabled="true" aria-label="放大卡片预览，含固定小程序码">${previewFrame('id="reader-export-canvas"', '同源导出画布')}<div class="reader-code-footer" aria-hidden="true"><div class="reader-code-copy"><strong>拾光撷语</strong><span>微信长按识别 · 打开小程序</span><span>每天一页，把喜欢留下。</span></div><img src="${CODE_URL}" alt="" width="280" height="280"></div></figure><p class="caption center">1080 × 1800 · 含固定小程序码 · 就绪后可放大核对</p><div class="reader-export-tabs" role="tablist" aria-label="卡片样式">${tabs}</div>${templates}${fonts}${details}<div class="reader-export-feedback"><p class="preview-status" id="reader-export-status" data-loading-hint="true" role="status" aria-live="polite" hidden></p></div><div class="row between">${state.exportFromDraft ? '<button class="quiet" type="button" data-action="create">← 编辑</button>' : ''}<button class="quiet" type="button" data-action="retry-export" hidden>重试生成</button><button class="primary" type="button" id="reader-save" data-action="save" disabled>模拟保存图片</button></div><p class="caption center">作者和出处随卡片保留，请确认素材使用权。设计页不会写相册或下载文件。</p>`;
}
function shareBody() {
  const card = readingCard();
  const excerpt = `${Array.from(card.text.replace(/\n/g, ' ')).slice(0, 24).join('')}…`;
  return `<div class="reader-chat-demo"><div class="reader-chat-bubble"><p class="reader-chat-title">${h(excerpt)}｜拾光撷语</p><div class="reader-chat-cover"><div class="reader-chat-card"><span class="reader-chat-date">${h(card.date)}</span><p>${h(card.text)}</p><span class="reader-chat-source">${h(card.author)} · ${h(card.source)}</span></div></div><p class="reader-chat-app">拾光撷语<small>小程序</small></p></div></div><p class="caption">好友卡片为 1000 × 800 封面：完整 3:4 卡片等比居中，两侧纸色留白；点开按卡片日期定位到这一天。朋友圈使用同一日签。此处仅静态示意，不调用微信接口。</p>`;
}
function resourceSummary() {
  const card = readingCard();
  const frame = $('#reader-daily').querySelector('[data-card-frame]');
  const template = catalog?.templates.find(row => row.id === card.template)?.name || '当前版式';
  const font = catalog?.fonts.find(row => row.id === card.font)?.name || '随卡片字体';
  const phases = { loading: '准备中', readable: '先读文字 · 原版准备中', revealing: '原版显示中', ready: '已就绪', error: '未就绪 · 可重试' };
  const fonts = { loaded: '原版就绪', system: '系统字体', fallback: '系统回退', partial: '部分字形回退' };
  return `${template} · ${font}；${phases[frame?.dataset.phase] || '这一天暂无内容'}；字体：${fonts[frame?.dataset.fontState] || '准备中'}；配图：${frame?.dataset.imageState === 'ready' ? '已就绪' : frame?.dataset.imageState === 'failed' ? '暂不可用' : '准备中'}`;
}
// Channel results below are explicitly synthetic. Opening diagnostics never downloads a sample,
// constructs provider URLs, changes the shared painter, or writes client/business preferences.
const RESOURCE_DEMO_LIMITS = { bytes: 12 * 1024 * 1024, channelMs: 15000, totalMs: 60000, cooldownMs: 60000 };
const RESOURCE_DEMO_CHANNELS = {
  fonts: [{ id: 'uploadthing', name: 'UploadThing' }, { id: 'github-mirror', name: 'GitHub 镜像' }, { id: 'axxiu', name: 'AxureShow' }],
  images: [{ id: 'wechat-material', name: '微信素材' }, { id: 'ipic', name: 'iPic' }, { id: 'axxiu', name: 'AxureShow' }, { id: 'github-mirror', name: 'GitHub 镜像' }],
};
const RESOURCE_DEMO_DELAYS = { fonts: [850, 1450, 1900], images: [440, 700, 1100, 950] };
const resourceChannelDemo = {
  groups: Object.fromEntries(['fonts', 'images'].map(kind => [kind, { sampleId: '', scenario: kind === 'fonts' ? 'missing' : 'insufficient', preferred: '', records: {}, cache: new Map(), downloads: new Map(), message: '' }])),
  network: 'wifi', run: undefined, generation: 0, cooldownUntil: 0, cooldownTimer: undefined,
};
function resourceLocalState(kind) {
  const card = readingCard(), frame = $('#reader-daily')?.querySelector('[data-card-frame]');
  if (state.scenario === 'empty') return { name: '暂无卡片', source: '没有当前资源', status: '未加载', cache: '未判定' };
  if (kind === 'fonts') {
    const font = catalog?.fonts.find(row => row.id === card.font);
    const value = frame?.dataset.fontState;
    const source = value === 'system' ? '设备系统字体' : value === 'fallback' ? '系统回退' : value === 'partial' ? '同源批准 TTF + 系统字形回退' : '同源批准 TTF';
    return { name: font?.name || '随卡片字体', source, status: ({ loaded: '原版就绪', system: '系统字体', fallback: '批准 TTF 未就绪', partial: '部分字形回退' })[value] || '准备中', cache: '浏览器管理；此页未判定命中' };
  }
  const value = frame?.dataset.imageState;
  return { name: `内置配图 · ${card.background}`, source: value === 'failed' ? '版式背景回退' : '同源内置配图', status: value === 'ready' ? '已就绪' : value === 'failed' ? '配图暂不可用' : '准备中', cache: '浏览器管理；此页未判定命中' };
}
function syncLocalResourceState() {
  for (const kind of ['fonts', 'images']) for (const [field, value] of Object.entries(resourceLocalState(kind))) {
    const node = $(`#reader-resource-local-${kind}-${field}`);
    if (node) node.textContent = value;
  }
}
function resourceDemoSamples(kind) {
  const rows = kind === 'fonts' ? (catalog?.fonts || []).filter(row => row.id !== 'system').map(row => ({ id: row.id, name: row.name, bytes: row.nativeBytes, sha256: row.nativeSha256, object: row.nativeUrl })) : (catalog?.imagery || []).map(row => ({ id: row.id, name: row.label, bytes: row.bytes, sha256: row.sha256, object: row.file }));
  return rows.filter(row => row.id && row.name && Number.isSafeInteger(row.bytes) && row.bytes > 0 && /^[a-f0-9]{64}$/.test(row.sha256 || '') && typeof row.object === 'string' && /^[A-Za-z0-9._-]+\.(ttf|png|jpe?g|webp)$/i.test(row.object)).sort((a, b) => a.bytes - b.bytes);
}
function resourceDemoSample(kind) {
  const group = resourceChannelDemo.groups[kind], samples = resourceDemoSamples(kind);
  if (!samples.some(row => row.id === group.sampleId)) group.sampleId = (kind === 'fonts' && samples.find(row => row.id === readingCard().font) || samples[0])?.id || '';
  return samples.find(row => row.id === group.sampleId);
}
function resourceDemoKey(sample) { return sample ? `${sample.id}:${sample.sha256}:${sample.bytes}` : ''; }
function resourceDemoNetwork() { return ({ wifi: 'Wi-Fi', cellular: '4G / 5G', unknown: '未知网络' })[resourceChannelDemo.network] + ' · 演示'; }
function resourceDemoPlan(kind) {
  const group = resourceChannelDemo.groups[kind], sample = resourceDemoSample(kind);
  const channels = RESOURCE_DEMO_CHANNELS[kind].map((channel, index) => ({ ...channel, index, available: Boolean(sample) && (group.scenario === 'insufficient' ? index === RESOURCE_DEMO_CHANNELS[kind].length - 1 : group.scenario === 'missing' ? index > 0 : true) }));
  const count = channels.filter(row => row.available).length, bytes = (sample?.bytes || 0) * count;
  const reason = !sample ? '正式目录暂无可测速的批准资源。' : count < 2 ? '可测渠道不足 2 个；需要同一批准资源在至少两个渠道的精确地址。' : bytes > RESOURCE_DEMO_LIMITS.bytes ? '本轮预计流量超过 12 MiB，请选择较小的批准样本。' : '';
  return { sample, channels, count, bytes, reason };
}
function resourceDemoCooldown() { return Math.max(0, Math.ceil((resourceChannelDemo.cooldownUntil - Date.now()) / 1000)); }
function resourceBytesLabel(bytes) { return `${(bytes / 1024 / 1024).toFixed(2)} MiB`; }
function resourceRecordMarkup(kind, channel) {
  const group = resourceChannelDemo.groups[kind], record = group.records[channel.id];
  const status = record?.status || (channel.available ? 'unmeasured' : 'unavailable');
  const label = ({ unmeasured: '未测', unavailable: '不可测 · 地址缺失', running: '测速中 · 演示', success: '成功 · 演示', failed: '失败 · 演示', cancelled: '已取消 · 演示' })[status];
  const elapsed = record?.elapsedMs === undefined ? status === 'cancelled' ? '未完成' : '未测' : status === 'success' ? `${(record.elapsedMs / 1000).toFixed(2)} s` : `未完成 · 等待 ${(record.elapsedMs / 1000).toFixed(2)} s`;
  const throughput = status === 'success' && record.elapsedMs > 0 ? `${(record.bytes / record.elapsedMs * 1000 / 1024 / 1024).toFixed(2)} MiB/s` : '未测';
  const measured = record?.measuredAt === undefined ? '未测' : new Date(record.measuredAt).toLocaleTimeString('zh-CN', { hour12: false });
  return `<li class="reader-resource-channel" data-resource-channel="${kind}:${channel.id}" data-status="${status}"><div class="reader-resource-channel-head"><strong>${h(channel.name)}</strong><span>${h(label)}</span></div><dl class="reader-resource-metrics"><div><dt>完整 GET · 演示</dt><dd>${h(elapsed)}</dd></div><div><dt>速率 · 演示</dt><dd>${h(throughput)}</dd></div><div><dt>网络 · 演示</dt><dd>${h(record?.network || '未测')}</dd></div><div><dt>记录时间 · 演示</dt><dd>${h(measured)}</dd></div></dl>${status === 'unavailable' ? '<p class="caption">没有匹配该样本的批准精确地址；不猜测 URL。</p>' : record?.notice ? `<p class="caption">${h(record.notice)}</p>` : ''}<button type="button" class="quiet" id="reader-resource-prefer-${kind}-${channel.id}" data-action="resource-prefer" data-resource-kind="${kind}" data-provider="${channel.id}" aria-pressed="${group.preferred === channel.id}"${resourceChannelDemo.run ? ' disabled' : ''}>${group.preferred === channel.id ? '已设为优先' : '优先使用'}</button></li>`;
}
function resourceGroupMarkup(kind) {
  const title = kind === 'fonts' ? '字体' : '图片', group = resourceChannelDemo.groups[kind], plan = resourceDemoPlan(kind), local = resourceLocalState(kind);
  const download = group.downloads.get(resourceDemoKey(plan.sample)), cached = group.cache.has(resourceDemoKey(plan.sample));
  const preferred = RESOURCE_DEMO_CHANNELS[kind].find(row => row.id === group.preferred)?.name;
  const blocked = Boolean(resourceChannelDemo.run || resourceDemoCooldown() || plan.reason);
  const scenarios = [['missing', kind === 'fonts' ? '缺少 UploadThing 回执' : '部分图片地址缺失'], ['success', '地址齐全 · 成功'], ['failure', '首个渠道失败 · 回退'], ['insufficient', '可测渠道不足']];
  return `<div class="reader-resource-group" data-resource-kind="${kind}"><div class="reader-resource-heading"><h4>${title}</h4><span class="tag">渠道部分为内存演示</span></div><div class="reader-resource-local"><strong>当前卡片 · 本页真实加载</strong><dl>${[['name', '资源'], ['source', '来源'], ['status', '状态'], ['cache', '缓存']].map(([field, label]) => `<div><dt>${label}</dt><dd id="reader-resource-local-${kind}-${field}">${h(local[field])}</dd></div>`).join('')}</dl></div><dl class="reader-resource-choice"><div><dt>本机选择 · 演示</dt><dd>${preferred ? `优先使用 ${h(preferred)}` : '自动 · 沿用渠道顺序与当前网络成功测速'}</dd></div><div><dt>样本来源 · 演示</dt><dd data-resource-demo-source="${kind}">${h(download?.source || '尚无下载记录')}</dd></div><div><dt>样本缓存 · 演示</dt><dd data-resource-demo-cache="${kind}">${cached ? download?.hit ? '有效缓存命中' : '已保留有效缓存' : '尚无有效缓存'}</dd></div></dl><label class="field">测速样本 · 批准目录<select id="reader-resource-sample-${kind}" data-resource-sample="${kind}"${resourceChannelDemo.run ? ' disabled' : ''}>${resourceDemoSamples(kind).map(row => `<option value="${h(row.id)}"${row.id === group.sampleId ? ' selected' : ''}>${h(row.name)} · ${resourceBytesLabel(row.bytes)}</option>`).join('') || '<option value="">暂无批准样本</option>'}</select></label>${plan.sample ? `<p class="reader-resource-identity caption">样本摘要 ${h(plan.sample.sha256.slice(0, 12))} · ${resourceBytesLabel(plan.sample.bytes)}；各渠道使用同一批准对象。</p>` : ''}<label class="field">地址与回执情境 · 内存演示<select id="reader-resource-scenario-${kind}" data-resource-scenario="${kind}"${resourceChannelDemo.run ? ' disabled' : ''}>${scenarios.map(([id, name]) => `<option value="${id}"${id === group.scenario ? ' selected' : ''}>${h(name)}</option>`).join('')}</select></label><p class="caption" data-resource-plan="${kind}">已批准精确地址可测数量 · 演示：${plan.count} / ${plan.channels.length}；预计最多 ${resourceBytesLabel(plan.bytes)}。</p>${plan.reason ? `<p class="reader-resource-warning" data-resource-blocked="${kind}">${h(plan.reason)}</p>` : ''}<div class="reader-resource-actions"><button type="button" id="reader-resource-test-${kind}" data-action="resource-test" data-resource-kind="${kind}"${blocked ? ' disabled' : ''}>测${title}渠道</button><button type="button" class="quiet" id="reader-resource-auto-${kind}" data-action="resource-auto" data-resource-kind="${kind}"${!group.preferred || resourceChannelDemo.run ? ' disabled' : ''}>恢复自动</button></div><ul class="reader-resource-channels">${plan.channels.map(channel => resourceRecordMarkup(kind, channel)).join('')}</ul><button type="button" class="quiet" id="reader-resource-download-${kind}" data-action="resource-download-demo" data-resource-kind="${kind}"${resourceChannelDemo.run || !plan.sample ? ' disabled' : ''}>演示后续下载 / 缓存命中</button><p class="caption" role="status" aria-live="polite" data-resource-message="${kind}">${h(group.message || '只影响后续下载；已有有效缓存保留，渠道失败时继续回退。')}</p></div>`;
}
function resourceDiagnosticsBody() {
  return `<div class="reader-resource-demo"><p class="reader-resource-boundary"><strong>内存演示</strong> · 字体与图片的渠道测速、回执和本机选择为情境模拟，不发起 CDN GET、不写业务配置。当前卡片仍使用本页真实同源批准 TTF 和内置配图；演示渠道不会冒充画布来源。</p><p class="caption">正式客户端仅测已批准精确地址：同一资源，每渠道完整 GET 一次；串行、最多 12 MiB、每渠道 15 秒、总计 60 秒、完成或取消后冷却 60 秒。字体与图片同时仅测一项；关闭面板或隐藏页面时取消。</p><label class="field">测速网络 · 演示<select id="reader-resource-network"${resourceChannelDemo.run ? ' disabled' : ''}>${[['wifi', 'Wi-Fi'], ['cellular', '4G / 5G'], ['unknown', '未知网络']].map(([id, label]) => `<option value="${id}"${resourceChannelDemo.network === id ? ' selected' : ''}>${label}</option>`).join('')}</select></label><p class="caption" id="reader-resource-cooldown">${resourceDemoCooldown() ? `冷却中 · 还剩 ${resourceDemoCooldown()} 秒` : '可手动测速 · 尚未测速的渠道显示“未测”'}</p><div class="reader-resource-actions"><button type="button" class="quiet" id="reader-resource-cancel" data-action="resource-cancel"${resourceChannelDemo.run ? '' : ' disabled'}>取消测速</button><button type="button" class="quiet" id="reader-resource-reset" data-action="resource-reset-demo">重置内存演示</button></div><p class="caption" id="reader-resource-demo-status" role="status" aria-live="polite" tabindex="-1">${resourceChannelDemo.run ? `正在演示${resourceChannelDemo.run.kind === 'fonts' ? '字体' : '图片'}渠道测速；此页不下载测试样本。` : '刷新页面或“重置内存演示”只清除演示记录和选择。'}</p>${['fonts', 'images'].map(resourceGroupMarkup).join('')}</div>`;
}
function refreshResourceDiagnostics() {
  if (state.sheet !== 'about') return;
  const host = $('#reader-resource-diagnostics');
  if (!host) return;
  const body = $('#reader-sheet-body'), scroll = body?.scrollTop;
  const focused = document.activeElement?.closest?.('#reader-resource-diagnostics') ? document.activeElement.id : '';
  host.innerHTML = resourceDiagnosticsBody();
  if (body && scroll !== undefined) body.scrollTop = scroll;
  if (focused) {
    const next = $(`#${focused}`);
    (next && !next.disabled ? next : $('#reader-resource-demo-status'))?.focus?.({ preventScroll: true });
  }
}
function scheduleResourceCooldown() {
  clearTimeout(resourceChannelDemo.cooldownTimer); resourceChannelDemo.cooldownTimer = undefined;
  if (state.sheet !== 'about' || document.hidden || !resourceDemoCooldown()) return;
  resourceChannelDemo.cooldownTimer = setTimeout(() => {
    resourceChannelDemo.cooldownTimer = undefined;
    const node = $('#reader-resource-cooldown');
    if (node) node.textContent = resourceDemoCooldown() ? `冷却中 · 还剩 ${resourceDemoCooldown()} 秒` : '可手动测速';
    if (resourceDemoCooldown()) scheduleResourceCooldown(); else refreshResourceDiagnostics();
  }, 1000);
}
function finishResourceDemoRun(run, message, redraw = true) {
  if (resourceChannelDemo.run !== run) return;
  clearTimeout(run.timer); clearTimeout(run.channelTimer); clearTimeout(run.overallTimer);
  resourceChannelDemo.run = undefined; ++resourceChannelDemo.generation;
  resourceChannelDemo.groups[run.kind].message = message;
  resourceChannelDemo.cooldownUntil = Date.now() + RESOURCE_DEMO_LIMITS.cooldownMs;
  if (redraw) { refreshResourceDiagnostics(); scheduleResourceCooldown(); }
}
function cancelResourceDemo(reason = '用户取消', redraw = true) {
  const run = resourceChannelDemo.run;
  if (!run) return false;
  const record = resourceChannelDemo.groups[run.kind].records[run.activeId];
  if (record?.status === 'running') { record.status = 'cancelled'; record.notice = reason; }
  finishResourceDemoRun(run, `${reason} · 已完成记录保留，其余渠道未测；冷却 60 秒。`, redraw);
  return true;
}
function stopResourceDiagnostics(reason, redraw = false) {
  cancelResourceDemo(reason, redraw);
  clearTimeout(resourceChannelDemo.cooldownTimer); resourceChannelDemo.cooldownTimer = undefined;
}
function nextResourceDemoChannel(run) {
  if (resourceChannelDemo.run !== run || run.generation !== resourceChannelDemo.generation) return;
  const channel = run.channels[run.next++];
  if (!channel) { finishResourceDemoRun(run, '本轮内存演示完成；成功记录可参与后续自动选择，失败渠道按顺序回退。'); return; }
  const group = resourceChannelDemo.groups[run.kind];
  run.activeId = channel.id;
  const record = group.records[channel.id] = { status: 'running', network: run.network, sampleKey: resourceDemoKey(run.sample) };
  const started = Date.now();
  const settle = (success, notice = '') => {
    if (resourceChannelDemo.run !== run || run.generation !== resourceChannelDemo.generation || record.status !== 'running') return;
    clearTimeout(run.timer); clearTimeout(run.channelTimer);
    Object.assign(record, { status: success ? 'success' : 'failed', elapsedMs: Date.now() - started, bytes: success ? run.sample.bytes : 0, measuredAt: Date.now(), notice });
    nextResourceDemoChannel(run);
  };
  run.channelTimer = setTimeout(() => settle(false, '每渠道 15 秒上限 · 超时演示'), RESOURCE_DEMO_LIMITS.channelMs);
  run.timer = setTimeout(() => settle(!(group.scenario === 'failure' && channel.index === 0), group.scenario === 'failure' && channel.index === 0 ? '下载失败情境 · 后续渠道继续' : ''), RESOURCE_DEMO_DELAYS[run.kind][channel.index]);
  refreshResourceDiagnostics();
}
function startResourceDemo(kind) {
  if (!resourceChannelDemo.groups[kind] || state.sheet !== 'about' || document.hidden || resourceChannelDemo.run || resourceDemoCooldown()) return false;
  const plan = resourceDemoPlan(kind), group = resourceChannelDemo.groups[kind];
  if (plan.reason) { group.message = plan.reason; refreshResourceDiagnostics(); return false; }
  group.records = Object.fromEntries(plan.channels.map(channel => [channel.id, { status: channel.available ? 'unmeasured' : 'unavailable' }]));
  group.message = '正在演示；不会重新下载卡片缓存或测试样本。';
  const run = { kind, sample: { ...plan.sample }, channels: plan.channels.filter(row => row.available), network: resourceDemoNetwork(), next: 0, generation: ++resourceChannelDemo.generation };
  resourceChannelDemo.run = run;
  run.overallTimer = setTimeout(() => {
    if (resourceChannelDemo.run !== run) return;
    const record = group.records[run.activeId];
    if (record?.status === 'running') { record.status = 'failed'; record.notice = '总计 60 秒上限 · 已停止演示'; }
    finishResourceDemoRun(run, '已达到总计 60 秒上限；剩余渠道未测。');
  }, RESOURCE_DEMO_LIMITS.totalMs);
  nextResourceDemoChannel(run);
  $('#reader-resource-cancel')?.focus?.({ preventScroll: true });
  return true;
}
function setResourceDemoPreference(kind, provider = '') {
  const group = resourceChannelDemo.groups[kind];
  if (!group || resourceChannelDemo.run || provider && !RESOURCE_DEMO_CHANNELS[kind].some(row => row.id === provider)) return false;
  group.preferred = provider;
  group.message = provider ? '已更新本机优先选择 · 内存演示；仅作用于后续下载，已有有效缓存保留，地址缺失或失败时回退。' : '已恢复自动 · 内存演示；已有有效缓存与下载来源保留。';
  refreshResourceDiagnostics(); return true;
}
function simulateResourceDownload(kind) {
  const group = resourceChannelDemo.groups[kind];
  if (!group || resourceChannelDemo.run) return false;
  const plan = resourceDemoPlan(kind), key = resourceDemoKey(plan.sample);
  if (!plan.sample) return false;
  const cached = group.cache.get(key);
  if (cached) { group.downloads.set(key, { source: cached.source, hit: true }); group.message = '命中已有有效缓存 · 内存演示；优先选择未触发重下，来源保持原下载渠道。'; }
  else {
    const candidates = plan.channels.filter(channel => channel.available && !(group.scenario === 'failure' && channel.index === 0));
    const score = channel => { const record = group.records[channel.id]; return record?.status === 'success' && record.sampleKey === key && record.network === resourceDemoNetwork() ? record.elapsedMs : Infinity; };
    candidates.sort((a, b) => a.id === group.preferred ? -1 : b.id === group.preferred ? 1 : score(a) - score(b) || a.index - b.index);
    const channel = candidates[0];
    if (channel) { group.cache.set(key, { source: channel.name, sha256: plan.sample.sha256, bytes: plan.sample.bytes }); group.downloads.set(key, { source: channel.name, hit: false }); group.message = `后续下载来自 ${channel.name} · 内存演示${group.preferred && channel.id !== group.preferred ? '；优先渠道地址缺失或失败，已回退' : ''}。本页真实画布没有重新加载。`; }
    else { group.downloads.set(key, { source: '无可用渠道 · 演示回退', hit: false }); group.message = '没有可用地址；保留正文与原有缓存 · 内存演示。'; }
  }
  refreshResourceDiagnostics(); return true;
}
function resetResourceDemo() {
  stopResourceDiagnostics('重置内存演示', false);
  resourceChannelDemo.cooldownUntil = 0;
  for (const group of Object.values(resourceChannelDemo.groups)) { group.preferred = ''; group.records = {}; group.cache.clear(); group.downloads.clear(); group.message = '已重置内存演示；本页真实卡片和加载状态保留。'; }
  refreshResourceDiagnostics();
}
function aboutBody() {
  return `<div class="reader-about"><div><h2>拾光撷语 / DAYLIGHT</h2><p>每天一页，把喜欢留下。</p></div><section><h3>内容状态 · 设计样例</h3><p>实际页面优先使用在线精选，网络不可用时显示缓存或内置内容。此页从未请求内容服务；日期与内容状态仅为设计演示。</p><button type="button" class="quiet" data-action="refresh">检查内容更新 · 模拟</button></section><section><h3>当前内置内容</h3><p>此设计资源仅含几句公开诗词和原创样例，不是业务工作区快照。</p></section><section><h3>隐私与使用说明</h3><p>不提供登录、收藏、点赞或公开投稿。实际小程序中的照片与创作文字只在本机处理，仅在保存时申请相册权限。远程内容服务会收到必要的网络请求信息。</p><button class="quiet" type="button" data-action="guide">查看隐私保护指引 · 设计说明</button></section><section><h3>资源与诊断</h3><p id="reader-resource-summary">${h(resourceSummary())}</p><label class="reader-loading-preference"><span><span>显示卡片加载提示</span><small id="reader-loading-hints-help">开发调试使用，默认关闭</small></span><input type="checkbox" role="switch" id="reader-show-loading-hints" aria-describedby="reader-loading-hints-help" ${state.showLoadingHints ? 'checked' : ''}></label><p class="caption">开关仅在本页内存保留，刷新后重置；只控制加载过程提示，不影响卡片、重试或保存权限。</p><div id="reader-resource-diagnostics">${resourceDiagnosticsBody()}</div><button class="quiet" type="button" data-action="font-info">查看本地字体状态</button></section></div>`;
}
function privacyBody() {
  return '<p class="privacy-copy">选择照片与保存卡片前，展示隐私说明和用户选择。此处不申请系统权限，也不读取真实照片。</p><button type="button" class="quiet" data-action="guide">阅读《用户隐私保护指引》设计说明</button><div class="privacy-actions"><button type="button" data-action="privacy-disagree">暂不同意</button><button type="button" class="primary" data-action="privacy-agree">同意并继续 · 模拟</button></div>';
}
function renderSheet() {
  ++sheetGeneration; invalidateSheetPreview();
  $('#reader-sheet-title').textContent = titles[state.sheet];
  const body = $('#reader-sheet-body');
  const builders = { dates: datesBody, create: createBody, export: exportBody, about: aboutBody, privacy: privacyBody, share: shareBody, fulltext: () => `<p class="reader-fulltext">${h(readingCard().text)}</p><p class="caption">${h(readingCard().author)} · ${h(readingCard().source)}</p><button type="button" class="primary wide" data-action="export-daily">保存为卡片</button>`, guide: () => '<p class="privacy-copy">本页不是正式隐私协议。交互示意不传输文字、图片或凭据，不调用业务接口；只会请求同源设计文件、内置配图、目录和字体资源。</p><p class="caption">实际授权条款以小程序展示的《用户隐私保护指引》为准。</p><button class="primary" type="button" data-action="back-privacy">返回</button>' };
  body.innerHTML = builders[state.sheet]();
  syncLoadingHints();
  body.scrollTop = 0;
  if (state.sheet === 'about') scheduleResourceCooldown();
  if (state.sheet === 'export') updateExport();
}
function exportIdentity() {
  return JSON.stringify([exportCard(), state.template, state.fontId, state.showDate, state.showBrand, state.exportFromDraft ? 'draft' : state.scenario]);
}
function validExport() {
  return state.sheet === 'export' && exportReady?.sheet === sheetGeneration && exportReady?.version === exportGeneration && exportReady?.key === exportIdentity() && $('#reader-export-canvas')?.isConnected;
}
async function updateExport(mode = state.loadingMode) {
  invalidateSheetPreview();
  const version = exportGeneration;
  const sheet = sheetGeneration;
  const canvas = $('#reader-export-canvas');
  if (!canvas || state.sheet !== 'export') return;
  const current = () => version === exportGeneration && sheet === sheetGeneration && state.sheet === 'export' && canvas.isConnected;
  const button = $('#reader-save');
  const preview = $('.reader-export-preview');
  const status = $('#reader-export-status');
  const retry = $('[data-action="retry-export"]');
  const key = exportIdentity();
  const selectedFontId = state.fontId;
  button.disabled = true; retry.hidden = true;
  preview.setAttribute('aria-disabled', 'true'); preview.tabIndex = -1; preview.classList.remove('zoomed');
  const card = previewPayload(exportCard(), !state.exportFromDraft && state.scenario === 'image-error');
  const codeTask = imageReady(preview.querySelector('.reader-code-footer img'));
  let codeLoaded, latestResult;
  const display = result => {
    if (!current() || codeLoaded === undefined) return;
    const code = preview.querySelector('.reader-code-footer img');
    // The result records the body font actually painted. Attribution-only system
    // fallback is explicit in the shared renderer and does not replace the body.
    const originalFontReady = Boolean(result && !result.fontFailure && result.fontState === (selectedFontId === 'system' ? 'system' : 'loaded'));
    const valid = Boolean(result?.displayReady && originalFontReady && result.imageState === 'ready' && codeLoaded && code.naturalWidth === 280 && code.naturalHeight === 280 && key === exportIdentity());
    exportReady = valid ? { version, sheet, key } : undefined;
    button.disabled = !valid;
    preview.setAttribute('aria-disabled', String(!valid)); preview.tabIndex = valid ? 0 : -1;
    retry.hidden = Boolean(result && (valid || mode === 'hold'));
    if (!codeLoaded || code.naturalWidth !== 280 || code.naturalHeight !== 280) { status.textContent += ' · 固定小程序码未就绪，不能保存或放大。'; retry.hidden = false; }
    else if (result?.displayReady && result.imageState !== 'ready') { status.textContent += ' · 配图未就绪，不能保存或放大。'; retry.hidden = false; }
    else if (result?.displayReady && !originalFontReady) { status.textContent += ' · 当前字体仍为回退，不能当作原版保存；可重试或明确选择系统字体。'; retry.hidden = false; }
    if (valid) status.textContent += ' · 码区独立 360px，合计 1080 × 1800。';
    if (!retry.hidden) { status.dataset.loadingHint = 'false'; status.hidden = false; }
  };
  const [result, codeReady] = await Promise.all([paintPreview(canvas, card, { template: state.template, fontId: selectedFontId, showDate: state.showDate, showBrand: state.showBrand, productionFontGate: true }, status, { ...presentationOptions(mode), onReady: value => { latestResult = value; display(value); } }), codeTask]);
  codeLoaded = codeReady;
  display(latestResult || result);
}
function requirePrivacy(action) {
  if (action === 'save') {
    if (!validExport()) return;
    pendingSave = { key: exportIdentity() };
  }
  state.nextPrivacyAction = action;
  if (state.privacy) return completePrivacyAction(action);
  openSheet('privacy');
}
function completePrivacyAction(action) {
  if (action === 'photo') { state.draftPhoto = true; state.nextPrivacyAction = ''; openSheet('create'); announce('已加入内置照片示例；没有读取或上传照片。'); }
  if (action === 'save') {
    if (!pendingSave || pendingSave.key !== exportIdentity()) { announce('预览已变更，请重新确认就绪后再保存。'); return; }
    state.saved = true; state.nextPrivacyAction = ''; openSheet('export'); announce('保存完成反馈已演示；未写入相册，也未下载文件。');
  }
}
function setLoadingPaused(paused) {
  state.loadingPaused = paused;
  setCardPreviewPaused($('#reader-layout-canvas'), paused);
  setCardPreviewPaused($('#reader-export-canvas'), paused);
  updateDemoStatus();
}
function setLoadingMode(mode) {
  setLoadingPaused(false);
  state.loadingMode = mode;
  pendingSave = undefined;
  updateDemoStatus();
  renderDaily();
  if (state.sheet === 'export') updateExport();
}
function retryCard() {
  state.scenario = state.scenario === 'image-error' ? 'normal' : state.scenario;
  state.loadScenario = 'auto'; state.loadingMode = 'auto';
  $('#reader-scenario').value = state.scenario; $('#reader-load-scenario').value = 'auto';
  updateDemoStatus(); renderDaily();
  if (state.sheet === 'export') updateExport();
  announce('已重新准备当前卡片；演示失败已重置，实际小程序会丢弃失败预览缓存后重试。');
}
function shiftDay(offset) {
  const next = dateOffset(state.date, offset);
  if (next < '2026-10-01' || next > '2026-11-12') { announce('已到示例日期边界。'); return; }
  state.date = next; renderDaily(); announce(`已切换示例日期 ${next}`);
}
document.addEventListener('click', event => {
  const node = event.target.closest('button[data-action],[role="button"][data-action],button[data-date],button[data-template],button[data-font],button[data-export-tab]');
  if (!node || node.disabled || node.getAttribute('aria-disabled') === 'true') return;
  if (!catalog && !['close', 'fulltext', 'about', 'guide', 'share'].includes(node.dataset.action)) return;
  if (node.dataset.date) { state.date = node.dataset.date; renderDaily(); closeSheet(); return; }
  if (node.dataset.template) {
    const picked = catalog?.templates.find(row => row.id === node.dataset.template);
    // 与小程序一致：换版式即采用该版式推荐字体，随后仍可在字体页覆盖。
    if (picked && picked.recommendedFont) state.fontId = picked.recommendedFont;
    state.template = node.dataset.template; renderSheet(); return;
  }
  if (node.dataset.font) { state.fontId = node.dataset.font; renderSheet(); return; }
  if (node.dataset.exportTab) { state.exportTab = node.dataset.exportTab; renderSheet(); return; }
  const action = node.dataset.action;
  if (['dates', 'create', 'fulltext', 'about', 'guide', 'share'].includes(action)) { openSheet(action); return; }
  switch (action) {
    case 'close': closeSheet(); break;
    case 'older': shiftDay(-1); break;
    case 'today': state.date = TODAY; renderDaily(); break;
    case 'retry-image':
    case 'retry-card':
    case 'retry-export': retryCard(); break;
    case 'export-daily': if (state.scenario !== 'empty') { state.exportFromDraft = false; openExport(); } break;
    case 'export-draft': if (!state.draftText.trim()) $('#create-error').textContent = '请先写一句话。'; else if (Array.from(state.draftText).length > 240 || Array.from(state.draftAuthor).length > 45 || Array.from(state.draftSource).length > 45) $('#create-error').textContent = '请检查正文、作者与出处长度。'; else openExportDraft(); break;
    case 'loading-pause': setLoadingPaused(!state.loadingPaused); break;
    case 'loading-hold': setLoadingMode(state.loadingMode === 'hold' ? state.loadScenario : 'hold'); break;
    case 'loading-replay': setLoadingMode(state.loadScenario === 'auto' ? 'replay' : state.loadScenario); break;
    case 'loading-instant': state.loadScenario = 'auto'; $('#reader-load-scenario').value = 'auto'; setLoadingMode('instant'); break;
    case 'photo': requirePrivacy('photo'); break;
    case 'remove-photo': state.draftPhoto = false; renderSheet(); break;
    case 'save': requirePrivacy('save'); break;
    case 'privacy-agree': state.privacy = true; completePrivacyAction(state.nextPrivacyAction); break;
    case 'privacy-disagree': openSheet(state.nextPrivacyAction === 'photo' ? 'create' : 'export'); announce('已取消本次权限示意，不影响继续阅读。'); break;
    case 'back-privacy': openSheet(state.nextPrivacyAction && !state.privacy ? 'privacy' : 'about'); break;
    case 'zoom': if (validExport()) node.classList.toggle('zoomed'); break;
    case 'refresh': announce('设计页不连接内容服务。已演示检查更新反馈。'); break;
    case 'font-info': announce('在保存卡片面板选择字体，可查看真实本地加载和回退状态。真机诊断不在这里执行。'); break;
    case 'resource-test': startResourceDemo(node.dataset.resourceKind); break;
    case 'resource-cancel': cancelResourceDemo(); break;
    case 'resource-prefer': setResourceDemoPreference(node.dataset.resourceKind, node.dataset.provider); break;
    case 'resource-auto': setResourceDemoPreference(node.dataset.resourceKind); break;
    case 'resource-download-demo': simulateResourceDownload(node.dataset.resourceKind); break;
    case 'resource-reset-demo': resetResourceDemo(); break;
  }
});
document.addEventListener('input', event => {
  if (event.target.dataset.draft) {
    const field = event.target.dataset.draft;
    const limit = field === 'draftText' ? 240 : 45;
    state[field] = Array.from(event.target.value).slice(0, limit).join('');
    if (field === 'draftText') $('#draft-count').textContent = `${Array.from(state.draftText).length} / 240`;
  }
});
document.addEventListener('click', event => {
  const node = event.target.closest('[data-visual-reset]');
  if (!node || !node.closest('[data-shared-visual-controls]')) return;
  event.preventDefault(); event.stopPropagation();
  try { resetTemplateVisualTokens(node.dataset.visualReset); renderDaily(); if (state.sheet === 'export') updateExport(); }
  catch (error) { announce(error.message); }
});
document.addEventListener('change', event => {
  if (event.target.dataset.resourceSample || event.target.dataset.resourceScenario || event.target.id === 'reader-resource-network') {
    if (resourceChannelDemo.run) return;
    const kind = event.target.dataset.resourceSample || event.target.dataset.resourceScenario;
    if (event.target.id === 'reader-resource-network' && ['wifi', 'cellular', 'unknown'].includes(event.target.value)) resourceChannelDemo.network = event.target.value;
    else if (resourceChannelDemo.groups[kind]) {
      const group = resourceChannelDemo.groups[kind];
      if (event.target.dataset.resourceSample && resourceDemoSamples(kind).some(row => row.id === event.target.value)) group.sampleId = event.target.value;
      else if (event.target.dataset.resourceScenario && ['missing', 'success', 'failure', 'insufficient'].includes(event.target.value)) group.scenario = event.target.value;
      group.records = {}; group.message = '已切换演示样本或地址情境；尚未测速，已有缓存与优先选择保留。';
    }
    refreshResourceDiagnostics(); return;
  }
  const visual = event.target.closest?.('[data-visual-enabled],[data-visual-token]');
  if (visual && visual.closest('[data-shared-visual-controls]')) {
    const selected = catalog?.templates.find(row => row.id === (state.readerTemplate === 'follow' ? readingCard().template : state.readerTemplate));
    if (!selected) return;
    const field = visual.dataset.visualEnabled || visual.dataset.visualToken;
    try {
      if (visual.dataset.visualEnabled) {
        const input = visual.closest('label').querySelector(`[data-visual-token="${field}"]`); input.disabled = !visual.checked;
        updateTemplateVisualToken(selected.id, field, input.value, visual.checked);
      } else if (field === 'fontScale' || field === 'lineHeightScale') updateTemplateVisualToken(selected.id, field, visual.value);
      else updateTemplateVisualToken(selected.id, field, visual.value, visual.closest('label').querySelector(`[data-visual-enabled="${field}"]`).checked);
      renderDaily(); if (state.sheet === 'export') updateExport();
    } catch (error) { announce(error.message); }
    return;
  }
  if (event.target.id === 'reader-scenario') {
    state.scenario = event.target.value; pendingSave = undefined; renderDaily();
    if (state.sheet === 'export') { if (state.scenario === 'empty' && !state.exportFromDraft) closeSheet(); else updateExport(); }
    else if (['fulltext', 'share'].includes(state.sheet)) renderSheet();
  }
  else if (event.target.id === 'reader-template' && (event.target.value === 'follow' || catalog?.templates.some(row => row.id === event.target.value))) {
    state.readerTemplate = event.target.value; pendingSave = undefined; renderDaily();
    if (state.sheet === 'export' && !state.exportFromDraft) { const card = readingCard(); state.template = card.template; state.fontId = card.font; renderSheet(); }
  }
  else if (event.target.id === 'reader-show-loading-hints') { setLoadingHints(event.target.checked); }
  else if (event.target.id === 'reader-load-scenario') { state.loadScenario = event.target.value; setLoadingMode(state.loadScenario); }
  else if (event.target.id === 'reader-reduce-motion') { state.reduceMotion = event.target.checked; setLoadingMode(state.loadingMode); }
  else if (event.target.id === 'reader-date-picker') { const value = event.target.value; if (/^2026-(10-\d{2}|11-(0\d|1[0-2]))$/.test(value) && value >= '2026-10-01' && value <= '2026-11-12') { state.date = value; renderDaily(); closeSheet(); } }
  else if (event.target.dataset.exportOption) { state[event.target.dataset.exportOption] = event.target.checked; updateExport(); }
});
$('#reader-daily').addEventListener('pointerdown', event => { swipeStart = !state.sheet && !event.target.closest('button') ? { x: event.clientX, y: event.clientY } : undefined; });
$('#reader-daily').addEventListener('pointerup', event => { const start = swipeStart; swipeStart = undefined; if (!start || state.sheet || state.scenario === 'empty') return; const delta = event.clientY - start.y; const horizontal = Math.abs(event.clientX - start.x); if (Math.abs(delta) > 55 && Math.abs(delta) > horizontal * 1.3) shiftDay(delta < 0 ? -1 : 1); });
$('#reader-daily').addEventListener('pointercancel', () => { swipeStart = null; });
document.addEventListener('keydown', event => {
  if (state.sheet) {
    if (event.key === 'Escape') { event.preventDefault(); closeSheet(); }
    if (event.key === 'Tab') {
      const nodes = [...$('.reader-sheet').querySelectorAll('button:not(:disabled),input,textarea,select,[tabindex="0"]')].filter(node => node.getClientRects().length);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  } else if (document.activeElement === $('#reader-daily') && ['ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); shiftDay(event.key === 'ArrowUp' ? -1 : 1); }
  if ((event.key === 'Enter' || event.key === ' ') && document.activeElement?.matches('.reader-export-preview')) { event.preventDefault(); if (validExport()) document.activeElement.classList.toggle('zoomed'); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stopResourceDiagnostics('页面隐藏', false); else if (state.sheet === 'about') { refreshResourceDiagnostics(); scheduleResourceCooldown(); } });
// Render the known local card before catalog/font requests; a failed catalog never leaves a blank phone.
renderDaily();
updateDemoStatus();
try {
  catalog = await loadCatalog();
  const selector = $('#reader-template');
  selector.innerHTML = '<option value="follow">跟随卡片配置</option>' + catalog.templates.map(row => `<option value="${h(row.id)}">${h(row.name)} · ${h(row.description)}</option>`).join('');
  selector.disabled = false;
  // Preserve the first mounted card and its actual 900ms deadline while the catalog arrives.
  const requested = new URLSearchParams(location.search).get('sheet');
  if (requested === 'export') openExport();
  else if (['dates', 'create', 'fulltext', 'about', 'share'].includes(requested)) openSheet(requested);
} catch {
  // A catalog failure must not replace the mounted shared frame or its readable fallback.
  dailyFeedback('正式资源目录暂不可用，请稍后刷新。', false, true);
  announce('正式资源目录暂不可用；已保留本地正文和全文入口，没有用示意图冒充正式画布。');
}
window.addEventListener('pagehide', () => { stopResourceDiagnostics('页面离开', false); cancelDaily(); ++sheetGeneration; invalidateSheetPreview(); });
