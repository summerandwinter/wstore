import { templateDefinitions, fontCatalog } from '../runtime/card-catalog.js';
import { layoutStudy, paintStudy } from './shared/card-studies.js';
import { loadPreviewFont, backgroundImage, resourceUrl, getTemplateVisualConfig, escapeHTML as h } from './shared/card-preview.js';

const specimenText = '行到水穷处，坐看云起时。';
const dailyText = '把日子过成喜欢的模样。';
const imageTasks = new Map();
async function studyImage(background) {
  if (!imageTasks.has(background)) {
    const task = (async () => {
      const response = await fetch(backgroundImage(background), { redirect: 'error', credentials: 'same-origin', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('配图未就绪');
      const blob = await response.blob();
      if (!blob.size || blob.size > 6 * 1024 * 1024 || !/^image\//.test(blob.type)) throw new Error('配图无效');
      const url = URL.createObjectURL(blob), image = new Image();
      let timer;
      try {
        image.src = url;
        await Promise.race([image.decode(), new Promise((_, reject) => { timer = setTimeout(() => { image.src = ''; reject(new Error('配图解码超时')); }, 10000); })]);
        if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 24000000) throw new Error('配图尺寸无效');
        return image;
      } finally { clearTimeout(timer); URL.revokeObjectURL(url); }
    })();
    imageTasks.set(background, task);
    task.catch(() => { if (imageTasks.get(background) === task) imageTasks.delete(background); });
  }
  return imageTasks.get(background);
}
const options = (rows, value) => rows.map(row => `<option value="${h(row.id)}"${row.id === value ? ' selected' : ''}>${h(row.name)}</option>`).join('');
const sizeLabel = value => `${(value / 1024).toFixed(0)} KB`;

export function createCardStudies({ catalog, samples }) {
  const designTemplates = templateDefinitions.filter(row => row.collection === 'new');
  const builtinIds = new Set(fontCatalog.map(row => row.id));
  const newFonts = catalog.fonts.filter(row => !builtinIds.has(row.id));
  const host = document.querySelector('[data-studies]');
  const query = new URLSearchParams(location.search);
  const state = {
    template: designTemplates.some(row => row.id === query.get('study')) ? query.get('study') : designTemplates[0].id,
    sample: samples.some(row => row.id === query.get('studySample')) ? query.get('studySample') : 'poem',
    font: catalog.fonts.some(row => row.id === query.get('studyFont')) ? query.get('studyFont') : 'auto',
    art: ['mist', 'sea', 'dusk'].includes(query.get('studyArt')) ? query.get('studyArt') : 'mist',
    showDate: query.get('studyDate') !== '0', showBrand: query.get('studyBrand') !== '0',
  };
  let revision = 0, active = false, fontsStarted = false;
  const $ = selector => host.querySelector(selector);
  host.innerHTML = `<div class="study-intro"><div><span class="eyebrow">NEW COLLECTION · 本轮新增</span><h2>给文字，再添几种表达。</h2><p>从一枚书签，到一页诗行。先比较构图，再挑选字的气质。</p></div><div class="study-intro-count"><strong>${designTemplates.length}<small>种新构图</small></strong><span>＋</span><strong>${newFonts.length}<small>款商用字体</small></strong></div></div>
    <div class="study-boundary"><span class="tag">正式目录</span><span>小程序、后台与图片帖共用这些版式和生产字体；本页用于同源预览。</span><button type="button" class="quiet" data-study-font-jump>先看新字体 ↓</button></div>
    <section class="study-stage" id="study-selected" aria-labelledby="study-title">
      <figure class="study-feature"><div class="study-canvas-wrap"><canvas width="1080" height="1440" class="preview-canvas" data-study-main role="img" aria-label="新方案卡片预览"></canvas><span class="study-canvas-wait" data-study-wait>正在准备真实字体…</span></div><figcaption data-study-status role="status" aria-live="polite"></figcaption></figure>
      <div class="study-inspector"><div class="study-selected-heading"><span class="eyebrow" data-study-index></span><h3 id="study-title" tabindex="-1"></h3><p data-study-description></p></div>
        <div class="study-controls"><label class="field">新构图<select data-study-control="template" aria-label="新方案版式">${options(designTemplates, state.template)}</select></label><label class="field">示例句<select data-study-control="sample" aria-label="新方案句子">${options(samples, state.sample)}</select></label><label class="field study-wide">搭配字体<select data-study-control="font" aria-label="新方案字体"><option value="auto">按版式推荐</option><optgroup label="本轮新字体">${options(newFonts, state.font)}</optgroup><optgroup label="原有字体">${options(catalog.fonts.filter(row => builtinIds.has(row.id)), state.font)}</optgroup></select></label><label class="field study-wide">配图<select data-study-control="art" aria-label="新方案配图"><option value="mist">雾野 · 山水</option><option value="sea">海风 · 晨光</option><option value="dusk">暮色 · 远山</option></select></label></div>
        <div class="row study-switches"><label><input type="checkbox" data-study-control="showDate"${state.showDate ? ' checked' : ''}> 日期</label><label><input type="checkbox" data-study-control="showBrand"${state.showBrand ? ' checked' : ''}> 品牌落款</label><button type="button" data-study-retry hidden>重试预览</button></div>
        <dl class="study-details" data-study-details></dl><p class="study-length" data-study-length></p>
      </div>
    </section>
    <div class="section-heading study-collection-heading"><div><span class="eyebrow">SIX COMPOSITIONS</span><h2>同一句话，六种新表情。</h2></div><span class="caption">点击构图，查看大图与搭配</span></div>
    <div class="study-gallery" role="group" aria-label="六款新构图">${designTemplates.map((row, index) => `<button type="button" class="study-choice" data-study-choice="${h(row.id)}" aria-pressed="${state.template === row.id}" aria-controls="study-selected"><canvas width="1080" height="1440" data-study-thumbnail="${h(row.id)}" role="img" aria-label="${h(row.name)}新方案缩略图"></canvas><span class="study-choice-heading"><strong>${h(row.name)}</strong><small>0${index + 1}</small></span><span class="caption">${h(row.description)}</span><span class="study-choice-state" data-study-tile-state="${h(row.id)}">正在准备预览</span></button>`).join('')}</div>
    <section class="study-font-section" id="study-fonts" aria-labelledby="study-font-title"><div class="section-heading"><div><span class="eyebrow">TYPE EXPLORATIONS</span><h2 id="study-font-title" tabindex="-1">同一句诗，看看字的性格。</h2></div><span class="tag">${newFonts.length} 款 · SIL OFL 1.1</span></div><p class="study-font-intro">以下字体使用正式生产 TTF 与完整商用许可。“搭配新构图”使用同一字体资源；遇到未覆盖字形会提示更换字体。</p><div class="study-font-grid">${newFonts.map((row, index) => `<article class="study-font-tile" data-study-font-tile="${h(row.id)}"><div class="study-font-heading"><span class="eyebrow">TYPE / 0${index + 1}</span><span class="tag historical">${h(({ sans: '黑体', serif: '宋楷', handwriting: '手写' })[row.role] || '中文字体')}</span></div><h3>${h(row.name)}</h3><p class="caption">${h(row.family)}</p><div class="study-font-specimen" data-study-specimen="${h(row.id)}" aria-busy="true"><p>${specimenText}</p><p>${dailyText}</p></div><p class="study-font-use">${h(row.description)}</p><p class="preview-status" data-study-font-state="${h(row.id)}" role="status">等待加载生产 TTF</p><div class="study-font-actions"><button type="button" data-study-font="${h(row.id)}">搭配新构图</button><button type="button" class="quiet" data-study-font-retry="${h(row.id)}" hidden>重试字样</button><a href="${h(resourceUrl(`fonts/${row.licenseUrl}`))}" target="_blank" rel="noopener">完整许可 ↗</a></div><details class="study-license"><summary>许可与生产资源</summary><p>SIL OFL 1.1 允许商用、嵌入与再分发。再分发需保留版权和许可；不能单独售卖字体，修改须遵守保留名称条款。</p><p>生产字体使用 ${h(row.family)}，大小 ${sizeLabel(row.nativeBytes)}。本页与正式卡片使用相同批准 TTF，具体覆盖以字库实测为准。</p><p class="study-digest">生产 TTF SHA-256<br>${h(row.nativeSha256)}<br>完整许可 SHA-256<br>${h(row.licenseSha256)}</p></details></article>`).join('')}</div><p class="study-font-summary" data-study-font-summary role="status" aria-live="polite"></p></section>`;

  async function fontFor(template, text) {
    const id = state.font === 'auto' ? (Array.from(text).length > template.preferredLength.max ? template.longTextFont : template.recommendedFont) : state.font;
    const row = catalog.fonts.find(row => row.id === id);
    const font = await loadPreviewFont(id, text);
    if (id !== 'system' && font.state !== 'loaded') throw new Error(`${row?.name || '字体'}未完整就绪，请重试或选择其他字体。`);
    return { id, family: font.family, name: row?.name || '系统字体' };
  }
  async function draw(canvas, row, card, run, main = false) {
    const status = main ? $('[data-study-status]') : $(`[data-study-tile-state="${row.id}"]`);
    canvas.dataset.studyState = 'loading'; canvas.setAttribute('aria-busy', 'true');
    status.textContent = '正在准备真实字体与配图…';
    try {
      const [font, image] = await Promise.all([fontFor(row, card.text), studyImage(state.art).catch(() => undefined)]);
      if (!active || revision !== run) return;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('当前浏览器无法创建画布。');
      const measure = (text, size, family) => { context.font = `${size}px ${family}`; return context.measureText(text).width; };
      const layout = layoutStudy(card, { template: row.id, fontId: font.id, showDate: state.showDate, showBrand: state.showBrand, templateConfig: getTemplateVisualConfig() }, measure, font.family);
      const result = paintStudy(context, layout, image);
      canvas.dataset.studyState = 'ready'; canvas.setAttribute('aria-busy', 'false');
      canvas.setAttribute('aria-label', `${row.name} · ${font.name} · ${card.text} ${card.author} ${card.source}`);
      const imageReady = result?.imageDrawn !== false && Boolean(image);
      if (!imageReady) imageTasks.delete(state.art);
      status.textContent = `${font.name} · ${imageReady ? '配图已就绪' : '配图未就绪，显示底色'}${main ? ' · 署名使用系统字体' : ''}`;
      if (main) { $('[data-study-wait]').hidden = true; $('[data-study-retry]').hidden = imageReady; }
    } catch (error) {
      if (!active || revision !== run) return;
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      canvas.dataset.studyState = 'error'; canvas.setAttribute('aria-busy', 'false');
      status.textContent = error.message;
      if (main) { $('[data-study-wait]').textContent = '预览暂未就绪'; $('[data-study-wait]').hidden = false; $('[data-study-retry]').hidden = false; }
    }
  }
  function render() {
    const run = ++revision, template = designTemplates.find(row => row.id === state.template), sample = samples.find(row => row.id === state.sample);
    const card = { ...sample, date: '2026-11-25' };
    $('[data-study-index]').textContent = `DIRECTION / 0${designTemplates.indexOf(template) + 1}`;
    $('#study-title').textContent = template.name;
    $('[data-study-description]').textContent = template.detail.title;
    $('[data-study-details]').innerHTML = `<dt>构图</dt><dd>${h(template.detail.structure)}</dd><dt>适合</dt><dd>${h(template.detail.scene)}</dd><dt>长文处理</dt><dd>${h(template.detail.note)}</dd>`;
    $('[data-study-length]').textContent = `当前正文 ${Array.from(sample.text).length} 字 · 1080 × 1440 · 保留完整正文与出处`;
    for (const node of host.querySelectorAll('[data-study-control]')) if (node.type === 'checkbox') node.checked = state[node.dataset.studyControl]; else node.value = state[node.dataset.studyControl];
    host.querySelectorAll('[data-study-choice]').forEach(node => node.setAttribute('aria-pressed', String(node.dataset.studyChoice === state.template)));
    host.querySelectorAll('[data-study-font-tile]').forEach(node => node.classList.toggle('selected', node.dataset.studyFontTile === state.font));
    $('[data-study-wait]').hidden = false; $('[data-study-wait]').textContent = '正在准备真实字体…'; $('[data-study-retry]').hidden = true;
    void draw($('[data-study-main]'), template, card, run, true);
    for (const row of designTemplates) void draw($(`[data-study-thumbnail="${row.id}"]`), row, card, run);
    const url = new URL(location.href);
    for (const [key, value] of Object.entries({ study: state.template, studySample: state.sample, studyFont: state.font, studyArt: state.art, studyDate: state.showDate ? '1' : '0', studyBrand: state.showBrand ? '1' : '0' })) url.searchParams.set(key, value);
    history.replaceState(null, '', url);
  }
  async function loadSpecimen(row) {
    const target = $(`[data-study-specimen="${row.id}"]`), label = $(`[data-study-font-state="${row.id}"]`), retry = $(`[data-study-font-retry="${row.id}"]`);
    label.textContent = '正在校验并加载生产字体…'; retry.hidden = true; target.setAttribute('aria-busy', 'true');
    try {
      const font = await loadPreviewFont(row.id, specimenText + dailyText);
      if (font.state !== 'loaded') throw new Error('生产字体未完整就绪，请重试。');
      target.style.fontFamily = font.family; target.dataset.loaded = 'true';
      label.textContent = `真实 TTF 已加载 · ${sizeLabel(row.nativeBytes)} · 字节与许可已校验`;
    } catch (error) { label.textContent = error.message; retry.hidden = false; target.dataset.loaded = 'false'; }
    finally {
      target.setAttribute('aria-busy', 'false');
      const count = host.querySelectorAll('[data-study-specimen][data-loaded="true"]').length;
      $('[data-study-font-summary]').textContent = `${count} / ${newFonts.length} 款生产字体已就绪。卡片预览会逐字检查当前正文，缺字时请更换字体。`;
    }
  }
  const focusSelected = () => { $('#study-selected').scrollIntoView({ block: 'start', behavior: 'auto' }); $('#study-title').focus({ preventScroll: true }); };
  host.addEventListener('change', event => {
    const node = event.target.closest('[data-study-control]');
    if (!node) return;
    state[node.dataset.studyControl] = node.type === 'checkbox' ? node.checked : node.value;
    render();
  });
  host.addEventListener('click', event => {
    const choice = event.target.closest('[data-study-choice]'), font = event.target.closest('[data-study-font]'), retry = event.target.closest('[data-study-font-retry]');
    if (choice) { state.template = choice.dataset.studyChoice; render(); focusSelected(); }
    else if (font) { state.font = font.dataset.studyFont; render(); focusSelected(); }
    else if (retry) void loadSpecimen(newFonts.find(row => row.id === retry.dataset.studyFontRetry));
    else if (event.target.closest('[data-study-retry]')) render();
    else if (event.target.closest('[data-study-font-jump]')) focusFonts();
  });
  function focusFonts() { $('#study-fonts').scrollIntoView({ block: 'start', behavior: 'auto' }); $('#study-font-title').focus({ preventScroll: true }); }
  return {
    show() { active = true; render(); if (!fontsStarted) { fontsStarted = true; for (const row of newFonts) void loadSpecimen(row); } },
    hide() { active = false; revision++; },
    focusFonts,
  };
}
