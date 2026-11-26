import { loadCatalog, loadPreviewFont, paintPreview, previewFrame, cancelCardPreview, setCardPreviewPaused, resourceUrl, escapeHTML as h, bindTheme, getTemplateVisualConfig, setTemplateVisualConfig, updateTemplateVisualToken, resetTemplateVisualTokens, templateVisualControlsMarkup } from './shared/card-preview.js';
import { proposalTemplates } from './shared/proposals.js';
import { createCardStudies } from './cards-studies.js';

bindTheme();
const samples = [
  { id: 'poem', name: '短句 · 王维', text: '行到水穷处，\n坐看云起时。', author: '王维', source: '终南别业' },
  { id: 'modern', name: '短句 · 苏轼', text: '且将新火试新茶，\n诗酒趁年华。', author: '苏轼', source: '望江南·超然台作' },
  { id: 'long', name: '长句 · 诸葛亮', text: '夫君子之行，静以修身，俭以养德。非淡泊无以明志，非宁静无以致远。夫学须静也，才须学也；非学无以广才，非志无以成学。', author: '诸葛亮', source: '诫子书' },
  { id: 'limit', name: '边界 · 240 字原创测试', text: '把今天的一束光留在纸上。'.repeat(20), author: '设计样例', source: '仅用于排版边界检查' },
];
const details = {
  paper: { title: '把山水与句子，放在一页里', scene: '日常摘抄 / 古典诗词 / 书摘', structure: '上图下文 / 纸色底 / 留白落款', note: '原有方案；长句减小图片面积，正文按真实测量适配' },
  light: { title: '让一句话，落在光里', scene: '现代短句 / 氛围照片 / 深色画面', structure: '整图沉浸 / 渐层压暗 / 底部文字', note: '原有方案；文字与图片对比度使用共享绘图器' },
  type: { title: '以文字为主，留一处风景', scene: '书摘 / 稍长正文 / 文字优先', structure: '大字起笔 / 右下小幅图 / 完整出处', note: '原有方案；缩略配图保留，长文不以省略号冒充全文' },
  window: { title: '一窗山色，半页清静', scene: '山水诗 / 平静句子', structure: '拱窗配图 / 居中诗句', note: '构图由共享模板决定；裁切与字幅以画布实际结果为准' },
  letter: { title: '像一封写给自己的信', scene: '日常 / 自我鼓励 / 书摘', structure: '信头留白 / 小幅落款图', note: '长句压低配图占比；书写字体适合短句' },
  vertical: { title: '从右向左，慢一点读', scene: '短诗 / 文言 / 古典意境', structure: '窄幅长图 / 右起竖排', note: '长句横排回退由共享布局计算，不另造示意形状' },
  split: { title: '一半风景，一半心事', scene: '现代语句 / 留白感书摘', structure: '左右分栏 / 书脊式边界', note: '长句适配与图栏宽度使用项目模板参数' },
  horizon: { title: '把今天，放进风景里', scene: '希望 / 成长 / 轻快诗句', structure: '上方短句 / 下方开阔风景', note: '日期作为视觉锚点；隐藏日期时同步重绘' },
  photo: { title: '留下一张有温度的照片', scene: '回忆 / 告别 / 日常心绪', structure: '相纸画框 / 自然书写注脚', note: '长句减少相片高度，作者和出处随卡片保留' },
};
const GROUPS = { text: '文字', nature: '自然', imagery: '影像', editorial: '编辑' };
// 归档提案仅提供说明文案，版式身份、推荐字体和绘制始终来自正式目录。
const descriptiveDetails = Object.fromEntries(proposalTemplates.map(row => [row.id, row.detail]));
function detailFor(template) {
  const detail = template.detail || details[template.id] || descriptiveDetails[template.id] || { title: template.name, structure: template.description, note: '由共享生产绘图器按正文实测适配。' };
  return { ...detail, scene: (template.categories || []).join(' / ') };
}
function fontName(id) { return catalog.fonts.find(row => row.id === id)?.name || id; }
function lengthLabel(template) {
  const range = template.preferredLength;
  return range ? `${range.min}–${range.max} 字优先` : '长度按正文实测';
}
function semanticChips(template) {
  const names = { theme: '主题', mood: '情绪', scene: '场景', element: '意象' };
  const labels = { growth:'成长',farewell:'告别',longing:'思念',belonging:'归属',hope:'希望',self_worth:'自我价值',acceptance:'释然',daily_life:'日常',freedom:'自由',calm:'平静',hopeful:'希望',melancholic:'忧伤',reflective:'沉思',joyful:'欢愉',tense:'紧张',abstract:'抽象',sea:'海岸',mountain:'山野',forest:'树林',sky:'天空',city:'城市',indoor:'室内',field:'田野',water:'水',cloud:'云',sun:'阳光',moon:'月亮',tree:'树',flower:'花',road:'道路',window:'窗',person:'人物',building:'建筑' };
  return Object.entries(template.semanticPreferences || {}).flatMap(([key, values]) => (Array.isArray(values) ? values : []).map(value => `<span class="tag" title="${h(names[key] || key)}">${h(names[key] || key)} · ${h(labels[value] || value)}</span>`)).join('');
}
function metadataChips(template) {
  return `<div class="metadata-chips"><span class="tag">${h(GROUPS[template.group] || '正式版式')}</span>${(template.categories || []).map(value => `<span class="tag historical">${h(value)}</span>`).join('')}<span class="tag historical">${h(lengthLabel(template))}</span><span class="tag historical">推荐 ${h(fontName(template.recommendedFont))}</span></div>`;
}
const query = new URLSearchParams(location.search);
const motionPreference = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
const state = {
  pane: ['layouts', 'fonts', 'sync', 'studies'].includes(query.get('pane')) ? query.get('pane') : 'layouts',
  layout: 'window', font: 'auto', art: 'mist', category: '',
  sample: samples.some(row => row.id === query.get('sample')) ? query.get('sample') : 'poem',
  group: Object.hasOwn(GROUPS, query.get('group')) ? query.get('group') : '',
  showDate: !['0', 'false'].includes(query.get('showDate')),
  showBrand: !['0', 'false'].includes(query.get('showBrand')),
  loadingMode: ['slow', 'error'].includes(query.get('loading')) ? query.get('loading') : 'auto',
  playback: ['hold', 'replay', 'instant'].includes(query.get('preview')) ? query.get('preview') : 'auto',
  reduceMotion: ['1', 'true'].includes(query.get('reduceMotion')),
  loadingPaused: false,
};
let catalog;
let studies;
let sampleFontsLoaded = false;
let activePane;
let selectionKey;
let mainNeedsRetry = false;
let referenceNeedsRetry = false;
const previews = new WeakMap();
const $ = selector => document.querySelector(selector);
const reducedMotion = () => state.reduceMotion || Boolean(motionPreference?.matches);
const playbackMode = () => ['hold', 'instant'].includes(state.playback) ? state.playback : state.loadingMode === 'auto' ? state.playback : state.loadingMode;

$('[data-skeleton-preview]').innerHTML = previewFrame('data-skeleton-canvas', '静态骨架参考');
$('[data-main-preview]').innerHTML = previewFrame('data-main-canvas aria-describedby="main-preview-status"', '当前版式成品预览');

function rememberLocation() {
  const url = new URL(location.href);
  const values = { pane: state.pane, variant: state.layout, font: state.font, sample: state.sample, art: state.art,
    group: state.group, category: state.category, showDate: state.showDate ? '1' : '0', showBrand: state.showBrand ? '1' : '0',
    loading: state.loadingMode, preview: state.playback, reduceMotion: state.reduceMotion ? '1' : '0' };
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  history.replaceState(null, '', url);
}
function selectedFont(template) {
  if (state.font !== 'auto') return state.font;
  const length = Array.from(samples.find(row => row.id === state.sample).text).length;
  return template.longTextFont && length > template.preferredLength?.max ? template.longTextFont : template.recommendedFont;
}
function optionsList(rows, selected, auto = false) {
  return `${auto ? '<option value="auto">按版式推荐</option>' : ''}${rows.map(row => `<option value="${h(row.id)}"${row.id === selected ? ' selected' : ''}>${h(row.name)}</option>`).join('')}`;
}
function updateRetry() {
  $('[data-loading-action="retry"]').hidden = !mainNeedsRetry && !referenceNeedsRetry;
}
function cancelPreview(canvas) {
  cancelCardPreview(canvas);
  // 已完成的帧可以复用；离开标签页或筛掉的未完成任务必须重新请求。
  if (!previews.get(canvas)?.settled) previews.delete(canvas);
}
function paintOnce(canvas, card, options, status, presentation, { force = false, start, done } = {}) {
  const key = JSON.stringify([card, options, presentation, getTemplateVisualConfig()?.revision || 'baseline']);
  if (!force && previews.get(canvas)?.key === key) return;
  const request = { key, settled: false };
  previews.set(canvas, request);
  start?.();
  const viewOptions = presentation ? { ...presentation, paused: state.loadingPaused, onReady: result => {
    if (previews.get(canvas) === request) done?.(result);
  } } : undefined;
  paintPreview(canvas, card, options, status, viewOptions).then(result => {
    if (previews.get(canvas) !== request) return;
    request.settled = true;
    request.failed = !result;
    done?.(result);
  });
}
function resourceFallbacks(canvas, result) {
  return [canvas.dataset.fontState === 'fallback' ? '字体回退' : canvas.dataset.fontState === 'partial' ? '部分字形回退' : '',
    result?.imageState === 'failed' ? '配图回退' : ''].filter(Boolean);
}
function renderLoadingControls() {
  const mode = playbackMode();
  $('[data-loading-mode]').value = state.loadingMode;
  $('[data-loading-action="hold"]').setAttribute('aria-pressed', String(mode === 'hold'));
  $('[data-loading-action="instant"]').setAttribute('aria-pressed', String(mode === 'instant'));
  const pause = $('[data-loading-action="pause"]');
  pause.setAttribute('aria-pressed', String(state.loadingPaused));
  pause.textContent = state.loadingPaused ? '继续交接' : '暂停交接';
  $('[data-reduce-motion]').checked = reducedMotion();
  $('[data-reduce-motion]').disabled = Boolean(motionPreference?.matches);
  $('[data-reduce-motion]').title = motionPreference?.matches ? '已遵循系统的减少动态设置' : '关闭骨架呼吸与原版淡入覆盖';
  const notes = {
    auto: '正常加载：可见等待达到 900ms 先读系统文字；只有骨架到原版淡入 240ms，已可读文字到原版直接替换，不叠字；快速命中直接呈现。',
    hold: '停留骨架 · 演示：右侧与下方总览停在各自骨架；左侧始终作为参照。点“重播切换”恢复成品。',
    replay: '重播切换 · 演示：900ms 先读文字，原版就绪后一次不透明替换。仅重播当前选中预览，不重新加载整组字体。',
    slow: '慢速等待 · 演示：人为延长骨架停留，不模拟真实网速；仍需真实字体与图片完成加载。',
    error: '失败状态 · 演示：人为展示失败提示，保留可读正文；“重试预览”恢复正常加载，不代表真实故障。',
    instant: '直接就绪：真实资源准备好后立即呈现，不播放过渡；不会跳过资源加载或掩盖回退。',
  };
  $('[data-loading-note]').textContent = notes[mode] + (state.loadingPaused ? ' DEMO · 交接已暂停；900ms 首读不受影响，继续后接续。' : '') + (motionPreference?.matches ? ' 已遵循系统减少动态设置。' : '');
  $('[data-transition-note]').textContent = reducedMotion() ? '减少动态 · 无呼吸 / 无淡入' : mode === 'instant' ? '本次直接就绪 · 无过渡' : '过渡设定 · 骨架淡入 240 ms / 可读文字直接替换';
}
function renderSelected(template, font, sample, detail) {
  const key = JSON.stringify([template.id, font.id, sample.id, state.art, state.showDate, state.showBrand]);
  if (selectionKey === key) return;
  selectionKey = key;
  $('[data-selected-title]').textContent = `${template.name} · ${detail.title}`;
  $('[data-selected-description]').textContent = `${detail.structure} · ${font.name} · ${sample.name}`;
  const management = $('[data-template-management]');
  if (management) management.setAttribute('href', `./studio.html?${new URLSearchParams({ page: 'templates', template: template.id, sample: state.sample })}`);
  $('[data-selected-index]').textContent = `已选 ${String(catalog.templates.indexOf(template) + 1).padStart(2, '0')} / ${catalog.templates.length}`;
  $('[data-text-count]').textContent = `${Array.from(sample.text).length} 字 · 作者与出处完整保留`;
  $('[data-skeleton-preview]').setAttribute('aria-label', `${template.name}版式的静态骨架参考，${sample.name}`);
  $('[data-main-canvas]').setAttribute('aria-label', `${template.name}版式成品：${sample.text.replace(/\n/g, ' ')} ${sample.author} · ${sample.source}`);
  $('[data-spec]').innerHTML = `<h3>${h(template.name)}</h3>${metadataChips(template)}<dl><dt>构图</dt><dd>${h(detail.structure)}</dd><dt>适合内容</dt><dd>${h(detail.scene)}</dd><dt>推荐字体</dt><dd>${h((template.recommendedFonts || [template.recommendedFont]).map(fontName).join(' / '))}</dd><dt>长文字体</dt><dd>${h(fontName(template.longTextFont || template.recommendedFont))}</dd><dt>语义偏好</dt><dd class="metadata-chips">${semanticChips(template) || '未指定偏好'}</dd></dl>`;
  $('[data-fit]').innerHTML = `<p class="caption">当前字体</p><h3>${h(font.name)}</h3><dl><dt>适配规则</dt><dd>${h(detail.note)}</dd><dt>正文全文 · ${Array.from(sample.text).length} 字</dt><dd>${h(sample.text).replace(/\n/g, '<br>')}</dd><dt>作者与出处</dt><dd>${h(sample.author)} · ${h(sample.source)}</dd></dl>`;
}
function render({ replay = false, retry = false } = {}) {
  if (activePane && activePane !== state.pane) {
    if (activePane === 'studies') studies?.hide();
    const selector = activePane === 'layouts' ? '[data-main-canvas], [data-skeleton-canvas], [data-layout-canvas]' : activePane === 'sync' ? '[data-admin-canvas], [data-reader-canvas]' : null;
    if (selector) document.querySelectorAll(selector).forEach(cancelPreview);
  }
  activePane = state.pane;
  document.querySelectorAll('[data-pane]').forEach(button => {
    button.setAttribute('aria-selected', String(button.dataset.pane === state.pane));
    button.tabIndex = button.dataset.pane === state.pane ? 0 : -1;
  });
  for (const pane of ['layouts', 'fonts', 'sync', 'studies']) $(`#pane-${pane}`).hidden = pane !== state.pane;
  $('[data-library-count]').textContent = `${catalog.templates.length} 款正式版式 · ${catalog.fonts.filter(row => row.id !== 'system').length} 款生产字体`;
  const template = catalog.templates.find(row => row.id === state.layout);
  const fontId = selectedFont(template);
  const font = catalog.fonts.find(row => row.id === fontId);
  const sample = samples.find(row => row.id === state.sample);
  document.querySelectorAll('[data-font]').forEach(select => { select.innerHTML = optionsList(catalog.fonts, state.font, true); });
  document.querySelectorAll('[data-layout]').forEach(select => { select.innerHTML = optionsList(catalog.templates, state.layout); });
  document.querySelectorAll('[data-sample]').forEach(select => { select.innerHTML = optionsList(samples, state.sample); });
  document.querySelectorAll('[data-art]').forEach(select => {
    const group = select.querySelector('[data-art-library]');
    if (group && !group.children.length) group.innerHTML = (catalog.imagery || []).map(row => `<option value="asset:${h(row.id)}">${h(row.label)} · 共享图库</option>`).join('');
    select.value = state.art;
  });
  document.querySelectorAll('[data-option]').forEach(input => { input.checked = state[input.dataset.option]; });
  $('[data-group]').value = state.group;
  $('[data-category]').value = state.category;
  const visible = catalog.templates.filter(row => (!state.group || row.group === state.group) && (!state.category || row.categories?.includes(state.category)));
  const visibleIds = new Set(visible.map(row => row.id));
  document.querySelectorAll('[data-layout-choice]').forEach(button => {
    const hidden = !visibleIds.has(button.dataset.layoutChoice);
    if (hidden && !button.hidden) cancelPreview(button.querySelector('[data-layout-canvas]'));
    button.hidden = hidden;
    button.setAttribute('aria-pressed', String(button.dataset.layoutChoice === state.layout));
  });
  $('[data-collection-summary]').textContent = `${visible.length} / ${catalog.templates.length} 款 · 当前：${template.name}${visibleIds.has(state.layout) ? '' : '（不在筛选结果中）'}${state.playback === 'hold' ? ' · 骨架停留演示' : ''}`;
  $('[data-clear-filters]').hidden = !state.group && !state.category;
  $('[data-collection-empty]').hidden = visible.length > 0;
  renderSelected(template, font, sample, detailFor(template));
  renderLoadingControls();
  $('[data-pairing]').textContent = `当前搭配：${template.name} × ${font.name}`;
  const visualHost = $('[data-shared-visual-controls]');
  visualHost.innerHTML = `${templateVisualControlsMarkup(template.id, catalog.visualDefaults?.[template.id] || {})}<p class="caption">本页视觉试调覆盖全部成品缩略图、对照画布和阅读示例；正式卡片目录和配置文件不变。</p>`;
  document.querySelectorAll('[data-font-tile]').forEach(tile => tile.classList.toggle('selected', state.font === tile.dataset.fontTile));
  // 配图只引用批准资产 ID；正文、落款与布局仍直接交给同一生产绘图器。
  const card = { text: sample.text, author: sample.author, source: sample.source, date: '2026-11-05', background: state.art, ...(state.art.startsWith('asset:') ? { imageId: state.art.slice(6), background: 'mist' } : {}) };
  const options = { template: state.layout, fontId, showDate: state.showDate, showBrand: state.showBrand };
  if (state.pane === 'layouts') {
    paintOnce($('[data-skeleton-canvas]'), card, options, null, { mode: 'hold', reduceMotion: true }, {
      force: retry,
      start() { referenceNeedsRetry = false; updateRetry(); $('#skeleton-preview-note').textContent = '浅绿标记图文位置；随版式与正文长度调整，不是成品图。'; },
      done(result) { referenceNeedsRetry = !result; if (!result) $('#skeleton-preview-note').textContent = '骨架参考暂未就绪，可点击“重试预览”。'; updateRetry(); },
    });
    const main = $('[data-main-canvas]');
    const mode = playbackMode();
    paintOnce(main, card, options, $('[data-main-status]'), { mode, reduceMotion: reducedMotion() }, {
      force: replay || retry,
      start() {
        mainNeedsRetry = false; updateRetry();
        $('[data-playback-state]').textContent = ({ auto: '正在加载', hold: '骨架停留 · 演示', replay: '重播中 · 演示', slow: '慢速等待 · 演示', error: '失败演示准备中', instant: '等待资源就绪' })[mode];
      },
      done(result) {
        const fallbacks = resourceFallbacks(main, result);
        mainNeedsRetry = !result || main.dataset.fontState === 'fallback' || result.imageState === 'failed';
        $('[data-playback-state]').textContent = !result ? mode === 'error' ? '失败状态 · 演示' : '预览未就绪' : !result.displayReady ? '骨架停留 · 演示' : fallbacks.length ? '已就绪 · 有回退' : '成品已就绪';
        updateRetry();
      },
    });
    // 每张缩略图按实际输入去重；选中项重播不会触发整组缩略图或参照帧重绘。
    for (const row of visible) {
      const canvas = document.querySelector(`[data-layout-canvas="${row.id}"]`);
      const label = document.querySelector(`[data-layout-status="${row.id}"]`);
      const mode = state.playback === 'hold' ? 'hold' : 'auto';
      paintOnce(canvas, card, { ...options, template: row.id, fontId: selectedFont(row) }, null, { mode, reduceMotion: reducedMotion() }, {
        force: retry && (row.id === state.layout || previews.get(canvas)?.failed),
        start() { label.textContent = mode === 'hold' ? '骨架停留 · 演示' : '正在加载同源画布…'; },
        done(result) {
          const fallbacks = resourceFallbacks(canvas, result);
          label.textContent = !result ? '预览未就绪 · 点选查看' : [result.displayReady ? '成品就绪' : '骨架停留 · 演示', ...fallbacks, result.fallback ? '长文已适配' : ''].filter(Boolean).join(' · ');
        },
      });
    }
  }
  if (state.pane === 'sync') {
    paintOnce($('[data-admin-canvas]'), card, options, $('[data-admin-status]'));
    paintOnce($('[data-reader-canvas]'), card, options, $('[data-reader-status]'));
  }
  if (state.pane === 'fonts' && !sampleFontsLoaded) loadSampleFonts();
  rememberLocation();
  if (state.pane === 'studies') studies.show();
}
async function loadSampleFonts() {
  sampleFontsLoaded = true;
  const outcomes = await Promise.all(catalog.fonts.filter(row => row.id !== 'system').map(async row => {
    const result = await loadPreviewFont(row.id, '行到水穷处，坐看云起时。');
    const line = document.querySelector(`[data-font-line="${row.id}"]`);
    if (line && result.family) line.style.fontFamily = `"${result.family}", serif`;
    const label = document.querySelector(`[data-sample-state="${row.id}"]`);
    if (label) label.textContent = result.notice;
    return result.state === 'loaded' || result.state === 'partial';
  }));
  $('[data-sample-status]').textContent = `${outcomes.filter(Boolean).length} / ${outcomes.length} 款生产 TTF 已加载；系统字体随设备变化。`;
}
function renderFontTiles() {
  $('[data-font-grid]').innerHTML = catalog.fonts.map(font => {
    const permission = font.id === 'system' ? '随操作系统提供' : `<a href="${h(resourceUrl(`fonts/${font.licenseUrl}`))}">查看完整 OFL</a>`;
    return `<article class="font-tile" data-font-tile="${h(font.id)}"><div class="font-title"><h3>${h(font.name)}</h3><span class="tag ${font.existing ? 'historical' : ''}">${font.proposal ? '设计专用 · 不参与生产推荐' : font.existing ? '原有保留' : '扩展字样'}</span></div><p class="caption">${h(font.description)}</p><p class="font-line" data-font-line="${h(font.id)}">行到水穷处，坐看云起时。</p><p class="caption" data-sample-state="${h(font.id)}">${font.id === 'system' ? '系统字体 · 不加载字库' : '等待加载真实字样'}</p><div class="font-bottom"><div>${permission}</div><button type="button" data-choose-font="${h(font.id)}">用于卡片预览</button></div></article>`;
  }).join('');
}
function renderLayoutOverview() {
  $('[data-layout-overview]').innerHTML = catalog.templates.map(row => `<button class="layout-card" type="button" data-choose-layout="${h(row.id)}" data-layout-choice="${h(row.id)}" aria-label="查看${h(row.name)}正式版式" aria-pressed="${row.id === state.layout}" aria-controls="selected-preview">${previewFrame(`data-layout-canvas="${h(row.id)}"`, `${row.name}版式总览缩略预览`)}<span class="layout-card-title">${h(row.name)}<small>${h(GROUPS[row.group] || '正式')}</small></span><span class="caption">${h(row.description)}</span>${metadataChips(row)}<span class="caption" data-layout-status="${h(row.id)}">等待加载同源画布…</span></button>`).join('');
  $('[data-category]').innerHTML = '<option value="">全部分类</option>' + [...new Set(catalog.templates.flatMap(row => row.categories || []))].map(value => `<option value="${h(value)}">${h(value)}</option>`).join('');
}
document.addEventListener('click', event => {
  if (!catalog) return;
  if (event.target.closest('[data-study-open-fonts]')) { state.pane = 'studies'; render(); studies.focusFonts(); return; }
  const visualReset = event.target.closest('[data-visual-reset]');
  if (visualReset) {
    try { resetTemplateVisualTokens(visualReset.dataset.visualReset); render(); }
    catch (error) { announceVisualError(error); }
    return;
  }
  const action = event.target.closest('[data-loading-action]')?.dataset.loadingAction;
  if (action) {
    if (action === 'pause') {
      state.loadingPaused = !state.loadingPaused;
      document.querySelectorAll('[data-card-result]').forEach(canvas => setCardPreviewPaused(canvas, state.loadingPaused));
      renderLoadingControls(); return;
    }
    state.loadingPaused = false;
    document.querySelectorAll('[data-card-result]').forEach(canvas => setCardPreviewPaused(canvas, false));
    if (action === 'retry') { state.loadingMode = 'auto'; state.playback = 'auto'; }
    else state.playback = action;
    render({ replay: action === 'replay', retry: action === 'retry' });
    return;
  }
  if (event.target.closest('[data-clear-filters]')) { state.group = ''; state.category = ''; render(); return; }
  const pane = event.target.closest('[data-pane]');
  const layout = event.target.closest('[data-choose-layout]');
  const font = event.target.closest('[data-choose-font]');
  if (pane) state.pane = pane.dataset.pane;
  else if (layout) state.layout = layout.dataset.chooseLayout;
  else if (font) { state.font = font.dataset.chooseFont; state.pane = 'layouts'; }
  else return;
  render();
  if (layout || font) {
    $('#selected-preview').scrollIntoView({ block: 'start', behavior: 'auto' });
    $('#loading-selected-title').focus({ preventScroll: true });
  }
});
function announceVisualError(error) {
  const host = $('[data-shared-visual-controls]');
  if (!host) return;
  const status = host.querySelector('[data-visual-error]') || host.appendChild(document.createElement('p'));
  status.dataset.visualError = '';
  status.setAttribute('role', 'alert');
  status.textContent = error?.message || '视觉配置无效，请重新选择。';
}
function updateVisualControl(event) {
  if (!catalog || event.type !== 'change') return false;
  const node = event.target.closest('[data-visual-enabled],[data-visual-token]');
  if (!node || !node.closest('[data-shared-visual-controls]')) return false;
  const field = node.dataset.visualEnabled || node.dataset.visualToken;
  const template = catalog.templates.find(row => row.id === state.layout);
  if (!template) return true;
  try {
    if (node.dataset.visualEnabled) {
      const input = node.closest('label').querySelector(`[data-visual-token="${field}"]`);
      input.disabled = !node.checked;
      updateTemplateVisualToken(template.id, field, input.value, node.checked);
    } else if (field === 'fontScale' || field === 'lineHeightScale') {
      updateTemplateVisualToken(template.id, field, node.value);
      node.previousElementSibling.querySelector('output').textContent = Number(node.value).toFixed(3);
    } else updateTemplateVisualToken(template.id, field, node.value, node.closest('label').querySelector(`[data-visual-enabled="${field}"]`).checked);
    const revision = getTemplateVisualConfig()?.revision;
    const badge = $('[data-visual-revision]');
    if (badge) badge.textContent = revision ? `当前预览修订 ${revision.slice(0, 12)}` : '沿用共享生产默认';
    render({ retry: true });
  } catch (error) { announceVisualError(error); }
  return true;
}
document.addEventListener('input', event => { updateVisualControl(event); });
document.addEventListener('change', event => {
  if (updateVisualControl(event)) return;
  if (!catalog) return;
  const node = event.target;
  if (node.matches('[data-font]')) state.font = node.value;
  else if (node.matches('[data-layout]')) state.layout = node.value;
  else if (node.matches('[data-sample]')) state.sample = node.value;
  else if (node.matches('[data-art]')) state.art = node.value;
  else if (node.matches('[data-group]')) state.group = node.value;
  else if (node.matches('[data-category]')) state.category = node.value;
  else if (node.matches('[data-loading-mode]')) { state.loadingMode = node.value; state.playback = 'auto'; }
  else if (node.matches('[data-reduce-motion]')) state.reduceMotion = node.checked;
  else if (['showDate', 'showBrand'].includes(node.dataset.option)) state[node.dataset.option] = node.checked;
  else return;
  render();
});
document.addEventListener('keydown', event => {
  if (!catalog || !event.target.matches('[data-pane]') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = [...document.querySelectorAll('[data-pane]')];
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (tabs.indexOf(event.target) + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  event.preventDefault();
  state.pane = tabs[index].dataset.pane;
  render();
  tabs[index].focus();
});
motionPreference?.addEventListener('change', () => { if (catalog) render(); });
window.addEventListener('pagehide', () => { studies?.hide(); document.querySelectorAll('[data-main-canvas], [data-skeleton-canvas], [data-layout-canvas], [data-admin-canvas], [data-reader-canvas]').forEach(cancelPreview); });
window.addEventListener('pageshow', event => { if (event.persisted && catalog) render(); });
try {
  catalog = await loadCatalog();
  const requested = query.get('variant');
  const match = catalog.templates.find(row => row.id === requested || row.name === requested);
  if (match) state.layout = match.id;
  if (catalog.fonts.some(row => row.id === query.get('font'))) state.font = query.get('font');
  if (['mist', 'sea', 'dusk', ...(catalog.imagery || []).map(row => `asset:${row.id}`)].includes(query.get('art'))) state.art = query.get('art');
  if (catalog.templates.some(row => row.categories?.includes(query.get('category')))) state.category = query.get('category');
  const productionFontCount = catalog.fonts.filter(row => row.id !== 'system').length;
  $('[data-count]').textContent = `${catalog.templates.length} 款正式布局 · ${productionFontCount} 款生产 TTF`;
  $('[data-font-count]').textContent = `${productionFontCount} 款生产 TTF + 系统字体 · 与小程序、后台同源`;
  renderFontTiles();
  renderLayoutOverview();
  studies = createCardStudies({ catalog, samples });
  render();
} catch (error) {
  $('#load-error').hidden = false;
  $('#load-error').textContent = error.message;
}
