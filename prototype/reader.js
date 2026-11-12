import { loadCatalog, previewFrame, paintPreview, cancelCardPreview, setCardPreviewPaused, setCardLoadingHints, skeletonPreview, backgroundImage, resourceUrl, escapeHTML as h, bindTheme } from './shared/card-preview.js';

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
function aboutBody() {
  return `<div class="reader-about"><div><h2>拾光撷语 / DAYLIGHT</h2><p>每天一页，把喜欢留下。</p></div><section><h3>内容状态 · 设计样例</h3><p>实际页面优先使用在线精选，网络不可用时显示缓存或内置内容。此页从未请求内容服务；日期与内容状态仅为设计演示。</p><button type="button" class="quiet" data-action="refresh">检查内容更新 · 模拟</button></section><section><h3>当前内置内容</h3><p>此设计资源仅含几句公开诗词和原创样例，不是业务工作区快照。</p></section><section><h3>隐私与使用说明</h3><p>不提供登录、收藏、点赞或公开投稿。实际小程序中的照片与创作文字只在本机处理，仅在保存时申请相册权限。远程内容服务会收到必要的网络请求信息。</p><button class="quiet" type="button" data-action="guide">查看隐私保护指引 · 设计说明</button></section><section><h3>资源与诊断</h3><p id="reader-resource-summary">${h(resourceSummary())}</p><label class="reader-loading-preference"><span><span>显示卡片加载提示</span><small id="reader-loading-hints-help">开发调试使用，默认关闭</small></span><input type="checkbox" role="switch" id="reader-show-loading-hints" aria-describedby="reader-loading-hints-help" ${state.showLoadingHints ? 'checked' : ''}></label><p class="caption">开关仅在本页内存保留，刷新后重置；只控制加载过程提示，不影响卡片、重试或保存权限。</p><p>真机诊断仍在实际小程序执行；设计页只显示本地字体加载结果。</p><button class="quiet" type="button" data-action="font-info">查看本地字体状态</button></section></div>`;
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
  button.disabled = true; retry.hidden = true;
  preview.setAttribute('aria-disabled', 'true'); preview.tabIndex = -1; preview.classList.remove('zoomed');
  const card = previewPayload(exportCard(), !state.exportFromDraft && state.scenario === 'image-error');
  const codeTask = imageReady(preview.querySelector('.reader-code-footer img'));
  let codeLoaded, latestResult;
  const display = result => {
    if (!current() || codeLoaded === undefined) return;
    const code = preview.querySelector('.reader-code-footer img');
    const originalFontReady = ['system', 'loaded'].includes(canvas.dataset.fontState);
    const valid = Boolean(result?.displayReady && originalFontReady && result.imageState === 'ready' && codeLoaded && code.naturalWidth === 280 && code.naturalHeight === 280 && key === exportIdentity());
    if (valid) exportReady = { version, sheet, key };
    button.disabled = !valid;
    preview.setAttribute('aria-disabled', String(!valid)); preview.tabIndex = valid ? 0 : -1;
    retry.hidden = Boolean(result && (valid || mode === 'hold'));
    if (!codeLoaded || code.naturalWidth !== 280 || code.naturalHeight !== 280) { status.textContent += ' · 固定小程序码未就绪，不能保存或放大。'; retry.hidden = false; }
    else if (result?.displayReady && result.imageState !== 'ready') { status.textContent += ' · 配图未就绪，不能保存或放大。'; retry.hidden = false; }
    else if (result?.displayReady && !originalFontReady) { status.textContent += ' · 当前字体仍为回退，不能当作原版保存；可重试或明确选择系统字体。'; retry.hidden = false; }
    if (valid) status.textContent += ' · 码区独立 360px，合计 1080 × 1800。';
    if (!retry.hidden) { status.dataset.loadingHint = 'false'; status.hidden = false; }
  };
  const [result, codeReady] = await Promise.all([paintPreview(canvas, card, { template: state.template, fontId: state.fontId, showDate: state.showDate, showBrand: state.showBrand }, status, { ...presentationOptions(mode), onReady: value => { latestResult = value; display(value); } }), codeTask]);
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
  const node = event.target.closest('[data-action],[data-date],[data-template],[data-font],[data-export-tab]');
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
document.addEventListener('change', event => {
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
window.addEventListener('pagehide', () => { cancelDaily(); ++sheetGeneration; invalidateSheetPreview(); });
