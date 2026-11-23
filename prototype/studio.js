import { loadCatalog, paintPreview as paintSharedPreview, backgroundImage, escapeHTML as h } from './shared/card-preview.js';
import { POOLS, WEEK, createStudioModel, boundDates, cardSettings, moveEntry } from './shared/studio-state.js';
import { createResourcePages } from './studio-resources.js';
import { createDeliveryPages } from './studio-delivery.js';
import { createWorkflowPages } from './studio-workflows.js';

// Public studio prototype. All business changes stay in memory; production uses editor/.
let model = createStudioModel();
let catalog;
const initialModel = structuredClone(model);
const pages = { review: '内容管理', collect: '采集候选', schedule: '内容排期', assets: '素材中心', templates: '卡片模板', ai: 'AI 任务', release: '发布中心', settings: '工作台设置' };
const icons = {
  content: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  collect: '<path d="M12 3v11m-4-4 4 4 4-4M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18M8 15h2m4 0h2m-8 3h2"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m21 16-6-6-9 11"/>',
  template: '<rect x="3" y="3" width="7" height="18" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  sparkle: '<path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z"/><path d="m20 2 .5 1.5L22 4l-1.5.5L20 6l-.5-1.5L18 4l1.5-.5Z"/>',
  send: '<path d="m21 3-6.5 18-4-7.5L3 9.5 21 3Zm0 0L10.5 13.5"/>',
  settings: '<path d="m9 3-1 3-3 1-2 3 2 2-.2 3 3 2 1 4h6l1-4 3-2-.2-3 2-2-2-3-3-1-1-3H9Z"/><circle cx="12" cy="12" r="3"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.4 9a2.7 2.7 0 1 1 4 2.4c-1.4.6-1.4 1.4-1.4 2.6m0 3h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
  left: '<path d="m14 6-6 6 6 6"/>',
  right: '<path d="m10 6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  filter: '<path d="M4 6h16M7 12h10m-7 6h4"/><circle cx="8" cy="6" r="2" fill="white"/><circle cx="16" cy="12" r="2" fill="white"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  inbox: '<path d="M4 4h16l2 11v5H2v-5L4 4Z"/><path d="M2 15h6l2 3h4l2-3h6"/>',
  book: '<path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v15"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  undo: '<path d="M8 4 3 9l5 5M3 9h10a7 7 0 0 1 0 14"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.content}</svg>`;
const $ = selector => document.querySelector(selector);
const main = $('#main'), detail = $('#detail'), modal = $('#modal');
const query = new URLSearchParams(location.search);
const state = { page: Object.hasOwn(pages, query.get('page')) ? query.get('page') : 'review', pool: 'all', search: '', category: '', imageState: '', from: '', view: 'list', selected: new Set(), week: 0, pageIndex: 0, limit: 6, releasePreview: false };
let draft = null, draftTab = 'content', draftOriginal = '', toastTimer, newSequence = 0;
let pendingClose = false;
let undo = null, draftScope = 'default', draftDate = '', moveScope = null, activeDay = '';
let detailPreviewCollapsed = false, detailReturnPosition, drawerState;
let pendingDetailEntry = null, detailPaintKey = '', scheduleChoice = null, detailQueueActive = '', detailQueueSearch = '', detailQueueReturn = null, detailSaveError = '';
const drawerMedia = window.matchMedia('(max-width:800px)');
const detailMobileMedia = window.matchMedia('(max-width:700px)');
const weekday = ['一', '二', '三', '四', '五', '六', '日'];
const navGroups = [
  ['工作空间', [['review', 'content'], ['collect', 'collect'], ['schedule', 'calendar']]],
  ['内容资源', [['assets', 'image'], ['templates', 'template']]],
  ['自动化与交付', [['ai', 'sparkle'], ['release', 'send']]],
];
const button = (text, action, symbol = '', style = '', attrs = '') => `<button type="button" class="button ${style}" data-action="${action}" ${attrs}>${symbol ? icon(symbol) : ''}${text}</button>`;
const status = (text, tone = '') => `<span class="status ${tone}">${h(text)}</span>`;
const rowStatus = row => status(POOLS[row.pool], ({ formal: 'good', reserve: 'blue', draft: 'warn' })[row.pool] || '');
const tags = values => `<div class="tag-list">${values.map(value => `<span class="tag">${h(value)}</span>`).join('')}</div>`;
const api = { h, icon, button, status, tags, getModel: () => model, getCatalog: () => catalog, render, notify: announce, clearNotice, modal: showModal, closeModal: () => modal.close(), openEntry, navigate, openAiResourcePool, restoreAiPriority: kind => modules[1].restoreAiPriority(kind), syncAiResourcePool: () => modules[1].syncAiResourcePool(), backgroundImage, paintPreview, initialTemplate: query.get('template'), initialTab: query.get('tab'), initialSample: query.get('sample') };
const modules = [createResourcePages(api), createDeliveryPages(api), createWorkflowPages(api)];
function openAiResourcePool() {
  if (!navigate('settings')) return false;
  void modules[2].handle('cfg-tab', { dataset: { value: 'models' } });
  return true;
}
function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(node => { node.innerHTML = icon(node.dataset.icon); }); }
async function paintPreview(canvas, card, options, node) {
  const result = await paintSharedPreview(canvas, card, options, node);
  if (result && node?.isConnected) node.textContent = result.imageState === 'failed' ? '配图未加载，当前显示底色' : canvas.dataset.fontState === 'fallback' ? '字体暂未就绪，当前为替代字体预览' : `卡片已就绪 · ${catalog?.fonts.find(row => row.id === options.fontId)?.name || '系统字体'} · 1080 × 1440`;
  return result;
}
function assetFor(row) { return model.assets.find(asset => asset.id === row.defaults?.imageId); }
function imageReviewStatus(row) {
  const asset = assetFor(row);
  return status(asset?.review === '已审核' ? '配图已核对' : asset ? '需复核' : '缺配图', asset?.review === '已审核' ? 'good' : 'warn');
}
function imageFor(row) { return assetFor(row)?.previewUrl || backgroundImage(assetFor(row)?.art || 'mist'); }
function entry(id) { return model.entries.find(row => row.id === id); }
function activeEntries() { return model.entries.filter(row => row.pool !== 'trash'); }
function shortDate(date) { return date.slice(5).replace('-', '.'); }
function displayText(row) { return row.text.replace(/\n/g, ''); }
function pageHead(title, subtitle, action = '', count = '') { return `<div class="page-heading"><div><h1>${h(title)}${count !== '' ? `<span>${h(count)}</span>` : ''}</h1><p>${subtitle}</p></div>${action}</div>`; }
function empty(title = '没有找到内容', text = '试试其他关键词，或清除筛选条件。') { return `<div class="empty">${icon('inbox')}<strong>${h(title)}</strong>${h(text)}</div>`; }
function clearNotice() {
  clearTimeout(toastTimer); toastTimer = null;
  const node = $('#toast'); node.classList.remove('visible'); node.innerHTML = ''; node.hidden = true;
}
function announce(text, { tone = 'info', undoable = false } = {}) {
  clearNotice();
  const node = $('#toast'); node.hidden = false; node.dataset.tone = tone;
  node.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  node.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
  node.innerHTML = `<span>${h(text)}</span><button type="button" class="toast-dismiss" data-action="dismiss-notice" aria-label="关闭提示">${icon('close')}</button>`;
  node.classList.add('visible');
  if (tone === 'success' && !undoable) toastTimer = setTimeout(clearNotice, 4000);
}
function datesForWeek() { return Array.from({ length: 7 }, (_, index) => { const date = new Date(`${model.schedule.start}T00:00:00Z`); const offset = (date.getUTCDay() + 6) % 7; date.setUTCDate(date.getUTCDate() - offset + state.week + index); return date.toISOString().slice(0, 10); }); }
function syncDrawer() {
  const sidebar = $('#sidebar'), hidden = drawerMedia.matches && !drawerState;
  sidebar.inert = hidden;
  if (hidden) sidebar.setAttribute('aria-hidden', 'true'); else sidebar.removeAttribute('aria-hidden');
}
function closeDrawer({ restoreFocus = true } = {}) {
  if (!drawerState) return;
  const previous = drawerState; drawerState = null;
  $('#app').classList.remove('menu-open'); $('[data-action="menu"]').setAttribute('aria-expanded', 'false');
  $('#menu-backdrop').hidden = true; $('#sidebar').removeAttribute('role'); $('#sidebar').removeAttribute('aria-modal');
  document.body.style.overflow = previous.overflow; $('.workspace-body').inert = previous.inert; syncDrawer();
  if (restoreFocus && previous.focus?.isConnected) previous.focus.focus({ preventScroll: true });
}
function openDrawer() {
  if (drawerState || !drawerMedia.matches) return;
  drawerState = { overflow: document.body.style.overflow, inert: $('.workspace-body').inert, focus: $('[data-action="menu"]') };
  document.body.style.overflow = 'hidden'; $('.workspace-body').inert = true; $('#app').classList.add('menu-open');
  $('[data-action="menu"]').setAttribute('aria-expanded', 'true'); $('#menu-backdrop').hidden = false;
  $('#sidebar').setAttribute('role', 'dialog'); $('#sidebar').setAttribute('aria-modal', 'true'); syncDrawer();
  $('#sidebar').scrollTop = 0;
  const focusNavigation = () => {
    const target = $('#sidebar .nav-item[aria-current="page"]') || $('#sidebar .nav-item[data-page]');
    target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: 'nearest' });
  };
  focusNavigation();
  const opened = drawerState;
  requestAnimationFrame(() => {
    if (drawerState !== opened || !drawerMedia.matches) return;
    focusNavigation();
  });
}
function fitEditorText() {
  detail.querySelectorAll('[data-editor-autogrow]').forEach(textarea => {
    if (!textarea.getClientRects().length) return;
    textarea.style.height = 'auto'; textarea.style.height = `${textarea.scrollHeight + Math.max(0, textarea.offsetHeight - textarea.clientHeight)}px`;
  });
}
function focusContentStart() {
  const target = $('#main [data-action="edit"]'); target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: 'start' });
}
function allDates() { const start = new Date(`${model.schedule.start}T00:00:00Z`), end = new Date(`${model.schedule.end}T00:00:00Z`); const count = Math.min(366, Math.max(0, Math.round((end - start) / 86400000) + 1)); return Array.from({ length: count }, (_, index) => { const date = new Date(start); date.setUTCDate(date.getUTCDate() + index); return date.toISOString().slice(0, 10); }); }
function navigate(page, replace = false, bypass = false) {
  if (!Object.hasOwn(pages, page)) return false;
  if (!bypass && !guardDetailNavigation()) return false;
  if (!bypass && page !== state.page && modules.some(module => module.beforeNavigate?.(page) === false)) return false;
  if (page !== state.page) clearNotice();
  state.page = page; state.selected.clear(); closeDrawer({ restoreFocus: false });
  const url = new URL(location.href); url.searchParams.set('page', page);
  history[replace ? 'replaceState' : 'pushState']({}, '', url);
  render(); window.scrollTo({ top: 0 }); return true;
}
function renderNavigation() {
  $('#navigation').innerHTML = navGroups.map(([name, rows]) => `<div class="nav-group"><div class="nav-label">${name}</div>${rows.map(([id, symbol]) => `<button class="nav-item" data-page="${id}" ${state.page === id ? 'aria-current="page"' : ''}>${icon(symbol)}${pages[id]}${id === 'review' ? `<span class="nav-counter">${activeEntries().length}</span>` : ''}</button>`).join('')}</div>`).join('');
  const settings = $('.sidebar-bottom [data-page="settings"]');
  if (state.page === 'settings') settings.setAttribute('aria-current', 'page'); else settings.removeAttribute('aria-current');
  $('#breadcrumb').textContent = pages[state.page]; hydrateIcons();
}
function filteredEntries() {
  return model.entries.filter(row => (state.pool === 'all' ? row.pool !== 'trash' : row.pool === state.pool) && (!state.search || `${row.text}${row.author}${row.source}${row.tags.join('')}`.toLowerCase().includes(state.search.toLowerCase())) && (!state.category || row.category === state.category) && (!state.imageState || (assetFor(row)?.review === '已审核' ? 'ready' : 'pending') === state.imageState) && (!state.from || boundDates(model, row.id).some(date => date >= state.from)));
}
function statsMarkup() {
  const draftCount = model.entries.filter(row => row.pool === 'draft').length;
  const ready = model.entries.filter(row => ['formal', 'reserve'].includes(row.pool)).length;
  const scheduled = allDates().filter(date => model.bindings[date]).length;
  return `<div class="stats"><button class="stat" data-action="stat-draft"><span class="stat-icon orange">${icon('content')}</span><div class="stat-copy"><div class="stat-label">待完善内容</div><div class="stat-value">${draftCount}<small>条草稿</small></div></div><span class="stat-note">继续打磨 ${icon('right')}</span></button><button class="stat" data-action="stat-ready"><span class="stat-icon">${icon('book')}</span><div class="stat-copy"><div class="stat-label">可用内容</div><div class="stat-value">${ready}<small>条正式 / 备选</small></div></div><span class="stat-note">准备就绪 ${icon('check')}</span></button><button class="stat" data-page="schedule"><span class="stat-icon blue">${icon('calendar')}</span><div class="stat-copy"><div class="stat-label">已安排日期</div><div class="stat-value">${scheduled}<small>/ ${allDates().length} 天演示范围</small></div></div><span class="stat-note">查看排期 ${icon('right')}</span></button></div>`;
}
function contentRows(rows) {
  return rows.map(row => {
    const dates = boundDates(model, row.id);
    return `<tr class="${state.selected.has(row.id) ? 'selected' : ''}"><td><label class="table-select"><input type="checkbox" data-select="${row.id}" aria-label="选择${h(displayText(row))}" ${state.selected.has(row.id) ? 'checked' : ''}></label></td><td><div class="content-cell"><img class="content-thumb" src="${h(imageFor(row))}" alt="" loading="lazy"><button class="content-open" data-action="edit" data-id="${row.id}"><span class="quote-text">${h(displayText(row))}</span><span class="attribution"><b>${h(row.author || '未填写作者')}</b><span>·</span><span>${h(row.source || '出处待补充')}</span></span></button></div></td><td>${tags(row.tags.slice(0, 2))}${row.tags.length > 2 ? `<span class="tag" title="${h(row.tags.slice(2).join('、'))}" aria-label="另有 ${row.tags.length - 2} 个标签，编辑详情可查看">+${row.tags.length - 2}</span>` : ''}</td><td>${rowStatus(row)}<div class="content-image-state">${imageReviewStatus(row)}</div><div class="cell-meta">${row.pool === 'formal' ? '可用于排期' : row.pool === 'draft' ? '继续完善' : row.pool === 'reserve' ? '等待安排' : '已移除'}</div></td><td class="content-date">${dates.length ? `<time datetime="${dates[0]}">${dates[0]}</time><div class="cell-meta">${dates.length > 1 ? `关联 ${dates.length} 个日期` : '已安排'}</div>` : '<span class="muted">暂未安排</span>'}</td><td><button class="row-edit" data-action="edit" data-id="${row.id}">编辑</button></td></tr>`;
  }).join('');
}
function reviewPage() {
  const rows = filteredEntries(), pageCount = Math.max(1, Math.ceil(rows.length / state.limit));
  state.pageIndex = Math.min(state.pageIndex, pageCount - 1);
  const current = rows.slice(state.pageIndex * state.limit, (state.pageIndex + 1) * state.limit);
  const pools = [['all', '全部内容', activeEntries().length], ...['draft', 'reserve', 'formal'].map(id => [id, POOLS[id], model.entries.filter(row => row.pool === id).length])];
  const filters = state.search || state.category || state.imageState || state.from;
  const allChecked = current.length && current.every(row => state.selected.has(row.id));
  const compact = window.matchMedia('(max-width:700px)').matches;
  const views = `<div class="view-control" aria-label="显示方式">${['list', 'grid'].map(view => `<button class="icon-button ${state.view === view ? 'active' : ''}" data-action="view" data-value="${view}" aria-label="${view === 'list' ? '列表视图' : '卡片视图'}" aria-pressed="${state.view === view}">${icon(view)}</button>`).join('')}</div>`;
  return pageHead(state.pool === 'trash' ? '回收站' : '内容管理', state.pool === 'trash' ? '保留被移除的内容，需要时可以恢复。' : '收集灵感，打磨内容，安排每一次分享。', button('新增内容', 'new', 'plus', 'primary')) + statsMarkup() + `
  <section class="panel content-panel${state.selected.size ? ' content-selecting' : ''}" aria-label="内容列表"><div class="panel-top"><div class="tabs" role="tablist" aria-label="内容状态">${pools.map(([id, label, count]) => `<button class="tab" role="tab" aria-selected="${state.pool === id}" data-action="pool" data-value="${id}">${label}<span class="count">${count}</span></button>`).join('')}</div>${compact ? '' : views}</div>
  <div class="toolbar"><label class="search-field">${icon('search')}<input id="content-search" type="search" placeholder="搜索正文、作者或标签…" aria-label="搜索正文、作者或标签" value="${h(state.search)}"></label><div class="toolbar-right">${compact ? views : ''}<select class="filter-select" id="category" aria-label="内容类型"><option value="">全部类型</option>${['诗词', '散文', '小说', '语录', '台词'].map(value => `<option ${state.category === value ? 'selected' : ''}>${value}</option>`).join('')}</select>${button('筛选', 'filter', 'filter', `small ${state.imageState || state.from || state.category ? 'filter-active' : ''}`)}${button('更多', 'list-more', 'more', 'small')}${filters ? button('清除', 'clear-filters', '', 'quiet small') : ''}</div></div>
  ${state.pool === 'trash' ? '<div class="notice" style="margin:0 24px 18px">内容移除前需先处理关联排期；恢复后进入草稿，不恢复旧排期。</div>' : ''}
  ${state.selected.size ? `<div class="batch-bar"><span>已选择 ${state.selected.size} 条内容 · 跨页保留选择</span>${button('批量处理', 'bulk-menu', 'check', 'small')}${button('取消选择', 'clear-selection', '', 'quiet small')}</div>` : ''}
  ${current.length ? state.view === 'grid' ? `<div class="card-view">${current.map(row => `<button class="content-card" data-action="edit" data-id="${row.id}"><img src="${h(imageFor(row))}" alt="" loading="lazy"><div><span class="quote-text">${h(displayText(row))}</span><span class="attribution">${h(row.author)} · ${h(row.source)}</span>${boundDates(model, row.id)[0] ? `<time class="content-card-date" datetime="${boundDates(model, row.id)[0]}">${boundDates(model, row.id)[0]}</time>` : ''}${rowStatus(row)}</div></button>`).join('')}</div>` : `<div class="table-scroll"><table class="content-table"><thead><tr><th><label class="table-select"><input type="checkbox" id="select-all" aria-label="选择当前页全部内容" ${allChecked ? 'checked' : ''}><span class="select-page-label">选择本页</span></label></th><th>内容 / 出处</th><th>主题标签</th><th>内容状态</th><th>排期日期</th><th>操作</th></tr></thead><tbody>${contentRows(current)}</tbody></table></div>` : empty()}
  <div class="table-footer"><span>共 ${rows.length} 条${state.pool !== 'all' ? ` · ${POOLS[state.pool]}` : '内容'}<span class="footer-dot">·</span>示例内容</span><div class="pagination"><select id="page-size" class="filter-select" aria-label="每页条数">${[6, 12, 24].map(size => `<option value="${size}" ${state.limit === size ? 'selected' : ''}>${size} 条 / 页</option>`).join('')}</select><button class="icon-button" data-action="content-prev" ${state.pageIndex === 0 ? 'disabled' : ''} aria-label="上一页">${icon('left')}</button><span class="page-number">${state.pageIndex + 1}</span><span>/ ${pageCount}</span><button class="icon-button" data-action="content-next" ${state.pageIndex + 1 >= pageCount ? 'disabled' : ''} aria-label="下一页">${icon('right')}</button></div></div></section>
  <section class="panel schedule-peek"><div class="panel-top"><div class="panel-title"><h2>一周内容</h2><span class="section-kicker">WEEKLY PLAN</span></div>${button('查看全部排期', 'open-schedule', 'arrow', 'quiet small')}</div><div class="week-strip">${datesForWeek().map((date, index) => { const row = entry(model.bindings[date]?.entryId); return `<button class="day-mini ${index === 0 ? 'today' : ''}" data-action="day" data-date="${date}"><span class="day-label">周${weekday[index]}</span>${index === 0 ? '<span class="today-label">演示周</span>' : ''}<strong>${date.slice(-2)}</strong><div class="day-content">${row ? `<span class="day-indicator"></span>${h(displayText(row))}` : '+ 安排内容'}</div></button>`; }).join('')}</div></section>
  <div class="insight">${icon('sparkle')}<span>有效范围还有 ${allDates().filter(date => !model.bindings[date]).length} 天未安排，留一点时间给内容。</span><button data-action="next-week">前往安排 ${icon('arrow')}</button></div>`;
}
function schedulePage() {
  const dates = datesForWeek(), count = dates.filter(date => model.bindings[date]).length;
  return pageHead('内容排期', '把内容放在合适的日子，每一次分享都从容有序。', '<div class="button-row">' + button('自动补齐', 'auto-fill', 'sparkle') + button('安排内容', 'pick-day', 'plus', 'primary') + '</div>') + `
  <div class="schedule-toolbar"><div class="month-title"><span>${dates[0].slice(0,4)} 年 ${Number(dates[0].slice(5,7))}${dates[0].slice(0,7) !== dates[6].slice(0,7) ? `—${Number(dates[6].slice(5,7))}` : ''} 月</span><small>${shortDate(dates[0])} — ${shortDate(dates[6])}</small><div class="button-row"><button class="icon-button" data-action="prev-week" aria-label="上一周" ${state.week === 0 ? 'disabled' : ''}>${icon('left')}</button><button class="icon-button" data-action="next-week" aria-label="下一周" ${dates[6] >= model.schedule.end ? 'disabled' : ''}>${icon('right')}</button></div></div>${button('回到演示周', 'first-week', '', 'small')}</div>
  <div class="schedule-date-strip" role="group" aria-label="定位本周日期">${dates.map((date, index) => `<button data-action="select-schedule-day" data-date="${date}" aria-pressed="${activeDay === date}"><small>周${weekday[index]}</small><strong>${shortDate(date)}</strong><span>${model.bindings[date]?.locked ? '锁定' : model.bindings[date] ? '已安排' : '空日'}</span></button>`).join('')}</div><p class="calendar-scroll-hint"><span class="calendar-desktop-hint">左右滑动查看本周，也可点日期列表定位。</span><span class="calendar-mobile-hint">在上方选择日期，再点击下方卡片查看详情。</span></p>
  <section class="panel schedule-calendar"><div class="calendar-week-wrap"><div class="calendar-weekdays">${weekday.map(day => `<span>星期${day}</span>`).join('')}</div><div class="calendar-grid">${dates.map((date, index) => { const row = entry(model.bindings[date]?.entryId); return `<div class="calendar-day${activeDay === date ? ' active' : ''}" data-calendar-date="${date}"><div class="calendar-number">${Number(date.slice(-2))}<small>周${weekday[index]}</small></div>${row ? `<button class="calendar-entry" data-action="day" data-date="${date}"><img src="${h(imageFor(row))}" alt=""><p>${h(displayText(row))}</p><small>${h(row.author)} · ${model.bindings[date]?.locked ? '已锁定' : POOLS[row.pool]}</small></button>` : `<button class="calendar-add" data-action="day" data-date="${date}" ${allDates().includes(date) ? '' : 'disabled'}>${icon('plus')}${allDates().includes(date) ? '安排内容' : '范围外'}</button>`}</div>`; }).join('')}</div></div><div class="split-note"><span>${shortDate(dates[0])} — ${shortDate(dates[6])} · 已安排 ${count} / 7 天</span><span>有效范围：${shortDate(model.schedule.start)} — ${shortDate(model.schedule.end)}</span></div></section><div class="insight">${icon('calendar')}<span>点击空白日期选句；点击已有内容可编辑、替换或锁定；自动补齐只安排有效空日。</span></div>`;
}
function render() {
  if (!catalog) { main.innerHTML = '<div class="loading-state">正在准备共享资源…</div>'; return; }
  renderNavigation();
  const markup = modules.map(module => module.render(state.page)).find(value => value !== null && value !== undefined);
  main.innerHTML = markup ?? ({ review: reviewPage, schedule: schedulePage })[state.page]();
  modules.forEach(module => module.afterRender?.(state.page));
}
function catalogErrorMarkup() {
  return '<section class="panel">' + empty('共享资源尚未就绪', '确认公开资源包已构建后，可以在这里重新读取。') + `<div class="resource-retry">${button('重新读取共享资源', 'retry-studio-resources', '', 'primary')}</div></section>`;
}
function showModal(title, body, footer = button('知道了', 'close-modal', '', 'primary')) {
  if (modal.open) modal.close();
  modal.innerHTML = `<div class="dialog-top"><h2 id="modal-title">${h(title)}</h2><button class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div><div class="modal-body">${body}</div><div class="dialog-footer">${footer}</div>`;
  modal.showModal();
}
function openEntry(id = '', date = '') {
  const source = id ? entry(id) : null;
  if (id && !source) return;
  if (!detail.open) {
    detailReturnPosition = { x: window.scrollX || 0, y: window.scrollY || 0, id, date };
    detailPreviewCollapsed = detailMobileMedia.matches;
  }
  draft = source ? structuredClone(source) : { id: `proposal-${++newSequence}`, text: '', author: '', source: '', pool: 'draft', category: '诗词', tags: [], note: '', created: '2026-11-02', defaults: { template: 'paper', fontId: 'wenkai', imageId: 'sample-mist', showDate: true, showBrand: true } };
  modal.close(); draftDate = date; draftScope = date ? 'current' : 'default';
  if (date && model.bindings[date]?.entryId === id) draft.defaults = cardSettings(model, id, date);
  if (!source && model.templateDefaults?.paper) Object.assign(draft.defaults, model.templateDefaults.paper);
  draftOriginal = JSON.stringify(draft); draftTab = 'content'; pendingClose = false; pendingDetailEntry = null; detailQueueReturn = null; detailSaveError = '';
  renderDetail(); if (!detail.open) detail.showModal();
  fitEditorText();
}
function editorMarkup() {
  if (draftTab === 'content') return `<label class="field"><span>正文 <small id="text-count">${Array.from(draft.text).length} / 240</small></span><textarea id="edit-text" data-editor-autogrow maxlength="480" placeholder="把值得留下的文字，写在这里…">${h(draft.text)}</textarea></label><div class="field-grid"><label class="field"><span>作者</span><input id="edit-author" maxlength="60" value="${h(draft.author)}" placeholder="如：王维"></label><label class="field"><span>出处</span><input id="edit-source" maxlength="100" value="${h(draft.source)}" placeholder="如：终南别业"></label></div><label class="field"><span>内容类型</span><select id="edit-category">${['诗词', '散文', '小说', '语录', '台词', '歌词', '动漫', '游戏'].map(value => `<option ${draft.category === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>`;
  if (draftTab === 'style') return `<label class="field"><span>选择版式 <small>共享正式目录</small></span></label><div class="template-choices">${catalog.templates.map(row => `<button class="template-choice" data-action="draft-template" data-value="${row.id}" aria-pressed="${draft.defaults.template === row.id}">${h(row.name)}<small>${h(row.description)}</small></button>`).join('')}</div><label class="field"><span>卡片字体</span><select id="edit-font">${catalog.fonts.map(row => `<option value="${row.id}" ${row.id === draft.defaults.fontId ? 'selected' : ''}>${h(row.name)}</option>`).join('')}</select></label><div class="button-row"><label class="label-option"><input id="edit-show-date" type="checkbox" ${draft.defaults.showDate ? 'checked' : ''}>显示日期</label><label class="label-option"><input id="edit-show-brand" type="checkbox" ${draft.defaults.showBrand ? 'checked' : ''}>显示品牌</label></div>`;
  if (draftTab === 'image') return `<label class="field"><span>选择配图 <small>仅展示已审核样例</small></span></label><div class="image-choices">${model.assets.filter(row => row.review === '已审核').map(row => `<button class="image-choice" data-action="draft-image" data-value="${row.id}" aria-pressed="${row.id === draft.defaults.imageId}"><img src="${h(backgroundImage(row.art))}" alt=""><span>${h(row.name)}</span></button>`).join('')}</div><div class="editor-hint">预览使用现有批准背景；素材状态来自共享演示模型。</div>`;
  const options = [...new Set([...draft.tags, ...initialModel.entries.flatMap(row => row.tags)])];
  return `<label class="field"><span>主题与意象</span></label><div>${options.map(tag => `<label class="label-option"><input type="checkbox" data-tag="${h(tag)}" ${draft.tags.includes(tag) ? 'checked' : ''}>${h(tag)}</label>`).join('')}</div><label class="field" style="margin-top:20px"><span>补充标签</span><input id="new-tag" placeholder="输入标签，点击添加" maxlength="20"></label>${button('添加标签', 'add-tag', 'plus', 'small')}<label class="field" style="margin-top:20px"><span>内容备注</span><textarea id="edit-note" data-editor-autogrow maxlength="300" placeholder="记录需要进一步核对的信息…">${h(draft.note || '')}</textarea></label><div class="editor-hint">${draft.annotationConfirmed ? '已确认人工标签 · 演示记录' : '标签仍为草稿，可在内容操作中确认。'}</div>`;
}
function detailQueue() {
  const rows = filteredEntries();
  return rows.some(row => row.id === draft?.id) ? rows : model.entries.filter(row => row.pool === draft?.pool);
}
function detailQueueRows() {
  const query = detailQueueSearch.trim().toLowerCase();
  return detailQueue().filter(row => !query || `${row.text} ${row.author} ${row.source} ${POOLS[row.pool]}`.toLowerCase().includes(query));
}
function detailQueueOptionsMarkup() {
  const rows = detailQueueRows();
  return rows.map(row => `<button class="choice-row" role="option" tabindex="-1" id="detail-queue-option-${h(row.id)}" data-action="detail-queue-preview" data-id="${h(row.id)}" aria-selected="${row.id === detailQueueActive}" aria-pressed="${row.id === detailQueueActive}"${row.id === draft?.id ? ' aria-current="true"' : ''}><span><strong>${h(row.text)}</strong><small>${h(row.author || '未填写作者')} · ${h(row.source || '出处待补充')} · ${POOLS[row.pool]}${row.id === draft?.id ? ' · 当前句' : ''}</small></span></button>`).join('') || empty('没有匹配句子', '换个关键词，或清空搜索。');
}
function requestDetailEntry(id, date = '') {
  if (!entry(id) || id === draft?.id && date === draftDate) return;
  if (draft && JSON.stringify(draft) !== draftOriginal) { pendingDetailEntry = { id, date }; closeDetail(); return; }
  openEntry(id, date);
}
function stepDetailEntry(step) {
  const rows = detailQueue(), index = rows.findIndex(row => row.id === draft?.id), row = rows[index + step];
  if (row) requestDetailEntry(row.id);
}
function detailQueuePreviewMarkup() {
  const rows = detailQueue(), index = rows.findIndex(row => row.id === detailQueueActive), row = rows[index];
  if (!row) return '';
  const current = row.id === draft?.id;
  return `<section class="detail-queue-detail${current ? ' is-current' : ''}" aria-label="${current ? '返回当前句' : '候选句完整预览'}"><div class="detail-queue-header"><strong>第 ${index + 1} 条 · ${current ? '当前句' : '全文'}</strong>${button(current ? '返回当前句' : '编辑此句', current ? 'close-modal' : 'detail-choose', '', current ? 'quiet' : 'primary', `data-id="${row.id}"`)}</div><p class="detail-queue-full-text"${current ? ' hidden' : ''}>${current ? '' : h(row.text)}</p><p class="detail-queue-credit"${current ? ' hidden' : ''}>${current ? '' : `${h(row.author || '未填写作者')} · ${h(row.source || '出处待补充')}`}</p></section>`;
}
function previewDetailQueue(id) {
  if (id === detailQueueActive || !detailQueue().some(row => row.id === id)) return;
  detailQueueActive = id;
  const preview = modal.querySelector('#detail-queue-preview');
  if (preview) preview.innerHTML = detailQueuePreviewMarkup();
  modal.querySelectorAll('.detail-queue-options [data-action="detail-queue-preview"]').forEach(node => { const selected = node.dataset.id === id; node.setAttribute('aria-pressed', String(selected)); node.setAttribute('aria-selected', String(selected)); });
  modal.querySelector('.detail-queue-options')?.setAttribute('aria-activedescendant', `detail-queue-option-${id}`);
}
function searchDetailQueue(value) {
  detailQueueSearch = value;
  const rows = detailQueueRows();
  if (!rows.some(row => row.id === detailQueueActive)) detailQueueActive = rows[0]?.id || '';
  const options = modal.querySelector('.detail-queue-options');
  if (options) { options.innerHTML = detailQueueOptionsMarkup(); if (detailQueueActive) options.setAttribute('aria-activedescendant', `detail-queue-option-${detailQueueActive}`); else options.removeAttribute('aria-activedescendant'); }
  const count = modal.querySelector('#detail-queue-count'); if (count) count.textContent = `${rows.length} 条句子`;
  const preview = modal.querySelector('#detail-queue-preview'); if (preview) preview.innerHTML = detailQueuePreviewMarkup();
}
function chooseDetailQueue(id) {
  if (!detailQueueRows().some(row => row.id === id)) return;
  if (id === draft?.id) { detailQueueReturn = null; modal.close(); return; }
  detailQueueReturn = detailMobileMedia.matches && draft && JSON.stringify(draft) !== draftOriginal ? { query: detailQueueSearch, active: id } : null;
  modal.close(); requestDetailEntry(id);
}
function cancelDetailModal() {
  const resume = detailQueueReturn; detailQueueReturn = null;
  pendingClose = false; pendingDetailEntry = null; modal.close();
  if (resume && draft && detail.open) openDetailQueue(resume);
}
function fitDetailQueueViewport() {
  if (!detailMobileMedia.matches || !modal.querySelector('.detail-queue-layout')) return;
  const height = window.visualViewport?.height || window.innerHeight;
  if (height) modal.style.setProperty?.('--detail-queue-height', `${height}px`);
  modal.style.setProperty?.('--detail-queue-offset', `${window.visualViewport?.offsetTop || 0}px`);
}
function openDetailQueue(resume = null) {
  detailQueueSearch = resume?.query || '';
  const rows = detailQueueRows();
  detailQueueActive = rows.find(row => row.id === resume?.active)?.id || rows.find(row => row.id === draft?.id)?.id || rows[0]?.id || '';
  showModal('选择句子', `<p class="detail-queue-scope">沿用当前内容范围，浏览候选可查看全文；切换前会检查未保存修改。</p><div class="detail-queue-layout"><label class="detail-queue-search field"><span>搜索正文、作者或出处</span><input id="detail-queue-search" type="search" autocomplete="off" value="${h(detailQueueSearch)}" placeholder="搜索句子、作者或出处"></label><p id="detail-queue-count" class="detail-queue-count" role="status">${rows.length} 条句子</p><div class="choice-list detail-queue-options" role="listbox" aria-label="当前范围的句子" tabindex="0"${detailQueueActive ? ` aria-activedescendant="detail-queue-option-${h(detailQueueActive)}"` : ''}>${detailQueueOptionsMarkup()}</div><div id="detail-queue-preview">${detailQueuePreviewMarkup()}</div></div>`, button('返回编辑', 'close-modal', '', 'quiet'));
  const options = modal.querySelector('.detail-queue-options');
  const previewChoice = event => { const target = event.target.closest('[data-action="detail-queue-preview"]'); if (target) previewDetailQueue(target.dataset.id); };
  options?.addEventListener('focusin', previewChoice); options?.addEventListener('pointerover', previewChoice);
  fitDetailQueueViewport();
  options?.querySelector(`[data-id="${detailQueueActive}"]`)?.scrollIntoView({ block: 'nearest' });
  (detailMobileMedia.matches ? options : modal.querySelector('#detail-queue-search'))?.focus({ preventScroll: true });
}
function detailSavePanelMarkup() {
  const dirty = JSON.stringify(draft) !== draftOriginal;
  return `<p>正文、版式、配图和标签修改，只在点击保存后应用。</p><dl><dt>正文与版式</dt><dd>${dirty ? '当前编辑尚未保存' : '本次未修改'}</dd><dt>配图</dt><dd>${assetFor(draft)?.review === '已审核' ? '选用已审核样例，卡面加载单独核对' : '配图仍需核对'}</dd><dt>语义标签</dt><dd>${draft.tags.length ? `${draft.tags.length} 个演示标签` : '尚未添加标签'}</dd></dl>`;
}
function detailSaveMarkup() {
  const dirty = JSON.stringify(draft) !== draftOriginal;
  return `<details class="editor-save-status"><summary id="save-hint" role="status" title="${detailSaveError ? '验证未通过，本次修改未保存' : dirty ? '有未保存的演示修改，点击保存后生效' : '点击保存后应用本次修改'}">${detailSaveError ? '保存未完成' : dirty ? '未保存修改' : '未修改'}</summary><div class="editor-save-panel">${detailSavePanelMarkup()}</div></details>`;
}
function detailSaveErrorMarkup() {
  return `<p id="detail-save-error" class="editor-save-error" role="alert"${detailSaveError ? '' : ' hidden'}>${h(detailSaveError)}</p>`;
}
function updateDetailSaveStatus() {
  const dirty = JSON.stringify(draft) !== draftOriginal, hint = $('#save-hint');
  hint.textContent = detailSaveError ? '保存未完成' : dirty ? '未保存修改' : '未修改'; hint.setAttribute('title', detailSaveError ? '验证未通过，本次修改未保存' : dirty ? '有未保存的演示修改，点击保存后生效' : '点击保存后应用本次修改');
  hint.setAttribute('role', 'status');
  const error = $('#detail-save-error'); error.textContent = detailSaveError; error.hidden = !detailSaveError; error.setAttribute('role', 'alert');
  const panel = detail.querySelector('.editor-save-panel'); if (panel) panel.innerHTML = detailSavePanelMarkup();
}
function renderDetail() {
  if (!draft) return;
  const existing = entry(draft.id), dates = existing ? boundDates(model, draft.id) : [];
  const rows = detailQueue(), index = rows.findIndex(row => row.id === draft.id);
  const previousCanvas = detail.querySelector('#detail-canvas'), previousStatus = detail.querySelector('#preview-status');
  const paintKey = JSON.stringify([draft.text, draft.author, draft.source, draft.defaults, draftDate]);
  detail.innerHTML = `<div class="dialog-top"><div><h2 id="detail-title">${existing ? '编辑内容' : '新增内容'}</h2><p>${existing ? `${h(draft.author || '未填写作者')} · ${h(draft.source || '出处待补充')}` : '从一段值得留下的文字开始'}</p></div><div class="button-row editor-heading-actions">${button(detailPreviewCollapsed ? '展开预览' : '收起预览', 'toggle-editor-preview', '', 'quiet small editor-preview-toggle', `aria-expanded="${!detailPreviewCollapsed}" aria-controls="detail-preview"`)}${rowStatus(draft)}<button class="icon-button" data-action="close-detail" aria-label="关闭编辑">${icon('close')}</button></div></div><div class="dialog-body" data-preview-collapsed="${detailPreviewCollapsed}"><div class="preview-area" id="detail-preview"><div class="preview-caption">卡片效果 · 实时预览</div><canvas id="detail-canvas" width="1080" height="1440" role="img" aria-label="当前内容卡片预览"></canvas><p class="preview-status" id="preview-status" role="status">正在准备同源卡面…</p></div><div class="editor-controls"><div class="editor-area"><div class="editor-tabs" role="tablist" aria-label="编辑内容">${[['content', '内容'], ['style', '版式'], ['image', '配图'], ['tags', '语义标签']].map(([id, text]) => `<button role="tab" aria-selected="${draftTab === id}" tabindex="${draftTab === id ? 0 : -1}" data-action="edit-tab" data-value="${id}">${text}</button>`).join('')}</div>${existing ? `<nav class="editor-navigation" aria-label="内容队列"><button class="icon-button" data-action="detail-prev" aria-label="上一句"${index <= 0 ? ' disabled' : ''}>${icon('left')}</button><button class="button editor-queue" data-action="detail-queue"><span>${index + 1} / ${rows.length} · ${h(Array.from(displayText(draft)).slice(0, 25).join(''))}</span>${icon('more')}</button><button class="icon-button" data-action="detail-next" aria-label="下一句"${index < 0 || index >= rows.length - 1 ? ' disabled' : ''}>${icon('right')}</button></nav>` : ''}${editorMarkup()}<details class="editor-advanced"><summary>更多内容操作</summary><div class="button-row">${button('内容操作', 'entry-menu', 'more', 'quiet', `data-id="${draft.id}"`) + button(draftScope === 'default' ? '默认样式' : draftScope === 'current' ? '仅当前日期' : '选定日期', 'draft-scope', '', 'quiet small')}</div><div class="editor-hint">${dates.length ? `本句关联 ${dates.length} 个演示日期；${draftScope === 'default' ? '样式更新本句默认，锁定日期保留' : draftScope === 'current' ? '样式只应用当前日期' : '样式只应用选定日期'}。正文属于句子。` : '当前内容尚未安排日期，可保存后前往排期。首次保存建立草稿；正文、版式、配图和标签修改只在点击保存后写入。'}</div></details></div></div></div><div class="dialog-footer">${detailSaveMarkup()}<div class="button-row">${button('取消', 'close-detail', '', 'quiet editor-cancel')}${button('保存', 'save', 'check', 'primary')}</div>${detailSaveErrorMarkup()}</div>`;
  if (previousCanvas) detail.querySelector('#detail-canvas')?.replaceWith(previousCanvas);
  if (previousStatus && detailPaintKey === paintKey) detail.querySelector('#preview-status')?.replaceWith(previousStatus);
  if (!previousCanvas || detailPaintKey !== paintKey) void paintDraft();
  detailPaintKey = paintKey; fitEditorText(); updateDetailSaveStatus();
}
async function paintDraft() {
  if (!draft || !$('#detail-canvas')) return;
  const canvas = $('#detail-canvas'), node = $('#preview-status');
  const card = { ...draft, text: draft.text || '把值得的，留下。', date: draftDate || boundDates(model, draft.id)[0] || WEEK[0], imagePath: imageFor(draft) };
  try { await paintPreview(canvas, card, draft.defaults, node); }
  catch { if (node.isConnected) node.textContent = '卡面暂未就绪，请稍后重试；正文修改仍保留。'; }
}
function closeDetail(force = false) {
  if (!force && draft && JSON.stringify(draft) !== draftOriginal) {
    pendingClose = true;
    showModal('保留这次修改？', '<p>当前内容有尚未保存的修改，可以继续编辑，也可以保存到本页演示。</p>', button('放弃修改', 'discard', '', 'quiet') + button('继续编辑', 'close-modal') + button('保存内容', 'save', 'check', 'primary'));
    return;
  }
  detail.close(); draft = null; pendingClose = false; pendingDetailEntry = null; detailQueueReturn = null; detailSaveError = ''; detailPaintKey = '';
  if (detailReturnPosition && state.page === 'review') {
    const saved = detailReturnPosition; detailReturnPosition = null;
    const target = [...document.querySelectorAll('#main [data-action="edit"]')].find(button => button.dataset.id === saved.id && (!saved.date || button.dataset.date === saved.date));
    target?.focus({ preventScroll: true }); window.scrollTo({ left: saved.x, top: saved.y, behavior: 'instant' });
  }
}
function guardDetailNavigation() {
  if (!detail.open) return true;
  if (draft && JSON.stringify(draft) !== draftOriginal) { closeDetail(); return false; }
  closeDetail(true); return true;
}
function saveDraft() {
  if (!draft) return;
  detailSaveError = ''; updateDetailSaveStatus();
  const cleanText = draft.text.replace(/\r\n/g, '\n').replace(/[\u200b-\u200f\ufeff]/g, '').trim();
  const invalid = Array.from(cleanText).length < 4 || Array.from(cleanText).length > 240
    ? { field: 'text', message: '请填写 4–240 字的正文' }
    : Array.from(draft.author.trim()).length > 45
      ? { field: 'author', message: '作者不能超过 45 字' }
      : Array.from(draft.author.trim() + draft.source.trim()).length > 90
        ? { field: 'source', message: '作者与作品 / 出处合计不能超过 90 字' } : null;
  if (invalid) {
    detailSaveError = invalid.message;
    modal.close(); pendingClose = false; pendingDetailEntry = null; detailQueueReturn = null; draftTab = 'content'; renderDetail();
    $(`#edit-${invalid.field}`)?.focus(); announce(invalid.message + '。', { tone: 'error' }); return;
  }
  const index = model.entries.findIndex(row => row.id === draft.id);
  const next = structuredClone(draft); next.text = cleanText; next.author = next.author.trim(); next.source = next.source.trim();
  const before = structuredClone(model);
  const locked = boundDates(model, draft.id).filter(date => model.bindings[date].locked);
  if (index >= 0 && locked.length) {
    const old = model.entries[index];
    if (next.text !== old.text || next.author !== old.author || next.source !== old.source) { announce('本句关联锁定日期，请先解除日期锁定再修改正文。'); return; }
    if (draftScope !== 'default' && (draftScope === 'current' ? [draftDate] : draft.scopedDates || []).some(date => locked.includes(date))) { announce('所选范围包含锁定日期，请先解除锁定。'); return; }
    if (draftScope === 'default') for (const date of locked) model.bindings[date].overrides = cardSettings(model, draft.id, date);
  }
  if (index < 0) model.entries.push(next); else {
    next.systemReview = null; next.annotationConfirmed = draft.tags.join() === model.entries[index].tags.join() && draft.text === model.entries[index].text ? next.annotationConfirmed : false;
    const old = model.entries[index];
    if (next.text !== old.text || next.author !== old.author || next.source !== old.source || JSON.stringify(next.defaults) !== JSON.stringify(old.defaults)) next.humanReview = null;
    if (draftScope !== 'default') {
      const targets = draftScope === 'current' ? [draftDate] : draft.scopedDates || [];
      if (!targets.length || targets.some(date => model.bindings[date]?.entryId !== draft.id)) { announce('请选择本句有效关联日期。'); return; }
      const settings = structuredClone(next.defaults); next.defaults = model.entries[index].defaults;
      for (const date of targets) Object.assign(model.bindings[date], { overrides: settings, confirmed: false });
    }
    model.entries[index] = next;
  }
  undo = { label: '保存内容', before, after: JSON.stringify(model) };
  const nextEntry = pendingDetailEntry; pendingDetailEntry = null;
  modal.close(); state.releasePreview = false; render();
  if (nextEntry) openEntry(nextEntry.id, nextEntry.date); else closeDetail(true);
  announce('内容已保存到本页演示，刷新后恢复。', { tone: 'success' });
}
function pickDate(date) {
  if (!allDates().includes(date)) return;
  const binding = model.bindings[date];
  if (binding) { dayDetail(date); return; }
  scheduleChoice = { date, replacement: false, query: '', selected: '', signature: JSON.stringify(model) }; renderScheduleChoices();
}
function candidateReviewMarkup(row) {
  return row ? `<section class="schedule-candidate-review" aria-label="已选内容完整核对" tabindex="-1"><h3>核对已选内容</h3><p class="candidate-full-text">${h(row.text)}</p><p>${h(row.author || '未填写作者')} · ${h(row.source || '出处待补充')}</p>${rowStatus(row)}</section>` : '<p class="muted">先选择候选，再核对完整正文与出处。</p>';
}
function renderScheduleChoices() {
  if (!scheduleChoice) return;
  const { date, query, selected, replacement } = scheduleChoice;
  const rows = activeEntries().filter(row => ['formal', 'reserve'].includes(row.pool) && (!replacement || row.id !== model.bindings[date]?.entryId) && (!query || `${row.text}${row.author}${row.source}`.toLowerCase().includes(query.toLowerCase())));
  const chosen = rows.find(row => row.id === selected);
  showModal(`${replacement ? '替换' : '安排'} ${date} 的内容`, `<div class="schedule-choice-workspace"${replacement ? ` data-replace-date="${date}"` : ''}><p>${replacement ? '只替换本日绑定，原句与其他日期保留。' : '选择正式或备选内容，核对后安排到这个空日。'}</p><form id="schedule-search-form" class="schedule-search-form"><label class="field"><span>搜索正文、作者或出处</span><input id="schedule-search" type="search" value="${h(query)}" autocomplete="off"></label><button class="button" type="submit">搜索</button></form><div class="choice-list">${rows.map(row => `<button class="choice-row" data-action="schedule-choose" data-id="${row.id}" aria-pressed="${row.id === selected}">${icon('book')}<span><strong>${h(Array.from(displayText(row)).slice(0, 70).join(''))}${Array.from(displayText(row)).length > 70 ? '…' : ''}</strong><small>${h(row.author)} · ${POOLS[row.pool]}</small></span></button>`).join('') || empty('没有匹配候选', '请调整关键词，或先完善草稿。')}</div>${candidateReviewMarkup(chosen)}</div>`, button('取消', 'close-modal', '', 'quiet') + button(replacement ? '确认替换' : '安排到本日', 'assign', 'check', 'primary', `data-id="${chosen?.id || ''}" data-date="${date}"${chosen ? '' : ' disabled'}`));
}
function searchScheduleChoices() {
  if (!scheduleChoice) return;
  scheduleChoice.query = $('#schedule-search').value.trim(); scheduleChoice.selected = ''; renderScheduleChoices(); $('#schedule-search')?.focus();
}
function filterModal() {
  showModal('筛选内容', `<form id="filter-form" class="filter-form"><label class="field"><span>内容类型</span><select id="filter-category"><option value="">全部类型</option>${['诗词', '散文', '小说', '语录', '台词'].map(value => `<option${state.category === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label><label class="field"><span>配图状态</span><select id="filter-image"><option value="">全部状态</option><option value="ready" ${state.imageState === 'ready' ? 'selected' : ''}>配图已审核</option><option value="pending" ${state.imageState === 'pending' ? 'selected' : ''}>配图待处理</option></select></label><label class="field"><span>已安排日期，从这天开始</span><input type="date" id="filter-from" value="${h(state.from)}" min="${model.schedule.start}" max="${model.schedule.end}"></label></form>`, button('重置条件', 'reset-filter', '', 'quiet') + button('应用筛选', 'apply-filter', 'check', 'primary'));
}
function bulkMove(pool) {
  if (!state.selected.size) return;
  try {
    let next = model;
    for (const id of state.selected) next = moveEntry(next, id, pool);
    model = next; const count = state.selected.size; state.selected.clear(); state.releasePreview = false; render(); announce(`${count} 条演示内容已转入${POOLS[pool]}。`);
  } catch (error) { announce(error.message, { tone: 'error' }); }
}
function operationMap() {
  showModal('原型操作总览', `<div class="operation-map">${[
    ['review', 'content', '内容管理', '新增编辑 · 四池与回收站 · 跨页批量 · 标签确认 · 图文复核 · 保护与撤销'],
    ['collect', 'collect', '采集候选', '来源与采集表单 · 任务进度 · 候选核对 · 去重整理 · 异常修正与撤销'],
    ['schedule', 'calendar', '内容排期', '空日安排 · 多日选择 · 替换与移除 · 日期样式 · 锁定 · 自动补齐'],
    ['assets', 'image', '素材中心', '新增编辑 · 来源许可 · 审核驳回 · 关联选用 · 渠道交付与异常'],
    ['templates', 'template', '卡片模板', '同源预览 · 样例切换 · 默认设置 · 未保存提示 · HTML与影响范围'],
    ['ai', 'sparkle', 'AI 任务', '新建与范围确认 · 进度 · 会话产物 · 暂停取消 · 失败与未知恢复'],
    ['release', 'send', '发布中心', '范围预检 · 冻结确认 · 单篇批量 · 草稿与素材 · 记录 · 资源测速'],
    ['settings', 'settings', '工作台设置', '处理策略 · 模型表单 · 渠道账号示例 · 日期范围 · 偏好与重置'],
  ].map(([page, symbol, name, text]) => `<button class="choice-row" data-action="map-go" data-value="${page}">${icon(symbol)}<span><strong>${name}</strong><small>${text}</small></span>${icon('right')}</button>`).join('')}</div>`, button('开始体验', 'close-modal', '', 'primary'));
}
function moreList() {
  showModal('内容工具', `<div class="choice-list"><button class="choice-row" data-action="trash">${icon('inbox')}<span><strong>回收站</strong><small>${model.entries.filter(row => row.pool === 'trash').length} 条内容，可恢复到草稿</small></span></button><button class="choice-row" data-action="export-content">${icon('collect')}<span><strong>导出当前筛选</strong><small>${filteredEntries().length} 条示例内容，本地 JSON 文件</small></span></button><button class="choice-row" data-action="undo">${icon('undo')}<span><strong>撤销最近一次操作</strong><small>${undo ? h(undo.label) : '暂时没有可撤销操作'}</small></span></button></div>`);
}
function entryMenu(id) {
  const row = draft?.id === id ? draft : entry(id); if (!row) return;
  if (!entry(id)) { showModal('先保存这条内容', '<p>保存后可调整状态、安排日期与记录人工复核。当前输入已保留在编辑表单中。</p>', button('继续编辑', 'close-modal', '', 'quiet') + button('保存内容', 'save', 'check', 'primary')); return; }
  showModal('内容操作', `<div class="choice-list">${[['confirm-tags', 'check', '确认人工标签', row.annotationConfirmed ? '已有演示签核，再次确认当前标签' : '确认标签与理由，保留人工证据'], ['review-card', 'image', '图文复核', '检查正文、来源、配图与字体预览'], ['entry-protect', 'settings', row.protected ? '取消人工保护' : '启用人工保护', '保护人工标签与配图，自动任务跳过'], ['move', 'content', '调整内容状态', '正式 / 备选 / 草稿 / 回收站'], ['entry-history', 'clock', '内容记录', '关联日期、修改与审核记录']].map(([action, symbol, title, text]) => `<button class="choice-row" data-action="${action}" data-id="${id}">${icon(symbol)}<span><strong>${title}</strong><small>${text}</small></span></button>`).join('')}</div>`);
}
function moveForm(ids) {
  const rows = ids.map(entry).filter(Boolean); if (!rows.length) return;
  moveScope = { ids: rows.map(row => row.id), signature: JSON.stringify(model) };
  const dates = [...new Set(rows.flatMap(row => boundDates(model, row.id)))].sort();
  const replacements = activeEntries().filter(row => !ids.includes(row.id) && row.pool !== 'draft');
  showModal(rows.length > 1 ? `批量处理 ${rows.length} 条内容` : '调整内容状态', `<div class="form-summary">${rows.map(row => `<p>${h(displayText(row))}</p>`).join('')}</div><label class="field" style="margin-top:20px"><span>目标状态</span><select id="move-pool">${Object.entries(POOLS).map(([id, text]) => `<option value="${id}" ${id === 'reserve' ? 'selected' : ''}>${text}</option>`).join('')}</select></label>${dates.length ? `<div class="notice warn">所选内容关联 ${dates.length} 个日期。移出正式时，必须为这些日期选择替代句；加入正式不改排期。</div><div class="scope-dates">${dates.map(date => `<label class="field"><span>${date} 替代内容</span><select data-replacement="${date}"><option value="">请选择替代句</option>${replacements.map(row => `<option value="${row.id}">${h(displayText(row))}</option>`).join('')}</select></label>`).join('')}</div>` : '<div class="notice">内容没有关联日期，只调整内容状态。</div>'}<p class="form-error" id="move-error" role="alert"></p>`, button('取消', 'close-modal', '', 'quiet') + button('确认调整', 'confirm-move', 'check', 'primary'));
}
function confirmMove() {
  if (!moveScope || moveScope.signature !== JSON.stringify(model)) { announce('演示状态已变化，请重新打开操作。'); return; }
  const pool = $('#move-pool').value, replacements = Object.fromEntries([...modal.querySelectorAll('[data-replacement]')].map(node => [node.dataset.replacement, node.value]));
  try {
    const before = structuredClone(model); let next = model;
    if (pool !== 'formal' && moveScope.ids.some(id => boundDates(model, id).some(date => model.bindings[date].locked))) throw new Error('包含锁定日期，请先解除锁定再移出正式内容。');
    for (const id of moveScope.ids) next = moveEntry(next, id, pool, replacements);
    model = next; undo = { label: `转入${POOLS[pool]}`, before, after: JSON.stringify(model) };
    state.selected.clear(); if (detail.open) closeDetail(true); modal.close(); render(); announce(`已转入${POOLS[pool]}，可在内容工具中撤销。`);
  } catch (error) { $('#move-error').textContent = error.message; }
}
function scopeForm() {
  if (!draft) return;
  const dates = boundDates(model, draft.id);
  showModal('样式应用范围', `<div class="notice">正文、作者与标签属于句子；版式、字体和配图可只用于指定日期。日期锁定保护内容绑定，替换前须先解锁。</div><div class="scope-dates">${[['default', '本句默认样式', '仅更新本句默认，已保存日期保留独立样式'], ['current', '仅当前日期', draftDate || '请从排期进入当前日期'], ['dates', '选择关联日期', `${dates.length} 个本句关联日期`]].map(([id, title, text]) => `<label class="choice-row"><input name="draft-scope" type="radio" value="${id}" ${draftScope === id ? 'checked' : ''} ${id === 'current' && !draftDate ? 'disabled' : ''}><span><strong>${title}</strong><small>${text}</small></span></label>`).join('')}</div><div class="scope-date-grid">${dates.map(date => `<label class="label-option"><input type="checkbox" data-scope-date="${date}" ${draft.scopedDates?.includes(date) ? 'checked' : ''}>${date}</label>`).join('')}</div>`, button('取消', 'close-modal', '', 'quiet') + button('应用范围', 'apply-scope', 'check', 'primary'));
}
function reviewCard(id) {
  const row = draft?.id === id ? draft : entry(id); if (!row) return;
  const checks = [{ text: '正文 1–240 字', ok: row.text.trim() && Array.from(row.text).length <= 240 }, { text: '作者与出处已填写', ok: row.author.trim() && row.source.trim() }, { text: '配图已经审核', ok: assetFor(row)?.review === '已审核' }, { text: '同源卡片字体与图像预览', ok: false, preview: true }];
  showModal('图文复核', `<div class="checklist">${checks.map(check => `<div class="check-row">${icon(check.ok ? 'check' : 'clock')}<span>${check.text}</span>${status(check.ok ? '通过' : check.preview ? '请查看预览' : '待补齐', check.ok ? 'good' : 'warn')}</div>`).join('')}</div><p>系统检查与人工审阅分别记录，不将规则检查当作人工签核。</p><label class="label-option" style="margin-top:18px"><input id="human-card-review" type="checkbox">我已查看完整卡面并核对正文与配图</label>`, button('返回编辑', 'close-modal', '', 'quiet') + button('记录人工复核', 'confirm-review', 'check', 'primary', `data-id="${id}"`));
}
function dayDetail(date) {
  activeDay = date;
  const binding = model.bindings[date], row = entry(binding?.entryId);
  if (!row) { pickDate(date); return; }
  showModal(`${date} · 日期内容`, `<div class="date-detail"><img src="${h(imageFor(row))}" alt=""><div><h3>${h(displayText(row))}</h3><p>${h(row.author)} · ${h(row.source)}</p>${status(binding.locked ? '日期已锁定' : '可调整', binding.locked ? 'warn' : 'good')}</div></div><p class="muted">正文属于句子，编辑日期样式时只应用当前日期。</p>`, `<details class="schedule-date-menu"><summary class="button">日期操作</summary><div class="schedule-date-menu-panel">${button(binding.locked ? '解除日期锁定' : '锁定这个日期', 'day-lock', 'settings', '', `data-date="${date}"`)}${button('移除本日安排', 'day-remove', 'close', 'danger', `data-date="${date}"${binding.locked ? ' disabled' : ''}`)}</div></details>${button('编辑', 'day-edit', 'content', '', `data-date="${date}" aria-label="编辑内容与日期样式"`)}${button('替换', 'day-replace', 'undo', 'primary', `data-date="${date}" aria-label="替换本日内容"${binding.locked ? ' disabled' : ''}`)}`);
}
function autoFillForm() {
  const dates = datesForWeek().filter(date => allDates().includes(date) && !model.bindings[date]);
  const available = activeEntries().filter(row => row.pool === 'reserve' && !boundDates(model, row.id).length);
  const count = Math.min(dates.length, available.length);
  showModal('自动补齐空白日期', `<p>只使用未排期的备选内容，每条只用一次。已安排、锁定及有效范围外日期保留。</p><div class="form-metrics"><div><strong>${dates.length}</strong><span>有效空日</span></div><div><strong>${available.length}</strong><span>未排期备选</span></div><div><strong>${count}</strong><span>本次可安排</span></div></div><div class="form-summary">${dates.map((date, index) => `<p><strong>${date}</strong><span>${available[index] ? h(displayText(available[index])) : '备选不足，保留空白'}</span></p>`).join('') || '<p>本周没有可补齐的有效空日。</p>'}</div>`, button('取消', 'close-modal', '', 'quiet') + button(`安排 ${count} 天`, 'confirm-fill', 'check', 'primary', count ? '' : 'disabled'));
  moveScope = { dates: dates.slice(0, count), ids: available.slice(0, count).map(row => row.id), signature: JSON.stringify(model) };
}
function commitFill() {
  if (!moveScope?.dates || moveScope.signature !== JSON.stringify(model)) { announce('排期已变化，请重新查看补齐范围。'); return; }
  const before = structuredClone(model);
  moveScope.dates.forEach((date, index) => { const row = entry(moveScope.ids[index]); row.pool = 'formal'; model.bindings[date] = { entryId: row.id, overrides: {}, confirmed: false, locked: false }; });
  undo = { label: '自动补齐排期', before, after: JSON.stringify(model) };
  modal.close(); render(); announce(`已安排 ${moveScope.dates.length} 天，其余不足留空。`);
}
function exportContent() {
  const rows = filteredEntries().map(({ id, text, author, source, pool, tags, category }) => ({ id, text, author, source, pool, tags, category }));
  const text = JSON.stringify({ prototype: true, entries: rows }, null, 2);
  showModal('导出示例内容', `<p>导出当前筛选 ${rows.length} 条内容，仅包含本页演示字段。</p><label class="field" style="margin-top:15px"><span>JSON 预览</span><textarea id="export-json" readonly rows="10">${h(text)}</textarea></label>`, button('取消', 'close-modal', '', 'quiet') + button('下载 JSON', 'download-json', 'collect', 'primary'));
}
function scheduleForm() {
  const candidates = activeEntries().filter(row => ['formal', 'reserve'].includes(row.pool));
  const dates = allDates().filter(date => !model.bindings[date]);
  showModal('安排内容到日期', `<label class="field"><span>选择内容</span><select id="schedule-entry"><option value="">选择正式或备选内容</option>${candidates.map(row => `<option value="${row.id}">${h(Array.from(displayText(row)).slice(0, 45).join(''))} · ${h(row.author)}</option>`).join('')}</select></label><div id="schedule-selected-review">${candidateReviewMarkup(null)}</div><div class="field"><span>空白日期 <small>可选多个，明确应用同一句内容</small></span><div class="scope-date-grid">${dates.map(date => `<label class="label-option"><input type="checkbox" data-assign-date="${date}">${date}</label>`).join('') || '<p>当前有效范围没有空白日期。</p>'}</div></div><div class="notice">仅安排选定空日，已有内容和锁定日期保留。自动补齐会使用不同备选句。</div><p class="form-error" id="schedule-error" role="alert"></p>`, button('取消', 'close-modal', '', 'quiet') + button('安排选中日期', 'schedule-confirm', 'check', 'primary', !dates.length || !candidates.length ? 'disabled' : ''));
  moveScope = { signature: JSON.stringify(model) };
}
document.addEventListener('click', async event => {
  if (!catalog) {
    const retry = event.target.closest('[data-action="retry-studio-resources"]');
    if (retry && !retry.disabled) {
      retry.disabled = true; retry.textContent = '正在重新读取…';
      try { catalog = await loadCatalog(); render(); }
      catch { main.innerHTML = catalogErrorMarkup(); }
    }
    return;
  }
  const pageButton = event.target.closest('[data-page]');
  if (pageButton) { navigate(pageButton.dataset.page); return; }
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const { action, value, id, date } = target.dataset;
  for (const module of modules) if (await module.handle(action, target)) return;
  switch (action) {
    case 'menu': drawerState ? closeDrawer() : openDrawer(); break;
    case 'close-menu': closeDrawer(); break;
    case 'dismiss-notice': clearNotice(); break;
    case 'search': if (navigate('review')) $('#content-search')?.focus(); break;
    case 'new': openEntry(); break;
    case 'edit': openEntry(id, date || ''); break;
    case 'toggle-editor-preview': detailPreviewCollapsed = !detailPreviewCollapsed; detail.querySelector('.dialog-body').dataset.previewCollapsed = String(detailPreviewCollapsed); target.setAttribute('aria-expanded', String(!detailPreviewCollapsed)); target.textContent = detailPreviewCollapsed ? '展开预览' : '收起预览'; break;
    case 'close-detail': closeDetail(); break;
    case 'close-modal': cancelDetailModal(); break;
    case 'discard': { const nextEntry = pendingDetailEntry; pendingDetailEntry = null; modal.close(); if (nextEntry) openEntry(nextEntry.id, nextEntry.date); else closeDetail(true); break; }
    case 'save': saveDraft(); break;
    case 'edit-tab': draftTab = value; renderDetail(); break;
    case 'detail-prev': stepDetailEntry(-1); break;
    case 'detail-next': stepDetailEntry(1); break;
    case 'detail-queue': openDetailQueue(); break;
    case 'detail-queue-preview': detailMobileMedia.matches ? chooseDetailQueue(id) : previewDetailQueue(id); break;
    case 'detail-choose': chooseDetailQueue(id); break;
    case 'draft-template': { const row = catalog.templates.find(row => row.id === value); if (!row || !draft) return; draft.defaults.template = row.id; draft.defaults.fontId = row.recommendedFont; if (model.templateDefaults?.[row.id]) Object.assign(draft.defaults, model.templateDefaults[row.id]); renderDetail(); break; }
    case 'draft-image': if (draft && model.assets.some(row => row.id === value && row.review === '已审核')) { draft.defaults.imageId = value; renderDetail(); } break;
    case 'pool': state.pool = value; state.selected.clear(); render(); break;
    case 'stat-draft': state.pool = 'draft'; state.selected.clear(); render(); break;
    case 'stat-ready': state.pool = 'all'; state.search = ''; state.category = ''; state.imageState = ''; state.from = ''; state.pageIndex = 0; render(); announce('可用内容包括正式与备选，可用状态筛选查看。'); break;
    case 'view': state.view = value; state.selected.clear(); render(); break;
    case 'content-prev': state.pageIndex = Math.max(0, state.pageIndex - 1); render(); focusContentStart(); break;
    case 'content-next': state.pageIndex++; render(); focusContentStart(); break;
    case 'filter': filterModal(); break;
    case 'apply-filter': state.category = $('#filter-category').value; state.imageState = $('#filter-image').value; state.from = $('#filter-from').value; state.pageIndex = 0; state.selected.clear(); modal.close(); render(); break;
    case 'reset-filter': state.category = ''; state.imageState = ''; state.from = ''; state.pageIndex = 0; state.selected.clear(); modal.close(); render(); break;
    case 'clear-filters': state.search = ''; state.category = ''; state.imageState = ''; state.from = ''; state.selected.clear(); render(); break;
    case 'clear-selection': state.selected.clear(); render(); break;
    case 'bulk-reserve': bulkMove('reserve'); break;
    case 'bulk-formal': bulkMove('formal'); break;
    case 'open-review': navigate('review'); break;
    case 'open-assets': navigate('assets'); break;
    case 'open-schedule': navigate('schedule'); break;
    case 'first-week': state.week = 0; render(); break;
    case 'next-week': state.week = state.page !== 'schedule' ? 7 : state.week + 7; if (state.page !== 'schedule') navigate('schedule'); else render(); break;
    case 'prev-week': state.week = Math.max(0, state.week - 7); render(); break;
    case 'day': dayDetail(date); break;
    case 'select-schedule-day': activeDay = date; main.querySelectorAll('.schedule-date-strip [data-date]').forEach(node => node.setAttribute('aria-pressed', String(node.dataset.date === date))); main.querySelectorAll('[data-calendar-date]').forEach(node => node.classList.toggle('active', node.dataset.calendarDate === date)); main.querySelector(`[data-calendar-date="${date}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center' }); break;
    case 'pick-day': scheduleForm(); break;
    case 'schedule-confirm': { const id = $('#schedule-entry').value, dates = [...modal.querySelectorAll('[data-assign-date]:checked')].map(node => node.dataset.assignDate); if (!id || !dates.length) { $('#schedule-error').textContent = '请选择内容和至少一个空白日期。'; return; } if (moveScope?.signature !== JSON.stringify(model) || dates.some(date => model.bindings[date] || !allDates().includes(date))) { $('#schedule-error').textContent = '排期已变化，请重新打开安排表单。'; return; } const before = structuredClone(model); model = moveEntry(model, id, 'formal'); dates.forEach(date => { model.bindings[date] = { entryId: id, overrides: {}, confirmed: false, locked: false }; }); undo = { label: `安排 ${dates.length} 个日期`, before, after: JSON.stringify(model) }; modal.close(); render(); announce(`已安排 ${dates.length} 个准确日期。`); break; }
    case 'choose-date': modal.close(); pickDate(date); break;
    case 'schedule-choose': if (scheduleChoice) { scheduleChoice.selected = id; renderScheduleChoices(); const review = modal.querySelector('.schedule-candidate-review'); review?.focus({ preventScroll: true }); review?.scrollIntoView({ block: 'nearest' }); } break;
    case 'assign': if (scheduleChoice?.signature !== JSON.stringify(model)) { announce('排期已变化，请重新核对候选。', { tone: 'error' }); break; } if (allDates().includes(date) && (!model.bindings[date] || modal.querySelector('[data-replace-date]')) && !model.bindings[date]?.locked && ['formal', 'reserve'].includes(entry(id)?.pool)) { const before = structuredClone(model); model = moveEntry(model, id, 'formal'); model.bindings[date] = { entryId: id, overrides: {}, confirmed: false, locked: false }; undo = { label: '安排日期', before, after: JSON.stringify(model) }; state.releasePreview = false; scheduleChoice = null; modal.close(); render(); announce(`已安排 ${date} 的演示内容。`); } break;
    case 'operation-map': operationMap(); break;
    case 'map-go': modal.close(); navigate(value); break;
    case 'list-more': moreList(); break;
    case 'trash': modal.close(); state.pool = 'trash'; state.selected.clear(); state.pageIndex = 0; render(); break;
    case 'export-content': exportContent(); break;
    case 'download-json': { const blob = new Blob([$('#export-json').value], { type: 'application/json' }), url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'daylight-demo-content.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); announce('已下载当前示例内容。', { tone: 'success' }); break; }
    case 'entry-menu': entryMenu(id); break;
    case 'move': if (draft?.id === id && JSON.stringify(draft) !== draftOriginal) showModal('先保存当前修改', '<p>当前编辑有未保存修改，保存后再调整内容状态，避免遗漏正文、标签或版式。</p>', button('继续编辑', 'close-modal', '', 'quiet') + button('保存内容', 'save', 'check', 'primary')); else moveForm([id]); break;
    case 'bulk-menu': moveForm([...state.selected]); break;
    case 'confirm-move': confirmMove(); break;
    case 'entry-protect': { const row = draft?.id === id ? draft : entry(id); row.protected = !row.protected; modal.close(); if (draft?.id === id) renderDetail(); else render(); announce(row.protected ? '人工保护已开启。' : '人工保护已取消。'); break; }
    case 'confirm-tags': { const row = draft?.id === id ? draft : entry(id); showModal('确认人工标签', `<p>核对正文：${h(displayText(row))}</p><div style="margin:17px 0">${tags(row.tags)}</div><label class="field"><span>核对说明</span><textarea id="tag-reason" placeholder="记录标签适合这段内容的理由…">${h(row.note || '')}</textarea></label><label class="label-option"><input id="tags-agree" type="checkbox">我已核对这些标签与当前正文</label><p class="form-error" id="tags-error"></p>`, button('取消', 'close-modal', '', 'quiet') + button('确认标签', 'save-tags', 'check', 'primary', `data-id="${id}"`)); break; }
    case 'save-tags': { if (!$('#tags-agree').checked) { $('#tags-error').textContent = '请先确认已经核对标签。'; return; } const row = draft?.id === id ? draft : entry(id); row.note = $('#tag-reason').value; row.annotationConfirmed = true; row.protected = true; modal.close(); if (draft?.id === id) renderDetail(); else render(); announce('已记录本次演示人工标签确认。', { tone: 'success' }); break; }
    case 'review-card': reviewCard(id); break;
    case 'confirm-review': { const row = draft?.id === id ? draft : entry(id); if (!$('#human-card-review').checked || !row.text.trim() || !row.author.trim() || !row.source.trim() || assetFor(row)?.review !== '已审核') { announce('请先补齐正文、出处和已审核配图，并确认完整卡面。'); return; } row.humanReview = { confirmed: true, text: row.text }; modal.close(); announce('已记录演示人工复核；保存内容后保留。', { tone: 'success' }); break; }
    case 'entry-history': { const row = entry(id) || draft; showModal('内容记录', `<p>${h(displayText(row))}</p><div class="record-lines"><p>内容状态：${POOLS[row.pool]}</p><p>关联日期：${boundDates(model, row.id).join('、') || '无'}</p><p>人工标签：${row.annotationConfirmed ? '已确认' : '未确认'}</p><p>人工保护：${row.protected ? '已开启' : '未开启'}</p><p>图文复核：${row.humanReview?.confirmed ? '已有人工演示记录' : '尚未确认'}</p></div><div class="notice">本页只保留当前内存状态；正式记录在真实后台独立保存。</div>`); break; }
    case 'draft-scope': scopeForm(); break;
    case 'apply-scope': { const scope = modal.querySelector('[name="draft-scope"]:checked')?.value; const dates = [...modal.querySelectorAll('[data-scope-date]:checked')].map(node => node.dataset.scopeDate); if (scope === 'dates' && !dates.length) { announce('请选择至少一个关联日期。'); return; } draftScope = scope; draft.scopedDates = dates; modal.close(); renderDetail(); break; }
    case 'add-tag': { const value = $('#new-tag').value.trim(); if (!value) { announce('请输入标签。'); return; } draft.tags = [...new Set([...draft.tags, value])]; renderDetail(); break; }
    case 'day-edit': modal.close(); openEntry(model.bindings[date].entryId, date); break;
    case 'day-replace': if (!model.bindings[date]?.locked) { scheduleChoice = { date, replacement: true, query: '', selected: '', signature: JSON.stringify(model) }; renderScheduleChoices(); } break;
    case 'day-lock': { const binding = model.bindings[date]; if (!binding) return; binding.locked = !binding.locked; modal.close(); render(); announce(binding.locked ? '本日已锁定。' : '已解除本日锁定。'); break; }
    case 'day-remove': if (!model.bindings[date]?.locked) showModal('移除本日安排？', `<p>${date} 将变为空白日期，内容与其他日期保留。</p>`, button('取消', 'close-modal', '', 'quiet') + button('移除安排', 'confirm-day-remove', '', 'danger', `data-date="${date}"`)); break;
    case 'confirm-day-remove': { if (!model.bindings[date] || model.bindings[date].locked) return; const before = structuredClone(model); delete model.bindings[date]; undo = { label: '移除日期安排', before, after: JSON.stringify(model) }; modal.close(); render(); announce('本日安排已移除，可撤销。'); break; }
    case 'auto-fill': autoFillForm(); break;
    case 'confirm-fill': commitFill(); break;
    case 'undo': { if (!undo) { announce('暂无可撤销操作。'); return; } if (undo.after !== JSON.stringify(model)) { announce('后续数据已变化，无法直接撤销；当前数据保留。'); return; } model = structuredClone(undo.before); undo = null; modal.close(); render(); announce('已撤销最近一次操作。', { tone: 'success' }); break; }
    case 'reset': showModal('重置本页演示', '<p>将恢复最初的示例内容和排期，清除本页尚未持久保存的演示修改。</p>', button('取消', 'close-modal', '', 'quiet') + button('重置演示', 'confirm-reset', 'undo', 'primary')); break;
    case 'confirm-reset': model = structuredClone(initialModel); modules.forEach(module => module.reset?.()); state.selected.clear(); state.releasePreview = false; undo = null; modal.close(); render(); announce('已恢复初始演示内容。', { tone: 'success' }); break;
    case 'help': showModal('从内容开始，轻松完成一次分享', '<p>1. 在内容管理中搜索或新增文字，点击内容进入编辑。</p><p>2. 在编辑面板切换版式、配图与标签，左侧同步查看卡片。</p><p>3. 在排期里点击空白日期，选择正式或备选内容。</p><p>4. 在发布中心核对范围，公众号与资源发布分别处理。</p>'); break;
    case 'about': showModal('内容工作台 · 原型说明', '<p>以白色、浅灰和青绿色构建更简洁的内容工作台；常用动作直接呈现，低频操作按需展开。</p><p>本稿是当前管理端原型。示例数据复用原 studio 的公开诗句与内存模型；卡片使用共享版式、字体和批准背景。</p><p>所有编辑在浏览器内存中演示，刷新即重置。没有接入后台、模型、账号或上传接口。</p>'); break;

  }
});
document.addEventListener('input', event => {
  const target = event.target;
  if (target.id === 'detail-queue-search') { searchDetailQueue(target.value); return; }
  if (target.id === 'content-search') {
    state.search = target.value; state.selected.clear(); state.pageIndex = 0; const start = target.selectionStart; render(); $('#content-search').focus();
    // Search fields may not support a selection range in every browser.
    try { if (start !== null) $('#content-search').setSelectionRange(start, start); } catch {}
    return;
  }
  if (!draft || !detail.contains(target)) return;
  const fields = { 'edit-text': 'text', 'edit-author': 'author', 'edit-source': 'source', 'edit-note': 'note' };
  if (fields[target.id]) {
    draft[fields[target.id]] = target.value;
    if (target.id === 'edit-text') $('#text-count').textContent = `${Array.from(draft.text).length} / 240`;
    fitEditorText();
    updateDetailSaveStatus();
    if (target.id !== 'edit-note') void paintDraft();
  }
});
document.addEventListener('change', event => {
  const target = event.target;
  if (target.dataset.select) { target.checked ? state.selected.add(target.dataset.select) : state.selected.delete(target.dataset.select); render(); }
  else if (target.id === 'select-all') { for (const row of filteredEntries().slice(state.pageIndex * state.limit, (state.pageIndex + 1) * state.limit)) target.checked ? state.selected.add(row.id) : state.selected.delete(row.id); render(); }
  else if (target.id === 'category') { state.category = target.value; state.selected.clear(); state.pageIndex = 0; render(); }
  else if (target.id === 'page-size') { state.limit = Number(target.value); state.pageIndex = 0; render(); }
  else if (target.id === 'schedule-entry') { $('#schedule-selected-review').innerHTML = candidateReviewMarkup(entry(target.value)); }
  else if (target.id === 'edit-category' && draft) draft.category = target.value;
  else if (target.id === 'edit-font' && draft) { draft.defaults.fontId = target.value; void paintDraft(); }
  else if (target.id === 'edit-show-date' && draft) { draft.defaults.showDate = target.checked; void paintDraft(); }
  else if (target.id === 'edit-show-brand' && draft) { draft.defaults.showBrand = target.checked; void paintDraft(); }
  else if (target.dataset.tag && draft) { draft.tags = target.checked ? [...new Set([...draft.tags, target.dataset.tag])] : draft.tags.filter(tag => tag !== target.dataset.tag); }
  if (draft && detail.contains(target)) updateDetailSaveStatus();
});
detail.addEventListener('cancel', event => { event.preventDefault(); closeDetail(); });
modal.addEventListener('cancel', event => { if (detailQueueReturn) { event.preventDefault(); cancelDetailModal(); } else { pendingClose = false; pendingDetailEntry = null; } });
modal.addEventListener('close', () => { if (pendingClose) pendingClose = false; });
document.addEventListener('submit', event => { event.preventDefault(); if (event.target.id === 'schedule-search-form') searchScheduleChoices(); });
$('#sidebar').addEventListener('click', event => { if (event.target.closest('[data-page],a.brand,[data-action="operation-map"],[data-action="about"]')) closeDrawer({ restoreFocus: false }); }, true);
drawerMedia.addEventListener('change', () => { if (!drawerMedia.matches) closeDrawer(); syncDrawer(); });
window.addEventListener('resize', fitEditorText);
window.addEventListener('resize', fitDetailQueueViewport);
window.matchMedia('(max-width:700px)').addEventListener('change', () => { if (catalog && state.page === 'review') render(); });
window.visualViewport?.addEventListener('resize', fitEditorText);
window.visualViewport?.addEventListener('resize', fitDetailQueueViewport);
window.visualViewport?.addEventListener('scroll', fitDetailQueueViewport);
document.addEventListener('keydown', event => {
  const queue = modal.open && event.target?.closest?.('.detail-queue-options');
  if (queue && ['ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter'].includes(event.key)) {
    event.preventDefault(); const rows = detailQueueRows(), index = rows.findIndex(row => row.id === detailQueueActive);
    if (event.key === 'Enter') { if (detailQueueActive) chooseDetailQueue(detailQueueActive); return; }
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
    if (rows[next]) { previewDetailQueue(rows[next].id); queue.querySelector(`[data-id="${rows[next].id}"]`)?.scrollIntoView({ block: 'nearest' }); }
    return;
  }
  if (drawerState && event.key === 'Escape') { event.preventDefault(); closeDrawer(); return; }
  if (drawerState && event.key === 'Tab') {
    const controls = [...$('#sidebar').querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),summary')].filter(node => node.getClientRects().length && node.getAttribute('tabindex') !== '-1');
    if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
    else if (!event.shiftKey && (document.activeElement === controls.at(-1) || !$('#sidebar').contains(document.activeElement))) { event.preventDefault(); controls[0]?.focus(); }
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (!detail.open && !modal.open && navigate('review')) $('#content-search')?.focus(); }
  const tab = event.target?.closest?.('[data-action="edit-tab"]');
  if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault(); const ids = ['content', 'style', 'image', 'tags'], index = ids.indexOf(draftTab);
    draftTab = ids[event.key === 'Home' ? 0 : event.key === 'End' ? ids.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length];
    renderDetail(); detail.querySelector(`[data-action="edit-tab"][data-value="${draftTab}"]`)?.focus();
  }
});
window.addEventListener('popstate', () => {
  const params = new URLSearchParams(location.search), value = params.get('page'), page = Object.hasOwn(pages, value) ? value : 'review';
  if (!guardDetailNavigation() || page !== state.page && modules.some(module => module.beforeNavigate?.(page) === false)) {
    const url = new URL(location.href); url.searchParams.set('page', state.page); history.pushState({}, '', url); return;
  }
  if (modules.some(module => module.setRoute?.({ page, template: params.get('template'), tab: params.get('tab'), sample: params.get('sample') }) === false)) return;
  if (page !== state.page) clearNotice();
  state.page = page; state.selected.clear(); render();
});
window.addEventListener('beforeunload', event => { if (draft && JSON.stringify(draft) !== draftOriginal) { event.preventDefault(); event.returnValue = ''; } });
syncDrawer();
try { catalog = await loadCatalog(); render(); }
catch { main.innerHTML = catalogErrorMarkup(); }
