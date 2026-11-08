import { loadCatalog, loadPreviewFont, paintPreview, backgroundImage, resourceUrl, escapeHTML as h, bindTheme } from './shared/card-preview.js';
import { proposalTemplates } from './shared/proposals.js';

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
const state = { pane: ['layouts', 'fonts', 'sync'].includes(query.get('pane')) ? query.get('pane') : 'layouts', layout: 'window', font: 'auto', sample: 'poem', art: 'mist', group: '', category: '', showDate: true, showBrand: true };
let catalog;
let sampleFontsLoaded = false;
let artLibraryLoaded = false;
const $ = selector => document.querySelector(selector);

async function loadArtLibrary() {
  if (artLibraryLoaded) return;
  artLibraryLoaded = true;
  try {
    const library = catalog.imagery;
    if (!Array.isArray(library) || !library.length) return;
    state.artLibrary = library.map(row => ({ value: `asset:${row.id}`, name: `${row.label} · 共享图库` }));
    render();
  } catch { /* 清单不可用时保留内置三图。 */ }
}

function rememberLocation() {
  const url = new URL(location.href);
  url.searchParams.set('pane', state.pane);
  url.searchParams.set('variant', state.layout);
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
function render() {
  document.querySelectorAll('[data-pane]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.pane === state.pane)));
  for (const pane of ['layouts', 'fonts', 'sync']) $(`#pane-${pane}`).hidden = pane !== state.pane;
  const template = catalog.templates.find(row => row.id === state.layout);
  const fontId = selectedFont(template);
  const font = catalog.fonts.find(row => row.id === fontId);
  const detail = detailFor(template);
  const sample = samples.find(row => row.id === state.sample);
  document.querySelectorAll('[data-font]').forEach(select => { select.innerHTML = optionsList(catalog.fonts, state.font, true); select.value = state.font; });
  document.querySelectorAll('[data-layout]').forEach(select => { select.innerHTML = optionsList(catalog.templates, state.layout); });
  document.querySelectorAll('[data-sample]').forEach(select => { select.innerHTML = optionsList(samples, state.sample); });
  document.querySelectorAll('[data-art]').forEach(select => {
    select.value = state.art;
    if (!state.artLibrary?.length || select.querySelector('[data-art-library]')?.children.length) return;
    const group = select.querySelector('[data-art-library]');
    if (group) group.innerHTML = state.artLibrary.map(row => `<option value="${h(row.value)}">${h(row.name)}</option>`).join('');
  });
  $('[data-group]').value = state.group;
  $('[data-category]').value = state.category;
  const visible = catalog.templates.filter(row => (!state.group || row.group === state.group) && (!state.category || row.categories?.includes(state.category)));
  document.querySelectorAll('[data-layout-choice]').forEach(button => {
    button.hidden = !visible.some(row => row.id === button.dataset.layoutChoice);
    button.setAttribute('aria-pressed', String(button.dataset.layoutChoice === state.layout));
  });
  $('[data-collection-summary]').textContent = `${visible.length} / ${catalog.templates.length} 款 · 当前：${template.name}${font.proposal ? ' · 额外字体仅设计预览' : ''}`;
  $('[data-spec]').innerHTML = `<span class="spec-index">${String(catalog.templates.indexOf(template) + 1).padStart(2, '0')}</span><h3>${h(template.name)}</h3><span class="tag">正式版式</span><p class="caption">${h(detail.title)}</p>${metadataChips(template)}<dl><dt>构图</dt><dd>${h(detail.structure)}</dd><dt>适合内容</dt><dd>${h(detail.scene)}</dd><dt>推荐字体</dt><dd>${h((template.recommendedFonts || [template.recommendedFont]).map(fontName).join(' / '))}</dd><dt>长文字体</dt><dd>${h(fontName(template.longTextFont || template.recommendedFont))}</dd><dt>语义偏好</dt><dd class="metadata-chips">${semanticChips(template) || '未指定偏好'}</dd></dl>`;
  $('[data-fit]').innerHTML = `<p class="caption">当前字体</p><h3>${h(font.name)}</h3><div class="spec-font">山川有序<br>日月有常</div><dl><dt>目录说明</dt><dd>${h(template.description)}</dd><dt>适配规则</dt><dd>${h(detail.note)}</dd><dt>当前正文</dt><dd>${Array.from(sample.text).length} 字 · 作者和出处完整保留</dd></dl>`;
  if (state.font === 'system') $('.spec-font').style.fontFamily = 'system-ui, sans-serif';
  $('[data-pairing]').textContent = `当前搭配：${template.name} × ${font.name}`;
  document.querySelectorAll('[data-font-tile]').forEach(tile => tile.classList.toggle('selected', state.font === tile.dataset.fontTile));
  // 配图只引用批准资产 ID，内置背景仍由共享解析器定位。
  const card = { text: sample.text, author: sample.author, source: sample.source, date: '2026-11-05', background: state.art, ...(state.art.startsWith('asset:') ? { imageId: state.art.slice(6), background: 'mist' } : {}) };
  const options = { template: state.layout, fontId, showDate: state.showDate, showBrand: state.showBrand };
  if (state.pane === 'layouts') {
    paintPreview($('[data-main-canvas]'), card, options, $('[data-main-status]'));
    for (const row of visible) {
      const canvas = document.querySelector(`[data-layout-canvas="${row.id}"]`);
      paintPreview(canvas, card, { ...options, template: row.id, fontId: selectedFont(row) });
    }
  }
  if (state.pane === 'sync') {
    paintPreview($('[data-admin-canvas]'), card, options, $('[data-admin-status]'));
    paintPreview($('[data-reader-canvas]'), card, options, $('[data-reader-status]'));
  }
  if (state.pane === 'fonts' && !sampleFontsLoaded) loadSampleFonts();
  const requestedFont = fontId;
  loadPreviewFont(fontId, '山川有序日月有常').then(result => {
    const current = catalog.templates.find(row => row.id === state.layout);
    if (requestedFont !== selectedFont(current)) return;
    const line = document.querySelector('.spec-font');
    if (line && result.family) line.style.fontFamily = `"${result.family}", serif`;
  });
  rememberLocation();
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
  $('[data-layout-overview]').innerHTML = catalog.templates.map(row => `<button class="layout-card" type="button" data-choose-layout="${h(row.id)}" data-layout-choice="${h(row.id)}" aria-label="查看${h(row.name)}正式版式" aria-pressed="${row.id === state.layout}"><canvas width="1080" height="1440" data-layout-canvas="${h(row.id)}" aria-hidden="true"></canvas><span class="layout-card-title">${h(row.name)}<small>${h(GROUPS[row.group] || '正式')}</small></span><span class="caption">${h(row.description)}</span>${metadataChips(row)}<span class="metadata-chips">${semanticChips(row)}</span></button>`).join('');
  $('[data-category]').innerHTML = '<option value="">全部分类</option>' + [...new Set(catalog.templates.flatMap(row => row.categories || []))].map(value => `<option value="${h(value)}">${h(value)}</option>`).join('');
}
document.addEventListener('click', event => {
  if (!catalog) return;
  const pane = event.target.closest('[data-pane]');
  const layout = event.target.closest('[data-choose-layout]');
  const font = event.target.closest('[data-choose-font]');
  if (pane) state.pane = pane.dataset.pane;
  else if (layout) state.layout = layout.dataset.chooseLayout;
  else if (font) { state.font = font.dataset.chooseFont; state.pane = 'layouts'; }
  else return;
  render();
});
document.addEventListener('change', event => {
  if (!catalog) return;
  const node = event.target;
  if (node.matches('[data-font]')) state.font = node.value;
  else if (node.matches('[data-layout]')) state.layout = node.value;
  else if (node.matches('[data-sample]')) state.sample = node.value;
  else if (node.matches('[data-art]')) state.art = node.value;
  else if (node.matches('[data-group]')) state.group = node.value;
  else if (node.matches('[data-category]')) state.category = node.value;
  else if (node.dataset.option) state[node.dataset.option] = node.checked;
  else return;
  render();
});
try {
  catalog = await loadCatalog();
  const requested = query.get('variant');
  const match = catalog.templates.find(row => row.id === requested || row.name === requested);
  if (match) state.layout = match.id;
  $('[data-count]').textContent = `${catalog.templates.length} 款正式布局 · ${catalog.fonts.length} 种生产字体`;
  $('[data-font-count]').textContent = `${catalog.fonts.length} 种生产字体 · 与小程序、后台使用同一 TTF`;
  renderFontTiles();
  renderLayoutOverview();
  render();
  loadArtLibrary();
} catch (error) {
  $('#load-error').hidden = false;
  $('#load-error').textContent = error.message;
}
