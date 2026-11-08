import { loadCatalog, paintPreview, backgroundImage, escapeHTML as h, bindTheme } from './shared/card-preview.js';

bindTheme();
const TODAY = '2026-11-05';
const poems = [
  { text: '行到水穷处，\n坐看云起时。', author: '王维', source: '终南别业', background: 'mist' },
  { text: '明月松间照，\n清泉石上流。', author: '王维', source: '山居秋暝', background: 'dusk' },
  { text: '采菊东篱下，\n悠然见南山。', author: '陶渊明', source: '饮酒·其五', background: 'sea' },
];
const longText = '夫君子之行，静以修身，俭以养德。非淡泊无以明志，非宁静无以致远。夫学须静也，才须学也；非学无以广才，非志无以成学。淫慢则不能励精，险躁则不能治性。年与时驰，意与日去，遂成枯落，多不接世，悲守穷庐，将复何及！';
const state = { date: TODAY, scenario: 'normal', sheet: '', template: 'paper', fontId: 'system', showDate: true, showBrand: true, exportFromDraft: false, draftText: '给日子留一点空白，让喜欢的事慢慢发生。', draftAuthor: '此刻的我', draftSource: '原创设计样例', draftPhoto: false, privacy: false, nextPrivacyAction: '', saved: false };
const $ = selector => document.querySelector(selector);
let catalog;
let priorFocus;
let swipeStart;
let renderVersion = 0;
const titles = { dates: '翻到某一天', create: '写一张', export: '保存卡片', fulltext: '展开全文', about: '关于拾光撷语', privacy: '保护你的隐私', guide: '隐私保护指引 · 设计说明' };

function dateOffset(value, offset) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
function announce(text) { $('#reader-announcement').textContent = text; }
function readingCard() {
  const index = Math.abs(Math.round((Date.parse(`${state.date}T12:00:00Z`) - Date.parse(`${TODAY}T12:00:00Z`)) / 86400000)) % poems.length;
  return { ...poems[index], ...(state.scenario === 'long' ? { text: longText, author: '诸葛亮', source: '诫子书' } : {}), date: state.date };
}
function exportCard() {
  return state.exportFromDraft ? { text: state.draftText, author: state.draftAuthor, source: state.draftSource, background: state.draftPhoto ? 'dusk' : 'mist', date: state.date } : readingCard();
}
function renderDaily() {
  const card = readingCard();
  const date = new Date(`${state.date}T12:00:00Z`);
  const [year, month, day] = state.date.split('-');
  const recentLabel = state.date === TODAY ? '今日' : state.date > TODAY ? '已排期未来 · 示例' : '往日';
  const heading = `<div class="reader-date-row"><button class="reader-date" type="button" data-action="dates" aria-label="选择日期 ${h(state.date)}"><span class="reader-day">${day}</span><span class="reader-date-meta"><span>${month}月 · 周${'日一二三四五六'[date.getUTCDay()]}</span><small>${year}　⌄</small></span></button>${state.date === TODAY ? '<span class="reader-today">今日</span>' : '<button class="quiet small" type="button" data-action="today">回到今天 ↗</button>'}</div>`;
  let body;
  if (state.scenario === 'empty') body = '<div class="reader-empty"><h2>这一天，还没有写下。</h2><p class="caption">可以先做一张属于自己的卡片。</p><button class="primary" data-action="create">写一张</button></div>';
  else {
    const text = state.scenario === 'long' ? `${Array.from(card.text).slice(0, 65).join('')}…` : card.text;
    body = `${state.scenario === 'image-error' ? '<div class="reader-image-fallback"><span>图片暂不可用 · 示意状态</span><button type="button" class="quiet" data-action="retry-image">重试示例图片</button></div>' : `<img class="reader-image" src="${backgroundImage(card.background)}" alt="内置山水配图">`}<div class="reader-image-caption"><span>诗词 · ${recentLabel}</span><span>DAYLIGHT</span></div><div class="reader-words ${state.scenario === 'long' ? 'long' : ''}"><p>${h(text)}</p>${state.scenario === 'long' ? '<button type="button" class="quiet" data-action="fulltext">展开全文 ↗</button>' : ''}<span class="reader-source">${h(card.author)} · ${h(card.source)}</span></div>`;
  }
  $('#reader-daily').innerHTML = heading + body;
  $('[data-action="export-daily"]').disabled = state.scenario === 'empty';
  $('.swipe-hint').disabled = state.scenario === 'empty';
}
function openSheet(name) {
  if (!state.sheet) priorFocus = document.activeElement;
  state.sheet = name;
  $('#reader-overlay').hidden = false;
  $('#reader-underlay').inert = true;
  renderSheet();
  $('.reader-sheet-head [data-action="close"]').focus({ preventScroll: true });
}
function closeSheet() {
  state.sheet = '';
  ++renderVersion;
  $('#reader-overlay').hidden = true;
  $('#reader-underlay').inert = false;
  if (priorFocus?.isConnected) priorFocus.focus({ preventScroll: true });
}
function datesBody() {
  const recent = Array.from({ length: 7 }, (_, index) => dateOffset(TODAY, -index));
  return `<label class="field">选择日期<input type="date" id="reader-date-picker" value="${state.date}" min="2026-10-01" max="2026-11-12"></label><p class="caption">设计样例覆盖 2026-10-01 至 2026-11-12；已排期的未来日期也可单独查看。</p><h3 class="small">最近几日</h3><div class="recent-days">${recent.map((date, index) => `<button type="button" data-date="${date}" class="recent-row ${date === state.date ? 'active' : ''}"><span>${date}</span><span>${h(poems[index % poems.length].text.replace(/\n/g, ''))}</span></button>`).join('')}</div>`;
}
function createBody() {
  return `<p class="caption">一句话，一张图。写成自己的一页。</p><label class="field"><span class="row between"><span>写下文字</span><span id="draft-count">${Array.from(state.draftText).length} / 240</span></span><textarea id="reader-draft-text" data-draft="draftText" maxlength="240" placeholder="写下你想留下的一句话…">${h(state.draftText)}</textarea></label><div class="field-pair"><label class="field">作者 · 选填<input data-draft="draftAuthor" maxlength="45" value="${h(state.draftAuthor)}" placeholder="作者"></label><label class="field">出处 · 选填<input data-draft="draftSource" maxlength="45" value="${h(state.draftSource)}" placeholder="作品 / 你的落款"></label></div><button type="button" class="reader-photo-demo" data-action="photo">${state.draftPhoto ? `<img src="${backgroundImage('dusk')}" alt="示例照片">` : '<span aria-hidden="true">＋</span>'}<span>${state.draftPhoto ? '更换照片 · 示例' : '选择自己的照片 · 示例'}<small>不打开文件选择器，只用内置图片演示</small></span></button>${state.draftPhoto ? '<button class="quiet small" type="button" data-action="remove-photo">移除照片</button>' : ''}<p class="reader-error" id="create-error" role="alert"></p><button type="button" class="primary wide" data-action="export-draft">选个模板，看看效果 →</button><p class="caption center">本页只在内存保留输入，关闭面板不清空；刷新后重置。不上传，不持久保存。</p>`;
}
function exportBody() {
  return `<figure class="reader-export-preview" data-action="zoom" tabindex="0" role="button" aria-label="放大卡片预览"><canvas class="preview-canvas" id="reader-export-canvas" width="1080" height="1440" role="img" aria-label="同源导出画布"></canvas></figure><div class="reader-template-options" role="group" aria-label="${catalog.templates.length}款制卡模板">${catalog.templates.map(row => `<button type="button" data-template="${row.id}" aria-pressed="${state.template === row.id}">${h(row.name)}<small>${h(row.description)}</small></button>`).join('')}</div><div class="row between"><strong class="small">卡片字体</strong><span class="caption">点击预览图可放大</span></div><div class="reader-font-options" role="group" aria-label="${catalog.fonts.length}种卡片字体">${catalog.fonts.map(row => `<button type="button" data-font="${row.id}" aria-pressed="${state.fontId === row.id}">${h(row.name)}</button>`).join('')}</div><p class="preview-status" id="reader-export-status" role="status" aria-live="polite"></p><div class="reader-options"><label><input type="checkbox" data-export-option="showDate" ${state.showDate ? 'checked' : ''}>日期</label><label><input type="checkbox" data-export-option="showBrand" ${state.showBrand ? 'checked' : ''}>品牌落款</label><span class="caption">1080 × 1440</span></div><div class="row between">${state.exportFromDraft ? '<button class="quiet" type="button" data-action="create">← 编辑</button>' : ''}<button class="primary" type="button" id="reader-save" data-action="save" disabled>模拟保存图片</button></div><p class="caption center">作者和出处随卡片保留，请确认素材使用权。设计页不会写相册或下载文件。</p>`;
}
function aboutBody() {
  return '<div class="reader-about"><div><h2>拾光撷语 / DAYLIGHT</h2><p>每天一页，把喜欢留下。</p></div><section><h3>内容状态 · 设计样例</h3><p>实际页面优先使用在线精选，网络不可用时显示缓存或内置内容。此页从未请求内容服务；日期与内容状态仅为设计演示。</p><button type="button" class="quiet" data-action="refresh">检查内容更新 · 模拟</button></section><section><h3>当前内置内容</h3><p>此设计资源仅含几句公开诗词和原创样例，不是业务工作区快照。</p></section><section><h3>隐私与使用说明</h3><p>不提供登录、收藏、点赞或公开投稿。实际小程序中的照片与创作文字只在本机处理，仅在保存时申请相册权限。远程内容服务会收到必要的网络请求信息。</p><button class="quiet" type="button" data-action="guide">查看隐私保护指引 · 设计说明</button></section><section><h3>字体诊断入口</h3><p>真机诊断仍在实际小程序执行；设计页只显示本地字体加载结果。</p><button class="quiet" type="button" data-action="font-info">查看本地字体状态</button></section></div>';
}
function privacyBody() {
  return '<p class="privacy-copy">选择照片与保存卡片前，展示隐私说明和用户选择。此处不申请系统权限，也不读取真实照片。</p><button type="button" class="quiet" data-action="guide">阅读《用户隐私保护指引》设计说明</button><div class="privacy-actions"><button type="button" data-action="privacy-disagree">暂不同意</button><button type="button" class="primary" data-action="privacy-agree">同意并继续 · 模拟</button></div>';
}
function renderSheet() {
  $('#reader-sheet-title').textContent = titles[state.sheet];
  const body = $('#reader-sheet-body');
  const builders = { dates: datesBody, create: createBody, export: exportBody, about: aboutBody, privacy: privacyBody, fulltext: () => `<p class="reader-fulltext">${h(readingCard().text)}</p><p class="caption">${h(readingCard().author)} · ${h(readingCard().source)}</p><button type="button" class="primary wide" data-action="export-daily">保存为卡片</button>`, guide: () => '<p class="privacy-copy">本页不是正式隐私协议。交互示意不传输文字、图片或凭据，不调用业务接口；只会请求同源设计文件、三张内置配图、目录和字体资源。</p><p class="caption">实际授权条款以小程序展示的《用户隐私保护指引》为准。</p><button class="primary" type="button" data-action="back-privacy">返回</button>' };
  body.innerHTML = builders[state.sheet]();
  body.scrollTop = 0;
  if (state.sheet === 'export') updateExport();
}
async function updateExport() {
  const version = ++renderVersion;
  const canvas = $('#reader-export-canvas');
  if (!canvas) return;
  const button = $('#reader-save');
  button.disabled = true;
  const result = await paintPreview(canvas, exportCard(), { template: state.template, fontId: state.fontId, showDate: state.showDate, showBrand: state.showBrand }, $('#reader-export-status'));
  if (version === renderVersion && button.isConnected) button.disabled = !result;
}
function requirePrivacy(action) {
  if (state.privacy) return completePrivacyAction(action);
  state.nextPrivacyAction = action;
  openSheet('privacy');
}
function completePrivacyAction(action) {
  if (action === 'photo') { state.draftPhoto = true; openSheet('create'); announce('已加入内置照片示例；没有读取或上传照片。'); }
  if (action === 'save') { state.saved = true; openSheet('export'); announce('保存完成反馈已演示；未写入相册，也未下载文件。'); }
}
function shiftDay(offset) {
  const next = dateOffset(state.date, offset);
  if (next < '2026-10-01' || next > '2026-11-12') { announce('已到示例日期边界。'); return; }
  state.date = next; renderDaily(); announce(`已切换示例日期 ${next}`);
}
document.addEventListener('click', event => {
  if (!catalog) return;
  const node = event.target.closest('[data-action],[data-date],[data-template],[data-font]');
  if (!node || node.disabled) return;
  if (node.dataset.date) { state.date = node.dataset.date; renderDaily(); closeSheet(); return; }
  if (node.dataset.template) { state.template = node.dataset.template; renderSheet(); return; }
  if (node.dataset.font) { state.fontId = node.dataset.font; renderSheet(); return; }
  const action = node.dataset.action;
  if (['dates', 'create', 'fulltext', 'about', 'guide'].includes(action)) { openSheet(action); return; }
  switch (action) {
    case 'close': closeSheet(); break;
    case 'older': shiftDay(-1); break;
    case 'today': state.date = TODAY; renderDaily(); break;
    case 'retry-image': state.scenario = 'normal'; $('#reader-scenario').value = 'normal'; renderDaily(); announce('已恢复内置图片示例。'); break;
    case 'export-daily': if (state.scenario !== 'empty') { state.exportFromDraft = false; openSheet('export'); } break;
    case 'export-draft': if (!state.draftText.trim()) $('#create-error').textContent = '请先写下一句话。'; else if (Array.from(state.draftText).length > 240 || Array.from(state.draftAuthor).length > 45 || Array.from(state.draftSource).length > 45) $('#create-error').textContent = '请检查正文、作者与出处长度。'; else { state.exportFromDraft = true; openSheet('export'); } break;
    case 'photo': requirePrivacy('photo'); break;
    case 'remove-photo': state.draftPhoto = false; renderSheet(); break;
    case 'save': requirePrivacy('save'); break;
    case 'privacy-agree': state.privacy = true; completePrivacyAction(state.nextPrivacyAction); break;
    case 'privacy-disagree': openSheet(state.nextPrivacyAction === 'photo' ? 'create' : 'export'); announce('已取消本次权限示意，不影响继续阅读。'); break;
    case 'back-privacy': openSheet(state.nextPrivacyAction && !state.privacy ? 'privacy' : 'about'); break;
    case 'zoom': node.classList.toggle('zoomed'); break;
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
  if (event.target.id === 'reader-scenario') { state.scenario = event.target.value; renderDaily(); }
  else if (event.target.id === 'reader-date-picker') { const value = event.target.value; if (/^2026-(10-\d{2}|11-(0\d|1[0-2]))$/.test(value) && value >= '2026-10-01' && value <= '2026-11-12') { state.date = value; renderDaily(); closeSheet(); } }
  else if (event.target.dataset.exportOption) { state[event.target.dataset.exportOption] = event.target.checked; updateExport(); }
});
$('#reader-daily').addEventListener('pointerdown', event => { if (!event.target.closest('button')) swipeStart = { x: event.clientX, y: event.clientY }; });
$('#reader-daily').addEventListener('pointerup', event => { if (!swipeStart || state.sheet || state.scenario === 'empty') return; const delta = event.clientY - swipeStart.y; const horizontal = Math.abs(event.clientX - swipeStart.x); swipeStart = null; if (Math.abs(delta) > 55 && Math.abs(delta) > horizontal * 1.3) shiftDay(delta < 0 ? -1 : 1); });
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
  if ((event.key === 'Enter' || event.key === ' ') && document.activeElement?.matches('.reader-export-preview')) { event.preventDefault(); document.activeElement.classList.toggle('zoomed'); }
});
try {
  catalog = await loadCatalog();
  renderDaily();
  const requested = new URLSearchParams(location.search).get('sheet');
  if (['dates', 'create', 'export', 'fulltext', 'about'].includes(requested)) openSheet(requested);
} catch (error) { announce(error.message); }
