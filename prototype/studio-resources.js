import { createTemplateHtmlExample, copyTemplateRichText, copyTemplateHtmlSource, downloadTemplateHtml } from './shared/card-preview.js';
import { formatStudioDateTime } from './studio-delivery.js';

// All records and receipts below are design-only memory. No asset or template publication.
export function createResourcePages(api) {
  const { h, icon, button: b, status, tags, backgroundImage, paintPreview } = api;
  const $ = selector => document.querySelector(selector);
  const libraryViewport = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 1101px)') : null;
  const res = { view: 'list', id: '', query: '', review: '', scope: '', sort: 'created-desc', selected: new Set(), operation: null, page: 0, draft: null, baseline: '', error: '', errorField: '', pending: null, saving: false, sequence: 0, ownerQuery: '', ownerPage: 0, ownerSearched: false, listOrigin: null, restoreList: false, focusResults: false };
  const templateTabs = [['preview', '卡片预览'], ['defaults', '默认设置'], ['html', 'HTML 示例'], ['impact', '同步影响']];
  const tpl = { id: /^[a-z][a-z0-9-]{0,39}$/.test(api.initialTemplate || '') ? api.initialTemplate : '', tab: templateTabs.some(([id]) => id === api.initialTab) ? api.initialTab : 'preview', query: '', group: '', mode: ['long', 'boundary'].includes(api.initialSample) ? api.initialSample : 'short', custom: { text: '行到水穷处，\n坐看云起时。', author: '王维', source: '终南别业' }, saved: new Map(), drafts: new Map(), pending: null, html: null, htmlError: '', copyStatus: '', saveError: '', ticket: 0, canvas: null, libraryOpen: libraryViewport ? libraryViewport.matches : true, expanded: false, htmlDetails: { source: false, compatibility: false } };
  const groups = { nature: '自然', imagery: '影像', text: '文字', editorial: '编排' };
  const assets = () => api.getModel().assets;
  const rows = () => api.getModel().entries;
  const catalog = () => api.getCatalog();
  const asset = id => assets().find(row => row.id === id);
  const picture = row => row?.previewUrl || backgroundImage(row?.art || 'mist');
  const head = (title, text, action = '') => `<div class="page-heading"><div><h1>${h(title)}</h1><p>${text}</p></div>${action}</div>`;
  const back = action => b('返回', action, 'left', 'quiet small');
  const check = (label, name, checked, attrs = '') => `<label class="nx-check"><input type="checkbox" ${name} ${checked ? 'checked' : ''} ${attrs}>${label}</label>`;
  const field = (label, name, value, extra = '') => `<label class="field"><span>${label}</span><input data-res-field="${name}" value="${h(value || '')}" ${extra}></label>`;
  function metadata(row) {
    return { source: '项目批准背景 · 演示来源', license: '既有批准资源的设计演示，不新增公开许可', compression: '100', fileName: `${row.art || 'mist'}.png`, size: 0, channels: [], ...structuredClone(row) };
  }
  function resourceDirty() { return res.draft && JSON.stringify(res.draft) !== res.baseline; }
  function rememberResourceList(action, target) {
    if (res.view !== 'list') return;
    res.listOrigin = { action, id: target.dataset.id || '', left: typeof window === 'undefined' ? 0 : window.scrollX, top: typeof window === 'undefined' ? 0 : window.scrollY };
  }
  function restoreResourceList() { clearResourceError(); res.view = 'list'; res.restoreList = true; api.render(); }
  const resourceActions = { 'upload-images': '双渠道上传', 'upload-wechat': '上传公众号素材库', 'upload-ipic': '上传 ipic 图床', 'verify-delivery': '联网验证交付地址', enable: '启用', disable: '停用' };
  const resourceSorts = { 'created-desc': '添加时间 · 最新在前', 'created-asc': '添加时间 · 最早在前', 'updated-desc': '更新时间 · 最新在前', 'name-asc': '名称 · 升序' };
  const enabledLabel = row => row.review === '已审核' ? '已启用' : row.review === '已停用' ? '已停用' : '未启用';
  function resourceChannels(row) {
    return `<div class="nx-res-channels">${['公众号素材库', 'ipic 图床'].map(channel => `<div><span>${channel}</span><span>${h(row.channelStates?.[channel] || '未上传')}${row.channelChecks?.[channel] ? ` · ${h(row.channelChecks[channel])}` : ''}</span></div>`).join('')}${row.deliveryCheck ? `<p>${h(row.deliveryCheck)}</p>` : ''}</div>`;
  }
  function resourceActionButtons(row) {
    return `<div class="nx-res-card-actions">${['upload-images', 'upload-wechat', 'upload-ipic', 'verify-delivery', row.review === '已审核' ? 'disable' : 'enable'].map(action => b(resourceActions[action], 'res-operation', '', 'small', `data-id="${row.id}" data-value="${action}" ${action.startsWith('upload-') && (row.review !== '已审核' || row.deliveryUnknown) ? 'disabled' : ''}`)).join('')}${b('查看 / 编辑资料', 'res-detail', '', 'quiet small', `data-id="${row.id}"`)}</div>`;
  }
  function resourceList() {
    const timestamp = (row, key) => Date.parse(row[key] || row.createdAt || '') || 0;
    const filtered = assets().filter(row => (!res.query || `${row.name} ${row.tags.join(' ')}`.includes(res.query)) && (!res.review || (res.review === 'enabled' ? row.review === '已审核' : row.review !== '已审核')) && (!res.scope || row.scope === res.scope)).sort((a, b) => (res.sort === 'name-asc' ? a.name.localeCompare(b.name, 'zh-CN') : res.sort === 'created-asc' ? timestamp(a, 'createdAt') - timestamp(b, 'createdAt') : timestamp(b, res.sort === 'updated-desc' ? 'updatedAt' : 'createdAt') - timestamp(a, res.sort === 'updated-desc' ? 'updatedAt' : 'createdAt')) || a.id.localeCompare(b.id));
    const limit = 6, totalPages = Math.max(1, Math.ceil(filtered.length / limit));
    res.page = Math.min(res.page, totalPages - 1);
    const current = filtered.slice(res.page * limit, (res.page + 1) * limit);
    for (const id of res.selected) if (!current.some(row => row.id === id)) res.selected.delete(id);
    return `<div class="nx-res">${head('素材中心', '管理素材启停、渠道上传与交付状态。', b('添加素材', 'res-new', 'plus', 'primary'))}<section class="panel"><div class="toolbar"><label class="search-field">${icon('search')}<input id="res-search" type="search" aria-label="搜索素材名称或标签" value="${h(res.query)}" placeholder="搜索名称、主题或意象…"></label><div class="toolbar-right"><select id="res-review" class="filter-select" aria-label="启用状态"><option value="">全部启用状态</option><option value="enabled" ${res.review === 'enabled' ? 'selected' : ''}>已启用</option><option value="disabled" ${res.review === 'disabled' ? 'selected' : ''}>未启用 / 已停用</option></select><select id="res-scope" class="filter-select" aria-label="素材范围"><option value="">全部范围</option>${['共享素材', '本句专属'].map(value => `<option ${res.scope === value ? 'selected' : ''}>${value}</option>`).join('')}</select><select id="res-sort" class="filter-select" aria-label="素材排序">${Object.entries(resourceSorts).map(([id, label]) => `<option value="${id}" ${id === res.sort ? 'selected' : ''}>${label}</option>`).join('')}</select>${b('筛选', 'res-filter', 'filter', 'small')}${res.query || res.review || res.scope ? b('清除', 'res-clear', '', 'quiet small') : ''}</div></div></section><section class="panel nx-res-batch" aria-label="素材批量操作"><div class="nx-res-selection">${check('选择本页', 'id="res-select-all"', current.length > 0 && current.every(row => res.selected.has(row.id)))}<span>已选 ${res.selected.size} 项</span><small>批量操作仅作用于所选素材</small></div><div class="button-row">${Object.entries(resourceActions).map(([action, label]) => b(label, 'res-batch', '', 'small', `data-value="${action}" ${res.selected.size ? '' : 'disabled'}`)).join('')}</div></section><div class="asset-grid nx-res-grid nx-res-results" id="res-results" tabindex="-1" role="region" aria-label="素材筛选结果">${current.map(row => `<article class="asset-card"><button class="asset-image nx-res-cover" data-action="res-detail" data-id="${row.id}" aria-label="查看${h(row.name)}"><img src="${h(picture(row))}" alt="${h(row.name)}" loading="lazy">${status(enabledLabel(row), row.review === '已审核' ? 'good' : '')}</button><div class="asset-card-body"><div class="asset-title">${check(h(row.name), `data-res-select="${row.id}"`, res.selected.has(row.id))}</div>${tags(row.tags.slice(0, 3))}<p class="nx-res-card-time">${h(row.createdAt ? formatStudioDateTime(row.createdAt) : '添加时间未记录')} · ${h(row.scope)}</p>${resourceChannels(row)}${resourceActionButtons(row)}</div></article>`).join('') || `<section class="panel nx-res-empty">${icon('image')}<h3>没有找到素材</h3><p>换个关键词，或清除筛选条件。</p>${b('清除筛选', 'res-clear', '', 'small')}</section>`}</div><div class="table-footer"><span>共 ${filtered.length} 张素材 · 第 ${res.page + 1} / ${totalPages} 页</span><div class="pagination">${b('上一页', 'res-page', 'left', 'small', `data-page-number="${res.page - 1}" ${res.page === 0 ? 'disabled' : ''}`)}${b('下一页', 'res-page', 'right', 'small', `data-page-number="${res.page + 1}" ${res.page + 1 >= totalPages ? 'disabled' : ''}`)}</div></div></div>`;
  }
  function applyResourceOperation(action, targets, outcome = 'success') {
    let processed = 0;
    for (const row of targets) {
      if (action === 'enable') { const values = metadata(row); if (!values.source || !values.license) continue; row.review = '已审核'; row.reviewedAt = new Date().toISOString(); }
      else if (action === 'disable') row.review = '已停用';
      else if (action === 'verify-delivery') {
        const channels = Object.keys(row.channelStates || {});
        if (!channels.length && row.delivery !== '可交付') continue;
        row.channelChecks ||= {}; channels.forEach(channel => { row.channelChecks[channel] = outcome === 'success' ? '本次验证通过 · 演示' : '本次验证失败 · 演示'; });
        row.deliveryCheck = `最近验证：${outcome === 'success' ? '通过' : '失败'} · ${channels.join('、') || '已有交付地址'} · 演示${outcome === 'success' ? '' : `${channels.includes('ipic 图床') ? '；ipic 交付地址回读失败（IPIC_READBACK_FAILED）' : ''}；原交付记录保留，未确认图文或触发发布预检`}`;
      }
      else {
        if (row.review !== '已审核' || row.deliveryUnknown) continue;
        const channels = action === 'upload-wechat' ? ['公众号素材库'] : action === 'upload-ipic' ? ['ipic 图床'] : ['公众号素材库', 'ipic 图床'];
        row.channelStates ||= {}; channels.forEach(channel => { row.channelStates[channel] = outcome === 'success' ? '已上传并验证 · 演示' : outcome === 'unknown' ? '结果未知，请核对原任务' : '本次上传失败 · 演示'; if (outcome === 'success' && row.channelChecks) delete row.channelChecks[channel]; });
        row.deliveryUnknown = outcome === 'unknown'; row.delivery = outcome === 'success' ? '可交付' : outcome === 'unknown' ? '结果待核对' : '交付失败';
        row.receipts ||= []; row.receipts.push({ channels, state: outcome, operation: 'demo-delivery', checkedAt: new Date().toISOString() });
      }
      row.updatedAt = new Date().toISOString(); row.events ||= []; row.events.push(`${resourceActions[action]}：${outcome === 'success' ? '本次完成' : outcome === 'unknown' ? '本次结果未知，保留原任务' : '本次失败，保留原交付记录'} · 演示`); processed++;
    }
    const result = outcome === 'success' ? '本次完成' : outcome === 'unknown' ? '本次结果未知，请核对原任务' : '本次失败，原交付记录保留，未确认图文或触发发布预检';
    res.selected.clear(); api.render(); api.notify(`${resourceActions[action]}：${processed} 项${result}${targets.length > processed ? `，${targets.length - processed} 项条件不满足` : ''} · 演示`, { tone: outcome === 'failed' ? 'error' : outcome === 'unknown' ? 'warning' : 'success' });
  }
  function resourceOperation(action, targets) {
    if (!targets.length || !resourceActions[action]) return;
    if (['enable', 'disable'].includes(action)) { applyResourceOperation(action, targets); return; }
    res.operation = { action, ids: targets.map(row => row.id) };
    api.modal(`${resourceActions[action]} · ${targets.length} 项`, `<div class="nx-res"><p>${targets.map(row => h(row.name)).join('、')}</p><label class="field"><span>演示结果</span><select id="res-operation-result"><option value="success">成功</option><option value="failed">网络失败</option>${action !== 'verify-delivery' ? '<option value="unknown">结果未知，保留原任务</option>' : ''}</select></label><div class="notice">此原型只演示状态变化，不连接外部服务。</div></div>`, b('取消', 'res-modal-close', '', 'quiet') + b('确认演示', 'res-operation-confirm', 'check', 'primary'));
  }
  function resourceDetail() {
    const source = asset(res.id); if (!source) { res.view = 'list'; return resourceList(); }
    const row = metadata(source), associated = rows().filter(item => item.defaults.imageId === row.id);
    const receipts = Array.isArray(row.receipts) ? row.receipts : [];
    const receiptLabel = state => ({ success: '演示交付已登记', failed: '交付失败，可重试', unknown: '结果待核对' })[state] || '记录待核对';
    const deliveryRecords = receipts.length ? `<details class="nx-res-optional"><summary>渠道回执与技术记录 · ${receipts.length} 项</summary><p>这里只展示本页内存中的演示记录，不构成真实渠道字节验证。</p>${receipts.map(receipt => `<div class="nx-res-event"><div><strong>${h(receiptLabel(receipt.state))}</strong><p>${h((receipt.channels || []).join('、') || '渠道未记录')}</p><p>记录时间：${h(receipt.checkedAt ? formatStudioDateTime(receipt.checkedAt) : '未记录')}</p><small>操作标识：${h(receipt.operation || '未记录')}</small></div></div>`).join('')}</details>` : '';
    const nextStep = row.review === '已审核' ? '素材已启用，可以为内容选用。' : '素材未启用，检查资料后可直接启用。';
    return `<div class="nx-res">${head(row.name, '素材详情 / 来源、启用与交付分别记录。', back('res-back'))}<section class="panel nx-res-primary-actions"><div><strong>${h(enabledLabel(row))}</strong><p>${nextStep}</p></div><div class="button-row">${b('编辑资料', 'res-edit', 'content', '', `data-id="${row.id}"`)}${b(row.review === '已审核' ? '停用' : '启用', 'res-operation', '', '', `data-id="${row.id}" data-value="${row.review === '已审核' ? 'disable' : 'enable'}"`)}${row.review === '已审核' ? b('用于内容', 'res-use', 'plus', 'primary', `data-id="${row.id}"`) : ''}</div></section><div class="nx-res-detail"><section class="panel nx-res-preview"><img src="${h(picture(row))}" alt="${h(row.name)}"><div class="nx-res-image-caption"><span>${h(row.fileName)}</span><span>${row.size ? `${(row.size / 1024).toFixed(1)} KiB` : '批准背景示例'} · ${row.width && row.height ? `${row.width} × ${row.height}` : '原始比例'}</span></div></section><section class="panel nx-res-facts"><div class="panel-title"><h2>素材资料</h2>${status(enabledLabel(row), row.review === '已审核' ? 'good' : 'warn')}</div><dl><dt>使用范围</dt><dd>${h(row.scope)}${row.owner ? resourceOwnerSummary(row.owner) : ''}</dd><dt>来源</dt><dd>${h(row.source)}</dd><dt>许可说明</dt><dd>${h(row.license)}</dd><dt>主题标签</dt><dd>${tags(row.tags)}</dd><dt>渠道交付</dt><dd>${resourceChannels(row)}${resourceActionButtons(row)}<details class="nx-res-channel-actions"><summary>渠道操作</summary><p>启用与渠道交付分别管理，选用本地素材无需先交付。</p>${row.deliveryUnknown ? b('核对原交付记录', 'res-delivery-check', 'check', '', `data-id="${row.id}"`) : b('渠道交付', 'res-deliver', 'send', '', `data-id="${row.id}"`)}</details></dd></dl>${row.reviewedAt ? `<p class="nx-form-help">启用时间：${h(formatStudioDateTime(row.reviewedAt))}</p>` : ''}${row.reason ? `<div class="notice${row.review === '已驳回' ? ' warn' : ''}">${h(row.reason)}</div>` : ''}<details class="nx-res-optional"><summary>文件与处理详情</summary><p>文件：${h(row.fileName)}${row.size ? ` · ${(row.size / 1024).toFixed(1)} KiB` : ''}</p><p>压缩目标 100 KiB，硬上限 150 KiB；原型不修改原字节。</p></details>${deliveryRecords}</section></div><section class="panel nx-res-related"><div class="panel-top"><div class="panel-title"><h2>关联内容</h2><span>${associated.length} 条</span></div></div>${associated.length ? associated.map(item => `<div class="nx-res-related-row"><div><strong>${h(item.text.replace(/\n/g, ''))}</strong><small>${h(item.author)} · ${h(item.source)}</small></div>${b('查看内容', 'res-content', 'right', 'quiet small', `data-id="${item.id}"`)}</div>`).join('') : '<div class="empty">暂未用于内容，启用后可以选用。</div>'}</section><section class="panel nx-res-related"><div class="panel-top"><div class="panel-title"><h2>操作记录</h2><span>本页内存</span></div></div>${(row.events || ['素材资料来自共享演示模型']).map(text => `<div class="nx-res-event">${icon('clock')}<span>${h(text)}</span></div>`).join('')}</section></div>`;
  }
  function beginAsset(id) {
    const source = id && asset(id);
    res.id = source?.id || '';
    res.draft = source ? metadata(source) : { id: `sample-added-${++res.sequence}`, name: '', art: '', previewUrl: '', scope: '共享素材', owner: '', review: '待审核', delivery: '仅本地', tags: [], source: '', license: '', fileName: '', size: 0, compression: '100', channels: [], permissionConfirmed: false };
    res.ownerQuery = ''; res.ownerPage = 0; res.ownerSearched = false;
    res.baseline = JSON.stringify(res.draft); clearResourceError(); res.view = 'form'; api.render();
  }
  function resourceOwnerSummary(id) {
    const owner = rows().find(item => item.id === id && item.pool !== 'trash');
    return owner ? `<div class="nx-res-owner-copy"><strong>${h(owner.text)}</strong><span>${h(owner.author)} · ${h(owner.source)}</span><small>内容标识：${h(owner.id)}</small></div>` : id ? `<p>当前关联内容摘要不可用，请搜索有效内容重新选择。</p><small>内容标识：${h(id)}</small>` : '尚未选择内容';
  }
  function resourceOwnerResults() {
    if (!res.ownerSearched) return '';
    const seen = new Set(), query = res.ownerQuery.toLowerCase();
    const filtered = rows().filter(item => {
      if (item.pool === 'trash' || !item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return !query || `${item.text} ${item.author} ${item.source}`.toLowerCase().includes(query);
    });
    const limit = 12, count = Math.max(1, Math.ceil(filtered.length / limit)); res.ownerPage = Math.min(res.ownerPage, count - 1);
    return `${filtered.slice(res.ownerPage * limit, (res.ownerPage + 1) * limit).map(item => `<article class="nx-res-owner-result">${resourceOwnerSummary(item.id)}${b('关联此内容', 'res-owner-select', 'check', 'small', `data-id="${h(item.id)}"`)}</article>`).join('') || '<p>暂无匹配内容，请调整正文、作者或出处关键词。</p>'}<nav class="nx-res-owner-pagination" aria-label="关联内容分页">${b('上一页', 'res-owner-page', 'left', 'small', `data-owner-page="${res.ownerPage - 1}" ${res.ownerPage === 0 ? 'disabled' : ''}`)}<span>共 ${filtered.length} 条 · ${res.ownerPage + 1} / ${count}</span>${b('下一页', 'res-owner-page', 'right', 'small', `data-owner-page="${res.ownerPage + 1}" ${res.ownerPage + 1 >= count ? 'disabled' : ''}`)}</nav>`;
  }
  function updateResourceOwners(toStart = false) {
    const node = $('#res-owner-results'); if (!node) return;
    node.innerHTML = resourceOwnerResults(); node.hidden = !res.ownerSearched;
    if (toStart) { node.focus?.({ preventScroll: true }); node.scrollIntoView?.({ block: 'start', behavior: 'auto' }); }
  }
  function syncResourcePreview() {
    if (!res.draft) return;
    const hasImage = Boolean(res.draft.previewUrl || res.draft.art), preview = $('#res-form-preview'), empty = $('#res-preview-empty');
    if (preview) { preview.hidden = !hasImage; if (hasImage) preview.src = picture(res.draft); }
    if (empty) empty.hidden = hasImage;
    $('.nx-res-form-layout')?.classList?.toggle('is-empty', !hasImage);
    $('.nx-res-upload')?.classList?.toggle('is-empty', !hasImage);
  }
  function resourceForm() {
    const row = res.draft, hasImage = Boolean(row.previewUrl || row.art);
    return `<div class="nx-res">${head(res.id ? '编辑素材' : '添加素材', '先完善文件、来源与许可，再启用素材。', back('res-back'))}<div class="nx-res-form-layout${hasImage ? '' : ' is-empty'}"><section class="panel nx-res-upload${hasImage ? '' : ' is-empty'}"><div id="res-preview-empty" class="nx-res-preview-empty" ${hasImage ? 'hidden' : ''}>${icon('image')}<span>选择图片后预览</span></div><img id="res-form-preview" ${hasImage ? `src="${h(picture(row))}"` : 'hidden'} alt="素材预览"><div class="nx-res-upload-body"><p>素材预览 · 本地登记</p></div></section><section class="panel nx-res-form"><div class="nx-form-heading"><h2>文件与基本资料</h2><p>带 * 的项目必填</p></div><div class="nx-form-error" id="res-error" role="alert">${h(res.error)}</div><div class="nx-res-file-section"><label class="nx-res-file"><input id="res-file" type="file" accept="image/jpeg,image/png,image/webp">${icon('plus')}选择本机图片 *</label><p>选择不超过 6 MiB 的 JPG、PNG 或 WebP；图片只在本页显示。</p><span id="res-file-info">${h(row.fileName || '尚未选择图片')}</span><details class="nx-res-demo-source"><summary>使用批准背景体验表单</summary><label class="field"><span>演示背景</span><select id="res-art" data-res-field="art"><option value="" ${row.art ? '' : 'selected'}>请选择批准背景</option>${[['mist', '云山'], ['dusk', '暮光'], ['sea', '海岸']].map(([id, text]) => `<option value="${id}" ${id === row.art ? 'selected' : ''}>${text}</option>`).join('')}</select></label></details></div>${field('素材名称 *', 'name', row.name, 'maxlength="30" placeholder="如：山间的一束光"')}${field('素材来源 *', 'source', row.source, 'maxlength="160" placeholder="原作者、来源页或自主创作说明"')}<label class="field"><span>许可与使用权说明 *</span><textarea data-res-field="license" rows="4" maxlength="200" placeholder="说明授权人、许可方式及可使用范围">${h(row.license)}</textarea></label><label class="field"><span>使用范围</span><select data-res-field="scope" id="res-form-scope"><option ${row.scope === '共享素材' ? 'selected' : ''}>共享素材</option><option ${row.scope === '本句专属' ? 'selected' : ''}>本句专属</option></select></label><section class="nx-res-owner-picker" id="res-owner-picker" aria-label="所属内容" ${row.scope === '共享素材' ? 'hidden' : ''}><div class="nx-res-owner-search"><label class="field"><span>搜索要关联的内容</span><input id="res-owner-query" type="search" value="${h(res.ownerQuery)}" placeholder="正文、作者或出处"></label>${b('搜索内容', 'res-owner-search', 'search', 'small')}</div><div class="nx-res-owner-selection" id="res-owner-selection" role="status" tabindex="-1">${resourceOwnerSummary(row.owner)}</div><div id="res-owner-results" class="nx-res-owner-results" tabindex="-1" aria-live="polite" ${res.ownerSearched ? '' : 'hidden'}>${resourceOwnerResults()}</div><input type="hidden" id="res-owner" data-res-field="owner" value="${h(row.owner)}"><p>专属素材只允许所选内容使用，归属变更需重新启用。</p></section><div class="nx-check-list nx-res-local-save">${check('保存后只登记为本地素材', 'data-res-local', true, 'disabled')}${check('已确认来源和许可 *', 'id="res-permission" data-res-field="permissionConfirmed"', row.permissionConfirmed)}</div><div class="notice">新增或修改来源、许可、归属后，会变为未启用；启用与渠道交付分别管理。</div><details class="nx-res-optional"><summary>可选资料与处理详情</summary>${field('主题标签', 'tagText', row.tagText ?? row.tags.join('，'), 'placeholder="用逗号分隔，如：山野，平静，云" maxlength="150"')}<label class="field"><span>压缩目标</span><select data-res-field="compression"><option value="100" ${row.compression === '100' ? 'selected' : ''}>100 KiB · 常用卡片配图</option></select><small>统一压缩目标 100 KiB，硬上限 150 KiB；未达目标需单独复核。原型不修改原字节。</small></label></details><div class="nx-form-actions"><span id="res-dirty">${resourceDirty() ? '有未保存修改' : '尚未修改'}</span><div class="button-row">${b('取消', 'res-back', '', 'quiet')}${b('保存素材', 'res-save', 'check', 'primary')}</div></div></section></div></div>`;
  }
  function syncAssetSaving() {
    document.querySelectorAll('[data-action="res-back"], [data-action="res-discard"], [data-action="res-save"], [data-action="res-save-close"], [data-action="res-modal-close"]').forEach(button => { button.disabled = res.saving; });
  }
  function setResourceError(text, field) {
    api.clearNotice?.();
    res.error = text; res.errorField = field;
    const error = $('#res-error'); if (error) error.textContent = text;
  }
  function clearResourceError(field = '') {
    if (field && field !== res.errorField) return;
    res.error = ''; res.errorField = '';
    const error = $('#res-error'); if (error) error.textContent = '';
    api.clearNotice?.();
  }
  function revealResourceError(selector = '#res-error', field = null) {
    const error = $(selector); if (!error) return;
    error.setAttribute('tabindex', '-1');
    const target = field ? $(field) || error : error;
    if (field && target !== error) { target.setAttribute('aria-invalid', 'true'); target.setAttribute('aria-describedby', error.id || selector.slice(1)); }
    target.focus?.({ preventScroll: true }); target.scrollIntoView?.({ block: 'center', behavior: 'auto' });
    if (target !== error) error.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
  }
  function saveAsset() {
    if (res.saving || !res.draft) return false;
    const row = res.draft;
    const fail = (text, field) => {
      setResourceError(text, field); api.notify(text, { tone: 'error' });
      const node = $('#res-error');
      if (node) {
        node.textContent = text;
        revealResourceError();
      }
      return false;
    };
    if (!row.previewUrl && !row.art) return fail('请选择本机图片，或明确选择一个批准背景示例。', 'image');
    if (!row.name.trim()) return fail('请填写素材名称。', 'name');
    if (!row.source.trim()) return fail('请填写可核对的素材来源。', 'source');
    if (!row.license.trim()) return fail('请填写许可与使用权说明。', 'license');
    if (row.scope === '本句专属' && !rows().some(item => item.id === row.owner && item.pool !== 'trash')) return fail('本句专属素材需要选择有效所属内容。', 'owner');
    if (!row.permissionConfirmed) return fail('请确认来源与许可后再保存。', 'permissionConfirmed');
    res.saving = true; syncAssetSaving();
    try {
      const current = res.id ? asset(res.id) : null;
      const next = structuredClone(row); next.name = next.name.trim(); next.source = next.source.trim(); next.license = next.license.trim();
      next.tags = (row.tagText ?? row.tags.join('，')).split(/[,，]/).map(value => value.trim()).filter(Boolean).slice(0, 12); delete next.tagText;
      if (next.scope === '共享素材') next.owner = '';
      const changed = !current || ['source', 'license', 'scope', 'owner', 'previewUrl', 'art'].some(key => (current[key] || metadata(current)[key] || '') !== (next[key] || ''));
      if (changed) { next.review = '待审核'; next.delivery = '仅本地'; next.reason = ''; next.reviewedAt = ''; next.receipts = []; }
      next.createdAt ||= current?.createdAt || new Date().toISOString(); next.updatedAt = new Date().toISOString();
      next.events = [...(current?.events || []), current ? `资料已更新${changed ? '，需要重新启用' : ''} · 演示` : '素材已登记，尚未启用 · 演示'];
      if (current) Object.assign(current, next); else assets().push(next);
      res.id = next.id; res.draft = null; res.baseline = ''; res.error = ''; res.errorField = ''; res.view = 'detail'; api.render(); api.notify('素材已保存到本页演示。', { tone: 'success' }); return true;
    } finally { res.saving = false; syncAssetSaving(); }
  }
  function requestResourceBack() {
    if (res.saving) return;
    if (!resourceDirty()) { clearResourceError(); res.view = res.id ? 'detail' : 'list'; res.draft = null; res.restoreList = res.view === 'list'; api.render(); return; }
    res.pending = 'back';
    api.modal('素材资料尚未保存', '<p>你可以继续编辑、保存资料，或放弃这次修改。</p>', b('放弃修改', 'res-discard', '', 'quiet') + b('继续编辑', 'res-modal-close') + b('保存资料', 'res-save-close', 'check', 'primary'));
  }
  function deliveryDialog(row) {
    const previous = row.receipts?.at(-1), channels = previous?.state === 'failed' ? previous.channels || [] : ['公众号素材库'];
    api.modal(`渠道交付 · ${row.name}`, `<div class="nx-res"><p>状态：${h(enabledLabel(row))} · 当前：${h(row.delivery)}</p><div class="nx-check-list">${check('公众号图片素材库', 'id="res-delivery-wechat"', channels.includes('公众号素材库'))}${check('ipic 图床', 'id="res-delivery-host"', channels.includes('ipic 图床') || channels.includes('资源图床'))}</div><label class="field"><span>演示结果</span><select id="res-delivery-result"><option value="success">交付成功</option><option value="failed">本次渠道失败，保留原记录</option><option value="unknown">结果未知，需要核对原任务</option></select></label><div class="notice">只展示本次渠道结果，不连接渠道、不上传文件；失败保留原记录，图文采用与发布预检分别操作。</div><div id="res-delivery-error" class="nx-form-error" role="alert"></div></div>`, b('取消', 'res-modal-close', '', 'quiet') + b('模拟交付', 'res-deliver-run', 'send', 'primary', `data-id="${row.id}"`));
  }
  function suggested(template) { return { fontId: template.recommendedFont, longFontId: template.longTextFont || template.recommendedFont, imageId: 'sample-dusk', showDate: true, showBrand: true }; }
  function templateDefinition() { return catalog().templates.find(row => row.id === tpl.id) || catalog().templates[0]; }
  function templateDraft() { const definition = templateDefinition(); tpl.id = definition.id; if (!tpl.drafts.has(tpl.id)) tpl.drafts.set(tpl.id, structuredClone(tpl.saved.get(tpl.id)?.values || suggested(definition))); return tpl.drafts.get(tpl.id); }
  function templateDirty() { return tpl.id && JSON.stringify(templateDraft()) !== JSON.stringify(tpl.saved.get(tpl.id)?.values || suggested(templateDefinition())); }
  const templateStatus = () => tpl.saveError ? '保存失败 · 默认草稿未保存' : templateDirty() ? '默认草稿未保存' : tpl.saved.has(tpl.id) ? '默认设置已保存' : '未修改';
  function templateSample() {
    const first = rows().find(row => row.pool !== 'trash') || rows()[0];
    if (tpl.mode === 'custom') return { ...tpl.custom, date: '2026-11-05' };
    if (tpl.mode === 'short') return { text: first.text, author: first.author, source: first.source, date: '2026-11-05' };
    const unit = '山色在晨光里缓缓展开，远处的风带来安静的回响。把平凡的片刻收进眼底，让心绪在留白里停靠。';
    return { text: Array.from(unit.repeat(8)).slice(0, tpl.mode === 'boundary' ? 240 : 150).join(''), author: '拾光撷语', source: '虚构排版样例', date: '2026-11-05' };
  }
  function templateSource() {
    const sample = templateSample(), values = templateDraft(), definition = templateDefinition();
    const count = Array.from(sample.text).length;
    if (!sample.text.trim() || count > 240) throw new Error('样例正文需要 1–240 字。');
    if (!sample.author.trim() || !sample.source.trim()) throw new Error('请填写样例作者与出处。');
    if (Array.from(sample.author).length > 45 || Array.from(sample.author + sample.source).length > 90) throw new Error('作者最多 45 字，作者与出处合计最多 90 字。');
    const selected = asset(values.imageId);
    const fontId = count > 100 ? values.longFontId : values.fontId;
    return { card: { ...sample, imagePath: picture(selected) }, options: { template: definition.id, fontId, showDate: values.showDate, showBrand: values.showBrand } };
  }
  function revealTemplateTab() {
    const navigation = $('.nx-tpl-workspace [role="tablist"]'), active = $(`[data-tpl-tab="${tpl.tab}"]`);
    if (!active || !navigation?.clientWidth || navigation.scrollWidth <= navigation.clientWidth || typeof active.getBoundingClientRect !== 'function') return;
    const frame = navigation.getBoundingClientRect(), bounds = active.getBoundingClientRect();
    const left = frame.left + navigation.clientLeft, right = left + navigation.clientWidth;
    const delta = bounds.left < left ? bounds.left - left : bounds.right > right ? bounds.right - right : 0;
    if (delta) navigation.scrollLeft = Math.max(0, Math.min(navigation.scrollWidth - navigation.clientWidth, navigation.scrollLeft + delta));
  }
  function setTemplateTab(tab, focus = false) {
    if (!templateTabs.some(([id]) => id === tab)) return false;
    if (tpl.tab !== tab) api.clearNotice?.();
    tpl.tab = tab; tpl.copyStatus = ''; api.render();
    const active = $(`[data-tpl-tab="${tab}"]`);
    revealTemplateTab();
    if (focus) active?.focus({ preventScroll: true });
    return true;
  }
  function filteredTemplates() {
    return catalog().templates.filter(row => (!tpl.query || `${row.name}${row.description}`.includes(tpl.query)) && (!tpl.group || row.group === tpl.group));
  }
  function templateSampleControls() {
    return `<label class="field"><span>排版样例</span><select id="tpl-sample">${[['short', '短句'], ['long', '长文 150 字'], ['boundary', '边界 240 字'], ['custom', '自定义']].map(([id, text]) => `<option value="${id}" ${id === tpl.mode ? 'selected' : ''}>${text}</option>`).join('')}</select></label>${tpl.mode === 'custom' ? `<label class="field"><span>样例正文 · 1–240 字</span><textarea data-tpl-sample="text" maxlength="480" rows="4">${h(tpl.custom.text)}</textarea></label><div class="field-grid"><label class="field"><span>作者</span><input data-tpl-sample="author" maxlength="45" value="${h(tpl.custom.author)}"></label><label class="field"><span>出处</span><input data-tpl-sample="source" maxlength="90" value="${h(tpl.custom.source)}"></label></div>` : ''}`;
  }
  function templateDefaultsControls(definition, values) {
    const fonts = selected => catalog().fonts.map(row => `<option value="${row.id}" ${row.id === selected ? 'selected' : ''}>${h(row.name)}</option>`).join('');
    return `<div class="nx-tpl-defaults"><div class="nx-form-heading"><h2>${h(definition.name)} · 默认设置</h2><p>调整后核对左侧卡片，再明确保存。保存仅影响本页后续使用。</p><span id="tpl-config-status" class="status" role="status">${templateStatus()}</span></div><div id="tpl-error" class="nx-form-error" role="alert" tabindex="-1">${h(tpl.saveError)}</div><div class="field-grid"><label class="field"><span>短句默认字体</span><select data-tpl-field="fontId">${fonts(values.fontId)}</select></label><label class="field"><span>长文默认字体</span><select data-tpl-field="longFontId">${fonts(values.longFontId)}</select></label></div><label class="field"><span>默认配图</span><select data-tpl-field="imageId">${assets().filter(row => row.review === '已审核' && row.scope === '共享素材' && !row.owner && !row.previewUrl).map(row => `<option value="${row.id}" ${row.id === values.imageId ? 'selected' : ''}>${h(row.name)}</option>`).join('')}</select><small>只使用已审核、无归属的共享素材。</small></label><div class="nx-check-list">${check('显示日期', 'data-tpl-field="showDate"', values.showDate)}${check('显示品牌', 'data-tpl-field="showBrand"', values.showBrand)}</div><details class="nx-tpl-sample-options"><summary>更换预览样例</summary>${templateSampleControls()}</details><p class="nx-tpl-footnote">版式由共享正式目录维护，本页不回写生产模板。</p></div>`;
  }
  function templateCardWorkspace(definition, values) {
    const inspector = tpl.tab === 'defaults' ? templateDefaultsControls(definition, values) : `<h2>${h(definition.name)}</h2><p>${h(definition.description)}</p><dl><dt>适合内容</dt><dd>${h(definition.categories.join(' / '))}</dd><dt>建议字数</dt><dd>${definition.preferredLength.min} — ${definition.preferredLength.max} 字</dd><dt>视觉风格</dt><dd>${h(groups[definition.group])}</dd></dl>${templateSampleControls()}${b('设置模板默认', 'tpl-tab', 'settings', 'small', 'data-value="defaults"')}<p class="nx-tpl-footnote">卡面使用共享生产绘图器、正式字体及批准背景。样例用于只读预览，不写入内容库。</p>`;
    return `<div class="nx-tpl-stage" data-expanded="${tpl.expanded}"><div class="nx-tpl-canvas"><canvas id="nx-template-canvas" width="1080" height="1440" role="img" aria-label="${h(definition.name)}真实卡片预览"></canvas><p id="nx-template-status" role="status">正在准备同源卡面…</p>${b(tpl.expanded ? '收起预览' : '放大预览', 'tpl-preview-size', '', 'quiet small', `aria-expanded="${tpl.expanded}"`)}</div><div class="nx-tpl-inspector">${inspector}</div></div>`;
  }
  function templateFooter() {
    return `<footer class="nx-tpl-save-bar" id="tpl-save-bar" ${tpl.tab === 'defaults' || templateDirty() ? '' : 'hidden'}><span id="tpl-dirty" role="status">${templateStatus()}</span><div class="nx-tpl-save-main"><details class="nx-tpl-save-menu"><summary>更多</summary><div class="nx-tpl-save-menu-panel">${b('恢复推荐', 'tpl-recommend', 'undo', 'quiet small')}${b('取消修改', 'tpl-cancel', '', 'small')}</div></details>${b('保存默认', 'tpl-save', 'check', 'primary', templateDirty() ? '' : 'disabled')}</div></footer>`;
  }
  function syncTemplateStatus() {
    for (const selector of ['#tpl-dirty', '#tpl-config-status']) { const node = $(selector); if (node) node.textContent = templateStatus(); }
    const footer = $('#tpl-save-bar'); if (footer) footer.hidden = tpl.tab !== 'defaults' && !templateDirty();
    const save = $('[data-action="tpl-save"]'); if (save) save.disabled = !templateDirty();
  }
  function templatePage() {
    const definition = templateDefinition(), values = templateDraft(), filtered = filteredTemplates();
    let workspace;
    if (tpl.tab === 'html') workspace = templateHTML();
    else if (tpl.tab === 'impact') workspace = `<div class="nx-tpl-impact"><h2>同步影响</h2><p>每次保存都保留清楚的范围，历史内容不会被默认设置追溯修改。</p><div class="nx-tpl-impact-row">${icon('check')}<div><strong>新使用此模板</strong><span>后续新建预览可采用已保存的本页默认设置。</span></div>${status('可应用', 'good')}</div><div class="nx-tpl-impact-row">${icon('clock')}<div><strong>已有内容与日期</strong><span>保持原字体、配图及开关，需要在内容编辑中明确调整。</span></div>${status('保持原样')}</div><div class="nx-tpl-impact-row">${icon('image')}<div><strong>PNG、文章和远端草稿</strong><span>保留已有成品，不重新绘制、上传或发表。</span></div>${status('保持原样')}</div>${b('返回预览', 'tpl-tab', 'left', 'small', 'data-value="preview"')}</div>`;
    else workspace = templateCardWorkspace(definition, values);
    return `<div class="nx-tpl">${head('卡片模板', `${catalog().templates.length} 款同源版式，为不同的文字找到合适的表达。`, b('默认设置', 'tpl-tab', 'settings', '', 'data-value="defaults"'))}<section class="panel"><div class="nx-tpl-shell"><aside class="nx-tpl-nav"><details class="nx-tpl-library" data-tpl-library ${tpl.libraryOpen ? 'open' : ''}><summary class="nx-tpl-library-summary"><span><small>当前模板</small><strong>${h(definition.name)}</strong></span><span>${catalog().templates.length} 款 · 切换</span></summary><div class="nx-tpl-library-content"><label class="search-field">${icon('search')}<input id="tpl-search" value="${h(tpl.query)}" placeholder="搜索模板…" aria-label="搜索模板"></label><select id="tpl-group" class="filter-select" aria-label="模板分组"><option value="">全部风格</option>${Object.entries(groups).map(([id, text]) => `<option value="${id}" ${tpl.group === id ? 'selected' : ''}>${text}</option>`).join('')}</select><div class="template-list">${filtered.map((row, index) => `<button data-action="tpl-select" data-value="${row.id}" aria-current="${row.id === definition.id}"><span class="template-number">${String(index + 1).padStart(2, '0')}</span><span>${h(row.name)}<small>${h(row.description)}</small>${tpl.saved.has(row.id) ? '<small class="text-primary">已保存演示默认</small>' : ''}</span></button>`).join('') || '<div class="empty">没有符合条件的模板</div>'}</div></div></details><div class="nx-tpl-filter-context" id="tpl-filter-context" ${filtered.some(row => row.id === definition.id) ? 'hidden' : ''}><p>当前编辑：${h(definition.name)}，不在筛选结果内。</p>${b('回到当前模板', 'tpl-clear-filter', '', 'quiet small')}</div></aside><div class="nx-tpl-workspace"><div class="panel-top"><div class="tabs" role="tablist" aria-label="模板工作区">${templateTabs.map(([id, text]) => `<button class="tab" type="button" role="tab" data-action="tpl-tab" data-value="${id}" data-tpl-tab="${id}" aria-selected="${tpl.tab === id}" tabindex="${tpl.tab === id ? 0 : -1}">${text}</button>`).join('')}</div></div>${workspace}${templateFooter()}</div></div></section></div>`;
  }
  function prepareHTML() {
    tpl.html = null; tpl.htmlError = '';
    try { const source = templateSource(); tpl.html = createTemplateHtmlExample({ ...source.card, imagePath: undefined }, source.options); }
    catch (error) { tpl.htmlError = error.message; }
  }
  function templateHTML() {
    prepareHTML();
    return `<div class="nx-tpl-html"><div class="nx-form-heading"><h2>HTML / 富文本示例</h2><p>使用同源转换器，展示结构与操作流程；不代表微信客户端等价验收。</p></div>${tpl.html ? `<div class="button-row nx-tpl-html-actions">${b('复制富文本', 'tpl-copy-rich', 'content', 'primary')}${b('复制 HTML', 'tpl-copy-source', '', '')}${b('下载 HTML', 'tpl-download', 'collect', '')}</div><p id="tpl-copy-status" class="nx-tpl-footnote" role="status">${h(tpl.copyStatus)}</p><div class="nx-tpl-html-preview"><div>${tpl.html.html}</div></div><details class="nx-tpl-html-details" data-tpl-html-details="compatibility" ${tpl.htmlDetails.compatibility ? 'open' : ''}><summary>兼容与转换详情</summary><p>本机图片地址不会写入可复制 HTML；此处示例省略背景图。</p>${tpl.html.warnings.length ? `<p>${h(tpl.html.warnings.join('；'))}</p>` : ''}</details><details class="nx-tpl-html-details" data-tpl-html-details="source" ${tpl.htmlDetails.source ? 'open' : ''}><summary>查看 HTML 源码 / 手动复制</summary><textarea class="nx-tpl-source" rows="10" readonly aria-label="HTML 源码">${h(tpl.html.html)}</textarea></details>` : `<div class="notice warn">${h(tpl.htmlError)}${b('回到预览调整', 'tpl-tab', 'left', 'quiet small', 'data-value="preview"')}</div>`}</div>`;
  }
  function saveTemplate() {
    const values = templateDraft(), selected = asset(values.imageId);
    if (!catalog().fonts.some(row => row.id === values.fontId) || !catalog().fonts.some(row => row.id === values.longFontId) || !selected || selected.review !== '已审核' || selected.scope !== '共享素材' || selected.owner || selected.previewUrl) { tpl.saveError = '请使用有效字体与已审核共享配图。'; tpl.tab = 'defaults'; api.render(); const error = $('#tpl-error'); error?.focus(); error?.scrollIntoView?.({ block: 'nearest' }); api.notify(tpl.saveError, { tone: 'error' }); return false; }
    tpl.saveError = '';
    const revision = (tpl.saved.get(tpl.id)?.revision || 0) + 1;
    tpl.saved.set(tpl.id, { values: structuredClone(values), revision });
    api.getModel().templateDefaults ||= {}; api.getModel().templateDefaults[tpl.id] = { ...structuredClone(values), revision };
    api.notify('模板默认已保存，仅作用于本页演示；历史内容与成品保持原样。', { tone: 'success' }); api.render(); return true;
  }
  function templateGuard(target) {
    if (!templateDirty()) { performTemplateNavigation(target); return; }
    tpl.pending = target;
    api.modal('模板默认尚未保存', '<p>当前模板有未保存的默认设置。保存只影响本页后续使用，不追溯修改旧卡片。</p>', b('放弃修改并继续', 'tpl-discard-next', '', 'quiet') + b('继续编辑', 'tpl-modal-close') + b('保存并继续', 'tpl-save-next', 'check', 'primary'));
  }
  function performTemplateNavigation(target) {
    tpl.pending = null;
    if (target.page) api.navigate(target.page);
    else { api.clearNotice?.(); tpl.saveError = ''; if (target.id) tpl.id = target.id; tpl.tab = target.tab || 'preview'; if (['short', 'long', 'boundary'].includes(target.sample)) tpl.mode = target.sample; tpl.copyStatus = ''; api.render(); }
  }
  function setRoute(route) {
    if (route?.page !== 'templates' || !catalog()?.templates?.length) return true;
    const current = templateDefinition(), next = catalog().templates.find(row => row.id === route.template) || current;
    const tab = templateTabs.some(([id]) => id === route.tab) ? route.tab : 'preview';
    if (next.id !== current.id && templateDirty()) { templateGuard({ id: next.id, tab, sample: route.sample }); return false; }
    tpl.id = next.id; tpl.tab = tab; tpl.copyStatus = ''; tpl.saveError = '';
    if (['short', 'long', 'boundary'].includes(route.sample)) tpl.mode = route.sample;
    return true;
  }
  async function paintTemplate() {
    const canvas = $('#nx-template-canvas'), node = $('#nx-template-status'), ticket = ++tpl.ticket;
    if (!canvas || !node) return;
    try { const source = templateSource(); await paintPreview(canvas, source.card, source.options, node); }
    catch (error) { if (ticket === tpl.ticket && node.isConnected) node.textContent = error.message; }
  }
  function updateLibraryViewport(event) {
    tpl.libraryOpen = event.matches;
    const node = $('[data-tpl-library]'); if (node) node.open = tpl.libraryOpen;
    revealTemplateTab();
  }
  libraryViewport?.addEventListener?.('change', updateLibraryViewport);
  function afterRender(page) {
    if (page === 'assets' && res.view === 'list') {
      document.querySelectorAll('[data-res-select]').forEach(input => input.addEventListener('change', () => { if (input.checked) res.selected.add(input.dataset.resSelect); else res.selected.delete(input.dataset.resSelect); api.render(); }));
      $('#res-select-all')?.addEventListener('change', event => { res.selected.clear(); if (event.target.checked) document.querySelectorAll('[data-res-select]').forEach(input => res.selected.add(input.dataset.resSelect)); api.render(); });
      $('#res-sort')?.addEventListener('change', () => { res.sort = $('#res-sort').value; res.selected.clear(); res.page = 0; api.render(); });
      $('#res-search')?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); void handle('res-filter', { dataset: {} }); } });
      if (res.focusResults) {
        res.focusResults = false;
        const results = $('#res-results'); results?.focus?.({ preventScroll: true }); results?.scrollIntoView?.({ block: 'start', behavior: 'auto' });
      } else if (res.restoreList) {
        res.restoreList = false;
        const origin = res.listOrigin;
        if (origin) {
          const trigger = [...document.querySelectorAll('[data-action]')].find(node => node.dataset.action === origin.action && (node.dataset.id || '') === origin.id);
          trigger?.focus?.({ preventScroll: true });
          if (typeof window !== 'undefined') window.scrollTo({ left: origin.left, top: origin.top, behavior: 'auto' });
        }
      }
    }
    if (page === 'assets' && res.view === 'form') {
      syncAssetSaving();
      document.querySelectorAll('[data-res-field]').forEach(node => node.addEventListener(node.tagName === 'SELECT' || node.type === 'checkbox' ? 'change' : 'input', () => {
        const name = node.dataset.resField; res.draft[name] = node.type === 'checkbox' ? node.checked : node.value;
        if (name === 'scope') { const shared = node.value === '共享素材'; $('#res-owner-picker').hidden = shared; if (shared) { res.draft.owner = ''; $('#res-owner').value = ''; $('#res-owner-selection').innerHTML = resourceOwnerSummary(''); } }
        if (name === 'art') { res.draft.previewUrl = ''; res.draft.fileName = node.value ? `${node.value}.png` : ''; res.draft.size = 0; delete res.draft.width; delete res.draft.height; syncResourcePreview(); $('#res-file-info').textContent = node.value ? '已选择批准背景示例' : '尚未选择图片'; }
        clearResourceError(name === 'art' ? 'image' : name === 'scope' && node.value === '共享素材' ? 'owner' : name);
        $('#res-dirty').textContent = resourceDirty() ? '有未保存修改' : '尚未修改';
      }));
      $('#res-owner-query')?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); void handle('res-owner-search', { dataset: {} }); } });
      $('#res-file')?.addEventListener('change', async event => {
        const file = event.target.files?.[0]; if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 6 * 1024 * 1024) { setResourceError('请选择不超过 6 MiB 的 JPG、PNG 或 WebP 图片。', 'image'); revealResourceError(); return; }
        const selectedDraft = res.draft, url = URL.createObjectURL(file), image = new Image();
        image.onload = () => { if (res.draft !== selectedDraft) { URL.revokeObjectURL(url); return; } if (image.naturalWidth * image.naturalHeight > 24000000) { URL.revokeObjectURL(url); setResourceError('图片超过 2400 万像素，请先缩小后再选择。', 'image'); revealResourceError(); return; } selectedDraft.previewUrl = url; selectedDraft.fileName = file.name; selectedDraft.size = file.size; selectedDraft.width = image.naturalWidth; selectedDraft.height = image.naturalHeight; if (!selectedDraft.name) { selectedDraft.name = file.name.replace(/\.[^.]+$/, ''); $('[data-res-field="name"]').value = selectedDraft.name; } syncResourcePreview(); $('#res-file-info').textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KiB · ${image.naturalWidth} × ${image.naturalHeight}`; clearResourceError('image'); $('#res-dirty').textContent = '有未保存修改'; };
        image.onerror = () => { URL.revokeObjectURL(url); if (res.draft === selectedDraft) { setResourceError('图片无法解码，请选择有效图片文件。', 'image'); revealResourceError(); } };
        image.src = url;
      });
    }
    if (page === 'templates') {
      const canvas = $('#nx-template-canvas');
      if (canvas) {
        if (tpl.canvas && tpl.canvas !== canvas && typeof canvas.replaceWith === 'function') { tpl.canvas.setAttribute('aria-label', canvas.getAttribute('aria-label') || '真实卡片预览'); canvas.replaceWith(tpl.canvas); }
        else tpl.canvas = canvas;
      }
      revealTemplateTab();
      $('[data-tpl-library]')?.addEventListener('toggle', event => { tpl.libraryOpen = event.target.open; });
      document.querySelectorAll('[data-tpl-html-details]').forEach(node => node.addEventListener('toggle', () => { tpl.htmlDetails[node.dataset.tplHtmlDetails] = node.open; }));
      const tabs = [...document.querySelectorAll('[data-tpl-tab]')];
      tabs.forEach(button => button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (tabs.indexOf(button) + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        setTemplateTab(tabs[index].dataset.tplTab, true);
      }));
      document.querySelectorAll('[data-tpl-field]').forEach(node => node.addEventListener('change', () => { templateDraft()[node.dataset.tplField] = node.type === 'checkbox' ? node.checked : node.value; tpl.saveError = ''; api.clearNotice?.(); syncTemplateStatus(); const error = $('#tpl-error'); if (error) error.textContent = ''; void paintTemplate(); }));
      document.querySelectorAll('[data-tpl-sample]').forEach(node => node.addEventListener('input', () => { tpl.custom[node.dataset.tplSample] = node.value; void paintTemplate(); }));
      $('#tpl-sample')?.addEventListener('change', event => { tpl.mode = event.target.value; api.render(); });
      $('#tpl-group')?.addEventListener('change', event => { tpl.group = event.target.value; api.render(); });
      $('#tpl-search')?.addEventListener('input', event => { tpl.query = event.target.value; const caret = event.target.selectionStart; api.render(); const node = $('#tpl-search'); node.focus(); try { node.setSelectionRange(caret, caret); } catch {} });
      void paintTemplate();
    }
  }
  async function handle(action, target) {
    if (!/^(res|tpl)-/.test(action)) return false;
    if (action.startsWith('res-') && res.saving) return true;
    const { id, value, date } = target.dataset;
    if (action === 'res-new') { rememberResourceList(action, target); beginAsset(); }
    else if (action === 'res-edit') { rememberResourceList(action, target); beginAsset(id || res.id); }
    else if (action === 'res-detail') { rememberResourceList(action, target); clearResourceError(); res.id = id; res.view = 'detail'; api.render(); }
    else if (action === 'res-back') { if (res.view === 'form') requestResourceBack(); else restoreResourceList(); }
    else if (action === 'res-discard') { api.closeModal(); const next = res.pending; clearResourceError(); res.draft = null; res.baseline = ''; res.pending = null; res.view = res.id ? 'detail' : 'list'; res.restoreList = res.view === 'list' && !next?.page; if (next?.page) api.navigate(next.page); else api.render(); }
    else if (action === 'res-save' || action === 'res-save-close') { const next = res.pending; if (saveAsset()) { api.closeModal(); res.pending = null; if (next?.page) api.navigate(next.page); } else if (action === 'res-save-close') { api.closeModal(); res.pending = null; revealResourceError(); } }
    else if (action === 'res-modal-close' || action === 'tpl-modal-close') { api.closeModal(); res.pending = null; tpl.pending = null; }
    else if (action === 'res-filter') { res.query = $('#res-search').value.trim(); res.review = $('#res-review').value; res.scope = $('#res-scope').value; res.sort = $('#res-sort').value; res.selected.clear(); res.page = 0; res.focusResults = true; api.render(); }
    else if (action === 'res-clear') { res.query = ''; res.review = ''; res.scope = ''; res.selected.clear(); res.page = 0; res.focusResults = true; api.render(); }
    else if (action === 'res-page') { res.selected.clear(); res.page = Math.max(0, Number(target.dataset.pageNumber)); res.focusResults = true; api.render(); }
    else if (action === 'res-owner-search') { res.ownerQuery = $('#res-owner-query').value.trim(); res.ownerPage = 0; res.ownerSearched = true; updateResourceOwners(); }
    else if (action === 'res-owner-page') { res.ownerPage = Math.max(0, Number(target.dataset.ownerPage)); updateResourceOwners(true); }
    else if (action === 'res-owner-select') { const owner = rows().find(item => item.id === id && item.pool !== 'trash'); if (!res.draft || res.draft.scope !== '本句专属' || !owner) return true; res.draft.owner = owner.id; $('#res-owner').value = owner.id; clearResourceError('owner'); const selection = $('#res-owner-selection'); selection.innerHTML = resourceOwnerSummary(owner.id); selection.focus?.({ preventScroll: true }); selection.scrollIntoView?.({ block: 'nearest' }); $('#res-dirty').textContent = resourceDirty() ? '有未保存修改' : '尚未修改'; }
    else if (action === 'res-operation') { const row = asset(id); if (row) resourceOperation(value, [row]); }
    else if (action === 'res-batch') resourceOperation(value, assets().filter(row => res.selected.has(row.id)));
    else if (action === 'res-operation-confirm') { const operation = res.operation, outcome = $('#res-operation-result').value; res.operation = null; api.closeModal(); if (operation) applyResourceOperation(operation.action, operation.ids.map(asset).filter(Boolean), outcome); }
    else if (action === 'res-use') { const row = asset(id); if (!row || row.review !== '已审核') return true; const eligible = rows().filter(item => item.pool !== 'trash' && (row.scope === '共享素材' || row.owner === item.id)); api.modal('用于内容', `<div class="nx-res"><p>选择要采用“${h(row.name)}”的内容，只修改该句默认配图。</p><div class="choice-list">${eligible.map(item => `<button class="choice-row" data-action="res-use-confirm" data-id="${row.id}" data-entry="${item.id}">${icon('book')}<span><strong>${h(item.text.replace(/\n/g, ''))}</strong><small>${h(item.author)} · ${h(item.source)}</small></span></button>`).join('') || '<div class="empty">没有符合素材范围的可用内容</div>'}</div></div>`, b('取消', 'res-modal-close', '', 'quiet')); }
    else if (action === 'res-use-confirm') { const row = asset(id), item = rows().find(item => item.id === target.dataset.entry && item.pool !== 'trash'); if (!row || !item || row.review !== '已审核' || row.scope !== '共享素材' && row.owner !== item.id) return true; item.defaults.imageId = row.id; item.systemReview = null; api.closeModal(); api.render(); api.notify('已采用该素材作为本句默认配图，仅保存到本页演示。', { tone: 'success' }); }
    else if (action === 'res-content') api.openEntry(id);
    else if (action === 'res-deliver') { const row = asset(id); if (row) deliveryDialog(row); }
    else if (action === 'res-deliver-run') { const row = asset(id); if (!row) return true; const channels = [['#res-delivery-wechat', '公众号素材库'], ['#res-delivery-host', 'ipic 图床']].filter(([selector]) => $(selector).checked).map(([, text]) => text); if (row.review !== '已审核') { $('#res-delivery-error').textContent = '素材尚未启用，请先启用。'; return true; } if (!channels.length) { $('#res-delivery-error').textContent = '请选择至少一个目标渠道。'; return true; } if (row.deliveryUnknown) { $('#res-delivery-error').textContent = '原任务结果未知，不能重放；请先核对原交付记录。'; return true; } const result = $('#res-delivery-result').value; row.delivery = result === 'success' ? '可交付' : result === 'failed' ? '交付失败' : '结果待核对'; row.deliveryUnknown = result === 'unknown'; row.channelStates ||= {}; channels.forEach(channel => { row.channelStates[channel] = result === 'success' ? '已上传并验证 · 演示' : result === 'failed' ? '本次上传失败 · 演示' : '结果未知，请核对原任务'; }); row.events ||= []; row.events.push(`${channels.join('、')}：${row.delivery} · 模拟回执`); row.receipts ||= []; row.receipts.push({ channels, state: result, operation: 'demo-delivery', checkedAt: new Date().toISOString() }); api.closeModal(); api.render(); api.modal(result === 'success' ? '模拟交付完成' : result === 'failed' ? '交付失败' : '交付结果未知', `<div class="nx-res"><p>${channels.map(h).join('、')} · ${h(row.name)}</p><div class="notice ${result === 'success' ? '' : 'warn'}">${result === 'success' ? '已登记演示交付回执，没有真实上传。' : result === 'failed' ? '本次所选渠道交付失败，本地素材与原交付记录保留。可沿原目标重试；未确认图文，也未触发发布预检。' : '保留本地素材和原任务，核对前禁止重放。'}</div></div>`, b('关闭', 'res-modal-close', '', 'quiet') + (result === 'unknown' ? b('核对原记录', 'res-delivery-check', 'check', 'primary', `data-id="${row.id}"`) : result === 'failed' ? b('重试', 'res-deliver', 'arrow', 'primary', `data-id="${row.id}"`) : '')); }
    else if (action === 'res-delivery-check') { const row = asset(id); if (row) api.modal('核对原交付记录', `<div class="nx-res"><p>原素材：${h(row.name)}</p><p>保留原任务与目标渠道，核对后再决定是否恢复。</p><label class="field"><span>模拟核对结果</span><select id="res-reconcile"><option value="pending">仍无法确定 · 保持锁定</option><option value="received">确认已接收 · 记录原回执</option><option value="absent">确认未接收 · 允许沿原范围继续</option></select></label><div class="notice">本页不读取真实渠道，所选结果仅用于演示异常恢复 UI。</div></div>`, b('返回', 'res-modal-close', '', 'quiet') + b('记录核对结果', 'res-delivery-reconcile', 'check', 'primary', `data-id="${row.id}"`)); }
    else if (action === 'res-delivery-reconcile') { const row = asset(id), result = $('#res-reconcile').value; if (row) { row.deliveryUnknown = result === 'pending'; row.delivery = result === 'received' ? '可交付' : result === 'absent' ? '仅本地' : '结果待核对'; row.events.push(`模拟人工核对：${result === 'received' ? '原渠道已接收，保留回执' : result === 'absent' ? '原渠道未接收，可沿原范围继续' : '仍未确定，保持任务锁定'}`); api.closeModal(); api.render(); api.notify('演示核对结果已记录；没有真实远端验证。', { tone: 'success' }); } }
    else if (action === 'tpl-select') templateGuard({ id: value });
    else if (action === 'tpl-tab') setTemplateTab(value);
    else if (action === 'tpl-clear-filter') { tpl.query = ''; tpl.group = ''; tpl.libraryOpen = true; api.render(); const node = $(`[data-action="tpl-select"][data-value="${tpl.id}"]`); node?.focus?.({ preventScroll: true }); node?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }
    else if (action === 'tpl-preview-size') { tpl.expanded = !tpl.expanded; const stage = $('.nx-tpl-stage'); if (stage) stage.dataset.expanded = String(tpl.expanded); target.textContent = tpl.expanded ? '收起预览' : '放大预览'; target.setAttribute?.('aria-expanded', String(tpl.expanded)); }
    else if (action === 'tpl-save') saveTemplate();
    else if (action === 'tpl-cancel') { tpl.saveError = ''; tpl.drafts.set(tpl.id, structuredClone(tpl.saved.get(tpl.id)?.values || suggested(templateDefinition()))); api.render(); api.notify('已撤销未保存的模板修改。', { tone: 'success' }); }
    else if (action === 'tpl-recommend') { tpl.saveError = ''; tpl.drafts.set(tpl.id, suggested(templateDefinition())); api.render(); api.notify('已恢复推荐值，保存后生效于本页默认。'); }
    else if (action === 'tpl-discard-next') { const next = tpl.pending; tpl.drafts.set(tpl.id, structuredClone(tpl.saved.get(tpl.id)?.values || suggested(templateDefinition()))); api.closeModal(); if (next) performTemplateNavigation(next); }
    else if (action === 'tpl-save-next') { const next = tpl.pending; if (saveTemplate()) { api.closeModal(); if (next) performTemplateNavigation(next); } }
    else if (action === 'tpl-copy-rich' || action === 'tpl-copy-source') { if (!tpl.html) return true; try { await (action === 'tpl-copy-rich' ? copyTemplateRichText(tpl.html) : copyTemplateHtmlSource(tpl.html)); tpl.copyStatus = action === 'tpl-copy-rich' ? '富文本已写入剪贴板，请在目标编辑器核对。' : 'HTML 源码已写入剪贴板。'; } catch (error) { tpl.copyStatus = `${error.message} 可展开源码手动复制。`; } const node = $('#tpl-copy-status'); if (node) node.textContent = tpl.copyStatus; }
    else if (action === 'tpl-download') { if (tpl.html) { try { await downloadTemplateHtml(tpl.html, `daylight-template-${tpl.id}.html`); api.notify('已请求本地下载 HTML 示例；未发布。', { tone: 'success' }); } catch (error) { api.notify(error.message, { tone: 'error' }); } } }
    return true;
  }
  return {
    render(page) { if (page === 'assets') return res.view === 'form' ? resourceForm() : res.view === 'detail' ? resourceDetail() : resourceList(); if (page === 'templates') return templatePage(); return null; },
    handle, afterRender, setRoute,
    reset() { res.view = 'list'; res.id = ''; res.query = ''; res.review = ''; res.scope = ''; res.selected.clear(); res.page = 0; res.draft = null; res.baseline = ''; res.error = ''; res.errorField = ''; res.pending = null; res.ownerQuery = ''; res.ownerPage = 0; res.ownerSearched = false; res.listOrigin = null; res.restoreList = false; res.focusResults = false; tpl.id = ''; tpl.tab = 'preview'; tpl.query = ''; tpl.group = ''; tpl.mode = 'short'; tpl.saved.clear(); tpl.drafts.clear(); tpl.pending = null; tpl.html = null; tpl.copyStatus = ''; tpl.saveError = ''; tpl.canvas = null; tpl.libraryOpen = libraryViewport ? libraryViewport.matches : true; tpl.expanded = false; tpl.htmlDetails = { source: false, compatibility: false }; },
    dispose() { libraryViewport?.removeEventListener?.('change', updateLibraryViewport); tpl.ticket++; tpl.canvas = null; },
    beforeNavigate(page) {
      if (res.saving) return false;
      if (page !== 'assets' && res.view === 'form' && resourceDirty()) { res.pending = { page }; api.modal('素材资料尚未保存', '<p>保存或放弃这次修改后，再切换页面。</p>', b('放弃并继续', 'res-discard', '', 'quiet') + b('继续编辑', 'res-modal-close') + b('保存并继续', 'res-save-close', 'check', 'primary')); return false; }
      if (page !== 'templates' && templateDirty()) { templateGuard({ page }); return false; }
      return true;
    },
  };
}
