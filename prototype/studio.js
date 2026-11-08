import { loadCatalog, paintPreview, backgroundImage, resourceUrl, escapeHTML as h, bindTheme, wireDialog } from './shared/card-preview.js';
import { POOLS, WEEK, createStudioModel, boundDates, cardSettings, moveEntry, replaceDates, applyScope, advanceRelease } from './shared/studio-state.js';

bindTheme();
let model = createStudioModel();
let catalog;
const pageNames = { review: '内容工作台', collect: '采集候选', schedule: '正式排期', assets: '素材中心', ai: 'AI 任务中心', release: '发布中心' };
const state = { page: 'review', pool: 'draft', entryId: 'example-flower', tab: 'image', view: 'focus', currentDate: '', scope: 'default', selectedDates: new Set(), search: '', assetFilter: 'all', assetSearch: '', taskTab: 'tasks', source: 'all', selectedCandidates: new Set(), imported: new Set(), checked: false, lockOnConfirm: true, settings: {}, dirty: false, draft: {}, message: '', modal: '', modalTarget: '', pendingStep: -1, day: WEEK[3], tags: [], note: '' };
const candidates = [
  { id: 'candidate-spring', text: '春眠不觉晓，处处闻啼鸟。', author: '孟浩然', source: '春晓', origin: '来源甲 · 示例', annotated: true },
  { id: 'candidate-sun', text: '白日依山尽，黄河入海流。', author: '王之涣', source: '登鹳雀楼', origin: '来源乙 · 示例', annotated: false },
  { id: 'candidate-river', text: '江流天地外，山色有无中。', author: '王维', source: '汉江临泛', origin: '来源甲 · 示例', annotated: true },
];
const tagGroups = { 主题: ['释然', '成长', '自由', '希望', '日常'], 情绪: ['平静', '温暖', '思念', '沉思'], 场景: ['山野', '树林', '田野', '海岸'], 意象: ['云', '月', '花', '水', '日'] };
const $ = selector => document.querySelector(selector);
const root = $('#daylight-studio-polish');
const main = $('#studio-main');
const dialog = $('#studio-dialog');
const modal = wireDialog(dialog);
const button = (label, action, attrs = '', type = '') => `<button type="button" class="ds-btn ${type}" data-action="${action}" ${attrs}>${label}</button>`;
const pill = (text, tone = '') => `<span class="ds-pill ${tone}">${h(text)}</span>`;
const selectOptions = (rows, selected) => rows.map(row => `<option value="${h(row.id)}"${row.id === selected ? ' selected' : ''}>${h(row.name)}</option>`).join('');
const entry = () => model.entries.find(row => row.id === state.entryId);
const settingPatch = () => ({ ...state.settings });
const availableRows = () => model.entries.filter(row => row.pool === state.pool && `${row.text} ${row.author} ${row.source}`.includes(state.search));

function unifiedModel() {
  const next = createStudioModel();
  if (!catalog?.imagery.length) return next;
  const approved = catalog.imagery.map(asset => ({ id: asset.id, resourceId: asset.id, name: asset.label, imageUrl: resourceUrl(`imagery/${asset.file}`), art: 'mist', scope: '共享素材', review: '已审核', delivery: '同源文件已构建', tags: [] }));
  const aliases = new Map(next.assets.map((asset, index) => [asset.id, approved[index % approved.length].id]));
  for (const row of next.entries) row.defaults.imageId = aliases.get(row.defaults.imageId);
  next.assets = approved;
  return next;
}
function announce(text) {
  state.message = text;
  const node = $('[data-status]');
  if (node) node.textContent = text;
}
function initializeEntry(id, date = '') {
  state.entryId = id;
  const row = entry();
  const dates = boundDates(model, id);
  state.currentDate = dates.includes(date) ? date : dates[0] || '';
  state.scope = state.currentDate ? 'current' : 'default';
  state.selectedDates = new Set(state.currentDate ? [state.currentDate] : []);
  state.settings = cardSettings(model, id, state.currentDate);
  state.draft = { text: row.text, author: row.author, source: row.source };
  state.tags = [...row.tags];
  state.note = row.note;
  state.checked = false;
  state.dirty = false;
}
function rememberPage() {
  const url = new URL(location.href);
  url.searchParams.set('page', state.page);
  history.replaceState(null, '', url);
}
function head(title, subtitle, actions = '') {
  return `<div class="ds-pagehead"><div><p class="ds-breadcrumb">设计工作区 / ${h(pageNames[state.page])}</p><h1>${h(title)}</h1><p class="ds-subtitle">${h(subtitle)}</p></div><div class="ds-row">${actions}</div></div>`;
}
function preview(row = entry(), settings = state.settings, date = state.currentDate, canvasId = 'studio-preview') {
  return `<section class="ds-previewstage"><div class="ds-previewtitle"><span>卡片预览 · 同源画布</span><span>3 : 4</span></div><canvas class="ds-poster-canvas" id="${canvasId}" width="1080" height="1440" role="img" aria-label="${h(row.author)}的卡片预览"></canvas><p class="ds-status-line" id="${canvasId}-status" role="status" aria-live="polite"></p><div class="ds-row">${pill(catalog.templates.find(item => item.id === settings.template)?.name || settings.template)}${pill(catalog.fonts.find(item => item.id === settings.fontId)?.name || settings.fontId)}</div><p class="ds-poster-caption">${date ? h(date) + ' · 日期副本示例' : '句子默认设置 · 示例'} / 非发布状态</p></section>`;
}
function paint(canvasId, row, settings, date) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const image = model.assets.find(asset => asset.id === settings.imageId);
  paintPreview(canvas, { text: row.text, author: row.author, source: row.source, date: date || '2026-11-05', background: image?.art || 'mist', ...(image?.resourceId ? { imageId: image.resourceId } : {}) }, { template: settings.template, fontId: settings.fontId, showDate: settings.showDate, showBrand: settings.showBrand }, document.getElementById(`${canvasId}-status`));
}
function scopePanel() {
  const dates = boundDates(model, state.entryId);
  return `<div class="ds-scope"><label>应用范围<select class="ds-select" data-setting="scope" aria-label="修改应用范围"><option value="current"${state.scope === 'current' ? ' selected' : ''}${!dates.length ? ' disabled' : ''}>当前日期${state.currentDate ? ' · ' + state.currentDate : ' · 未排期'}</option><option value="default"${state.scope === 'default' ? ' selected' : ''}>本句默认 · 不覆盖日期专属值</option><option value="dates"${state.scope === 'dates' ? ' selected' : ''}${!dates.length ? ' disabled' : ''}>选择关联日期 · 明确范围</option></select></label>${state.scope === 'dates' ? `<div class="ds-date-choice">${dates.map(date => `<label><input type="checkbox" data-scope-date="${date}"${state.selectedDates.has(date) ? ' checked' : ''}>${date}</label>`).join('')}</div>` : ''}<span class="ds-form-note">${state.scope === 'default' ? '默认设置会影响未设置专属值的日期；日期专属值保留。' : '仅所选日期更新；同一句的其他日期保持不变。'} 保存与图文确认分开。</span></div>`;
}
function contentPanel() {
  return `<div class="ds-form"><label class="ds-field">正文 · 240 字内<textarea class="ds-textarea" maxlength="240" data-edit="text" rows="4">${h(state.draft.text)}</textarea></label><div class="ds-two-fields"><label class="ds-field">作者 · 45 字内<input class="ds-input" data-edit="author" maxlength="45" value="${h(state.draft.author)}"></label><label class="ds-field">作品 / 出处 · 45 字内<input class="ds-input" data-edit="source" maxlength="45" value="${h(state.draft.source)}"></label></div><p class="ds-form-note">正文和出处属于句子本身；改动影响其关联日期，日期版式与配图仍独立。这里只保存到演示内存。</p></div>`;
}
function layoutPanel() {
  return `<div><div class="ds-sectionhead"><h3>卡片版式</h3><span class="ds-small ds-muted">共享目录 · ${catalog.templates.length}款</span></div><div class="ds-template-grid">${catalog.templates.map(row => `<button type="button" data-action="template" data-value="${row.id}" aria-pressed="${state.settings.template === row.id}">${h(row.name)}<small>${h(row.description)}</small></button>`).join('')}</div></div><label class="ds-field">卡片字体<select class="ds-select" data-setting="fontId">${selectOptions(catalog.fonts, state.settings.fontId)}</select></label><div class="ds-row"><label class="ds-check"><input type="checkbox" data-option="showDate"${state.settings.showDate ? ' checked' : ''}>日期</label><label class="ds-check"><input type="checkbox" data-option="showBrand"${state.settings.showBrand ? ' checked' : ''}>品牌落款</label></div>${scopePanel()}`;
}
function imageOption(asset) {
  return `<button type="button" class="ds-image-choice" data-action="image" data-value="${asset.id}" aria-pressed="${state.settings.imageId === asset.id}"><img src="${h(asset.imageUrl || backgroundImage(asset.art))}" alt="${h(asset.name)}"><strong>${h(asset.name)}</strong><small>${h(asset.review)} · ${h(asset.delivery)}</small></button>`;
}
function imagePanel() {
  const exclusive = model.assets.filter(asset => asset.scope === '本句专属' && asset.owner === state.entryId && asset.review !== '已驳回');
  const shared = model.assets.filter(asset => asset.scope === '共享素材' && asset.review !== '已驳回').slice(0, 2);
  return `<div><div class="ds-sectionhead"><h3>语义标签</h3>${button('标签详情', 'tab', 'data-value="tags"', 'ds-quiet')}</div><div class="ds-tags">${entry().tags.map(tag => `<span class="ds-tag">${h(tag)}</span>`).join('')}</div><p class="ds-tag-note">${h(entry().note)}</p></div><div><div class="ds-sectionhead"><h3>选择配图</h3><span class="ds-small ds-muted">审核与交付分开</span></div><div class="ds-image-groups"><div><p class="ds-groupname">本句专属</p>${exclusive.length ? exclusive.map(imageOption).join('') : `<div class="ds-exclusive-empty"><span>暂无专属图</span>${button('生成示例流程', 'generate', '', 'ds-quiet')}</div>`}</div><div><p class="ds-groupname">共享推荐 · 标签匹配</p><div class="ds-shared">${shared.map(imageOption).join('')}</div></div></div><div class="ds-image-tools"><span class="ds-small ds-muted">候选图不是已确认配图</span>${button('更多素材 ↗', 'go-assets', '', 'ds-quiet')}</div></div>${scopePanel()}`;
}
function tagsPanel() {
  return `<div class="ds-sectionhead"><h3>语义标注</h3>${pill(entry().annotationConfirmed ? '人工已确认' : '建议待确认', entry().annotationConfirmed ? 'ds-good' : 'ds-warning')}</div><div class="ds-label-groups">${Object.entries(tagGroups).map(([group, labels]) => `<div><strong>${group}</strong><div class="ds-tags-check">${labels.map(label => `<button type="button" class="ds-tag-choice" data-action="tag" data-value="${label}" aria-pressed="${state.tags.includes(label)}">${label}</button>`).join('')}</div></div>`).join('')}</div><label class="ds-field">标注备注<textarea class="ds-textarea" data-tag-note rows="2">${h(state.note)}</textarea></label><p class="ds-form-note">人工标签确认与图文确认是不同状态。确认后保护人工结果；批量任务默认跳过已确认或锁定记录。</p>${button('确认人工标注', 'annotation-confirm', '', 'ds-primary')}`;
}
function reviewPage() {
  const rows = availableRows();
  if (rows.length && !rows.some(row => row.id === state.entryId)) initializeEntry(rows[0].id);
  const pools = `<div class="ds-pools" role="group" aria-label="四池导航">${Object.entries(POOLS).map(([id, label]) => `<button type="button" data-action="pool" data-value="${id}" aria-pressed="${state.pool === id}">${label}<span class="ds-count">${model.entries.filter(row => row.pool === id).length}</span></button>`).join('')}</div>`;
  const heading = `<div class="ds-review-heading"><h1>内容工作台</h1>${pools}<div class="ds-segment" role="group" aria-label="审阅方式">${[['focus', '精审'], ['grid', '总览']].map(([id, label]) => `<button type="button" data-action="view" data-value="${id}" aria-pressed="${state.view === id}">${label}</button>`).join('')}</div></div><div class="ds-toolbar"><label class="ds-search"><span aria-hidden="true">⌕</span><input type="search" id="studio-search" placeholder="搜索正文、作者或作品" aria-label="搜索正文作者作品" value="${h(state.search)}"></label>${button('应用筛选', 'search')}${button('批量任务', 'new-task', '', 'ds-quiet')}</div><p class="ds-readonly-notice">全部 ${model.entries.length} 条均为公开诗句设计样例。四池自由流转；正式内容移出前必须为其全部关联日期明确替代句。</p>`;
  if (!rows.length) return heading + `<div class="ds-sheet ds-empty"><h2>${state.search ? '没有匹配的示例' : `${POOLS[state.pool]}池暂时为空`}</h2><p class="ds-small">不会读取真实四池数据来补齐。</p>${button('清除筛选', 'clear-search')}</div>`;
  if (state.view === 'grid') return heading + `<div class="ds-grid-review">${rows.map((row, index) => `<section>${preview(row, row.defaults, '', `grid-${index}`)}<div class="ds-row" style="margin-top:10px">${button('精审这句', 'entry', `data-value="${row.id}"`, 'ds-primary')}</div></section>`).join('')}</div>`;
  const row = entry();
  const binding = model.bindings[state.currentDate];
  const confirmed = binding?.entryId === row.id ? binding.confirmed : !!row.imageConfirmed;
  const panels = { content: contentPanel, layout: layoutPanel, image: imagePanel, tags: tagsPanel };
  return heading + `<div class="ds-viewbar"><label class="ds-field ds-queue">精审队列<select class="ds-select" data-entry>${rows.map((item, index) => `<option value="${item.id}"${item.id === row.id ? ' selected' : ''}>${index + 1} / ${rows.length}　${h(item.text.replace(/\n/g, ''))} — ${h(item.author)}</option>`).join('')}</select></label><div class="ds-row">${button('上一句', 'previous')}${button('下一句', 'next')}</div></div><div class="ds-review">${preview()}<section class="ds-inspector" aria-label="句子精审详情"><div class="ds-tabs" role="tablist" aria-label="精审四个页签">${[['content', '内容'], ['layout', '版式'], ['image', '配图'], ['tags', '标签']].map(([id, label]) => `<button type="button" role="tab" id="studio-tab-${id}" aria-selected="${state.tab === id}" aria-controls="studio-inspector-panel" data-action="tab" data-value="${id}">${label}</button>`).join('')}</div><div class="ds-inspector-body" id="studio-inspector-panel" role="tabpanel" aria-labelledby="studio-tab-${state.tab}">${panels[state.tab]()}</div><footer class="ds-inspector-footer"><div class="ds-row ds-between"><label class="ds-check"><input type="checkbox" data-check="reviewed"${state.checked ? ' checked' : ''}>已核对语境、裁切与权利说明</label><label class="ds-check"><input type="checkbox" data-check="lock"${state.lockOnConfirm ? ' checked' : ''}>确认后锁定</label></div><div class="ds-row ds-between"><span class="ds-save-state">${state.dirty ? '预览已改 · 尚未保存' : confirmed ? '示例图文已确认 · 尚未发布' : '示例已保存 · 待图文确认'}</span><div class="ds-row">${button('保存示例修改', 'save', '', state.dirty ? 'ds-primary' : '')}${button(confirmed ? '重新复核' : '确认图文', 'confirm', !state.checked && !confirmed || state.dirty ? 'disabled' : '', 'ds-primary')}</div></div></footer></section></div><div class="ds-pool-footer"><span class="ds-small ds-muted">关联日期 ${boundDates(model, row.id).length} 天 · 流转不等于发布</span><div class="ds-pool-move"><span class="ds-small ds-muted">移动到</span>${Object.entries(POOLS).filter(([id]) => id !== state.pool).map(([id, label]) => button(label, 'move', `data-value="${id}"`, id === 'trash' ? 'ds-danger' : '')).join('')}</div></div>`;
}
function visibleCandidates() { return candidates.filter(row => !state.imported.has(row.id) && (state.source === 'all' || row.origin === state.source)); }
function collectPage() {
  const rows = visibleCandidates();
  return head('采集候选', '来源和范围明确，入库前保留作者与作品。', button('开始抓取 · 流程示意', 'collect-info')) + `<div class="ds-toolbar"><label class="ds-field">来源<select class="ds-select" data-source><option value="all">全部来源</option>${['来源甲 · 示例', '来源乙 · 示例'].map(value => `<option${state.source === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label><span class="ds-small ds-muted">${rows.length} 条虚构候选 · 没有联网</span></div><section class="ds-sheet"><div class="ds-sheet-heading"><label class="ds-check"><input type="checkbox" data-check="all-candidates"${rows.length && rows.every(row => state.selectedCandidates.has(row.id)) ? ' checked' : ''}>只选本页</label><div class="ds-row">${button('标注选中', 'new-task', state.selectedCandidates.size ? '' : 'disabled')}${button(`入库选中 ${state.selectedCandidates.size} 条`, 'import', state.selectedCandidates.size ? '' : 'disabled', 'ds-primary')}</div></div><table class="ds-table"><thead><tr><th style="width:9%">选择</th><th style="width:45%">句子与出处</th><th>来源</th><th>标注</th></tr></thead><tbody>${rows.map(row => `<tr><td><input type="checkbox" data-candidate="${row.id}" aria-label="选择${h(row.text)}"${state.selectedCandidates.has(row.id) ? ' checked' : ''}></td><td data-label="句子">${h(row.text)}<span class="ds-cell-sub">${h(row.author)} · ${h(row.source)}</span></td><td data-label="来源">${h(row.origin)}</td><td data-label="标注">${pill(row.annotated ? '建议待确认' : '未标注')}</td></tr>`).join('') || '<tr><td colspan="4"><div class="ds-empty"><h3>本页候选已处理</h3><p>演示入库后折叠，保留来源。</p></div></td></tr>'}</tbody></table><div class="ds-table-foot"><span>只入库明确勾选的记录，不变更日期或推送。</span>${button('重置候选示例', 'undo-import', '', 'ds-quiet')}</div></section>`;
}
function assetsPage() {
  const rows = model.assets.filter(asset => (state.assetFilter === 'all' || state.assetFilter === 'shared' && asset.scope === '共享素材' || state.assetFilter === 'exclusive' && asset.scope === '本句专属' || state.assetFilter === 'pending' && asset.review === '待审核' || state.assetFilter === 'rejected' && asset.review === '已驳回' || state.assetFilter === 'delivery' && asset.delivery !== '可交付') && `${asset.name} ${asset.tags.join(' ')}`.includes(state.assetSearch));
  return head('素材中心', '素材审核与分发状态独立；“仅本地”不代表可发布。', button('登记素材 · 示例', 'asset-record') + button('生成素材 · 示例', 'generate', '', 'ds-primary')) + `<div class="ds-toolbar"><label class="ds-search"><input type="search" id="asset-search" aria-label="搜索素材名称标签" placeholder="搜索名称、标签或意象" value="${h(state.assetSearch)}"></label>${button('搜索', 'asset-search')}</div><div class="ds-viewbar"><div class="ds-pools" role="group" aria-label="素材状态筛选">${[['all', '全部'], ['shared', '共享'], ['exclusive', '本句专属'], ['pending', '待审核'], ['rejected', '已驳回'], ['delivery', '分发待处理']].map(([id, label]) => `<button type="button" data-action="asset-filter" data-value="${id}" aria-pressed="${state.assetFilter === id}">${label}</button>`).join('')}</div><span class="ds-small ds-muted">${rows.length} 张示例</span></div><div class="ds-asset-grid">${rows.map(asset => `<button type="button" class="ds-asset-card" data-action="asset-detail" data-value="${asset.id}"><img src="${h(asset.imageUrl || backgroundImage(asset.art))}" alt="${h(asset.name)}"><div class="ds-asset-copy"><div class="ds-asset-name"><h3>${h(asset.name)}</h3>${pill(asset.review, asset.review === '已审核' ? 'ds-good' : 'ds-warning')}</div><span class="ds-small ds-muted">${h(asset.tags.join(' / '))}</span></div><div class="ds-asset-footer"><span>${asset.scope}</span><span>${asset.delivery}</span></div></button>`).join('')}</div>`;
}
function tasksPage() {
  return head('AI 任务中心', '任务、产物与会话互相对应；均为虚构状态。', button('新建任务 · 示例', 'new-task', '', 'ds-primary')) + `<details class="ds-config"><summary><span>模型配置 · 本地设置设计</span>${pill('真实输入已禁用')}</summary><div class="ds-config-body">${['语义标注', '图像生成'].map(label => `<div><h3>${label}</h3><label class="ds-field">模型<input class="ds-input" value="${label}模型 · 示例" disabled></label><label class="ds-field">服务地址<input class="ds-input" placeholder="设计页不接收真实地址" disabled></label><label class="ds-field">本机密钥<input class="ds-input ds-disabled-secret" type="password" placeholder="不读取、不显示、不接受真实密钥" disabled autocomplete="off"></label>${button('本地保存反馈 · 模拟', 'config-save')}<p class="ds-form-note">实际凭据配置在本地后台进行，不是这里；此页不访问环境变量、加密文件或系统密钥存储。</p></div>`).join('')}</div></details><div class="ds-viewbar"><div class="ds-pools" role="tablist" aria-label="任务与会话">${[['tasks', '任务列表'], ['sessions', '会话记录']].map(([id, label]) => `<button type="button" role="tab" data-action="task-tab" data-value="${id}" aria-selected="${state.taskTab === id}" aria-pressed="${state.taskTab === id}">${label}</button>`).join('')}</div><span class="ds-small ds-muted">不是真实任务与日志</span></div>${state.taskTab === 'sessions' ? `<section class="ds-sheet"><table class="ds-table"><thead><tr><th>会话</th><th>关联任务</th><th>状态</th><th>操作</th></tr></thead><tbody>${['语义标注', '绘画提示词', '图像生成'].map((label, index) => `<tr><td data-label="会话">${label}<span class="ds-cell-sub">虚构会话 ${index + 1}</span></td><td data-label="任务">${index ? '本句专属配图 · 样例' : '草稿标注 · 样例'}</td><td data-label="状态">${pill('示例返回')}</td><td>${button('查看示例详情', 'session', `data-value="${index}"`, 'ds-quiet')}</td></tr>`).join('')}</tbody></table></section>` : `<section class="ds-sheet"><table class="ds-table"><thead><tr><th style="width:30%">任务</th><th style="width:25%">进度</th><th style="width:27%">产物</th><th>操作</th></tr></thead><tbody><tr><td data-label="任务">草稿语义标注<span class="ds-cell-sub">3 句 · 示例</span></td><td data-label="进度">${pill('处理中', 'ds-good')}<div class="ds-meter" role="progressbar" aria-label="模拟标注进度" aria-valuemin="0" aria-valuemax="3" aria-valuenow="2"><span style="width:66.7%"></span></div><span class="ds-cell-sub">2 / 3</span></td><td data-label="产物">2 条建议<span class="ds-cell-sub">人工确认结果默认保护</span></td><td>${button('任务详情', 'task-detail', 'data-value="annotation"', 'ds-quiet')}</td></tr><tr><td data-label="任务">云起青山 · 本句专属<span class="ds-cell-sub">1 张 · 示例</span></td><td data-label="进度">${pill('后处理待恢复', 'ds-warning')}</td><td data-label="产物">模型产物已保留<span class="ds-cell-sub">只重试入库，不重复生图</span></td><td>${button('查看原因', 'task-detail', 'data-value="image"', 'ds-quiet')}</td></tr><tr><td data-label="任务">共享图库补充<span class="ds-cell-sub">2 张 · 示例</span></td><td data-label="进度">${pill('已完成', 'ds-good')}</td><td data-label="产物">2 张待审核<span class="ds-cell-sub">完成不等于可交付</span></td><td>${button('查看素材', 'go-assets', '', 'ds-quiet')}</td></tr></tbody></table></section>`}`;
}
function schedulePage() {
  const binding = model.bindings[state.day];
  const row = model.entries.find(item => item.id === binding.entryId);
  const settings = cardSettings(model, row.id, state.day);
  const asset = model.assets.find(item => item.id === settings.imageId);
  return head('正式排期', '七天示例，日期专属设置不覆盖同句其他日期。', button('2026 年 11 月 2–8 日', 'week-info')) + `<div class="ds-week" aria-label="七天日期选择">${WEEK.map((date, index) => { const item = model.entries.find(row => row.id === model.bindings[date].entryId); const image = model.assets.find(asset => asset.id === cardSettings(model, item.id, date).imageId); return `<button type="button" class="ds-day" data-action="day" data-value="${date}" aria-pressed="${state.day === date}"><small>星期${'一二三四五六日'[index]}</small><strong>${date.slice(-2)}</strong><img src="${h(image?.imageUrl || backgroundImage(image?.art || 'mist'))}" alt="日签配图示意"><small>${model.bindings[date].confirmed ? '示例已确认' : '待图文确认'}</small></button>`; }).join('')}</div><div class="ds-review">${preview(row, settings, state.day, 'schedule-preview')}<section class="ds-sheet"><div class="ds-sheet-heading"><h2>${state.day} · 日期详情</h2>${pill('工作副本示意')}</div><div class="ds-inspector-body"><p class="ds-poem">${h(row.text)}</p><p class="ds-small ds-muted">${h(row.author)} · ${h(row.source)}</p><dl class="ds-detail-list"><dt>版式</dt><dd>${h(catalog.templates.find(item => item.id === settings.template).name)}</dd><dt>字体</dt><dd>${h(catalog.fonts.find(item => item.id === settings.fontId).name)}</dd><dt>配图</dt><dd>${h(asset?.name || '无')}</dd><dt>图文状态</dt><dd>${binding.confirmed ? '示例已确认' : '待人工确认'}</dd><dt>日期专属值</dt><dd>${Object.keys(binding.overrides).length ? h(Object.keys(binding.overrides).join(' / ')) : '继承本句默认'}</dd><dt>远端</dt><dd>未读取，不推断状态</dd></dl></div><div class="ds-release-actions">${button('替换本日句子', 'replace-day')}${button('进入本日精审 →', 'schedule-review', '', 'ds-primary')}</div></section></div>`;
}
function releasePage() {
  const labels = ['运行预检', '应用修订', '生成发布包', '确认推送', '核验回执'];
  const notes = ['核对范围与阻塞项', '应用选定日期的修订', '准备本地分发产物', '独立确认后模拟发送', '单独核对远端回执'];
  return head('发布中心', '五个阶段都可演练，任何阶段都不执行构建或网络发布。', button('数据健康 · 示例', 'health') + button('刷新对照 · 示例', 'refresh')) + `<div class="ds-readonly-notice">版本数字是纯设计样例：${WEEK.length} 天工作副本、${WEEK.length} 天模拟构建。远端从未读取。保存、审核、构建与发布不能互相替代。</div><div class="ds-release-alert"><div><strong>${model.release.blocked ? '示例阻塞：1 项图文待核对' : '已选择无阻塞场景 · 仍不是业务校验'}</strong><span style="display:block;margin-top:3px">切换只改变演示状态，不会修复真实内容。</span></div>${button(model.release.blocked ? '模拟问题已处理' : '切回阻塞示例', 'release-block', '', 'ds-quiet')}</div><section class="ds-sheet"><div class="ds-stepper" aria-label="五个发布阶段">${['预检', '应用修订', '生成发布包', '确认推送', '核验回执'].map((label, index) => `<div class="ds-step ${index <= model.release.completed ? 'active' : ''}"><span class="ds-step-num">${index + 1}</span><span>${label}</span></div>`).join('')}</div><div class="ds-release-controls">${labels.map((label, index) => `<section class="ds-release-control"><strong class="ds-small">${String(index + 1).padStart(2, '0')} · ${index < model.release.completed ? '示例已完成' : '尚未演示'}</strong><span>${notes[index]}</span>${button(label + ' · 模拟', 'release-step', `data-value="${index}"${index !== model.release.completed ? ' disabled' : ''}`, index === model.release.completed ? 'ds-primary' : '')}</section>`).join('')}</div></section><div class="ds-release-grid"><section class="ds-sheet"><div class="ds-sheet-heading"><h2>版本对照</h2>${pill('虚构示例')}</div>${[['正式工作副本', '已编排，不代表线上已更新', '7 天'], ['模拟构建', '用于说明日期差异，未运行构建', '7 天'], ['远端内容', '没有联网核验', '未知']].map(([name, detail, amount]) => `<div class="ds-version-row"><span class="ds-object-icon">▤</span><div><strong>${name}</strong><small>${detail}</small></div><span>${amount}</span></div>`).join('')}</section><section class="ds-sheet"><div class="ds-sheet-heading"><h2>检查范围</h2>${pill(model.release.completed === 5 ? '演示结束' : '待演练', 'ds-warning')}</div><div class="ds-checklist">${['四池归属与日期关联', '图文确认与使用说明', '字体与图片交付产物', '推送结果独立核验'].map(label => `<div class="ds-check-item"><span class="ds-check-icon">·</span><div>${label}<small>只有真实环境校验能形成有效结论</small></div></div>`).join('')}</div></section></div><section class="ds-sheet" style="margin-top:18px"><div class="ds-sheet-heading"><h2>日期差异 · 示例</h2>${button('查看对比', 'diff', '', 'ds-quiet')}</div><table class="ds-table"><thead><tr><th>日期</th><th>模拟构建</th><th>工作副本示例</th></tr></thead><tbody><tr><td>2026-11-05</td><td>明月松间照，清泉石上流。</td><td>行到水穷处，坐看云起时。</td></tr></tbody></table></section>`;
}
function render() {
  main.innerHTML = ({ review: reviewPage, collect: collectPage, schedule: schedulePage, assets: assetsPage, ai: tasksPage, release: releasePage })[state.page]() + `<div class="ds-toast" data-status role="status" aria-live="polite">${h(state.message)}</div>`;
  root.querySelectorAll('[data-page]').forEach(node => { if (node.dataset.page === state.page) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current'); });
  if (state.page === 'review') {
    const rows = availableRows();
    if (state.view === 'grid') rows.forEach((row, index) => paint(`grid-${index}`, row, row.defaults, ''));
    else if (rows.length) paint('studio-preview', { ...entry(), ...state.draft }, state.settings, state.currentDate);
  }
  if (state.page === 'schedule') { const row = model.entries.find(item => item.id === model.bindings[state.day].entryId); paint('schedule-preview', row, cardSettings(model, row.id, state.day), state.day); }
  rememberPage();
}
function openDialog(title, content, footer = '') {
  $('#studio-dialog-title').textContent = title;
  $('#studio-dialog-body').innerHTML = content + '<p class="ds-inline-error" id="dialog-error" role="alert"></p>';
  $('#studio-dialog-footer').innerHTML = footer || button('我知道了', 'close-dialog', '', 'ds-primary');
  if (!dialog.open) modal.open();
}
function closeDialog() { modal.close(); state.modal = ''; }
function moveDialog(target) {
  const dates = target === 'formal' ? [] : boundDates(model, state.entryId);
  state.modalTarget = target;
  state.modal = 'move';
  const replacements = model.entries.filter(row => row.id !== state.entryId && row.pool !== 'trash');
  openDialog(`移入${POOLS[target]} · 纯内存模拟`, `<p>当前句子：${h(entry().text.replace(/\n/g, ''))}</p><p class="ds-form-note">四池之间可自由移动。${dates.length ? '此句有关联日期；所有替代项一次性校验通过后才会应用，取消或任一缺项不改变任何日期。' : '没有需要替换的关联日期；只改变示例归属。'}</p>${dates.map(date => `<label class="ds-replacement-row">${date}<select class="ds-select" data-replacement="${date}"><option value="">请选择替代句</option>${replacements.map(row => `<option value="${row.id}">${h(row.text.replace(/\n/g, ''))} · ${POOLS[row.pool]}</option>`).join('')}</select></label>`).join('')}`, button('取消', 'close-dialog') + button('一次性应用示例变更', 'apply-move', '', 'ds-primary'));
}
function nextEntry(offset) {
  const rows = availableRows();
  if (!rows.length) return;
  const index = rows.findIndex(row => row.id === state.entryId);
  initializeEntry(rows[(index + offset + rows.length) % rows.length].id);
  render();
}
function saveEdits() {
  if (!state.draft.text.trim() || Array.from(state.draft.text).length > 240 || Array.from(state.draft.author).length > 45 || Array.from(state.draft.source).length > 45) throw new Error('请检查正文与出处长度：240 / 45 / 45。');
  let next = applyScope(model, state.entryId, settingPatch(), state.scope, state.currentDate, [...state.selectedDates]);
  const row = next.entries.find(item => item.id === state.entryId);
  Object.assign(row, state.draft);
  row.imageConfirmed = false;
  model = next;
  state.dirty = false;
  state.checked = false;
  render();
  announce('示例修改已保存到内存；图文需要重新复核，未发布。');
}
function importSelected() {
  const chosen = visibleCandidates().filter(row => state.selectedCandidates.has(row.id));
  chosen.forEach(candidate => {
    state.imported.add(candidate.id);
    if (!model.entries.some(row => row.id === candidate.id)) model.entries.push({ id: candidate.id, text: candidate.text, author: candidate.author, source: candidate.source, pool: 'draft', defaults: { template: 'paper', fontId: 'system', imageId: 'sample-dusk', showDate: true, showBrand: true }, tags: candidate.annotated ? ['平静'] : [], note: `${candidate.origin} · 示例来源保留`, annotationConfirmed: false, protected: false });
  });
  state.selectedCandidates.clear();
  closeDialog(); render(); announce(`仅将 ${chosen.length} 条选中样例加入内存草稿，未改正式排期。`);
}
root.addEventListener('click', event => {
  if (!catalog) return;
  const node = event.target.closest('button');
  if (!node || node.disabled) return;
  if (node.dataset.page) { state.page = node.dataset.page; state.message = ''; render(); return; }
  const action = node.dataset.action, value = node.dataset.value;
  try {
    switch (action) {
      case 'tab': state.tab = value; render(); break;
      case 'pool': state.pool = value; state.search = ''; state.message = ''; render(); break;
      case 'view': state.view = value; render(); break;
      case 'entry': state.view = 'focus'; initializeEntry(value); render(); break;
      case 'previous': nextEntry(-1); break;
      case 'next': nextEntry(1); break;
      case 'search': state.search = $('#studio-search').value.trim(); render(); break;
      case 'clear-search': state.search = ''; render(); break;
      case 'template': state.settings.template = value; state.dirty = true; state.checked = false; render(); break;
      case 'image': state.settings.imageId = value; state.dirty = true; state.checked = false; render(); break;
      case 'save': saveEdits(); break;
      case 'confirm': {
        const asset = model.assets.find(item => item.id === state.settings.imageId);
        if (asset?.review !== '已审核') throw new Error('先审核候选图，再确认图文；图片交付状态另行核对。');
        const binding = model.bindings[state.currentDate];
        if (binding?.entryId === state.entryId) { binding.confirmed = !binding.confirmed; binding.locked = binding.confirmed && state.lockOnConfirm; }
        else entry().imageConfirmed = !entry().imageConfirmed;
        render(); announce('图文确认效果已演示；素材可交付性与发布仍分别确认。'); break;
      }
      case 'tag': state.tags.includes(value) ? state.tags = state.tags.filter(tag => tag !== value) : state.tags.push(value); node.setAttribute('aria-pressed', String(state.tags.includes(value))); break;
      case 'annotation-confirm': openDialog('确认人工标注', `<p>将保存 ${state.tags.length} 个标签及备注，保护人工结果。标注确认不等于图片确认，也不等于发布。</p><p class="ds-tag-note">${h(state.tags.join(' / '))}</p>`, button('取消', 'close-dialog') + button('确认并保护 · 示例', 'apply-annotation', '', 'ds-primary')); break;
      case 'apply-annotation': entry().tags = [...state.tags]; entry().note = state.note; entry().annotationConfirmed = true; entry().protected = true; closeDialog(); render(); announce('人工标注已在示例内存确认并保护。'); break;
      case 'move': moveDialog(value); break;
      case 'apply-move': { const replacements = Object.fromEntries([...dialog.querySelectorAll('[data-replacement]')].map(select => [select.dataset.replacement, select.value])); model = moveEntry(model, state.entryId, state.modalTarget, replacements); state.pool = state.modalTarget; initializeEntry(state.entryId); closeDialog(); render(); announce('归属与全部日期替代已一次性模拟应用，没有真实写入。'); break; }
      case 'day': state.day = value; render(); break;
      case 'schedule-review': state.pool = 'formal'; state.page = 'review'; state.view = 'focus'; initializeEntry(model.bindings[state.day].entryId, state.day); render(); break;
      case 'replace-day': state.modal = 'replace-day'; openDialog('替换本日句子', `<p>只替换 ${state.day}，同句其他排期保持不变。</p><label class="ds-field">替代句<select class="ds-select" id="replacement-entry"><option value="">请选择</option>${model.entries.filter(row => row.pool !== 'trash').map(row => `<option value="${row.id}">${h(row.text.replace(/\n/g, ''))}</option>`).join('')}</select></label>`, button('取消', 'close-dialog') + button('替换本日 · 示例', 'apply-replace-day', '', 'ds-primary')); break;
      case 'apply-replace-day': model = replaceDates(model, [state.day], $('#replacement-entry').value); closeDialog(); render(); announce('仅更新本日示例关联，图文回到待确认。'); break;
      case 'go-assets': state.page = 'assets'; render(); break;
      case 'asset-filter': state.assetFilter = value; render(); break;
      case 'asset-search': state.assetSearch = $('#asset-search').value.trim(); render(); break;
      case 'asset-detail': {
        const asset = model.assets.find(row => row.id === value); state.modalTarget = asset.id;
        openDialog(asset.name, `<img class="ds-detail-image" src="${h(asset.imageUrl || backgroundImage(asset.art))}" alt="${h(asset.name)}"><div class="ds-row">${pill(asset.scope)}${pill(asset.review)}${pill(asset.delivery)}</div><dl class="ds-detail-list"><dt>标签</dt><dd>${h(asset.tags.join(' / '))}</dd><dt>来源</dt><dd>内置配图，只有展示状态是虚构样例</dd><dt>审核</dt><dd>核对语境、权利与裁切</dd><dt>分发</dt><dd>另验文件与地址，不以审核代替</dd></dl>`, button('关闭', 'close-dialog') + button('模拟审核通过', 'asset-approve') + button('模拟交付验证', 'asset-deliver', '', 'ds-primary')); break;
      }
      case 'asset-approve': model.assets.find(row => row.id === state.modalTarget).review = '已审核'; closeDialog(); render(); announce('只更新素材审核示例；交付状态没有自动改变。'); break;
      case 'asset-deliver': { const asset = model.assets.find(row => row.id === state.modalTarget); if (asset.review !== '已审核') throw new Error('此示例先完成人工审核，再演示交付核对。'); asset.delivery = '可交付'; closeDialog(); render(); announce('交付通过反馈已演示；没有验证真实地址或上传文件。'); break; }
      case 'task-tab': state.taskTab = value; render(); break;
      case 'new-task': openDialog('任务范围预演 · 不创建真实任务', `<p>提交前明确对象和范围，人工确认内容默认保护。</p><label class="ds-field">范围<select class="ds-select"><option>当前选中示例</option><option>当前筛选未标注样例</option><option>全部未标注样例</option></select></label><label class="ds-check"><input type="checkbox" checked disabled>跳过已确认、已锁定的人工结果</label><p class="ds-form-note">真实执行会向配置的模型发送正文、作者与出处；本设计页不会发送。</p>`, button('取消', 'close-dialog') + button('查看模拟任务', 'task-preview', '', 'ds-primary')); break;
      case 'task-preview': closeDialog(); state.page = 'ai'; state.taskTab = 'tasks'; render(); announce('只切换到已有虚构任务列表，未提交模型请求。'); break;
      case 'task-detail': openDialog(value === 'image' ? '后处理待恢复 · 示例' : '标注任务详情 · 示例', '<p>请求返回、文件校验、入库、人工审核分别显示。图像模型已返回而入库失败时，复用产物重试后处理，不重复生成。</p><div class="ds-row">' + pill('模型产物示例已保留') + pill('未执行真实任务') + '</div>', button('查看关联会话', 'open-sessions') + button('重试入库 · 模拟', 'retry-task', '', 'ds-primary')); break;
      case 'retry-task': closeDialog(); announce('后处理恢复反馈已演示；未下载、未入库、未重复生成。'); break;
      case 'open-sessions': closeDialog(); state.page = 'ai'; state.taskTab = 'sessions'; render(); break;
      case 'session': openDialog('会话详情 · 虚构记录', '<div class="ds-row">' + pill('请求与返回布局') + pill('不是脱敏后的真实日志') + '</div><dl class="ds-detail-list"><dt>关联任务</dt><dd>设计任务样例</dd><dt>模型</dt><dd>配置模型占位</dd><dt>凭据</dt><dd>从未采集或记录</dd></dl><pre class="ds-logcode">请求示意\n  目标：当前句子\n  内容：公开诗句样例\n\n返回示意\n  模型阶段：完成\n  产物：示例引用\n  后处理：等待恢复\n\n以上文本是手写虚构状态，不含真实日志。</pre>'); break;
      case 'config-save': announce('配置保存反馈示意；输入已禁用，未接受或保存地址、模型凭据。'); break;
      case 'generate': openDialog('生成专属图 · 流程设计', '<p>仅当前句子的生成产物进入“本句专属”组，待人工审核。模型完成、文件入库、图片审核、对外交付分别确认。</p><p>此页不会调用模型，也不产生费用。</p>', button('关闭', 'close-dialog') + button('查看模拟任务', 'task-preview', '', 'ds-primary')); break;
      case 'asset-record': openDialog('登记素材 · 样式示例', '<label class="ds-field">素材名<input class="ds-input" placeholder="仅可填写演示名称"></label><label class="ds-field">权利说明<textarea class="ds-textarea" placeholder="来源、授权与适用范围示例"></textarea></label><p class="ds-form-note">不接收文件、URL 或真实素材；不会入库。</p>', button('取消', 'close-dialog') + button('保存反馈 · 模拟', 'mock-save', '', 'ds-primary')); break;
      case 'import': openDialog('确认候选入库范围', `<p>只处理明确选择的 ${state.selectedCandidates.size} 条可见示例，进入草稿池，保留来源；不自动标为人工确认。</p>`, button('取消', 'close-dialog') + button('模拟入库', 'apply-import', '', 'ds-primary')); break;
      case 'apply-import': importSelected(); break;
      case 'undo-import': model.entries = model.entries.filter(row => !state.imported.has(row.id) || boundDates(model, row.id).length); state.imported.clear(); state.selectedCandidates.clear(); render(); announce('已重置候选演示；仍被示例排期引用的条目保留。'); break;
      case 'collect-info': openDialog('开始抓取 · 原有入口保留', '<p>正式采集应先选择来源与范围，并明确外部请求。此设计资源不接入采集模块，不联网抓取。</p><label class="ds-field">来源<select class="ds-select"><option>来源甲 · 示例</option><option>来源乙 · 示例</option></select></label>'); break;
      case 'release-block': model.release.blocked = !model.release.blocked; model.release.completed = 0; render(); break;
      case 'release-step': { const step = Number(value); if (model.release.blocked) { announce('预检示例仍有阻塞；应用修订、打包和推送不可继续。'); break; } state.pendingStep = step; openDialog(['运行预检', '应用修订', '生成发布包', '确认推送', '核验回执'][step] + ' · 演示确认', `<p>将演示第 ${step + 1} 个阶段的反馈。没有业务调用、构建、网络推送或真实回执。</p>${step === 3 ? '<p class="ds-warning-note">真实推送必须单独确认目标和范围；这里不包含任何生产目标。</p>' : ''}`, button('取消', 'close-dialog') + button('继续模拟', 'apply-release-step', '', 'ds-primary')); break; }
      case 'apply-release-step': model = advanceRelease(model, state.pendingStep); closeDialog(); render(); announce(`第 ${model.release.completed} 阶段反馈已演示；仍未执行任何真实操作。`); break;
      case 'health': openDialog('数据健康 · 设计样例', `<dl class="ds-detail-list"><dt>内容实体</dt><dd>${model.entries.length} 条公开诗句样例</dd><dt>排期</dt><dd>${WEEK.length} 个虚构日期绑定</dd><dt>范围</dt><dd>只检查示例模型，不检查真实工作区</dd><dt>远端</dt><dd>从未读取</dd></dl><p>这里不恢复、合并、替换或发布真实内容。</p>`); break;
      case 'diff': openDialog('日期修订对照 · 示例', '<div class="ds-two-fields"><div><h3>模拟构建</h3><p class="ds-poem">明月松间照，\n清泉石上流。</p></div><div><h3>工作副本示例</h3><p class="ds-poem">行到水穷处，\n坐看云起时。</p></div></div><p>正文、出处、版式、字体和配图逐项核对，再形成日期修订。</p>'); break;
      case 'record': openDialog('录入内容 · 设计表单', '<label class="ds-field">正文<textarea class="ds-textarea" maxlength="240" placeholder="这里的输入只用于设计演示"></textarea></label><div class="ds-two-fields"><label class="ds-field">作者<input class="ds-input" maxlength="45"></label><label class="ds-field">出处<input class="ds-input" maxlength="45"></label></div>', button('取消', 'close-dialog') + button('保存反馈 · 模拟', 'mock-save', '', 'ds-primary')); break;
      case 'mock-save': closeDialog(); announce('保存反馈已演示，没有创建真实记录或文件。'); break;
      case 'legacy': openDialog('高级工具 / 旧版编辑器', '<p>旧版编辑器、采集与字体维护入口在真实后台保留。设计资源不会跳转到真实服务，避免混淆工作区。</p>'); break;
      case 'week-info': announce('本设计只提供七天示例；真实日期范围与地址恢复以后台为准。'); break;
      case 'refresh': announce('已演示刷新反馈；未读取真实版本或远端状态。'); break;
      case 'reset': model = unifiedModel(); state.pool = 'draft'; state.page = 'review'; state.view = 'focus'; state.search = ''; state.imported.clear(); state.selectedCandidates.clear(); initializeEntry('example-flower'); render(); announce('所有内存演示状态已重置。'); break;
      case 'close-dialog': closeDialog(); break;
    }
  } catch (error) {
    if (dialog.open) $('#dialog-error').textContent = error.message;
    else announce(error.message);
  }
});
root.addEventListener('change', event => {
  const node = event.target;
  if (node.hasAttribute('data-entry')) { initializeEntry(node.value); render(); }
  else if (node.dataset.setting === 'scope') { state.scope = node.value; render(); }
  else if (node.dataset.setting === 'fontId') { state.settings.fontId = node.value; state.dirty = true; state.checked = false; render(); }
  else if (node.dataset.option) { state.settings[node.dataset.option] = node.checked; state.dirty = true; state.checked = false; render(); }
  else if (node.dataset.scopeDate) { node.checked ? state.selectedDates.add(node.dataset.scopeDate) : state.selectedDates.delete(node.dataset.scopeDate); }
  else if (node.dataset.check === 'reviewed') { state.checked = node.checked; render(); }
  else if (node.dataset.check === 'lock') state.lockOnConfirm = node.checked;
  else if (node.hasAttribute('data-source')) { state.source = node.value; state.selectedCandidates.clear(); render(); }
  else if (node.dataset.candidate) { node.checked ? state.selectedCandidates.add(node.dataset.candidate) : state.selectedCandidates.delete(node.dataset.candidate); render(); }
  else if (node.dataset.check === 'all-candidates') { visibleCandidates().forEach(row => node.checked ? state.selectedCandidates.add(row.id) : state.selectedCandidates.delete(row.id)); render(); }
});
root.addEventListener('input', event => {
  const node = event.target;
  if (node.dataset.edit) {
    state.draft[node.dataset.edit] = Array.from(node.value).slice(0, node.dataset.edit === 'text' ? 240 : 45).join('');
    state.dirty = true; state.checked = false;
    paint('studio-preview', { ...entry(), ...state.draft }, state.settings, state.currentDate);
    const confirmButton = main.querySelector('[data-action="confirm"]'); if (confirmButton) confirmButton.disabled = true;
    announce('预览已更新；示例修改尚未保存。');
  }
  if (node.hasAttribute('data-tag-note')) state.note = node.value;
});
root.addEventListener('keydown', event => {
  if (event.key === 'Enter' && event.target.id === 'studio-search') { state.search = event.target.value.trim(); render(); }
  if (event.key === 'Enter' && event.target.id === 'asset-search') { state.assetSearch = event.target.value.trim(); render(); }
});
try {
  catalog = await loadCatalog();
  model = unifiedModel();
  initializeEntry(state.entryId);
  const requested = new URLSearchParams(location.search).get('page');
  if (Object.hasOwn(pageNames, requested)) state.page = requested;
  render();
} catch (error) { main.textContent = `共享渲染目录不可用：${error.message}`; }
