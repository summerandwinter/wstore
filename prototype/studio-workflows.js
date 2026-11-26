import { formatStudioDateTime, createStudioAiResourcePool, studioAiCandidates } from './studio-delivery.js';
import { IMAGE_GENERATION_STYLES, IMAGE_GENERATION_DEFAULTS } from '../runtime/image-generation-styles.js';
import { fontCatalog } from '../runtime/card-catalog.js';

// Review-only workflows. All state and simulated jobs live in this browser tab.
export function createWorkflowPages(api) {
  const { h, icon, button, status, tags } = api;
  const clone = value => structuredClone(value);
  const $ = selector => document.querySelector(selector);
  const model = () => api.getModel();
  const sources = [['all', '全部来源'], ['poetry', '古诗精选 · 示例'], ['reading', '阅读摘录 · 示例']];
  const corpus = [
    ['白日依山尽，\n黄河入海流。', '王之涣', '登鹳雀楼', 'poetry'],
    ['海上生明月，\n天涯共此时。', '张九龄', '望月怀远', 'poetry'],
    ['山气日夕佳，\n飞鸟相与还。', '陶渊明', '饮酒·其五', 'reading'],
    ['欲穷千里目，\n更上一层楼。', '王之涣', '登鹳雀楼', 'poetry'],
    ['空山不见人，\n但闻人语响。', '王维', '鹿柴', 'reading'],
  ];
  const normalize = text => String(text || '').replace(/[\s，。！？；、,.!?;]/g, '');
  let sequence = 20, timer = null, currentPage = '', modalKind = '', pendingNavigation = null, loginTimer = null, loginRun = 0;
  function seedCandidates() {
    const existing = model().entries.find(row => row.pool !== 'trash');
    const other = model().entries.find(row => row.id !== existing?.id && row.pool !== 'trash');
    return [
      ...corpus.map(([text, author, source, origin], index) => ({ id: `col-sample-${index}`, text, author, source, origin, category: '诗词', tags: ['诗词'], note: '', state: 'pending', batch: '初始示例' })),
      { id: 'col-sample-duplicate', text: existing?.text || corpus[0][0], author: existing?.author || corpus[0][1], source: existing?.source || corpus[0][2], origin: 'poetry', category: '诗词', tags: [], note: '', state: 'pending', batch: '初始示例' },
      { id: 'col-sample-conflict', text: other?.text || corpus[1][0], author: other?.author || corpus[1][1], source: '出处待核对', origin: 'reading', category: '诗词', tags: [], note: '', state: 'pending', batch: '初始示例' },
      { id: 'col-sample-incomplete', text: '夜来风雨声，\n花落知多少。', author: '', source: '春晓', origin: 'reading', category: '诗词', tags: [], note: '', state: 'pending', batch: '初始示例' },
      { id: 'col-sample-empty', text: '', author: '', source: '', origin: 'reading', category: '诗词', tags: [], note: '采集结果为空 · 异常示例', state: 'pending', batch: '初始示例' },
    ];
  }
  const col = { rows: seedCandidates(), search: '', source: 'all', filter: 'pending', page: 0, size: 4, selected: new Set(), selectionMode: false, selectedMatching: false, task: null, edit: null, original: '', errors: {}, preview: null, undo: null, result: null };
  const initialPublication = api.initialPublicationSettings || {};
  const routeProviders = { axxiu: 'AxureShow', ipic: 'ipic', 'github-mirror': 'GitHub 镜像', 'wechat-material': '公众号素材库', uploadthing: 'UploadThing' };
  const demoRouting = () => ({ schemaVersion: 2, authorityRoot: 'https://axureshow.example/daylight-demo', channels: {
    images: [{ providerId: 'wechat-material', baseUrl: 'https://mmbiz.qpic.cn' }, { providerId: 'axxiu', baseUrl: 'https://axureshow.example/daylight-demo' }, { providerId: 'ipic', baseUrl: 'https://images.example/daylight-demo' }, { providerId: 'github-mirror', baseUrl: 'https://mirror.example/daylight-demo/imagery' }],
    fonts: [{ providerId: 'axxiu', baseUrl: 'https://axureshow.example/daylight-demo' }, { providerId: 'github-mirror', baseUrl: 'https://mirror.example/daylight-demo/fonts' }],
  } });
  const demoRoutingUpgrade = routing => ({ available: routing.schemaVersion < 3, targetSchemaVersion: 3, draft: {
    ...clone(routing), schemaVersion: 3, channels: { images: routing.channels.images.some(row => row.providerId === 'wechat-material') ? clone(routing.channels.images) : [{ providerId: 'wechat-material', baseUrl: 'https://mmbiz.qpic.cn' }, ...clone(routing.channels.images)], fonts: [{ providerId: 'uploadthing', baseUrl: 'https://demo-upload.ufs.sh' }, ...clone(routing.channels.fonts).filter(row => row.providerId !== 'uploadthing')] },
  } });
  function defaultSettings() {
    return {
      workflow: { mode: 'auto', review: 'rules', protectLabels: true, protectImages: true, deduplicate: true },
      resourcePool: clone(model().demoAiResourcePool || createStudioAiResourcePool()),
      workParameters: clone(model().demoAiWorkParameters || {
        annotation: { concurrency: 3, timeoutMs: 30000, temperature: 0.2, batchSize: 50, maxBatchChars: 12000 },
        generation: { concurrency: 2, timeoutMs: 60000, size: '1080x1440', countPerItem: 1, ...IMAGE_GENERATION_DEFAULTS },
      }),
      channels: {
        images: { name: '批准素材图床', provider: 'axureshow', namespace: 'daylight-demo', enabled: true },
        wechat: { name: '示例公众号', provider: 'personal', namespace: 'example-account', enabled: false },
        resources: { name: '公开资源渠道', provider: 'axureshow', fallback: 'github', namespace: 'daylight-demo', enabled: true },
        fonts: { name: 'UploadThing 字体上传', provider: 'uploadthing', namespace: 'font-objects', enabled: true, sampleToken: false },
      },
      routing: clone(initialPublication.routing || model().demoResourceRouting || demoRouting()),
      range: { ...model().schedule },
      preferences: { density: 'comfortable', startPage: 'review', hints: true, motion: true },
    };
  }
  const defaults = defaultSettings();
  model().demoAiWorkParameters ||= clone(defaults.workParameters);
  const cfg = { tab: ['models', 'channels'].includes(api.initialTab) ? api.initialTab : 'workflow', poolKind: 'annotation', openChannels: {}, poolStates: {}, parameterStates: {}, saved: clone(defaults), draft: clone(defaults), errors: {}, editor: null, editorOriginal: '', test: null, savedAt: '', saveFailed: false, editorFailed: false, loginOutcome: 'success' };
  const initialRoutingUpgrade = Object.hasOwn(initialPublication, 'routingUpgrade') ? clone(initialPublication.routingUpgrade) : demoRoutingUpgrade(defaults.routing);
  let routingUpgrade = clone(initialRoutingUpgrade), routingSequence = 0;
  let settingsRead = { state: 'ready', revision: initialPublication.revision || 'demo-publication', error: '' }, settingsReadRun = 0;
  let fontResourceDemo = { scenario: 'current', imported: false, error: '' };
  let poolDetection = null, detectionTimer = null, detectionRun = 0, poolSequence = 1, aiReadRun = 0;
  const publicationReady = () => settingsRead.state === 'ready' && typeof settingsRead.revision === 'string' && settingsRead.revision.length > 0;
  const fontDraftChanged = () => JSON.stringify(cfg.draft.channels.fonts) !== JSON.stringify(cfg.saved.channels.fonts);
  const routingDraftChanged = () => JSON.stringify(cfg.draft.routing) !== JSON.stringify(cfg.saved.routing);
  const blockedSettingsSave = () => !publicationReady() && (cfg.tab === 'channels' || fontDraftChanged() || routingDraftChanged());
  const settingsReadStatus = () => settingsRead.state === 'loading' ? '正在读取配置…' : '配置读取失败，请刷新重试';
  const fontAccountReadStatus = () => settingsRead.state === 'loading' ? '正在读取凭据…' : '凭据状态读取失败，请刷新重试';
  const settingsReadNotice = () => settingsRead.state === 'failed' ? `<p class="nx-form-error" role="alert" data-settings-load-error>${h(settingsRead.error)}</p>` : settingsRead.state === 'loading' ? '<p class="nx-form-help" role="status">正在读取已保存配置…</p>' : '';
  const dirty = () => JSON.stringify(cfg.draft) !== JSON.stringify(cfg.saved);
  const candidate = id => col.rows.find(row => row.id === id);
  const sourceName = id => sources.find(row => row[0] === id)?.[1] || '示例来源';
  const note = text => `<div class="notice">${h(text)}</div>`;
  const technicalNotes = (title, text) => `<details class="nx-cfg-details nx-cfg-technical"><summary>${h(title)}</summary><div><p class="nx-form-help">${h(text)}</p></div></details>`;
  const errorLine = (errors, key) => errors[key] ? `<small class="nx-form-error" role="alert">${h(errors[key])}</small>` : '';
  const field = (label, input, key = '', errors = {}) => {
    const errorId = `nx-error-${key.replace(/[^a-z0-9_-]/gi, '-')}`;
    return `<label class="field"><span>${h(label)}</span>${errors[key] ? input.replace(/^(<(?:input|select|textarea)\b)/, `$1 aria-invalid="true" aria-describedby="${errorId}"`) : input}${errors[key] ? `<small id="${errorId}" class="nx-form-error" role="alert">${h(errors[key])}</small>` : ''}</label>`;
  };
  const heading = (title, subtitle, action = '') => `<div class="page-heading"><div><h1>${h(title)}</h1><p>${h(subtitle)}</p></div>${action}</div>`;
  const empty = (title, text) => `<div class="empty">${icon('inbox')}<strong>${h(title)}</strong>${h(text)}</div>`;
  function openModal(kind, title, body, footer) {
    modalKind = kind;
    api.modal(title, `<div class="${kind.startsWith('col') ? 'nx-col' : 'nx-cfg'}" data-workflow-modal="${kind}">${body}</div>`, footer);
    bindModal();
  }
  function closeModal() {
    if (modalKind === 'cfg-pool-detection') { clearTimeout(detectionTimer); detectionTimer = null; ++detectionRun; if (poolDetection?.state === 'running') poolDetection.state = 'idle'; }
    modalKind = ''; clearTimeout(loginTimer); loginTimer = null; ++loginRun; api.closeModal();
  }
  function classify(row, earlier = []) {
    if (row.state === 'imported') return { code: 'imported', label: '已转入草稿', tone: 'good' };
    if (row.state === 'ignored') return { code: 'ignored', label: '已忽略', tone: '' };
    if (Array.from(row.text.trim()).length < 4 || Array.from(row.text.trim()).length > 240) return { code: 'invalid', label: '正文无效', tone: 'warn', reason: '正文需为 4–240 字。' };
    if (!row.author.trim() || !row.source.trim()) return { code: 'incomplete', label: '信息缺失', tone: 'warn', reason: '补全作者与出处后再整理。' };
    const match = model().entries.filter(item => item.pool !== 'trash').concat(earlier).find(item => normalize(item.text) === normalize(row.text));
    if (match) {
      if (normalize(match.author) !== normalize(row.author) || normalize(match.source) !== normalize(row.source)) return { code: 'conflict', label: '出处冲突', tone: 'warn', reason: `同文记录为 ${match.author || '作者未填'} · ${match.source || '出处未填'}，请核对。`, match };
      return { code: 'duplicate', label: '重复内容', tone: '', reason: '与已有内容或本次较早候选重复，将跳过，不新增副本。', match };
    }
    return { code: 'ready', label: '可整理', tone: 'blue', reason: '正文、作者与出处完整，可转入草稿。' };
  }
  function filteredCandidates() {
    return col.rows.filter(row => {
      const result = classify(row);
      return (col.source === 'all' || row.origin === col.source) && (!col.search || `${row.text}${row.author}${row.source}${row.note}`.toLowerCase().includes(col.search.toLowerCase())) && (col.filter === 'all' || (col.filter === 'pending' ? !['imported', 'ignored'].includes(result.code) : col.filter === 'issues' ? ['invalid', 'incomplete', 'conflict'].includes(result.code) : result.code === col.filter));
    });
  }
  function collectPage() {
    const rows = filteredCandidates(), totalPages = Math.max(1, Math.ceil(rows.length / col.size));
    col.page = Math.min(col.page, totalPages - 1);
    const visible = rows.slice(col.page * col.size, (col.page + 1) * col.size);
    const selectable = visible.filter(row => !['imported', 'ignored'].includes(row.state));
    const counts = { ready: 0, issues: 0, duplicate: 0 };
    for (const row of col.rows) { const type = classify(row).code; if (type === 'ready') counts.ready++; if (['invalid', 'incomplete', 'conflict'].includes(type)) counts.issues++; if (type === 'duplicate') counts.duplicate++; }
    const task = col.task;
    const selecting = col.selectionMode || col.selected.size > 0;
    const filters = `<details class="nx-col-filter-options"><summary>更多筛选${col.source !== 'all' ? ' · 已启用来源' : ''}</summary><div class="toolbar-right"><label class="field"><span>采集来源</span><select id="nx-col-source" class="filter-select" aria-label="筛选采集来源">${sources.map(([id, text]) => `<option value="${id}" ${col.source === id ? 'selected' : ''}>${text}</option>`).join('')}</select></label>${button('清除筛选', 'col-clear-filters', '', 'quiet small')}</div></details>`;
    const selectionTools = `<div class="nx-col-scope nx-col-selection-tools">${!selecting ? button('选择候选', 'col-start-selection', '', 'small') : `<span>选择本页或跨页范围，再核对整理。</span><div class="button-row">${button(`选择全部筛选 ${rows.filter(row => !['imported', 'ignored'].includes(row.state)).length} 条（跨页）`, 'col-select-matching', '', 'small')}${button('结束选择', 'col-clear-selection', '', 'quiet small')}</div>`}</div>`;
    const selectionDock = `<div class="nx-col-batch-dock" data-col-batch-dock${col.selected.size ? '' : ' hidden'}><span role="status">${col.selectedMatching ? `已选择全部筛选 ${col.selected.size} 条（跨页）` : `已勾选 ${col.selected.size} 条，跨页保留`}</span><div class="button-row">${button('取消选择', 'col-clear-selection', '', 'quiet small')}${button(`整理选中 ${col.selected.size} 条`, 'col-organize', 'check', 'primary small', col.selected.size ? '' : 'disabled')}</div></div>`;
    return `<div class="nx-col${selecting ? ' nx-col-selecting' : ''}">${heading('采集候选', '先收集，再核对；把值得留下的文字整理成内容。', button('新建采集', 'col-new', 'plus', 'primary'))}<div class="nx-col-summary"><button data-action="col-filter" data-value="ready"><strong>${counts.ready}</strong><span>可整理</span></button><button data-action="col-filter" data-value="issues"><strong>${counts.issues}</strong><span>待修正</span></button><button data-action="col-filter" data-value="duplicate"><strong>${counts.duplicate}</strong><span>重复内容</span></button><div><span class="live-dot"></span>虚构采集 · 本页演示</div></div>${task ? `<section class="panel nx-col-job"><div class="nx-col-job-top"><div><h2>${h(task.name)}</h2><p>${h(sourceName(task.source))} · ${h(task.range)} · ${task.count} 条目标</p></div>${status(({ running: '采集中', paused: '已暂停', cancelled: '已取消', completed: '采集完成' })[task.state] || '状态待核对', task.state === 'completed' ? 'good' : task.state === 'running' ? 'blue' : '')}</div><progress max="${task.count}" value="${task.done}" aria-label="示例采集进度"></progress><div class="nx-col-job-bottom"><span>${task.done} / ${task.count} 已处理${task.state === 'completed' ? ' · 结果已进入候选列表' : ' · 演示不访问来源；真实任务按请求边界暂停'}</span><div class="button-row">${task.state === 'running' ? button('暂停', 'col-task-pause', '', 'small') : task.state === 'paused' ? button('继续采集', 'col-task-resume', '', 'small') : ''}${['running', 'paused'].includes(task.state) ? button('取消任务', 'col-task-cancel', '', 'quiet small') : ''}${button('查看详情', 'col-task-detail', '', 'quiet small')}</div></div></section>` : ''}${col.result ? `<div class="nx-col-result" role="status"><div><strong>${h(col.result.title)}</strong><span>${h(col.result.text)}</span></div><div class="button-row">${col.undo ? button('撤销本批整理', 'col-undo', 'undo', 'small') : ''}${button('关闭结果', 'col-dismiss-result', 'close', 'quiet small')}</div></div>` : ''}<section class="panel"><div class="panel-top"><div class="tabs" role="tablist" aria-label="候选状态">${[['pending', '待整理'], ['issues', '待修正'], ['imported', '已整理'], ['all', '全部']].map(([id, label]) => `<button class="tab" role="tab" aria-selected="${col.filter === id}" data-action="col-filter" data-value="${id}">${label}</button>`).join('')}</div>${button('查看已忽略', 'col-filter', '', 'quiet small', 'data-value="ignored"')}</div><div class="toolbar"><label class="search-field">${icon('search')}<input id="nx-col-search" type="search" value="${h(col.search)}" placeholder="搜索正文、作者或出处…" aria-label="搜索采集候选"></label>${filters}</div>${selectionTools}${visible.length ? `<div class="nx-col-table-scroll"><table class="nx-col-table"><thead><tr><th><label class="nx-col-selection-target"><input type="checkbox" id="nx-col-select-page" aria-label="选择本页可整理候选" ${selectable.length && selectable.every(row => col.selected.has(row.id)) ? 'checked' : ''} ${selectable.length ? '' : 'disabled'}></label></th><th>内容与来源</th><th>核对状态</th><th>操作</th></tr></thead><tbody>${visible.map(row => { const type = classify(row); return `<tr class="${col.selected.has(row.id) ? 'selected' : ''}"><td><label class="nx-col-selection-target"><input type="checkbox" data-col-select="${row.id}" aria-label="选择${h(row.text || '空白候选')}" ${col.selected.has(row.id) ? 'checked' : ''} ${['imported', 'ignored'].includes(row.state) ? 'disabled' : ''}></label></td><td><button class="content-open" data-action="col-detail" data-id="${row.id}"><span class="quote-text">${h(row.text.replace(/\n/g, '') || '（未采集到正文）')}</span><span class="attribution">${h(row.author || '作者待补全')} · ${h(row.source || '出处待补全')}</span></button><small>${h(sourceName(row.origin))} · ${h(row.batch)}</small></td><td>${status(type.label, type.tone)}${row.state === 'imported' ? '<small>继续到内容管理编辑</small>' : `<small>${h(type.reason || '保留在采集记录中')}</small>`}</td><td><div class="button-row">${row.state === 'imported' ? button('编辑草稿', 'col-open-entry', '', 'quiet small', `data-id="${row.entryId}"`) : button(type.code === 'ready' || type.code === 'duplicate' ? '查看' : '修正', 'col-detail', '', 'quiet small', `data-id="${row.id}"`)}</div></td></tr>`; }).join('')}</tbody></table></div>` : empty('没有符合条件的候选', '调整来源或搜索条件，也可以新建一次示例采集。')}<div class="table-footer"><span>共 ${rows.length} 条 · 每页 ${col.size} 条</span><div class="pagination">${button('上一页', 'col-prev', 'left', 'quiet small', col.page ? '' : 'disabled')}<span>${col.page + 1} / ${totalPages}</span>${button('下一页', 'col-next', 'right', 'quiet small', col.page < totalPages - 1 ? '' : 'disabled')}</div></div>${selectionDock}</section><div class="insight">${icon('collect')}<span>完整来源、重复、出处冲突和无效内容分别保留。整理只新增有效草稿，不覆盖现有内容。</span></div></div>`;
  }
  function newCollection() {
    openModal('col-create', '新建采集', `${note('这是离线采集演示，来源和结果均为虚构，不访问网站或调用模型。')}<form id="nx-col-create"><div class="field-grid">${field('采集来源', `<select id="nx-col-new-source">${sources.slice(1).map(([id, text]) => `<option value="${id}">${text}</option>`).join('')}</select>`)}${field('目标数量', '<input id="nx-col-new-count" type="number" min="1" max="12" value="6">')}</div>${field('采集范围', '<input id="nx-col-new-range" maxlength="50" value="示例精选第 1–3 页">')}${field('重复处理', '<select id="nx-col-new-dedup"><option value="skip">整理时跳过重复，保留采集记录</option><option value="review">重复项先人工核对，不自动整理</option></select>')}<p class="nx-form-help">采集完成后进入候选列表。任务可暂停、继续或取消；已经返回的候选保留。</p><p id="nx-col-create-error" class="nx-form-error" role="alert"></p></form>`, button('取消', 'col-close', '', 'quiet') + button('开始示例采集', 'col-create-submit', 'collect', 'primary'));
  }
  function scheduleTick() {
    clearTimeout(timer);
    if (col.task?.state !== 'running') return;
    timer = setTimeout(() => {
      const task = col.task;
      if (!task || task.state !== 'running') return;
      const index = task.done++, sample = corpus[index % corpus.length];
      const row = { id: `col-generated-${++sequence}`, text: sample[0], author: sample[1], source: sample[2], origin: task.source, category: '诗词', tags: ['诗词'], note: '', state: 'pending', batch: task.name, dedup: task.dedup };
      // Include inspectable duplicate and incomplete outcomes in every larger simulated batch.
      if (index === 2) { const existing = model().entries.find(item => item.pool !== 'trash'); if (existing) Object.assign(row, { text: existing.text, author: existing.author, source: existing.source }); }
      if (index === 4) row.author = '';
      col.rows.unshift(row); task.candidateIds.push(row.id);
      if (task.done >= task.count) task.state = 'completed';
      if (currentPage === 'collect') api.render();
      if (modalKind === 'col-task' && $('#modal')?.open && $('[data-workflow-modal="col-task"]')) taskDialog();
      if (task.state === 'completed') api.notify(`示例采集完成，${task.done} 条候选等待核对。`, { tone: 'success' });
      else scheduleTick();
    }, 450);
  }
  function taskDialog() {
    const task = col.task;
    if (!task) return;
    openModal('col-task', '采集任务详情', `<div class="nx-col-detail-summary"><h3>${h(task.name)}</h3><p>${h(sourceName(task.source))} · ${h(task.range)}</p>${status(({ running: '采集中', paused: '已暂停', cancelled: '已取消', completed: '已完成' })[task.state] || '状态待核对', task.state === 'completed' ? 'good' : task.state === 'running' ? 'blue' : '')}<p>创建时间：${h(task.createdAt ? formatStudioDateTime(task.createdAt) : '未记录')}</p><progress max="${task.count}" value="${task.done}"></progress><p>${task.done} / ${task.count} 条已返回。${task.dedup === 'review' ? '重复项须人工核对。' : '重复项在整理时跳过。'}</p><p>暂停只停止后续模拟；取消后不自动重启，已返回候选保留。</p></div>`, `${['running', 'paused'].includes(task.state) ? button(task.state === 'running' ? '暂停' : '继续采集', task.state === 'running' ? 'col-task-pause' : 'col-task-resume', '', 'small') + button('取消任务', 'col-task-cancel', '', 'quiet small') : ''}${button('返回候选', 'col-close', '', 'primary')}`);
  }
  function candidateDialog(id, keepDraft = false) {
    const row = candidate(id);
    if (!row) return;
    if (!keepDraft) { col.edit = clone(row); col.original = JSON.stringify(row); col.errors = {}; }
    const draft = col.edit, result = classify(row), readonly = row.state === 'imported';
    openModal('col-candidate', '核对采集候选', `<div class="nx-col-detail-summary">${status(result.label, result.tone)}<p>${h(result.reason || '已经完成本条候选处理。')}</p><small>${h(sourceName(row.origin))} · ${h(row.batch)} · 虚构来源</small></div><form id="nx-col-candidate-form">${field('正文 · 4–240 字', `<textarea data-col-edit="text" minlength="4" maxlength="240" ${readonly ? 'disabled' : ''}>${h(draft.text)}</textarea>`, 'text', col.errors)}<div class="field-grid">${field('作者', `<input data-col-edit="author" maxlength="60" value="${h(draft.author)}" ${readonly ? 'disabled' : ''}>`, 'author', col.errors)}${field('出处', `<input data-col-edit="source" maxlength="100" value="${h(draft.source)}" ${readonly ? 'disabled' : ''}>`, 'source', col.errors)}</div>${field('标签 · 用逗号分隔', `<input data-col-edit="tags" maxlength="120" value="${h(draft.tags.join('，'))}" ${readonly ? 'disabled' : ''}>`)}${field('核对备注', `<textarea data-col-edit="note" maxlength="300" ${readonly ? 'disabled' : ''}>${h(draft.note)}</textarea>`)}${result.match ? `<div class="notice"><strong>已有内容参考</strong><p>${h(result.match.text)}<br>${h(result.match.author)} · ${h(result.match.source)}</p>${result.match.id ? button('查看已有内容', 'col-open-existing', '', 'quiet small', `data-id="${result.match.id}"`) : ''}</div>` : ''}<p class="nx-form-help">保存修正仅更新本条候选；转入草稿前仍会重新去重核对。</p></form>`, button('返回', 'col-candidate-close', '', 'quiet') + (readonly ? button('编辑已整理草稿', 'col-open-entry', '', 'primary', `data-id="${row.entryId}"`) : `${row.state === 'ignored' ? button('恢复为待整理', 'col-restore', '', '', `data-id="${row.id}"`) : button('忽略此条', 'col-ignore', '', 'quiet', `data-id="${row.id}"`)}${button('保存修正', 'col-candidate-save', 'check', 'primary')}`));
  }
  function closeCandidate() {
    if (col.edit && JSON.stringify(col.edit) !== col.original) {
      openModal('col-unsaved', '候选有未保存的修改', '<p tabindex="-1" data-workflow-feedback>保存修正后继续，或放弃这次编辑。</p>', button('放弃修改', 'col-candidate-discard', '', 'quiet') + button('继续编辑', 'col-candidate-continue') + button('保存修正', 'col-candidate-save', 'check', 'primary'));
    } else { col.edit = null; closeModal(); }
  }
  function planFor(ids, label) {
    const earlier = [], items = [];
    for (const id of ids) {
      const row = candidate(id);
      if (!row || ['imported', 'ignored'].includes(row.state)) continue;
      const type = classify(row, earlier);
      if (type.code === 'ready') earlier.push(row);
      items.push({ id, type: type.code, label: type.label, reason: type.reason, manual: row.dedup === 'review' && type.code === 'duplicate' });
    }
    return { ids, label, items, signature: JSON.stringify([ids.map(candidate), model().entries.filter(row => row.pool !== 'trash').map(row => [row.id, row.text, row.author, row.source])]) };
  }
  function previewCollection(ids, label) {
    const plan = planFor(ids, label); col.preview = plan;
    const ready = plan.items.filter(row => row.type === 'ready').length;
    const duplicates = plan.items.filter(row => row.type === 'duplicate' && !row.manual).length;
    const issues = plan.items.length - ready - duplicates;
    openModal('col-preview', '核对本批整理范围', `<p class="nx-col-range">${h(label)} · ${plan.items.length} 条准确候选</p><div class="nx-col-plan-stats"><div><strong>${ready}</strong><span>新增草稿</span></div><div><strong>${duplicates}</strong><span>重复跳过</span></div><div><strong>${issues}</strong><span>保留待处理</span></div></div><div class="nx-col-plan">${plan.items.map(item => { const row = candidate(item.id); return `<div><strong>${h(row.text.replace(/\n/g, '') || '（空白候选）')}</strong>${status(item.manual ? '重复待人工核对' : item.label, item.type === 'ready' ? 'good' : '')}<small>${h(item.reason)}</small></div>`; }).join('') || empty('没有可整理候选', '已整理、已忽略或不存在的候选不会再次处理。')}</div><p class="nx-form-help">只新增完整且不重复的内容；异常留在候选。已有内容不覆盖，本批结果支持按版本撤销。</p>`, button('返回调整', 'col-close', '', 'quiet') + button(`整理 ${ready} 条并跳过 ${duplicates} 条重复`, 'col-commit', 'check', 'primary', ready || duplicates ? '' : 'disabled'));
  }
  function commitCollection() {
    const frozen = col.preview;
    if (!frozen) return;
    const fresh = planFor(frozen.ids, frozen.label);
    if (fresh.signature !== frozen.signature) { api.notify('候选或已有内容已变化，请核对刷新后的范围。'); previewCollection(frozen.ids, frozen.label); return; }
    const before = [], added = [];
    for (const item of fresh.items) {
      const row = candidate(item.id);
      if (item.type !== 'ready' && (item.type !== 'duplicate' || item.manual)) continue;
      before.push(clone(row));
      if (item.type === 'duplicate') { row.state = 'ignored'; row.note = [row.note, '整理时识别重复，保留采集记录'].filter(Boolean).join('；'); continue; }
      const id = `col-draft-${++sequence}`;
      const entry = { id, text: row.text.trim(), author: row.author.trim(), source: row.source.trim(), pool: 'draft', category: row.category, created: '2026-11-20', entered: '2026-11-20', tags: [...row.tags], note: '虚构采集候选整理 · 本页演示', annotationConfirmed: false, protected: false, defaults: { template: 'paper', fontId: 'wenkai', imageId: model().assets.find(asset => asset.scope === '共享素材' && asset.review === '已审核')?.id || '', showDate: true, showBrand: true } };
      model().entries.push(entry); row.state = 'imported'; row.entryId = id; added.push(clone(entry));
    }
    col.undo = { before, added, after: before.map(row => clone(candidate(row.id))) };
    col.result = { title: '本批整理完成', text: `${added.length} 条已转入草稿，${before.length - added.length} 条重复已跳过，${fresh.items.length - before.length} 条保留待处理。` };
    col.selected.clear(); col.selectionMode = false; col.selectedMatching = false; col.preview = null; closeModal(); api.render(); api.notify('整理完成，可前往内容管理继续编辑。');
  }
  function undoCollection() {
    const undo = col.undo;
    if (!undo) return;
    const changed = undo.added.filter(row => JSON.stringify(model().entries.find(item => item.id === row.id)) !== JSON.stringify(row) || Object.values(model().bindings).some(binding => binding.entryId === row.id));
    const changedCandidates = undo.after.some(row => JSON.stringify(candidate(row.id)) !== JSON.stringify(row));
    if (changed.length || changedCandidates) {
      openModal('col-undo-conflict', '本批内容已有后续变化', `<p>新增草稿被编辑、安排到日期，或候选记录已变化。为保留后续工作，本批未撤销。</p>${changed.map(row => button('查看受影响草稿', 'col-open-entry', '', 'small', `data-id="${row.id}"`)).join('')}`, button('保留当前结果', 'col-close', '', 'primary'));
      return;
    }
    openModal('col-undo', '撤销本批整理', `<p>将移除本批新增的 ${undo.added.length} 条未修改草稿，并恢复 ${undo.before.length} 条候选的原状态。已有内容和其他批次保留。</p>`, button('保留结果', 'col-close', '', 'quiet') + button('确认撤销', 'col-undo-confirm', 'undo', 'primary'));
  }
  const settingTabs = [['workflow', '内容处理'], ['models', 'AI 资源池'], ['channels', '发布与资源渠道'], ['range', '有效日期范围'], ['preferences', '工作台偏好'], ['security', '账号与安全']];
  const settingsStatus = () => blockedSettingsSave() ? settingsReadStatus() : cfg.saveFailed ? '保存失败 · 修改未保存' : dirty() ? '有未保存修改' : cfg.savedAt ? `已保存 · ${cfg.savedAt}` : '未修改';
  const editorDirty = () => Boolean(cfg.editor && JSON.stringify(cfg.editor) !== cfg.editorOriginal);
  const editorStatus = () => cfg.editor?.channel === 'fonts' && !publicationReady() ? settingsReadStatus() : cfg.editorFailed ? '保存失败 · 修改未保存' : editorDirty() ? '有未保存修改' : '未修改';
  function editorFooter(action) {
    const blocked = cfg.editor?.channel === 'fonts' && !publicationReady();
    return `<span id="nx-cfg-editor-status" role="status">${editorStatus()}</span><div class="button-row">${button('放弃修改', 'cfg-editor-close', '', 'quiet', editorDirty() ? '' : 'disabled')}${button(action.startsWith('cfg-pool-') ? '应用到资源池草稿' : '保存到设置草稿', action, 'check', 'primary', editorDirty() && !blocked ? '' : 'disabled')}</div>`;
  }
  const checked = value => value ? 'checked' : '';
  const options = (rows, selected) => rows.map(([id, label]) => `<option value="${id}" ${selected === id ? 'selected' : ''}>${label}</option>`).join('');
  const configField = (label, path, type, rows) => {
    const value = path.split('.').reduce((value, key) => value[key], cfg.draft);
    const input = type === 'select' ? `<select data-cfg-path="${path}">${options(rows, value)}</select>` : `<input type="${type}" data-cfg-path="${path}" value="${h(value)}" ${type === 'text' ? 'maxlength="60"' : ''}>`;
    return field(label, input, path, cfg.errors);
  };
  function toggleRow(title, description, path) {
    const value = path.split('.').reduce((value, key) => value[key], cfg.draft);
    return `<label class="nx-cfg-toggle"><span><strong>${h(title)}</strong><small>${h(description)}</small></span><input type="checkbox" data-cfg-path="${path}" ${checked(value)}><span class="nx-cfg-toggle-ui" aria-hidden="true"></span></label>`;
  }
  const poolKinds = [['annotation', '语义标注'], ['generation', '图像生成']];
  const poolSlot = (kind, settings = cfg.draft) => settings.resourcePool[kind];
  const poolChannel = (kind, id, settings = cfg.draft) => poolSlot(kind, settings)?.channels.find(row => row.id === id);
  const poolAttrs = (kind, channelId, id = '') => `data-kind="${h(kind)}" data-channel-id="${h(channelId)}"${id ? ` data-id="${h(id)}"` : ''}`;
  const poolDirty = kind => JSON.stringify(poolSlot(kind)) !== JSON.stringify(poolSlot(kind, cfg.saved));
  const parametersDirty = kind => JSON.stringify(cfg.draft.workParameters[kind]) !== JSON.stringify(cfg.saved.workParameters[kind]);
  const poolLabel = kind => poolKinds.find(([id]) => id === kind)?.[1] || '模型';
  const aiAccess = { readState: 'ready', canEditConfig: true, safeMode: false, ...api.initialAiResourceState };
  const editablePool = () => aiAccess.readState === 'ready' && aiAccess.canEditConfig;
  const poolBaselineRevisions = Object.fromEntries(poolKinds.map(([kind]) => [kind, poolSlot(kind, cfg.saved).revision]));
  const parameterBaselines = Object.fromEntries(poolKinds.map(([kind]) => [kind, clone(cfg.saved.workParameters[kind])]));
  const poolDisclosures = new Map();
  function rememberPoolDisclosures() {
    for (const node of document.querySelectorAll('[data-cfg-work-parameters], [data-cfg-pool-history], [data-cfg-pool-prompts], [data-cfg-style-editor]')) {
      const key = node.dataset.cfgWorkParameters ? `parameters-${node.dataset.cfgWorkParameters}` : node.dataset.cfgPoolHistory ? `history-${node.dataset.cfgPoolHistory}` : node.dataset.cfgStyleEditor ? `style-${node.dataset.cfgStyleEditor}` : 'prompts';
      poolDisclosures.set(key, node.open);
    }
  }
  const priorityOrder = rows => [...rows].sort((a, b) => a.priority - b.priority);
  const normalizePriorities = rows => rows.forEach((row, index) => { row.priority = index + 1; });
  const sameSavedChannel = (kind, id) => JSON.stringify(poolChannel(kind, id)) === JSON.stringify(poolChannel(kind, id, cfg.saved));
  const demoEndpoint = value => {
    try {
      if (typeof value !== 'string' || /[\s\\]/u.test(value)) return '';
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.hostname.endsWith('.example.test')) return '';
      return url.href.replace(/\/+$/, '');
    } catch { return ''; }
  };
  const savedPoolConnection = (kind, id) => {
    const channel = poolChannel(kind, id), saved = poolChannel(kind, id, cfg.saved);
    const endpoint = demoEndpoint(saved?.baseUrl);
    return Boolean(editablePool() && !aiAccess.safeMode && endpoint && saved?.keyStored && channel && endpoint === demoEndpoint(channel.baseUrl) && !channel.sampleKeyPending && !channel.removeApiKey && poolBaselineRevisions[kind] === poolSlot(kind, cfg.saved).revision);
  };
  function poolFocus(action, kind, channelId = '', id = '') {
    const find = name => [...document.querySelectorAll(`[data-action="${name}"][data-kind="${kind}"]`)].find(node => (!channelId || node.dataset.channelId === channelId) && (!id || node.dataset.id === id));
    let target = find(action);
    if (target?.disabled && channelId) target = find(id ? 'cfg-pool-model-edit' : 'cfg-pool-channel-edit');
    const more = target?.closest?.('.nx-ai-pool-more'); if (more) more.open = true;
    target?.focus?.({ preventScroll: true }); target?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
  }
  function poolAvailabilityText(kind, channelId, modelId) {
    const channel = poolChannel(kind, channelId, cfg.saved);
    const row = model().demoAiAvailability?.[kind]?.candidates?.find(row => row.channelId === channelId && row.model === modelId && (row.channelRevision === undefined || row.channelRevision === channel?.channelRevision));
    if (!row || row.available !== false) return '';
    const reason = { 'quota-exhausted': '额度耗尽', 'auth-invalid': '凭据不可用', 'endpoint-unavailable': '接口不可用', 'model-unavailable': '模型不可用', 'rate-limited': '渠道短暂限流' }[row.reason] || '暂不可用';
    return `${reason} · ${row.retryAt ? '冷却时暂缓使用' : '本机已跳过'} · 模拟`;
  }
  function reorderPool(rows, id, priority) {
    const sorted = priorityOrder(rows), index = sorted.findIndex(row => row.id === id);
    if (index < 0 || !Number.isInteger(priority) || priority < 1 || priority > sorted.length) return false;
    const [row] = sorted.splice(index, 1); sorted.splice(priority - 1, 0, row); normalizePriorities(sorted);
    rows.splice(0, rows.length, ...sorted); cfg.saveFailed = false; return true;
  }
  function poolSavebar(kind, parameters = false) {
    const changed = parameters ? parametersDirty(kind) : poolDirty(kind), state = (parameters ? cfg.parameterStates : cfg.poolStates)[kind];
    const description = changed ? state === 'failed' ? '保存失败 · 草稿保留' : '有未保存修改' : state === 'saved' ? '已保存' : '未修改';
    return `<div class="nx-cfg-savebar nx-ai-pool-savebar" data-cfg-${parameters ? 'parameters' : 'pool'}-savebar="${kind}"><span role="status" data-cfg-${parameters ? 'parameters' : 'pool'}-status="${kind}">${parameters ? '工作参数' : '渠道与模型'} · ${description}</span><div class="button-row">${button('放弃修改', parameters ? 'cfg-parameters-discard' : 'cfg-pool-discard', '', 'quiet small', `data-kind="${kind}"${changed ? '' : ' disabled'}`)}${button(`保存${kind === 'annotation' ? '标注' : '生图'}${parameters ? '工作参数' : '资源池'}`, parameters ? 'cfg-parameters-save' : 'cfg-pool-save', 'check', 'primary small', `data-kind="${kind}"${changed && editablePool() ? '' : ' disabled'}`)}</div></div>`;
  }
  function poolParameters(kind) {
    const values = cfg.draft.workParameters[kind], prefix = `parameters.${kind}.`;
    const parameter = (label, name, attrs = '', textarea = false) => field(label, textarea ? `<textarea name="${name}" data-cfg-parameter="${name}" data-kind="${kind}" rows="4" maxlength="4000">${h(values[name])}</textarea>` : `<input name="${name}" data-cfg-parameter="${name}" data-kind="${kind}" value="${h(values[name])}" ${attrs}>`, prefix + name, cfg.errors);
    return `<details class="nx-ai-pool-parameters" data-cfg-work-parameters="${kind}"><summary><span><strong>工作参数${kind === 'generation' ? '与生图提示词' : ''}</strong><small>${kind === 'generation' ? `${h(values.size)} · 每句 ${h(values.countPerItem)} 张` : `每批 ${h(values.batchSize)} 句 · 最多 ${h(values.maxBatchChars)} 字符`} · 并发 ${h(values.concurrency)}${parametersDirty(kind) ? ' · 未保存' : ''}</small></span><span aria-hidden="true">⌄</span></summary><form data-cfg-parameters="${kind}"><p class="nx-form-help">作用于本用途的所有渠道，独立保存。新任务采用已保存参数。</p>${kind === 'generation' ? `<section class="nx-cfg-form-section"><h3>配图设置</h3><div class="field-grid">${parameter('尺寸', 'size', 'maxlength="1000" placeholder="按模型支持的尺寸填写"')}${parameter('每句张数', 'countPerItem', 'type="number" min="1" max="4" step="1"')}</div>${field('默认配图风格', `<select name="imageStyle" data-cfg-parameter="imageStyle" data-kind="${kind}">${options(IMAGE_GENERATION_STYLES.map(style => [style.id, style.name]), values.imageStyle)}</select>`, prefix + 'imageStyle', cfg.errors)}<details class="nx-cfg-details nx-ai-pool-prompts" data-cfg-pool-prompts><summary>编辑两套风格提示词</summary><div>${IMAGE_GENERATION_STYLES.map(style => `<details class="nx-ai-style-editor" data-cfg-style-editor="${style.id}"${style.id === values.imageStyle ? ' open' : ''}><summary>${h(style.name)}</summary>${parameter('画面转换指令', style.instructionField, '', true)}<p class="nx-form-help">先由标注资源池把句意转为具体画面。</p>${parameter('画风提示词', style.prefixField, '', true)}<p class="nx-form-help">与具体画面一起发送给生图模型；切换风格保留另一套修改。</p></details>`).join('')}</div></details></section>` : ''}<section class="nx-cfg-form-section"><h3>调用参数</h3><div class="field-grid">${parameter('并发', 'concurrency', 'type="number" min="1" max="8" step="1"')}${parameter('超时（毫秒）', 'timeoutMs', 'type="number" min="1000" max="600000" step="1"')}${kind === 'annotation' ? `${parameter('温度', 'temperature', 'type="number" min="0" max="2" step="0.1"')}${parameter('每批句数', 'batchSize', 'type="number" min="1" max="50" step="1"')}${parameter('每批最多字符', 'maxBatchChars', 'type="number" min="1" max="12000" step="1"')}` : ''}</div></section>${poolSavebar(kind, true)}</form></details>`;
  }
  function poolModelsPage() {
    return `<div class="nx-cfg-section-head"><div><h2>模型服务 / AI 资源池</h2><p>先按渠道，再按渠道内模型选择。优先级 1 最高，明确失败后使用下一候选。</p></div>${button('查看 AI 任务', 'cfg-open-ai', 'right', 'small')}</div>
      <div class="nx-ai-pool-tabs" role="tablist" aria-label="模型用途">${poolKinds.map(([kind, label]) => button(label, 'cfg-pool-purpose', '', '', `data-kind="${kind}" id="nx-pool-tab-${kind}" role="tab" aria-controls="nx-pool-panel-${kind}" aria-selected="${cfg.poolKind === kind}" tabindex="${cfg.poolKind === kind ? 0 : -1}"`)).join('')}</div>
      ${aiAccess.readState !== 'ready' ? `<p class="nx-form-error" role="alert">${aiAccess.readState === 'loading' ? '正在读取资源池…' : '模型配置或资源池读取失败，草稿保留；请刷新后重试，读取成功前不能修改或保存。'}</p>` : !aiAccess.canEditConfig ? '<div class="notice">当前配置只读，请核对访问地址与登录权限。</div>' : ''}${aiAccess.safeMode ? '<div class="notice">隔离模式：可手动保存配置，模型检测和联网任务已禁用。</div>' : ''}
      <div class="nx-ai-pool-slots">${poolKinds.map(([kind, label]) => {
        const channels = priorityOrder(poolSlot(kind).channels), candidates = studioAiCandidates(cfg.draft.resourcePool, kind), savedCandidates = studioAiCandidates(cfg.saved.resourcePool, kind), ready = studioAiCandidates(cfg.saved.resourcePool, kind, model().demoAiAvailability || {});
        if (!Object.hasOwn(cfg.openChannels, kind)) cfg.openChannels[kind] = channels[0]?.id || '';
        return `<section class="nx-ai-pool-slot" data-ai-pool-kind="${kind}" id="nx-pool-panel-${kind}" role="tabpanel" aria-labelledby="nx-pool-tab-${kind}"${cfg.poolKind === kind ? '' : ' hidden'}><div class="nx-ai-pool-overview"><div><span>草稿优先候选</span><strong>${h(candidates.length ? `${candidates[0].channelName} / ${candidates[0].model}` : '暂无启用候选')}</strong></div><dl><div><dt>渠道</dt><dd>${channels.length}<small> / 8</small></dd></div><div><dt>启用候选</dt><dd>${candidates.length}</dd></div><div><dt>已保存本机可用</dt><dd>${ready.length}<small> / ${savedCandidates.length}</small></dd></div></dl></div><div class="nx-ai-pool-list-head"><div><h3>${label}渠道</h3><p>按优先级排列 · 本机可用状态来自已有记录</p></div>${button('新增渠道', 'cfg-pool-channel-new', 'plus', 'small', `data-kind="${kind}"${channels.length >= 8 || !editablePool() ? ' disabled' : ''}`)}</div>
          ${channels.length ? channels.map(channel => {
            const models = priorityOrder(channel.models), attrs = poolAttrs(kind, channel.id), expanded = cfg.openChannels[kind] === channel.id, unavailable = models.map(row => poolAvailabilityText(kind, channel.id, row.id)).find(Boolean);
            return `<article class="nx-ai-pool-channel${expanded ? ' is-expanded' : ''}" data-ai-pool-channel="${h(channel.id)}"><header><span class="nx-ai-pool-number" aria-label="渠道优先级 ${channel.priority}">${channel.priority}</span><div class="nx-ai-pool-channel-info"><strong>${h(channel.name)}</strong>${status(channel.enabled ? '已启用' : '已停用', channel.enabled ? 'good' : '')}<p>${models.length} 个模型 · ${channel.sampleKeyPending ? '新示例密钥待保存' : channel.removeApiKey ? '密钥待移除' : channel.keyStored ? '密钥已保存 · 尚未联网验证' : '未配置密钥'}${sameSavedChannel(kind, channel.id) ? '' : ' · 未保存'}${unavailable ? `<span class="nx-ai-route-warning">${h(unavailable)}</span>` : ''}</p></div><div class="button-row">${button(expanded ? '收起模型' : '管理模型', 'cfg-pool-channel-models', '', 'quiet small', `${attrs} aria-expanded="${expanded}" aria-controls="nx-models-${kind}-${h(channel.id)}" aria-label="${h(channel.name)}的模型列表"`)}${button('编辑渠道', 'cfg-pool-channel-edit', '', 'small', `${attrs} aria-label="编辑${h(channel.name)}"${editablePool() ? '' : ' disabled'}`)}<details class="nx-ai-pool-more"><summary aria-label="${h(channel.name)}的更多操作">更多</summary><div>${button('上移', 'cfg-pool-channel-up', '', 'quiet small', `${attrs} aria-label="提高${h(channel.name)}的优先级"${channel.priority === 1 || !editablePool() ? ' disabled' : ''}`)}${button('下移', 'cfg-pool-channel-down', '', 'quiet small', `${attrs} aria-label="降低${h(channel.name)}的优先级"${channel.priority === channels.length || !editablePool() ? ' disabled' : ''}`)}${button('删除渠道', 'cfg-pool-channel-delete', '', 'quiet small', `${attrs}${editablePool() ? '' : ' disabled'}`)}</div></details></div></header>
              <section class="nx-ai-pool-model-section" id="nx-models-${kind}-${h(channel.id)}"${expanded ? '' : ' hidden'}><div class="nx-ai-pool-model-head"><h4>渠道模型 <small>${models.length} / 64</small></h4><div class="button-row">${button('手动添加', 'cfg-pool-model-new', 'plus', 'small', `${attrs}${models.length >= 64 || !editablePool() ? ' disabled' : ''}`)}${button('检测模型', 'cfg-pool-detect', 'search', 'quiet small', `${attrs}${savedPoolConnection(kind, channel.id) ? '' : ' disabled'}`)}</div></div>${models.length ? `<ol class="nx-ai-pool-models">${models.map(row => `<li data-ai-pool-model="${h(row.id)}"><span class="nx-ai-pool-model-number" aria-label="模型优先级 ${row.priority}">${row.priority}</span><div class="nx-ai-pool-model-info"><strong>${h(row.id)}</strong><small>${row.source === 'detected' ? '检测添加' : '手动添加'}${poolAvailabilityText(kind, channel.id, row.id) ? ` · <span class="nx-ai-route-warning">${h(poolAvailabilityText(kind, channel.id, row.id))}</span>` : ''}</small></div><label class="nx-ai-pool-enable"><input type="checkbox" data-cfg-model-enabled="${h(row.id)}" data-kind="${kind}" data-channel-id="${h(channel.id)}"${checked(row.enabled) ? ' checked' : ''}${editablePool() ? '' : ' disabled'} aria-label="启用 ${h(row.id)}">启用</label><div class="button-row">${button('编辑', 'cfg-pool-model-edit', '', 'quiet small', `${poolAttrs(kind, channel.id, row.id)} aria-label="编辑 ${h(row.id)}"${editablePool() ? '' : ' disabled'}`)}<details class="nx-ai-pool-more"><summary aria-label="${h(row.id)}的更多操作">更多</summary><div>${button('上移', 'cfg-pool-model-up', '', 'quiet small', `${poolAttrs(kind, channel.id, row.id)} aria-label="提高 ${h(row.id)} 的优先级"${row.priority === 1 || !editablePool() ? ' disabled' : ''}`)}${button('下移', 'cfg-pool-model-down', '', 'quiet small', `${poolAttrs(kind, channel.id, row.id)} aria-label="降低 ${h(row.id)} 的优先级"${row.priority === models.length || !editablePool() ? ' disabled' : ''}`)}${button('删除模型', 'cfg-pool-model-delete', '', 'quiet small', `${poolAttrs(kind, channel.id, row.id)}${editablePool() ? '' : ' disabled'}`)}</div></details></div></li>`).join('')}</ol>` : empty('这个渠道还没有模型', '手动填写已知模型 ID，或保存接口和密钥后检测。')}<p class="nx-form-help">${savedPoolConnection(kind, channel.id) ? '检测仅预览候选；确认合并后新增模型默认停用，再保存资源池生效。' : '检测使用已保存接口与密钥；新接口或密钥修改须先保存。'}</p></section></article>`;
          }).join('') : empty('还没有渠道', '新增渠道后可先保存接口与密钥，再手动添加模型或检测。')}${poolSavebar(kind)}<div class="nx-ai-pool-secondary-actions">${button('恢复优先渠道', 'cfg-pool-availability-reset', 'undo', 'quiet small', `data-kind="${kind}"${editablePool() ? '' : ' disabled'}`)}<small>只清除本机暂不可用记录，不查询余额或检测模型。</small></div>${poolParameters(kind)}<details class="nx-ai-pool-history" data-cfg-pool-history="${kind}"><summary>历史兼容配置与导入</summary><p class="nx-form-help">导入本用途当前兼容配置及全部历史，按完整接口地址归为渠道。已有模型设置和顺序保留；导入会保存资源池。</p>${button('将当前与全部历史导入资源池', 'cfg-pool-import', '', 'small', `data-kind="${kind}"${poolDirty(kind) || !editablePool() ? ' disabled' : ''}`)}<p class="nx-form-help">资源池有草稿时，请先保存或放弃；无需手动切换历史配置。</p></details></section>`;
      }).join('')}</div>
      ${technicalNotes('原型演示与配置说明', '本页渠道、地址与结果均为虚构，只允许 .example.test 示例地址，不接收真实密钥。配置、检测、导入和任务全部在本页内存中演示。实际后台独立保存各用途资源池和工作参数，配置变更会使关联任务需要重新预演；已有产物与原请求记录保留。')}`;
  }
  const routingRows = kind => cfg.draft.routing.channels[kind];
  const routingBase = (kind, providerId) => routingRows(kind).find(row => row.providerId === providerId)?.baseUrl || '';
  function installedFontOrigin() {
    const fonts = routingUpgrade?.draft?.channels?.fonts;
    return Array.isArray(fonts) ? fonts.find(row => row.providerId === 'uploadthing')?.baseUrl || '' : '';
  }
  const canUpgradeRouting = () => Boolean(routingUpgrade?.available && routingUpgrade.targetSchemaVersion === 3 && [1, 2].includes(cfg.draft.routing.schemaVersion) && installedFontOrigin() && !routingRows('fonts').some(row => row.providerId === 'uploadthing'));
  function routingList(kind) {
    const rows = routingRows(kind);
    return `<ol class="nx-cfg-route-list" data-cfg-route-list="${kind}">${rows.map((row, index) => {
      const name = h(routeProviders[row.providerId] || row.providerId), attrs = `data-kind="${kind}" data-id="${h(row.providerId)}"`;
      return `<li data-cfg-route-provider="${h(row.providerId)}"><span class="nx-cfg-route-number">${index + 1}</span><div><strong>${name}</strong><small>${index === 0 ? '默认首选' : '失败后回退'}${row.providerId === 'uploadthing' ? ' · 仅采用匹配的逐对象回执' : ''}</small></div><div class="button-row">${button('上移', 'cfg-route-up', '', 'quiet small', `${attrs} aria-label="上移${name}"${index === 0 || !publicationReady() ? ' disabled' : ''}`)}${button('下移', 'cfg-route-down', '', 'quiet small', `${attrs} aria-label="下移${name}"${index === rows.length - 1 || !publicationReady() ? ' disabled' : ''}`)}</div></li>`;
    }).join('')}</ol>`;
  }
  function routingPage() {
    const installed = installedFontOrigin(), pending = installed && !routingRows('fonts').some(row => row.providerId === 'uploadthing');
    const compatibilityAdded = cfg.saved.routing.schemaVersion === 1 && cfg.draft.routing.schemaVersion === 3 && !cfg.saved.routing.channels.images.some(row => row.providerId === 'wechat-material');
    const disabled = publicationReady() ? '' : ' disabled';
    const baseInput = (key, label, value) => field(label, `<input type="url" data-cfg-route-base="${key}" value="${h(value)}" maxlength="2048" autocomplete="off" spellcheck="false"${disabled}>`, `routing.${key}`, cfg.errors);
    const ipicInput = routingRows('images').some(row => row.providerId === 'ipic') ? baseInput('ipic', 'ipic 图片 baseUrl', routingBase('images', 'ipic')) : '';
    return `<section class="nx-cfg-routing" data-cfg-routing aria-label="高级资源选路"><div class="nx-cfg-section-head"><div><h3>高级资源选路</h3><p>编辑默认来源顺序，保存为本机路由草稿；完成资源发布后才供客户端发现。</p></div>${status(`草稿版本 ${cfg.draft.routing.schemaVersion}`)}</div><div class="nx-cfg-routing-grid">${[['images', '图片来源', '有效缓存优先，下载失败后按顺序回退。'], ['fonts', '字体来源', '各渠道使用相同批准 TTF 字节与完整许可；缺少匹配回执时略过 UploadThing。']].map(([kind, title, hint]) => `<section><h4>${title}</h4><p>${hint}</p>${routingList(kind)}${kind === 'images' && compatibilityAdded ? '<p class="nx-form-help" data-cfg-route-compatibility>升级已补入公众号图片兼容渠道，原有图片渠道相对顺序保留；仍需保存设置。</p>' : ''}${kind === 'fonts' && pending ? `<div class="nx-cfg-route-installed" data-cfg-route-installed="uploadthing"><div><strong>UploadThing</strong>${status('已安装 · 尚未加入草稿', 'warn')}<p>安装来源已可见；加入后排在字体首位，保留原有渠道相对顺序。${cfg.draft.routing.schemaVersion === 1 ? '旧草稿升级时同步补入公众号图片兼容渠道。' : ''}</p></div>${button('加入 UploadThing 字体渠道', 'cfg-route-upgrade', 'plus', 'small', canUpgradeRouting() && publicationReady() ? '' : 'disabled')}</div>` : ''}</section>`).join('')}</div>
      <details class="nx-cfg-routing-bases" data-cfg-routing-bases><summary>高级：公开基址</summary><p>AxureShow 根地址由图片与字体共用；这里演示本地编辑，正式后台仍核验安装配置与合法域名。</p><div class="field-grid">${baseInput('authorityRoot', 'AxureShow 公开根地址（图片与字体共用）', cfg.draft.routing.authorityRoot)}${ipicInput}${baseInput('imageMirror', 'GitHub 镜像图片 baseUrl', routingBase('images', 'github-mirror'))}${baseInput('fontMirror', 'GitHub 镜像字体 baseUrl', routingBase('fonts', 'github-mirror'))}${installed ? `<label class="field nx-cfg-uploadthing-origin"><span>UploadThing 已安装来源</span><input type="url" value="${h(installed)}" readonly aria-label="UploadThing 已安装公开来源"><small>逐字体采用已核验的 /f/对象 key 直链；不由公开基址拼接目录。</small></label>` : ''}</div>${!installed ? '<p class="nx-form-help" data-cfg-routing-no-install>当前演示安装未提供 UploadThing 公开来源，不能加入字体路由。</p>' : ''}</details>
      <p class="nx-form-help" data-cfg-routing-state>${routingDraftChanged() ? '路由有未保存修改；加入渠道和调整优先级还需点击「保存设置」。' : '读取设置不会升级旧草稿；加入渠道后仍需点击「保存设置」。'}</p><details class="nx-cfg-details"><summary>查看路由草稿 JSON（只读）</summary><pre class="nx-cfg-route-json"><code data-cfg-routing-preview>${h(JSON.stringify(cfg.draft.routing, null, 2))}</code></pre></details></section>`;
  }
  function syncSettingsDraftControls() {
    const node = $('#nx-cfg-save-status'); if (node) node.textContent = settingsStatus();
    $('.nx-cfg [data-action="cfg-save"]')?.toggleAttribute?.('disabled', !dirty() || blockedSettingsSave());
    $('.nx-cfg [data-action="cfg-cancel"]')?.toggleAttribute?.('disabled', !dirty());
    for (const [kind] of poolKinds) {
      const values = cfg.draft.workParameters[kind], summary = $(`[data-cfg-work-parameters="${kind}"]`)?.querySelector?.('summary small');
      if (summary) summary.textContent = `${kind === 'generation' ? `${values.size} · 每句 ${values.countPerItem || '默认'} 张` : `每批 ${values.batchSize || '默认'} 句 · 最多 ${values.maxBatchChars || '默认'} 字符`} · 并发 ${values.concurrency || '默认'}${parametersDirty(kind) ? ' · 未保存' : ''}`;
      for (const parameters of [false, true]) {
        const changed = parameters ? parametersDirty(kind) : poolDirty(kind), state = (parameters ? cfg.parameterStates : cfg.poolStates)[kind], scope = parameters ? 'parameters' : 'pool';
        const statusNode = $(`[data-cfg-${scope}-status="${kind}"]`);
        if (statusNode) statusNode.textContent = `${parameters ? '工作参数' : '渠道与模型'} · ${changed ? state === 'failed' ? '保存失败 · 草稿保留' : '有未保存修改' : state === 'saved' ? '已保存' : '未修改'}`;
        $(`[data-action="cfg-${scope}-save"][data-kind="${kind}"]`)?.toggleAttribute?.('disabled', !changed || !editablePool());
        $(`[data-action="cfg-${scope}-discard"][data-kind="${kind}"]`)?.toggleAttribute?.('disabled', !changed);
      }
      $(`[data-action="cfg-pool-import"][data-kind="${kind}"]`)?.toggleAttribute?.('disabled', poolDirty(kind) || !editablePool());
    }
  }
  function setRoutingBase(key, value) {
    if (!publicationReady()) return;
    const lookup = { ipic: ['images', 'ipic'], imageMirror: ['images', 'github-mirror'], fontMirror: ['fonts', 'github-mirror'] };
    if (key === 'authorityRoot') {
      cfg.draft.routing.authorityRoot = value;
      for (const kind of ['images', 'fonts']) for (const row of routingRows(kind)) if (row.providerId === 'axxiu') row.baseUrl = value;
    } else {
      const where = lookup[key], row = where && routingRows(where[0]).find(row => row.providerId === where[1]);
      if (!row) return; row.baseUrl = value;
    }
    delete cfg.errors[`routing.${key}`]; cfg.saveFailed = false; syncSettingsDraftControls();
    const preview = $('[data-cfg-routing-preview]'); if (preview) preview.textContent = JSON.stringify(cfg.draft.routing, null, 2);
    const state = $('[data-cfg-routing-state]'); if (state) state.textContent = routingDraftChanged() ? '路由有未保存修改；加入渠道和调整优先级还需点击「保存设置」。' : '读取设置不会升级旧草稿；加入渠道后仍需点击「保存设置」。';
  }
  function renderRoutingChange(action, kind, providerId) {
    const basesOpen = $('[data-cfg-routing-bases]')?.open === true;
    cfg.saveFailed = false; api.render();
    if (basesOpen && $('[data-cfg-routing-bases]')) $('[data-cfg-routing-bases]').open = true;
    $(`[data-action="${action}"][data-kind="${kind}"][data-id="${providerId}"]`)?.focus({ preventScroll: true });
  }
  function upgradeRoutingDraft() {
    if (!publicationReady() || !canUpgradeRouting()) return;
    if (!routingRows('images').some(row => row.providerId === 'wechat-material')) routingRows('images').unshift({ providerId: 'wechat-material', baseUrl: 'https://mmbiz.qpic.cn' });
    cfg.draft.routing.schemaVersion = 3;
    routingRows('fonts').unshift({ providerId: 'uploadthing', baseUrl: installedFontOrigin() });
    renderRoutingChange('cfg-route-down', 'fonts', 'uploadthing');
    api.notify('UploadThing 已加入字体草稿首位；公开基址和原渠道顺序已保留，请点击「保存设置」。', { tone: 'success' });
  }
  function moveRoutingDraft(kind, id, direction) {
    if (!publicationReady() || !['images', 'fonts'].includes(kind)) return;
    const rows = routingRows(kind), index = rows.findIndex(row => row.providerId === id), next = index + direction;
    if (index < 0 || next < 0 || next >= rows.length) return;
    [rows[index], rows[next]] = [rows[next], rows[index]];
    renderRoutingChange(direction < 0 ? 'cfg-route-down' : 'cfg-route-up', kind, id);
  }
  function routingErrors() {
    const pairs = [['authorityRoot', cfg.draft.routing.authorityRoot], ['imageMirror', routingBase('images', 'github-mirror')], ['fontMirror', routingBase('fonts', 'github-mirror')]];
    if (routingRows('images').some(row => row.providerId === 'ipic')) pairs.push(['ipic', routingBase('images', 'ipic')]);
    for (const [key, value] of pairs) {
      try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || /^https:\/\/[^/]*@/i.test(url.href) || url.search || url.hash || /[\s\u0000-\u001f]/.test(value)) throw new Error('INVALID_PUBLIC_BASE');
      } catch { cfg.errors[`routing.${key}`] = '请填写不含凭据、查询参数或片段的完整 HTTPS 公开基址。'; }
    }
  }
  function fontResourceCard() {
    const fonts = (api.getCatalog?.()?.fonts || []).filter(row => row.id !== 'system');
    const builtinIds = new Set(fontCatalog.map(row => row.id));
    const newFonts = fonts.filter(row => !builtinIds.has(row.id));
    const pending = !fontResourceDemo.imported && ['available', 'blocked'].includes(fontResourceDemo.scenario);
    const blocked = fontResourceDemo.scenario === 'blocked', failed = fontResourceDemo.scenario === 'failed';
    const addedBytes = newFonts.reduce((sum, row) => sum + (Number.isSafeInteger(row.nativeBytes) ? row.nativeBytes : 0), 0);
    return `<section class="nx-cfg-font-resources" data-cfg-font-resources><div class="nx-cfg-section-head"><h3>生产字体资源</h3>${status(failed ? '读取失败 · 演示' : blocked ? '资源冲突待处理 · 演示' : pending ? `可导入 ${newFonts.length} 款 · 演示` : '本机已就绪 · 演示', pending || failed ? 'warn' : 'good')}</div><p>查看程序提供的正式字体，显式导入到本机后再到发布中心发布资源。</p><dl class="nx-definition"><dt>本机已安装 · 示例</dt><dd>${pending ? fonts.length - newFonts.length : fonts.length} 款</dd><dt>程序提供</dt><dd>${fonts.length} 款</dd>${pending ? `<dt>本次新增 · 示例</dt><dd>${newFonts.length} 款${addedBytes ? ` · ${(addedBytes / 1_000_000).toFixed(2)} MB TTF` : ''}</dd>` : ''}</dl><details><summary>查看共享批准字体</summary><ul>${fonts.map(row => `<li>${h(row.name)} · ${pending && !builtinIds.has(row.id) ? '可导入 · 示例' : '已安装 · 示例'}</li>`).join('')}</ul></details>${blocked ? '<p class="nx-form-error" role="alert">同名字体身份不一致，请核对批准资源清单后刷新；本页不覆盖冲突文件。</p>' : ''}${failed ? '<p class="nx-form-error" role="alert">生产字体资源读取失败，请点击「重试读取」重试；读取成功前不能导入。</p>' : ''}${fontResourceDemo.error ? `<p class="nx-form-error" role="alert">${h(fontResourceDemo.error)}</p>` : ''}${fontResourceDemo.imported ? '<p role="status">新增字体已导入本机 · 演示。正式后台需先保存当前输入，再刷新后台页面更新字体菜单，并到发布中心发布资源；本机就绪不代表远端已发布。</p>' : '<p class="nx-form-help">只使用共享目录展示实际字体名称；安装数量与导入结果为内存演示，未读写真实工作库。</p>'}<label class="field"><span>安装状态演示</span><select id="cfg-font-resource-scenario">${options([['current', '新安装 · 已就绪'], ['available', '旧安装 · 可导入新款'], ['blocked', '字体身份冲突'], ['failed', '读取失败']], fontResourceDemo.scenario)}</select></label><div class="button-row">${button(failed ? '重试读取 · 模拟' : '刷新字体状态 · 模拟', 'cfg-font-resource-refresh', '', 'small')}${button('导入新增字体到本机 · 模拟', 'cfg-font-resource-import', 'plus', 'primary small', !pending || blocked || !newFonts.length ? 'disabled' : '')}${button('前往发布中心', 'cfg-open-font-delivery', 'right', 'quiet small')}</div></section>`;
  }
  function syncFontResourceCard() {
    const current = $('[data-cfg-font-resources]');
    if (!current) return;
    const markup = fontResourceCard();
    current.innerHTML = markup.slice(markup.indexOf('>') + 1, markup.lastIndexOf('</section>'));
    const scenario = current.querySelector('#cfg-font-resource-scenario');
    if (scenario) scenario.onchange = () => {
      if (!['current', 'available', 'blocked', 'failed'].includes(scenario.value)) return;
      fontResourceDemo = { scenario: scenario.value, imported: false, error: '' }; syncFontResourceCard();
    };
  }
  function settingsBody() {
    if (cfg.tab === 'security') return `<h2>账号与安全</h2><p>管理员登录需要明确的等待与恢复反馈。这里使用禁用的示例密码，只演示页面状态。</p><div class="nx-cfg-reset-row"><div><strong>登录反馈预览</strong><p>检查登录中、密码错误、限流、服务不可用与网络中断；不会连接真实登录接口。</p></div>${button('预览登录页', 'cfg-login-preview', 'right', 'small')}</div>${technicalNotes('安全与验证范围', '真实密码输入已禁用，模拟不会改变登录状态或账号。网络与服务错误保留示例输入，重新尝试需要点击按钮。')}`;
    if (cfg.tab === 'workflow') return `<h2>内容处理</h2><p>处理方式用于批量流程与自动任务。新增和编辑内容始终需要点击保存。</p><div class="field-grid">${configField('处理方式', 'workflow.mode', 'select', [['auto', '自动推进批量步骤'], ['manual', '人工分步处理']])}${configField('复核方式', 'workflow.review', 'select', [['rules', '系统规则复核'], ['manual', '人工逐条复核']])}</div>${toggleRow('保护人工标签', '自动任务保留已确认的人工标签。', 'workflow.protectLabels')}${toggleRow('保护已锁定配图', '自动配图不会替换明确锁定的素材。', 'workflow.protectImages')}${toggleRow('整理前检查重复', '检查正文及出处，冲突保留人工处理。', 'workflow.deduplicate')}<div class="notice">系统规则结果与人工确认分别表达；本页设置仅影响共享演示偏好，不生成真实审核证据。</div>`;
    if (cfg.tab === 'models') return poolModelsPage();
    if (cfg.tab === 'channels') return `<h2>发布与资源渠道</h2><p>先核对保存的渠道配置和当前会话；发布条件请到发布中心重新预演。</p>${settingsReadNotice()}${fontResourceCard()}<div class="nx-cfg-channel-tabs">${[['images', '图床'], ['wechat', '公众号'], ['resources', '资源分发'], ['fonts', 'UploadThing 字体上传']].map(([id, label]) => `<section data-cfg-channel-card="${id}"><div class="nx-cfg-section-head"><h3>${label}</h3>${status(id === 'fonts' && !publicationReady() ? fontAccountReadStatus() : cfg.draft.channels[id].enabled ? '演示启用' : '演示停用', id === 'fonts' && !publicationReady() ? 'warn' : cfg.draft.channels[id].enabled ? 'good' : '')}</div><p>${h(cfg.draft.channels[id].name)}</p><small>${id === 'fonts' ? `生产 TTF · 逐字体公开直链 · 示例 Token${cfg.draft.channels.fonts.sampleToken ? '已配置' : '未配置'}` : `${h(cfg.draft.channels[id].namespace)} · ${h(cfg.draft.channels[id].provider)}`}</small><div class="button-row">${button('编辑配置', 'cfg-channel-edit', '', 'small', `data-id="${id}"${id === 'fonts' && !publicationReady() ? ' disabled' : ''}`)}${id === 'fonts' ? button('前往发布中心', 'cfg-open-font-delivery', 'right', 'quiet small') : button('模拟连通测试', 'cfg-channel-test', '', 'quiet small', `data-id="${id}"`)}</div></section>`).join('')}</div>${routingPage()}<div class="notice">公众号操作停在草稿；图床、整包资源与字体上传分别配置，修改后需保存设置。UploadThing 只登记生产 TTF 的已核验直链，完整许可继续随公开包分发。</div>${technicalNotes('示例账号与远端操作边界', '正式后台在这里查看保存账号和当前会话；整包校验与发布预演在发布中心完成，页面读取不登录或查询远端。UploadThing Token 加密保存在后台所在设备，上传时独立核验。本原型不接受真实账号或密钥，不上传，不发起远端请求。模拟连通结果不能替代真实账号、字节与发布验收。')}`;
    if (cfg.tab === 'range') {
      const outside = Object.keys(model().bindings).filter(date => date < cfg.draft.range.start || date > cfg.draft.range.end);
      return `<h2>内容有效日期范围</h2><p>先预演范围外日期，再确认保存到本页共享排期模型。真实后台核对日期配置与排期版本，保存不自动构建或发布。</p><div class="field-grid">${configField('开始日期', 'range.start', 'date')}${configField('结束日期', 'range.end', 'date')}</div><div class="notice ${outside.length ? 'warn' : ''}">当前已安排 ${Object.keys(model().bindings).length} 天；新范围外有 ${outside.length} 天。范围变更保留这些绑定，不覆盖、删除或补齐内容。</div><div class="nx-cfg-current-range"><span>当前已保存范围</span><strong>${h(cfg.saved.range.start)} — ${h(cfg.saved.range.end)}</strong>${button('查看内容排期', 'cfg-open-schedule', 'arrow', 'quiet small')}</div>`;
    }
    return `<h2>工作台偏好</h2><p>调整工作空间的阅读密度和常用入口。真实后台偏好保存在当前浏览器，减少动效偏好优先。</p><div class="field-grid">${configField('界面密度', 'preferences.density', 'select', [['comfortable', '舒适留白'], ['compact', '紧凑列表']])}${configField('默认打开页面', 'preferences.startPage', 'select', [['review', '内容管理'], ['collect', '采集候选'], ['schedule', '内容排期']])}</div>${toggleRow('显示操作提示', '为当前步骤显示简短的说明。', 'preferences.hints')}${toggleRow('界面过渡动效', '减少动效偏好仍优先生效。', 'preferences.motion')}<div class="nx-cfg-reset-row"><div><strong>恢复默认偏好</strong><p>仅恢复本页界面偏好，不改变内容、候选或排期。</p></div>${button('恢复默认', 'cfg-preferences-reset', 'undo', 'small')}</div><div class="nx-cfg-reset-row"><div><strong>重置本页设置演示</strong><p>恢复此模块最初的示例配置；保存后同步初始有效日期范围。</p></div>${button('重置设置', 'cfg-reset', '', 'quiet small')}</div>`;
  }
  function settingsPage() {
    return `<div class="nx-cfg">${heading('工作台设置', cfg.tab === 'models' ? '按用途整理渠道和模型，资源池与工作参数分别保存。' : '先核对当前分类，修改进入草稿，点击保存后在本页生效。', button('刷新已保存配置', 'cfg-refresh', '', 'small', settingsRead.state === 'loading' ? 'disabled' : ''))}<div class="settings-grid"><div class="nx-cfg-navigation"><nav class="settings-nav panel" role="tablist" aria-label="工作台设置分类" aria-orientation="vertical">${settingTabs.map(([id, label]) => `<button type="button" role="tab" id="nx-cfg-tab-${id}" aria-controls="nx-cfg-panel" aria-selected="${cfg.tab === id}" tabindex="${cfg.tab === id ? '0' : '-1'}" data-action="cfg-tab" data-value="${id}" ${cfg.tab === id ? 'aria-current="true"' : ''}>${label}</button>`).join('')}</nav><p class="nx-cfg-nav-hint" data-cfg-nav-hint hidden>左右滑动查看更多分类</p></div><section class="panel nx-cfg-panel" id="nx-cfg-panel" role="tabpanel" aria-labelledby="nx-cfg-tab-${cfg.tab}"><div class="settings-content">${settingsBody()}</div>${cfg.tab === 'models' ? '' : `<div class="nx-cfg-savebar"><span id="nx-cfg-save-status" role="status">${settingsStatus()}</span><div class="button-row">${button('放弃修改', 'cfg-cancel', '', 'quiet', dirty() ? '' : 'disabled')}${button('保存设置', 'cfg-save', 'check', 'primary', dirty() && !blockedSettingsSave() ? '' : 'disabled')}</div></div>`}</section></div></div>`;
  }
  async function refreshSettings() {
    if (cfg.tab === 'models') { await refreshAiPools(); return; }
    if (settingsRead.state === 'loading') return;
    const run = ++settingsReadRun, revision = settingsRead.revision || 'demo-publication';
    const repaint = () => {
      if ($('#main .nx-cfg')) api.render();
      if (modalKind === 'cfg-channel' && cfg.editor?.channel === 'fonts') channelDialog('fonts', true);
    };
    settingsRead = { state: 'loading', revision: '', error: '' }; repaint();
    try {
      // The canonical prototype only reads its in-memory snapshot. Tests may inject a read-only stub.
      const value = await (api.readPublicationSettings ? api.readPublicationSettings() : { revision, routingUpgrade: clone(routingUpgrade) });
      if (run !== settingsReadRun) return;
      if (typeof value?.revision !== 'string' || !value.revision) throw Object.assign(new Error('PUBLICATION_SETTINGS_INVALID'), { code: 'PUBLICATION_SETTINGS_INVALID' });
      if (Object.hasOwn(value, 'routingUpgrade')) routingUpgrade = clone(value.routingUpgrade);
      settingsRead = { state: 'ready', revision: value.revision, error: '' };
    } catch (error) {
      if (run !== settingsReadRun) return;
      const unavailable = error?.status === 503 || error?.code === 'PUBLISH_SETTINGS_CREDENTIALS_UNAVAILABLE';
      settingsRead = { state: 'failed', revision: '', error: `发布与资源渠道配置读取失败${unavailable ? '，后台暂不可用' : ''}。请点击「刷新已保存配置」重试；读取成功前不能保存这些设置。` };
    }
    repaint();
  }
  function setPath(path, value) {
    const keys = path.split('.'), last = keys.pop();
    if (keys.length !== 1 || !Object.hasOwn(cfg.draft, keys[0]) || !Object.hasOwn(cfg.draft[keys[0]], last)) return;
    const relatedErrors = Object.keys(cfg.errors).filter(key => key === path || (keys[0] === 'range' && key.startsWith('range.')));
    const correctingError = relatedErrors.length > 0;
    cfg.draft[keys[0]][last] = value; relatedErrors.forEach(key => delete cfg.errors[key]); cfg.saveFailed = false;
    if (correctingError) api.clearNotice?.();
    syncSettingsDraftControls();
  }
  function settingsChanged() { rememberPoolDisclosures(); api.render(); }
  function loginPreview(result = 'idle') {
    const busy = result === 'busy';
    const messages = { failed: '登录失败：密码不正确，请重新核对。', rate_limited: '请求过于频繁，请稍后重试。', unavailable: '登录服务暂时不可用，可稍后重试。示例输入已保留。', network: '网络连接中断，请检查网络后重试。示例输入已保留。' };
    const message = result === 'success' ? '<div class="notice" role="status" tabindex="-1" data-workflow-feedback>登录成功 · 演示。下一步进入内容管理。</div>' : busy ? '<div class="notice" role="status" tabindex="-1" data-workflow-feedback>正在登录，请稍候…</div>' : messages[result] ? `<div class="notice warn" role="alert" tabindex="-1" data-workflow-feedback>${h(messages[result])}</div>` : '';
    openModal('cfg-login-preview', '登录页预览', `<section class="nx-login-preview-panel panel" aria-busy="${busy}"><div class="button-row nx-login-preview-brand">${icon('content')}<strong>拾光撷语</strong><small>DAYLIGHT STUDIO</small></div><h3>欢迎回到内容工作台</h3><p class="nx-form-help">登录后，继续整理值得留下的文字。</p><label class="field"><span>管理密码 · 禁止真实输入</span><input type="password" value="demo-placeholder" disabled autocomplete="off" aria-label="登录预览示例密码，禁止真实密码输入"></label>${message}<label class="field"><span>模拟登录结果</span><select id="nx-cfg-login-result"${busy ? ' disabled' : ''}>${options([['success', '登录成功'], ['failed', '密码错误'], ['rate_limited', '请求限流'], ['unavailable', '服务不可用'], ['network', '网络中断']], cfg.loginOutcome)}</select></label><p class="nx-form-help">此工作台仅供管理员使用 · 本页不发起登录请求</p></section>`, button('关闭', 'cfg-close', '', 'quiet') + (result === 'success' ? button('进入内容管理', 'cfg-login-enter', 'right', 'primary') : button(busy ? '登录中…' : '登录工作台 · 模拟', 'cfg-login-run', 'check', 'primary', busy ? 'disabled' : '')));
  }
  function requestNavigation(page) {
    pendingNavigation = page;
    openModal('cfg-unsaved', '设置有未保存的修改', '<p>可以保存本次设置后离开，放弃修改，或返回继续编辑。</p>', button('放弃修改并离开', 'cfg-leave-discard', '', 'quiet') + button('继续编辑', 'cfg-close') + button('保存并离开', 'cfg-leave-save', 'check', 'primary'));
  }
  async function refreshAiPools() {
    if (aiAccess.readState === 'loading') return;
    const current = ++aiReadRun;
    aiAccess.readState = 'loading'; api.render();
    try {
      // One example snapshot represents the page's combined configuration, pools and access read.
      const incoming = await (api.readAiResourcePools ? api.readAiResourcePools() : { pools: clone(cfg.saved.resourcePool), workParameters: clone(cfg.saved.workParameters) });
      if (current !== aiReadRun) return;
      if (poolKinds.some(([kind]) => !incoming?.pools?.[kind]?.revision || !Array.isArray(incoming.pools[kind].channels))) throw new Error('Invalid example pool');
      for (const [kind] of poolKinds) {
        const changed = poolDirty(kind), parameterChanged = parametersDirty(kind);
        cfg.saved.resourcePool[kind] = clone(incoming.pools[kind]);
        if (!changed) { cfg.draft.resourcePool[kind] = clone(incoming.pools[kind]); poolBaselineRevisions[kind] = incoming.pools[kind].revision; delete cfg.poolStates[kind]; }
        if (incoming.workParameters?.[kind]) {
          cfg.saved.workParameters[kind] = clone(incoming.workParameters[kind]);
          if (!parameterChanged) { cfg.draft.workParameters[kind] = clone(incoming.workParameters[kind]); parameterBaselines[kind] = clone(incoming.workParameters[kind]); delete cfg.parameterStates[kind]; }
        }
      }
      if (typeof incoming.canEditConfig === 'boolean') aiAccess.canEditConfig = incoming.canEditConfig;
      if (typeof incoming.safeMode === 'boolean') aiAccess.safeMode = incoming.safeMode;
      model().demoAiResourcePool = clone(cfg.saved.resourcePool); model().demoAiWorkParameters = clone(cfg.saved.workParameters); api.syncAiResourcePool?.();
      aiAccess.readState = 'ready'; api.render(); api.notify('已重新读取本页保存快照，未保存草稿保留；没有检测模型。');
    } catch { if (current === aiReadRun) { aiAccess.readState = 'failed'; api.render(); api.notify('模型配置或资源池读取失败，已保存快照与草稿保留；读取成功前不能修改或保存。', { tone: 'error' }); } }
  }
  function resetPoolDrafts() {
    for (const [kind] of poolKinds) { poolBaselineRevisions[kind] = poolSlot(kind, cfg.saved).revision; parameterBaselines[kind] = clone(cfg.saved.workParameters[kind]); }
    cfg.poolStates = {}; cfg.parameterStates = {};
  }
  function importLegacyPool(kind) {
    if (!poolSlot(kind) || !editablePool() || poolDirty(kind)) return false;
    const initial = createStudioAiResourcePool()[kind].channels[0];
    const profiles = api.initialAiLegacyConfigurations?.[kind] || [
      { name: '当前兼容渠道 · 示例', baseUrl: initial.baseUrl, model: `legacy-${kind}-current-demo`, keyStored: true },
      { name: '历史兼容渠道 · 示例', baseUrl: initial.baseUrl, model: `legacy-${kind}-history-demo`, keyStored: true },
    ];
    const next = clone(poolSlot(kind, cfg.saved));
    for (const profile of profiles) {
      const endpoint = demoEndpoint(profile.baseUrl);
      if (!endpoint || !profile.keyStored || !/^[^\s\u0000-\u001f\u007f]{1,200}$/u.test(profile.model)) continue;
      let channel = next.channels.find(row => demoEndpoint(row.baseUrl) === endpoint);
      if (!channel) { channel = { id: `demo-import-${kind}-${++sequence}`, name: profile.name || '历史导入渠道 · 示例', baseUrl: endpoint, enabled: true, keyStored: true, priority: next.channels.length + 1, channelRevision: 'demo-unsaved', models: [] }; next.channels.push(channel); }
      channel.keyStored = true;
      if (!channel.models.some(row => row.id === profile.model)) channel.models.push({ id: profile.model, priority: channel.models.length + 1, enabled: true, source: 'manual' });
    }
    if (next.channels.length > 8 || next.channels.some(row => row.models.length > 64)) { api.notify('历史导入将超过 8 个渠道或每渠道 64 个模型，原资源池保留。', { tone: 'error' }); return false; }
    cfg.draft.resourcePool[kind] = next;
    if (!savePool(kind, false)) return false;
    api.render(); api.notify('已将本用途当前与全部历史导入示例资源池；未连接模型服务。', { tone: 'success' }); return true;
  }
  function savePool(kind, repaint = true) {
    if (!poolSlot(kind)) return false;
    if (!poolDirty(kind)) return true;
    if (!editablePool()) { api.notify('资源池尚不可编辑，请刷新并核对权限。', { tone: 'error' }); return false; }
    if (poolBaselineRevisions[kind] !== poolSlot(kind, cfg.saved).revision) {
      cfg.poolStates[kind] = 'failed'; api.notify('资源池版本已变化，草稿保留；请先核对，再明确放弃草稿重新填写。', { tone: 'error' }); return false;
    }
    const next = clone(poolSlot(kind)), previous = poolSlot(kind, cfg.saved);
    const invalidChannel = next.channels.length > 8 || next.channels.some((channel, index) => !channel.name.trim() || channel.name.trim().length > 60 || !demoEndpoint(channel.baseUrl) || channel.priority !== index + 1 || channel.models.length > 64 || channel.models.some((row, position) => !/^[^\s\u0000-\u001f\u007f]{1,200}$/u.test(row.id) || row.priority !== position + 1) || new Set(channel.models.map(row => row.id)).size !== channel.models.length || (previous.channels.find(row => row.id === channel.id)?.keyStored && demoEndpoint(channel.baseUrl) !== demoEndpoint(previous.channels.find(row => row.id === channel.id).baseUrl) && !channel.sampleKeyPending && !channel.removeApiKey));
    if (invalidChannel) { cfg.poolStates[kind] = 'failed'; api.notify('渠道字段或密钥绑定尚未完成，请编辑渠道核对后保存。', { tone: 'error' }); syncSettingsDraftControls(); return false; }
    next.revision = `demo-${kind}-${++poolSequence}`; next.configured = true;
    for (const channel of next.channels) {
      if (channel.removeApiKey) channel.keyStored = false;
      else if (channel.sampleKeyPending) channel.keyStored = true;
      delete channel.sampleKeyPending; delete channel.removeApiKey;
      if (JSON.stringify(channel) !== JSON.stringify(previous.channels.find(row => row.id === channel.id))) channel.channelRevision = `${next.revision}-${channel.id}`;
    }
    cfg.saved.resourcePool[kind] = next; cfg.draft.resourcePool[kind] = clone(next); poolBaselineRevisions[kind] = next.revision; cfg.poolStates[kind] = 'saved'; cfg.saveFailed = false;
    model().demoAiResourcePool = clone(cfg.saved.resourcePool); api.syncAiResourcePool?.();
    if (repaint) { closeModal(); api.render(); api.notify(`${poolLabel(kind)}资源池已保存到本页演示，工作参数草稿保留。`, { tone: 'success' }); const channelId = cfg.openChannels[kind] || next.channels[0]?.id; poolFocus(channelId ? 'cfg-pool-channel-edit' : 'cfg-pool-channel-new', kind, channelId); }
    return true;
  }
  function saveParameters(kind, repaint = true) {
    if (!cfg.draft.workParameters[kind]) return false;
    if (!parametersDirty(kind)) return true;
    if (!editablePool()) return false;
    if (JSON.stringify(parameterBaselines[kind]) !== JSON.stringify(cfg.saved.workParameters[kind])) { cfg.parameterStates[kind] = 'failed'; api.notify('工作参数已由其他窗口更新，草稿保留；请先核对保存版本。', { tone: 'error' }); syncSettingsDraftControls(); return false; }
    const values = clone(cfg.draft.workParameters[kind]), errors = {}, limits = { concurrency: [1, 8], timeoutMs: [1000, 600000], ...(kind === 'annotation' ? { temperature: [0, 2], batchSize: [1, 50], maxBatchChars: [1, 12000] } : { countPerItem: [1, 4] }) };
    for (const name of Object.keys(limits)) if (values[name] === '') values[name] = cfg.saved.workParameters[kind][name];
    for (const [name, [minimum, maximum]] of Object.entries(limits)) if (!Number.isFinite(values[name]) || values[name] < minimum || values[name] > maximum || name !== 'temperature' && !Number.isInteger(values[name])) errors[`parameters.${kind}.${name}`] = `请填写 ${minimum}–${maximum} 范围内的${name === 'temperature' ? '数值' : '整数'}。`;
    if (kind === 'generation') {
      if (typeof values.size !== 'string' || values.size.length > 1000) errors['parameters.generation.size'] = '尺寸最多 1000 字符，按模型支持值填写。';
      if (!IMAGE_GENERATION_STYLES.some(row => row.id === values.imageStyle)) errors['parameters.generation.imageStyle'] = '请选择支持的配图风格。';
      for (const name of Object.keys(IMAGE_GENERATION_DEFAULTS).filter(name => name !== 'imageStyle')) if (typeof values[name] !== 'string' || values[name].length > 4000 || name !== 'stylePrefix' && !values[name].trim()) errors[`parameters.generation.${name}`] = name === 'stylePrefix' ? '提示词最多 4000 字符。' : '请填写 1–4000 字符的提示词。';
    }
    for (const key of Object.keys(cfg.errors).filter(key => key.startsWith(`parameters.${kind}.`))) delete cfg.errors[key];
    Object.assign(cfg.errors, errors);
    if (Object.keys(errors).length) {
      cfg.parameterStates[kind] = 'failed'; cfg.tab = 'models'; cfg.poolKind = kind; closeModal(); api.render();
      const section = $(`[data-cfg-work-parameters="${kind}"]`); if (section) section.open = true;
      const invalid = $(`[data-cfg-parameter][data-kind="${kind}"][aria-invalid="true"]`);
      for (let parent = invalid?.parentElement; parent; parent = parent.parentElement) if (parent.tagName?.toLowerCase() === 'details') parent.open = true;
      invalid?.focus?.({ preventScroll: true }); invalid?.scrollIntoView?.({ block: 'center', behavior: 'auto' });
      api.notify('工作参数尚未保存，请修正标出的字段。', { tone: 'error' }); return false;
    }
    cfg.saved.workParameters[kind] = clone(values); cfg.draft.workParameters[kind] = clone(values); parameterBaselines[kind] = clone(values); cfg.parameterStates[kind] = 'saved'; cfg.saveFailed = false; model().demoAiWorkParameters = clone(cfg.saved.workParameters); api.syncAiResourcePool?.();
    if (repaint) { closeModal(); api.render(); const section = $(`[data-cfg-work-parameters="${kind}"]`); if (section) { section.open = true; section.querySelector('summary')?.focus?.({ preventScroll: true }); } api.notify(`${poolLabel(kind)}工作参数已保存到本页演示，渠道草稿保留。`, { tone: 'success' }); }
    return true;
  }
  function saveSettings() {
    if (blockedSettingsSave()) { api.notify(settingsReadStatus(), { tone: 'error' }); return false; }
    cfg.errors = {};
    const { start, end } = cfg.draft.range;
    const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
    if (!validDate(start)) cfg.errors['range.start'] = '请选择有效开始日期。';
    if (!validDate(end)) cfg.errors['range.end'] = '请选择有效结束日期。';
    if (validDate(start) && validDate(end)) {
      const days = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
      if (days < 1) cfg.errors['range.end'] = '结束日期不能早于开始日期。';
      else if (days > 366) cfg.errors['range.end'] = '本演示支持最多 366 天的有效范围。';
    }
    if (routingDraftChanged()) routingErrors();
    if (Object.keys(cfg.errors).length) {
      const invalidRouting = Object.keys(cfg.errors).some(key => key.startsWith('routing.'));
      cfg.saveFailed = true; cfg.tab = invalidRouting ? 'channels' : 'range'; closeModal(); api.render();
      if (invalidRouting && $('[data-cfg-routing-bases]')) $('[data-cfg-routing-bases]').open = true;
      api.notify(invalidRouting ? '设置尚未保存，请修正公开基址。' : '设置尚未保存，请修正日期范围。', { tone: 'error' });
      const invalid = $(invalidRouting ? '[data-cfg-route-base][aria-invalid="true"]' : '[data-cfg-path][aria-invalid="true"]');
      invalid?.focus({ preventScroll: true }); invalid?.closest('.field')?.scrollIntoView({ block: 'center', behavior: 'auto' });
      return false;
    }
    cfg.saveFailed = false;
    for (const [kind] of poolKinds) if (!saveParameters(kind, false) || !savePool(kind, false)) return false;
    const next = clone(cfg.draft), routingChanged = routingDraftChanged();
    for (const [kind] of poolKinds) {
      if (JSON.stringify(next.resourcePool[kind].channels) === JSON.stringify(poolSlot(kind, cfg.saved).channels)) continue;
      const revision = `demo-${kind}-${++poolSequence}`;
      next.resourcePool[kind].revision = revision;
      next.resourcePool[kind].configured = true;
      for (const channel of next.resourcePool[kind].channels) {
        if (JSON.stringify(channel) !== JSON.stringify(poolChannel(kind, channel.id, cfg.saved))) channel.channelRevision = `${revision}-${channel.id}`;
      }
    }
    cfg.saved = next; cfg.draft = clone(next); model().schedule = clone(cfg.saved.range);
    model().demoPreferences = { ...clone(cfg.saved.workflow), ...clone(cfg.saved.preferences) };
    model().demoFontChannel = clone(cfg.saved.channels.fonts);
    if (routingChanged) {
      model().demoResourceRouting = clone(cfg.saved.routing);
      model().demoFontRouting = cfg.saved.routing.channels.fonts.map(row => row.providerId);
      settingsRead.revision = `demo-routing-${++routingSequence}`;
    }
    model().demoAiResourcePool = clone(cfg.saved.resourcePool);
    model().demoAiWorkParameters = clone(cfg.saved.workParameters);
    api.syncAiResourcePool?.();
    cfg.savedAt = formatStudioDateTime(new Date().toISOString());
    document.documentElement.dataset.density = cfg.saved.preferences.density;
    document.documentElement.dataset.demoMotion = cfg.saved.preferences.motion ? 'on' : 'off';
    closeModal(); api.render(); api.notify('设置已保存到本页演示；日期范围已同步。', { tone: 'success' }); return true;
  }
  function poolChannelDialog(kind, id = '', keep = false) {
    if (!poolSlot(kind)) return;
    const existing = poolChannel(kind, id);
    if (!keep) {
      let newId = '';
      if (!existing) do { newId = `demo-channel-${++sequence}`; } while (poolKinds.some(([purpose]) => poolChannel(purpose, newId)));
      cfg.editor = { scope: 'ai-channel', kind, ...(existing ? clone(existing) : { id: newId, name: '', baseUrl: '', priority: poolSlot(kind).channels.length + 1, enabled: true, keyStored: false, channelRevision: 'demo-unsaved', models: [] }), sampleKey: existing?.sampleKeyPending === true, removeApiKey: existing?.removeApiKey === true };
      cfg.editorOriginal = JSON.stringify(cfg.editor); cfg.errors = {}; cfg.editorFailed = false;
    }
    const row = cfg.editor;
    openModal('cfg-pool-channel', existing ? '编辑 AI 渠道' : '新增 AI 渠道', `<form>
      <section class="nx-cfg-form-section"><h3>${poolKinds.find(([id]) => id === kind)?.[1]}渠道</h3>
        ${field('渠道名称', `<input data-cfg-pool="name" value="${h(row.name)}" maxlength="60" placeholder="如：标注备用渠道">`, 'pool.name', cfg.errors)}
        ${field('HTTPS 接口地址', `<input type="url" data-cfg-pool="baseUrl" value="${h(row.baseUrl)}" maxlength="2048" placeholder="https://service.example.test/v1" autocomplete="off" spellcheck="false">`, 'pool.baseUrl', cfg.errors)}
        <div class="field-grid">${field('渠道优先级 · 1 最高', `<input type="number" data-cfg-pool="priority" value="${row.priority}" min="1" max="${poolSlot(kind).channels.length + (existing ? 0 : 1)}" step="1">`, 'pool.priority', cfg.errors)}<label class="nx-cfg-check"><input type="checkbox" data-cfg-pool="enabled" ${checked(row.enabled)}>启用本渠道</label></div>
      </section><details class="nx-cfg-details" data-cfg-pool-credentials${row.sampleKey || row.removeApiKey || !row.keyStored || cfg.errors['pool.key'] ? ' open' : ''}><summary>管理示例凭据</summary><div>
        <div class="nx-cfg-key-summary"><span>API 密钥状态</span><span data-cfg-key-status>${row.removeApiKey ? '保存时移除' : row.sampleKey ? '新示例密钥待保存' : row.keyStored ? '已保存 · 尚未联网验证' : '未配置'}</span></div>
        ${field('API 密钥', '<input type="password" disabled autocomplete="new-password" maxlength="4096" spellcheck="false" placeholder="留空保留已保存密钥" aria-label="AI 渠道 API Key，禁止真实凭据输入">')}
        ${button('使用新示例密钥', 'cfg-pool-sample-key', '', 'quiet small')}
        <label class="nx-cfg-check"><input type="checkbox" data-cfg-pool="removeApiKey" ${checked(row.removeApiKey)}${row.keyStored ? '' : ' disabled'}>保存时移除该渠道密钥</label>
        <p class="nx-form-help">原型只演示凭据状态，不接收真实密钥。更换接口时，须使用新示例密钥或明确移除原密钥。</p>${errorLine(cfg.errors, 'pool.key')}
      </div></details><p class="nx-form-help">仅允许 .example.test 示例地址，完整路径与端口会保留。渠道先加入资源池草稿，再点击「保存${kind === 'annotation' ? '标注' : '生图'}资源池」。</p>
    </form>`, editorFooter('cfg-pool-channel-save'));
  }
  function poolModelDialog(kind, channelId, id = '', keep = false) {
    const channel = poolChannel(kind, channelId); if (!channel) return;
    const existing = channel.models.find(row => row.id === id);
    if (!keep) {
      if (modalKind === 'cfg-pool-detection') closeModal();
      cfg.editor = { scope: 'ai-model', kind, channelId, originalId: id, ...(existing ? clone(existing) : { id: '', priority: channel.models.length + 1, enabled: true, source: 'manual' }) };
      cfg.editorOriginal = JSON.stringify(cfg.editor); cfg.errors = {}; cfg.editorFailed = false;
    }
    const row = cfg.editor;
    openModal('cfg-pool-model', existing ? '编辑渠道模型' : '手动添加模型', `<form><p class="nx-form-help">所属渠道：${h(channel.name)}。检测失败时可直接填写已知模型 ID。</p>
      ${field('模型 ID', `<input data-cfg-pool="id" value="${h(row.id)}" maxlength="200" placeholder="如：annotation-custom-demo" spellcheck="false">`, 'pool.model', cfg.errors)}
      ${field('模型优先级 · 1 最高', `<input type="number" data-cfg-pool="priority" value="${row.priority}" min="1" max="${channel.models.length + (existing ? 0 : 1)}" step="1">`, 'pool.priority', cfg.errors)}
      <label class="nx-cfg-check"><input type="checkbox" data-cfg-pool="enabled" ${checked(row.enabled)}>启用本模型</label><p class="nx-form-help">ID 保留大小写、斜杠和冒号，保存后供任务请求使用；优先级仅在本渠道内排序。</p>
    </form>`, editorFooter('cfg-pool-model-save'));
  }
  function reopenPoolEditor() {
    if (cfg.editor?.scope === 'ai-channel') poolChannelDialog(cfg.editor.kind, cfg.editor.id, true);
    else if (cfg.editor?.scope === 'ai-model') poolModelDialog(cfg.editor.kind, cfg.editor.channelId, cfg.editor.originalId, true);
    else if (cfg.editor?.channel) channelDialog(cfg.editor.channel, true);
  }
  function poolDetectionDialog(kind, channelId, keep = false) {
    const channel = poolChannel(kind, channelId, cfg.saved); if (!channel) return;
    if (!keep) poolDetection = { kind, channelId, revision: poolSlot(kind, cfg.saved).revision, channelRevision: channel.channelRevision, state: 'idle', outcome: 'success', detectedModels: [], errorCode: '' };
    const detection = poolDetection; if (!detection) return;
    const busy = detection.state === 'running', failed = detection.state === 'failed', success = detection.state === 'success';
    const failureText = { TIMEOUT: '模型检测超时，手工列表已保留。可重试检测，或直接手动添加模型。', INVALID_RESPONSE: '检测结果无法识别，手工列表已保留。请手动添加已知模型 ID。' };
    openModal('cfg-pool-detection', '检测模型 · 内存模拟', `<div class="nx-ai-pool-detection" aria-busy="${busy}"><h3>${h(channel.name)}</h3>
      ${status(busy ? '正在模拟检测' : failed ? '检测失败' : success ? '检测候选已返回' : '等待点击检测', failed ? 'warn' : success ? 'good' : '')}
      ${failed ? `<p class="nx-form-error" role="alert">${failureText[detection.errorCode] || '模型检测失败，手工列表已保留。可直接手动添加模型。'}</p>` : '<p class="nx-form-help">只读取固定的示例候选；打开页面不会检测，确认合并前不会修改任何模型列表。</p>'}
      ${field('本次模拟结果', `<select id="nx-pool-detection-outcome"${busy ? ' disabled' : ''}>${options([['success', '返回示例模型候选'], ['timeout', '检测超时'], ['invalid', '返回无法识别的结果']], detection.outcome)}</select>`)}
      ${success ? `<ul class="nx-ai-pool-detected">${detection.detectedModels.map(id => `<li><strong>${h(id)}</strong><small>${channel.models.some(row => row.id === id) ? '已存在，合并时保留原设置' : '确认合并后新增 · 默认停用'}</small></li>`).join('')}</ul>` : ''}
      <p class="nx-form-help">真实后台只检测已保存的渠道；失败不清空手工模型，检测与保存设置分别操作。本演示不发送网络请求。</p></div>`, button('关闭', 'cfg-close', '', 'quiet') + (failed ? button('手动添加模型', 'cfg-pool-model-new', 'plus', 'small', poolAttrs(kind, channelId)) : '') + (success ? button('确认合并检测结果', 'cfg-pool-detect-merge', 'check', 'primary') : button(busy ? '正在检测…' : '开始检测 · 模拟', 'cfg-pool-detect-run', 'search', 'primary', busy ? 'disabled' : '')));
  }
  function beginPoolDetection() {
    const detection = poolDetection;
    if (!detection || detection.state === 'running' || modalKind !== 'cfg-pool-detection' || !$('#modal')?.open) return;
    const channel = poolChannel(detection.kind, detection.channelId, cfg.saved);
    if (!channel || !savedPoolConnection(detection.kind, detection.channelId) || poolSlot(detection.kind, cfg.saved).revision !== detection.revision) { api.notify('先保存接口或密钥修改，再检测模型。', { tone: 'error' }); return; }
    detection.outcome = $('#nx-pool-detection-outcome')?.value || 'success'; detection.state = 'running';
    const run = ++detectionRun; poolDetectionDialog(detection.kind, detection.channelId, true);
    detectionTimer = setTimeout(() => {
      if (run !== detectionRun || poolDetection !== detection || modalKind !== 'cfg-pool-detection' || !$('#modal')?.open || !$('[data-workflow-modal="cfg-pool-detection"]') || poolSlot(detection.kind, cfg.saved).revision !== detection.revision || !savedPoolConnection(detection.kind, detection.channelId)) return;
      detectionTimer = null;
      detection.errorCode = detection.outcome === 'timeout' ? 'TIMEOUT' : detection.outcome === 'invalid' ? 'INVALID_RESPONSE' : '';
      detection.state = detection.errorCode ? 'failed' : 'success';
      detection.detectedModels = detection.state === 'success' ? (detection.kind === 'generation' ? ['image-demo', 'image-detected-demo'] : ['annotation-demo', 'annotation-detected-demo']) : [];
      poolDetectionDialog(detection.kind, detection.channelId, true);
    }, 350);
  }
  function channelDialog(id, keep = false) {
    const row = cfg.draft.channels[id]; if (!row) return;
    if (!keep) { cfg.editor = { channel: id, ...clone(row) }; cfg.editorOriginal = JSON.stringify(cfg.editor); cfg.errors = {}; cfg.editorFailed = false; }
    const draft = cfg.editor;
    if (id === 'fonts') {
      const disabled = publicationReady() ? '' : ' disabled';
      openModal('cfg-channel', 'UploadThing 字体上传配置', `${settingsReadNotice()}<form>${field('配置名称', `<input data-cfg-channel="name" maxlength="40" value="${h(draft.name)}"${disabled}>`, 'channel.name', cfg.errors)}${field('字体上传渠道', '<input value="UploadThing · 生产 TTF" readonly>')}${field('已安装公开来源', '<input value="应用子域.ufs.sh /f/对象 key" readonly>')}<p class="nx-form-help">逐字体登记公开对象直链，保留当前 TTF 的大小与 SHA-256 绑定；缺少直链的字体按其他渠道回退。</p><label class="nx-cfg-check"><input type="checkbox" data-cfg-channel="sampleToken" ${checked(draft.sampleToken)}${disabled}>使用已配置的示例 Token · 仅内存标记</label>${field('UPLOADTHING_TOKEN · 真实输入已禁用', '<input type="password" disabled autocomplete="off" placeholder="演示 Token 占位，禁止真实凭据输入" aria-label="UploadThing 示例 Token，禁止真实凭据输入">')}<label class="nx-cfg-check"><input type="checkbox" data-cfg-channel="enabled" ${checked(draft.enabled)}${disabled}>启用字体上传演示</label>${note('这里只保存本页示例配置。上传批准 TTF、核验原直链及同文件三轮测速在「发布中心 → 资源与测速」分别确认。')}</form>`, editorFooter('cfg-channel-save'));
      return;
    }
    const providers = id === 'wechat' ? [['personal', '个人主体 · 仅草稿'], ['organization', '组织主体 · 本演示仍仅草稿']] : id === 'images' ? [['axureshow', 'AxureShow · 示例'], ['ipic', 'ipic · 示例']] : [['axureshow', 'AxureShow · 示例'], ['github', 'GitHub 镜像 · 示例']];
    openModal('cfg-channel', `${({ images: '图床', wechat: '公众号', resources: '资源渠道' })[id]}配置`, `<form>${field('配置名称', `<input data-cfg-channel="name" maxlength="40" value="${h(draft.name)}">`, 'channel.name', cfg.errors)}${field('渠道类型', `<select data-cfg-channel="provider">${options(providers, draft.provider)}</select>`)}${field(id === 'wechat' ? '演示账号别名 · 勿填真实账号' : '演示资源目录', `<input data-cfg-channel="namespace" maxlength="60" value="${h(draft.namespace)}" placeholder="example-workspace">`, 'channel.namespace', cfg.errors)}${id === 'resources' ? field('备用渠道', `<select data-cfg-channel="fallback">${options([['github', 'GitHub 镜像 · 示例'], ['axureshow', 'AxureShow · 示例'], ['none', '不启用备用']], draft.fallback)}</select>`, 'channel.fallback', cfg.errors) : ''}<label class="nx-cfg-check"><input type="checkbox" data-cfg-channel="enabled" ${checked(draft.enabled)}>启用本示例渠道</label>${field('真实凭据输入已禁用', '<input type="password" disabled value="demo-placeholder" autocomplete="off">')}${note(id === 'wechat' ? '公众号只演示保存草稿；不登录、不上传、不发表。原生链接及草稿结果必须独立表达。' : '目录和目标用于本页流程演示；这里不更改实际资源源，不上传文件。')}</form>`, editorFooter('cfg-channel-save'));
  }
  function editorClose() {
    if (cfg.editor && JSON.stringify(cfg.editor) !== cfg.editorOriginal) {
      openModal('cfg-editor-unsaved', '配置表单有未保存修改', '<p tabindex="-1" data-workflow-feedback>可以继续填写，或放弃这份表单；工作台其他设置草稿保留。</p>', button('放弃这份表单', 'cfg-editor-discard', '', 'quiet') + button('继续填写', 'cfg-editor-continue', '', 'primary'));
    } else { cfg.editor = null; closeModal(); }
  }
  function testDialog(kind, id, keep = false) {
    const row = cfg.draft.channels[id];
    if (!row) return;
    if (!keep) cfg.test = { kind, id, name: row.name, phase: 'idle', outcome: 'success' };
    const test = cfg.test;
    const labels = { idle: '尚未测试', running: '正在模拟检查', success: '示例连接成功', failure: '示例连接失败' };
    openModal('cfg-test', '模拟连通测试', `<div class="nx-cfg-test"><span class="task-symbol">${icon('settings')}</span><h3>${h(test.name)}</h3>${status(labels[test.phase], test.phase === 'success' ? 'good' : test.phase === 'failure' ? 'warn' : 'blue')}<p>${test.phase === 'success' ? '占位配置完整，示例回执已返回；这不是服务真实可用的证明。' : test.phase === 'failure' ? '模拟服务超时。请检查后台所在设备的网络后手动重试；原配置保留，不会自动重试。' : '仅检查本页示例配置并演示回执，不发送网络请求。'}</p>${field('本次模拟结果', `<select id="nx-cfg-test-outcome" ${test.phase === 'running' ? 'disabled' : ''}>${options([['success', '模拟成功'], ['failure', '模拟超时失败']], test.outcome)}</select>`)}${note('真实账号、密钥、服务可用性与远端权限均未验证。')}</div>`, button('关闭', 'cfg-close', '', 'quiet') + button(test.phase === 'running' ? '正在模拟…' : test.phase === 'idle' ? '开始模拟测试' : '重新测试', 'cfg-test-run', '', 'primary', test.phase === 'running' ? 'disabled' : ''));
  }
  function bindModal() {
    const root = $('[data-workflow-modal]'); if (!root) return;
    const editorModal = () => ['cfg-pool-channel', 'cfg-pool-model', 'cfg-channel'].includes(modalKind);
    const closeAction = modalKind === 'col-candidate' ? 'col-candidate-close' : modalKind === 'col-unsaved' ? 'col-candidate-continue' : editorModal() ? 'cfg-editor-close' : modalKind === 'cfg-editor-unsaved' ? 'cfg-editor-continue' : modalKind.startsWith('col') ? 'col-close' : 'cfg-close';
    const headerClose = root.closest('dialog')?.querySelector('.dialog-top [data-action="close-modal"]');
    if (headerClose) headerClose.dataset.action = closeAction;
    root.oninput = event => {
      const node = event.target;
      if (node.dataset.colEdit && col.edit) col.edit[node.dataset.colEdit] = node.dataset.colEdit === 'tags' ? [...new Set(node.value.split(/[,，、]/).map(value => value.trim()).filter(Boolean))].slice(0, 8) : node.value;
      const poolKey = node.dataset.cfgPool, channelKey = node.dataset.cfgChannel;
      if (cfg.editor && (poolKey || channelKey)) {
        if (cfg.editor.channel === 'fonts' && !publicationReady()) return;
        if (poolKey && !(cfg.editor.scope === 'ai-channel' ? ['name', 'baseUrl', 'priority', 'enabled', 'removeApiKey'] : ['id', 'priority', 'enabled']).includes(poolKey)) return;
        const key = poolKey || channelKey;
        cfg.editor[key] = key === 'priority' ? Number(node.value) : node.type === 'checkbox' ? node.checked : node.value;
        if (key === 'baseUrl') cfg.editor.sampleKey = false;
        if (key === 'removeApiKey' && node.checked) cfg.editor.sampleKey = false;
        cfg.editorFailed = false;
        const statusNode = $('#nx-cfg-editor-status'); if (statusNode) statusNode.textContent = editorStatus();
        const dialog = root.closest('dialog');
        for (const action of ['cfg-editor-close', 'cfg-pool-channel-save', 'cfg-pool-model-save', 'cfg-channel-save']) dialog?.querySelector(`.dialog-footer [data-action="${action}"]`)?.toggleAttribute?.('disabled', !editorDirty() || (action === 'cfg-channel-save' && cfg.editor.channel === 'fonts' && !publicationReady()));
        const keyStatus = root.querySelector?.('[data-cfg-key-status]'); if (keyStatus) keyStatus.textContent = cfg.editor.removeApiKey ? '保存时移除' : cfg.editor.sampleKey ? '新示例密钥待保存' : cfg.editor.keyStored ? '已保存 · 尚未联网验证' : '未配置';
      }
    };
    root.onchange = root.oninput;
    const invalid = root.querySelector?.('[aria-invalid="true"]');
    invalid?.focus(); invalid?.closest('.field')?.scrollIntoView({ block: 'center', behavior: 'instant' });
    const feedback = root.querySelector?.('[data-workflow-feedback]');
    feedback?.focus({ preventScroll: true }); feedback?.scrollIntoView({ block: 'center', behavior: 'auto' });
    const dialog = root.closest('dialog');
    if (dialog && !dialog.dataset.nxWorkflowCancel) {
      dialog.dataset.nxWorkflowCancel = 'true';
      dialog.addEventListener('cancel', event => {
        if (!$('[data-workflow-modal]')) return;
        if (modalKind === 'col-candidate' && col.edit && JSON.stringify(col.edit) !== col.original) { event.preventDefault(); event.stopImmediatePropagation(); closeCandidate(); }
        else if (editorModal() && cfg.editor && JSON.stringify(cfg.editor) !== cfg.editorOriginal) { event.preventDefault(); event.stopImmediatePropagation(); editorClose(); }
        else if (modalKind === 'col-unsaved' && col.edit) { event.preventDefault(); event.stopImmediatePropagation(); candidateDialog(col.edit.id, true); }
        else if (modalKind === 'cfg-editor-unsaved' && cfg.editor) { event.preventDefault(); event.stopImmediatePropagation(); reopenPoolEditor(); }
      }, true);
    }
  }
  function afterRender(page) {
    currentPage = page;
    const colRoot = $('#main .nx-col');
    if (colRoot) {
      colRoot.oninput = event => {
        const node = event.target;
        if (node.id !== 'nx-col-search') return;
        col.search = node.value; col.page = 0; col.selected.clear(); col.selectionMode = false; col.selectedMatching = false;
        const position = node.selectionStart; api.render(); $('#nx-col-search')?.focus();
        try { $('#nx-col-search')?.setSelectionRange(position, position); } catch { /* Search inputs may not expose selection ranges. */ }
      };
      colRoot.onchange = event => {
        const node = event.target;
        if (node.id === 'nx-col-source') { col.source = node.value; col.page = 0; col.selected.clear(); col.selectionMode = false; col.selectedMatching = false; }
        else if (node.dataset.colSelect) { col.selectionMode = true; col.selectedMatching = false; node.checked ? col.selected.add(node.dataset.colSelect) : col.selected.delete(node.dataset.colSelect); }
        else if (node.id === 'nx-col-select-page') { col.selectionMode = true; col.selectedMatching = false; for (const row of filteredCandidates().slice(col.page * col.size, (col.page + 1) * col.size).filter(row => !['imported', 'ignored'].includes(row.state))) node.checked ? col.selected.add(row.id) : col.selected.delete(row.id); }
        else return;
        api.render();
      };
    }
    const cfgRoot = $('#main .nx-cfg');
    if (cfgRoot) {
      syncFontResourceCard();
      cfgRoot.querySelectorAll?.('[data-cfg-work-parameters], [data-cfg-pool-history], [data-cfg-pool-prompts], [data-cfg-style-editor]').forEach(node => {
        const key = node.dataset.cfgWorkParameters ? `parameters-${node.dataset.cfgWorkParameters}` : node.dataset.cfgPoolHistory ? `history-${node.dataset.cfgPoolHistory}` : node.dataset.cfgStyleEditor ? `style-${node.dataset.cfgStyleEditor}` : 'prompts';
        if (poolDisclosures.has(key)) node.open = poolDisclosures.get(key);
      });
      const parameterInput = node => {
        const kind = node.dataset.kind, name = node.dataset.cfgParameter, values = cfg.draft.workParameters[kind];
        if (!editablePool() || !values || !Object.hasOwn(values, name)) return;
        values[name] = node.type === 'number' ? node.value === '' ? '' : Number(node.value) : node.value;
        delete cfg.parameterStates[kind]; delete cfg.errors[`parameters.${kind}.${name}`];
        if (name === 'imageStyle') cfgRoot.querySelectorAll?.('[data-cfg-style-editor]').forEach(editor => { editor.open = editor.dataset.cfgStyleEditor === node.value; });
        syncSettingsDraftControls();
      };
      cfgRoot.oninput = event => { const node = event.target; if (node.dataset.cfgParameter) parameterInput(node); else if (node.dataset.cfgPath) setPath(node.dataset.cfgPath, node.type === 'checkbox' ? node.checked : node.value); else if (node.dataset.cfgRouteBase) setRoutingBase(node.dataset.cfgRouteBase, node.value); };
      cfgRoot.onchange = event => { const node = event.target; if (node.dataset.cfgParameter) parameterInput(node); else if (node.dataset.cfgModelEnabled && editablePool()) { const row = poolChannel(node.dataset.kind, node.dataset.channelId)?.models.find(row => row.id === node.dataset.cfgModelEnabled); if (row) { row.enabled = node.checked; delete cfg.poolStates[node.dataset.kind]; settingsChanged(); const target = [...document.querySelectorAll('[data-cfg-model-enabled]')].find(input => input.dataset.kind === node.dataset.kind && input.dataset.channelId === node.dataset.channelId && input.dataset.cfgModelEnabled === row.id); target?.focus?.({ preventScroll: true }); } } else if (node.dataset.cfgPath) { setPath(node.dataset.cfgPath, node.type === 'checkbox' ? node.checked : node.value); if (node.type === 'date') api.render(); } else if (node.dataset.cfgRouteBase) setRoutingBase(node.dataset.cfgRouteBase, node.value); };
      cfgRoot.querySelectorAll?.('[data-cfg-parameters]').forEach(form => form.addEventListener?.('submit', event => { event.preventDefault(); saveParameters(form.dataset.cfgParameters); }));
      if (!editablePool()) cfgRoot.querySelectorAll?.('[data-cfg-parameter]').forEach(node => { node.disabled = true; });
      cfgRoot.querySelector?.('.nx-ai-pool-tabs')?.addEventListener?.('keydown', event => {
        const current = poolKinds.findIndex(([kind]) => kind === event.target.dataset.kind); if (current < 0) return;
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowRight' ? 1 - current : -1;
        if (index < 0) return; event.preventDefault(); cfg.poolKind = poolKinds[index][0]; api.render(); poolFocus('cfg-pool-purpose', cfg.poolKind);
      });
      const navigation = cfgRoot.querySelector?.('.settings-nav');
      if (navigation) {
        syncSettingsNavigation(true);
        navigation.addEventListener('scroll', () => syncSettingsNavigation(false), { passive: true });
        navigation.addEventListener('keydown', event => {
          const buttons = [...navigation.querySelectorAll('[role="tab"]')];
          const index = buttons.indexOf(event.target); if (index < 0) return;
          const horizontal = navigation.getAttribute('aria-orientation') === 'horizontal';
          const direction = event.key === (horizontal ? 'ArrowRight' : 'ArrowDown') ? 1 : event.key === (horizontal ? 'ArrowLeft' : 'ArrowUp') ? -1 : 0;
          const next = event.key === 'Home' ? buttons[0] : event.key === 'End' ? buttons.at(-1) : direction ? buttons[(index + direction + buttons.length) % buttons.length] : null;
          if (!next) return; event.preventDefault(); cfg.tab = next.dataset.value; api.render();
          $(`#nx-cfg-tab-${cfg.tab}`)?.focus({ preventScroll: true });
        });
      }
    }
  }
  function syncSettingsNavigation(reveal) {
    const navigation = $('#main .nx-cfg .settings-nav'); if (!navigation) return;
    const narrow = window.matchMedia?.('(max-width:800px)').matches === true;
    navigation.setAttribute('aria-orientation', narrow ? 'horizontal' : 'vertical');
    const selected = navigation.querySelector('[aria-selected="true"]');
    if (narrow && reveal && selected) {
      const bounds = navigation.getBoundingClientRect(), current = selected.getBoundingClientRect();
      if (current.left < bounds.left + 8) navigation.scrollLeft -= bounds.left + 8 - current.left;
      else if (current.right > bounds.right - 8) navigation.scrollLeft += current.right - bounds.right + 8;
    }
    const moreStart = narrow && navigation.scrollLeft > 2, moreEnd = narrow && navigation.scrollWidth - navigation.clientWidth - navigation.scrollLeft > 2;
    navigation.dataset.overflowStart = String(moreStart); navigation.dataset.overflowEnd = String(moreEnd);
    const hint = $('[data-cfg-nav-hint]');
    if (hint) { hint.hidden = !moreStart && !moreEnd; hint.textContent = `${moreStart ? '← ' : ''}左右滑动查看更多分类${moreEnd ? ' →' : ''}`; }
  }
  window.addEventListener('resize', () => syncSettingsNavigation(true));
  async function handle(action, target) {
    if (!action.startsWith('col-') && !action.startsWith('cfg-')) return false;
    const { id, value, kind, channelId } = target.dataset;
    rememberPoolDisclosures();
    if ((action.startsWith('cfg-pool-') || action.startsWith('cfg-parameters-')) && !['cfg-pool-purpose', 'cfg-pool-channel-models', 'cfg-pool-discard', 'cfg-pool-discard-confirm', 'cfg-parameters-discard', 'cfg-parameters-discard-confirm'].includes(action) && !editablePool()) { api.notify('当前资源池不可编辑，请刷新并核对权限。', { tone: 'error' }); return true; }
    switch (action) {
      case 'col-new': if (['running', 'paused'].includes(col.task?.state)) taskDialog(); else newCollection(); break;
      case 'col-close': closeModal(); break;
      case 'col-filter': col.filter = value; col.page = 0; col.selected.clear(); col.selectionMode = false; col.selectedMatching = false; api.render(); break;
      case 'col-clear-filters': col.search = ''; col.source = 'all'; col.filter = 'pending'; col.page = 0; col.selected.clear(); col.selectionMode = false; col.selectedMatching = false; api.render(); break;
      case 'col-start-selection': col.selectionMode = true; api.render(); $('#nx-col-select-page')?.focus({ preventScroll: true }); break;
      case 'col-select-matching': col.selected = new Set(filteredCandidates().filter(row => !['imported', 'ignored'].includes(row.state)).map(row => row.id)); col.selectionMode = true; col.selectedMatching = true; api.render(); break;
      case 'col-clear-selection': col.selected.clear(); col.selectionMode = false; col.selectedMatching = false; api.render(); $('[data-action="col-start-selection"]')?.focus({ preventScroll: true }); break;
      case 'col-prev': col.page = Math.max(0, col.page - 1); api.render(); $('.nx-col-table-scroll')?.scrollIntoView({ block: 'start', behavior: 'auto' }); break;
      case 'col-next': col.page++; api.render(); $('.nx-col-table-scroll')?.scrollIntoView({ block: 'start', behavior: 'auto' }); break;
      case 'col-create-submit': {
        const count = Number($('#nx-col-new-count')?.value), range = $('#nx-col-new-range')?.value.trim(), source = $('#nx-col-new-source')?.value;
        if (!Number.isInteger(count) || count < 1 || count > 12 || !range || !sources.some(row => row[0] === source && source !== 'all')) {
          const error = $('#nx-col-create-error');
          error.textContent = '请选择示例来源，填写采集范围，并将数量设为 1–12 的整数。';
          error.setAttribute('tabindex', '-1'); error.focus?.({ preventScroll: true }); error.scrollIntoView?.({ block: 'center', behavior: 'auto' });
          break;
        }
        col.task = { id: `collection-${++sequence}`, name: `示例采集 ${sequence}`, source, range, count, done: 0, state: 'running', createdAt: new Date().toISOString(), dedup: $('#nx-col-new-dedup').value, candidateIds: [] };
        col.page = 0; col.source = 'all'; col.filter = 'pending'; col.search = ''; closeModal(); api.render(); scheduleTick(); break;
      }
      case 'col-task-detail': taskDialog(); break;
      case 'col-task-pause': if (col.task?.state === 'running') { clearTimeout(timer); col.task.state = 'paused'; api.render(); if ($('#modal')?.open) taskDialog(); } break;
      case 'col-task-resume': if (col.task?.state === 'paused') { col.task.state = 'running'; api.render(); if ($('#modal')?.open) taskDialog(); scheduleTick(); } break;
      case 'col-task-cancel': openModal('col-task-cancel', '取消本次采集？', `<p>已返回的 ${col.task?.done || 0} 条候选保留；取消后不再生成后续候选。</p>`, button('保留任务', 'col-task-detail', '', 'quiet') + button('确认取消', 'col-task-cancel-confirm', '', 'primary')); break;
      case 'col-task-cancel-confirm': if (col.task && ['running', 'paused'].includes(col.task.state)) { clearTimeout(timer); col.task.state = 'cancelled'; closeModal(); api.render(); api.notify('示例采集已取消，已有候选保留。', { tone: 'success' }); } break;
      case 'col-detail': candidateDialog(id); break;
      case 'col-candidate-close': closeCandidate(); break;
      case 'col-candidate-discard': col.edit = null; closeModal(); break;
      case 'col-candidate-continue': if (col.edit) candidateDialog(col.edit.id, true); break;
      case 'col-candidate-save': {
        const row = col.edit; if (!row) break; col.errors = {};
        if (Array.from(row.text.trim()).length < 4 || Array.from(row.text.trim()).length > 240) col.errors.text = '请填写 4–240 字的正文。';
        if (!row.author.trim()) col.errors.author = '请核对并填写作者。';
        if (!row.source.trim()) col.errors.source = '请核对并填写出处。';
        if (Object.keys(col.errors).length) { candidateDialog(row.id, true); break; }
        Object.assign(candidate(row.id), clone(row)); col.edit = null; closeModal(); api.render(); api.notify('候选修正已保存，请继续核对整理。', { tone: 'success' }); break;
      }
      case 'col-ignore': if (col.edit && JSON.stringify(col.edit) !== col.original) { api.notify('先保存修正或放弃修改，再忽略此条。'); break; } openModal('col-ignore', '忽略这条候选？', '<p>候选记录保留，可在“已忽略”中恢复；不会移除已有内容。</p>', button('返回核对', 'col-detail', '', 'quiet', `data-id="${id}"`) + button('确认忽略', 'col-ignore-confirm', '', 'primary', `data-id="${id}"`)); break;
      case 'col-ignore-confirm': if (candidate(id)) { candidate(id).state = 'ignored'; col.selected.delete(id); col.edit = null; closeModal(); api.render(); } break;
      case 'col-restore': if (candidate(id)?.state === 'ignored') { candidate(id).state = 'pending'; col.edit = null; closeModal(); api.render(); api.notify('候选已恢复为待整理。', { tone: 'success' }); } break;
      case 'col-open-existing': if (col.edit && JSON.stringify(col.edit) !== col.original) { api.notify('候选有未保存修改，请先保存或返回放弃。'); break; } closeModal(); api.openEntry(id); break;
      case 'col-open-entry': closeModal(); api.openEntry(id); break;
      case 'col-organize': previewCollection([...col.selected], '明确选中的跨页候选'); break;
      case 'col-organize-filter': previewCollection(filteredCandidates().map(row => row.id), `当前筛选：${sourceName(col.source)}${col.search ? ` / ${col.search}` : ''}`); break;
      case 'col-commit': commitCollection(); break;
      case 'col-undo': undoCollection(); break;
      case 'col-undo-confirm': {
        const undo = col.undo; if (!undo) break;
        const safe = undo.added.every(row => JSON.stringify(model().entries.find(item => item.id === row.id)) === JSON.stringify(row) && !Object.values(model().bindings).some(binding => binding.entryId === row.id)) && undo.after.every(row => JSON.stringify(candidate(row.id)) === JSON.stringify(row));
        if (!safe) { undoCollection(); break; }
        const ids = new Set(undo.added.map(row => row.id)); model().entries = model().entries.filter(row => !ids.has(row.id));
        undo.before.forEach(row => { const index = col.rows.findIndex(item => item.id === row.id); if (index >= 0) col.rows[index] = clone(row); });
        col.undo = null; col.result = { title: '已撤销本批整理', text: '未修改草稿已移除，候选已恢复，其他内容保留。' }; closeModal(); api.render(); break;
      }
      case 'col-dismiss-result': col.result = null; api.render(); break;
      case 'cfg-tab': if (cfg.tab !== value) api.clearNotice?.(); cfg.tab = value; api.render(); $(`#nx-cfg-tab-${cfg.tab}`)?.focus({ preventScroll: true }); break;
      case 'cfg-login-preview': clearTimeout(loginTimer); loginTimer = null; ++loginRun; loginPreview(); break;
      case 'cfg-login-run': {
        if (loginTimer !== null || modalKind !== 'cfg-login-preview') break;
        const result = $('#nx-cfg-login-result'); if (!result) break;
        cfg.loginOutcome = result.value;
        if (!['success', 'failed', 'rate_limited', 'unavailable', 'network'].includes(cfg.loginOutcome)) cfg.loginOutcome = 'success';
        const run = ++loginRun; loginPreview('busy');
        loginTimer = setTimeout(() => {
          if (run !== loginRun) return;
          loginTimer = null;
          if (modalKind !== 'cfg-login-preview' || !$('#modal')?.open || !$('[data-workflow-modal="cfg-login-preview"]')) return;
          loginPreview(cfg.loginOutcome);
        }, 500);
        break;
      }
      case 'cfg-login-enter': closeModal(); if (dirty()) requestNavigation('review'); else api.navigate('review'); break;
      case 'cfg-close': closeModal(); break;
      case 'cfg-refresh': await refreshSettings(); break;
      case 'cfg-route-upgrade': upgradeRoutingDraft(); break;
      case 'cfg-route-up': moveRoutingDraft(kind, id, -1); break;
      case 'cfg-route-down': moveRoutingDraft(kind, id, 1); break;
      case 'cfg-save': saveSettings(); break;
      case 'cfg-cancel': api.clearNotice?.(); openModal('cfg-cancel', '放弃未保存的设置？', '<p>将恢复最近保存的设置。已经保存的内容与排期保留。</p>', button('继续编辑', 'cfg-close', '', 'quiet') + button('放弃修改', 'cfg-cancel-confirm', '', 'primary')); break;
      case 'cfg-cancel-confirm': cfg.draft = clone(cfg.saved); resetPoolDrafts(); cfg.errors = {}; cfg.saveFailed = false; closeModal(); api.render(); break;
      case 'cfg-open-schedule': if (dirty()) requestNavigation('schedule'); else api.navigate('schedule'); break;
      case 'cfg-leave-discard': { const next = pendingNavigation; cfg.draft = clone(cfg.saved); resetPoolDrafts(); cfg.errors = {}; cfg.saveFailed = false; pendingNavigation = null; closeModal(); api.navigate(next); break; }
      case 'cfg-leave-save': { const next = pendingNavigation; if (saveSettings()) { pendingNavigation = null; api.navigate(next); } break; }
      case 'cfg-open-ai': if (dirty()) requestNavigation('ai'); else api.navigate('ai'); break;
      case 'cfg-pool-purpose': if (poolSlot(kind)) { cfg.poolKind = kind; api.render(); poolFocus('cfg-pool-purpose', kind); } break;
      case 'cfg-pool-channel-models': if (poolChannel(kind, channelId)) { cfg.openChannels[kind] = cfg.openChannels[kind] === channelId ? '' : channelId; api.render(); poolFocus('cfg-pool-channel-models', kind, channelId); } break;
      case 'cfg-pool-save': savePool(kind); break;
      case 'cfg-pool-import': importLegacyPool(kind); break;
      case 'cfg-parameters-save': saveParameters(kind); break;
      case 'cfg-pool-discard': case 'cfg-parameters-discard': {
        const parameters = action === 'cfg-parameters-discard';
        if (!(parameters ? parametersDirty(kind) : poolDirty(kind))) break;
        openModal('cfg-pool-discard', `放弃${poolLabel(kind)}${parameters ? '工作参数' : '资源池'}修改？`, `<p>恢复此用途${parameters ? '工作参数' : '渠道与模型'}上次读取的保存版本。其他用途与${parameters ? '渠道' : '工作参数'}草稿保留。</p>`, button('继续编辑', 'cfg-close', '', 'quiet') + button('放弃修改', parameters ? 'cfg-parameters-discard-confirm' : 'cfg-pool-discard-confirm', '', 'primary', `data-kind="${kind}"`)); break;
      }
      case 'cfg-pool-discard-confirm': if (poolSlot(kind)) { cfg.draft.resourcePool[kind] = clone(poolSlot(kind, cfg.saved)); poolBaselineRevisions[kind] = poolSlot(kind, cfg.saved).revision; delete cfg.poolStates[kind]; closeModal(); api.render(); poolFocus('cfg-pool-discard', kind); } break;
      case 'cfg-parameters-discard-confirm': if (cfg.saved.workParameters[kind]) { cfg.draft.workParameters[kind] = clone(cfg.saved.workParameters[kind]); parameterBaselines[kind] = clone(cfg.saved.workParameters[kind]); delete cfg.parameterStates[kind]; for (const key of Object.keys(cfg.errors).filter(key => key.startsWith(`parameters.${kind}.`))) delete cfg.errors[key]; closeModal(); api.render(); const section = $(`[data-cfg-work-parameters="${kind}"]`); if (section) section.open = true; } break;
      case 'cfg-pool-sample-key': if (cfg.editor?.scope === 'ai-channel') { cfg.editor.sampleKey = true; cfg.editor.removeApiKey = false; delete cfg.errors['pool.key']; cfg.editorFailed = false; poolChannelDialog(cfg.editor.kind, cfg.editor.id, true); } break;
      case 'cfg-pool-channel-new': if (poolSlot(kind)?.channels.length < 8) poolChannelDialog(kind); break;
      case 'cfg-pool-channel-edit': if (poolChannel(kind, channelId)) poolChannelDialog(kind, channelId); break;
      case 'cfg-pool-channel-save': {
        const row = cfg.editor; if (row?.scope !== 'ai-channel') break;
        const slot = poolSlot(row.kind), existing = poolChannel(row.kind, row.id); cfg.errors = {};
        if (!row.name.trim() || row.name.trim().length > 60) cfg.errors['pool.name'] = '请填写 1–60 字的渠道名称。';
        if (!demoEndpoint(row.baseUrl)) cfg.errors['pool.baseUrl'] = '请填写完整 HTTPS 示例地址（.example.test），不含账号、查询或片段。';
        if (!Number.isInteger(row.priority) || row.priority < 1 || row.priority > slot.channels.length + (existing ? 0 : 1)) cfg.errors['pool.priority'] = '请填写当前渠道范围内的整数优先级，1 最高。';
        if (!existing && slot.channels.length >= 8) cfg.errors['pool.name'] = '每个用途最多配置 8 个渠道。';
        if (row.keyStored && demoEndpoint(row.baseUrl) !== demoEndpoint(existing?.baseUrl) && !row.sampleKey && !row.removeApiKey) cfg.errors['pool.key'] = '接口地址已改变，请使用新示例密钥或明确移除原密钥。';
        if (Object.keys(cfg.errors).length) { cfg.editorFailed = true; poolChannelDialog(row.kind, row.id, true); break; }
        const values = { id: row.id, name: row.name.trim(), baseUrl: demoEndpoint(row.baseUrl), priority: row.priority, enabled: row.enabled, keyStored: row.keyStored, channelRevision: row.channelRevision, models: clone(row.models), ...(row.sampleKey ? { sampleKeyPending: true } : {}), ...(row.removeApiKey ? { removeApiKey: true } : {}) };
        const index = slot.channels.findIndex(item => item.id === row.id); if (index < 0) slot.channels.push(values); else slot.channels[index] = values;
        reorderPool(slot.channels, row.id, row.priority); cfg.openChannels[row.kind] = row.id; delete cfg.poolStates[row.kind]; cfg.editor = null; closeModal(); settingsChanged(); poolFocus('cfg-pool-channel-edit', row.kind, row.id); api.notify('渠道已加入资源池草稿，请保存资源池后生效。', { tone: 'success' }); break;
      }
      case 'cfg-pool-model-new': if ((poolChannel(kind, channelId)?.models.length ?? 64) < 64) poolModelDialog(kind, channelId); break;
      case 'cfg-pool-model-edit': if (poolChannel(kind, channelId)?.models.some(row => row.id === id)) poolModelDialog(kind, channelId, id); break;
      case 'cfg-pool-model-save': {
        const row = cfg.editor; if (row?.scope !== 'ai-model') break;
        const channel = poolChannel(row.kind, row.channelId); if (!channel) break;
        const index = channel.models.findIndex(item => item.id === row.originalId); cfg.errors = {};
        if (!/^[^\s\u0000-\u001f\u007f]{1,200}$/u.test(row.id)) cfg.errors['pool.model'] = '请填写 1–200 位模型 ID，不包含空白或控制字符。';
        else if (channel.models.some((item, position) => position !== index && item.id === row.id)) cfg.errors['pool.model'] = '这个模型已在当前渠道中，请编辑已有记录。';
        if (!Number.isInteger(row.priority) || row.priority < 1 || row.priority > channel.models.length + (index < 0 ? 1 : 0)) cfg.errors['pool.priority'] = '请填写当前模型范围内的整数优先级，1 最高。';
        if (index < 0 && channel.models.length >= 64) cfg.errors['pool.model'] = '每个渠道最多配置 64 个模型。';
        if (Object.keys(cfg.errors).length) { cfg.editorFailed = true; poolModelDialog(row.kind, row.channelId, row.originalId, true); break; }
        const values = { id: row.id, priority: row.priority, enabled: row.enabled, source: row.id !== row.originalId ? 'manual' : row.source };
        if (index < 0) channel.models.push(values); else channel.models[index] = values;
        reorderPool(channel.models, row.id, row.priority); cfg.openChannels[row.kind] = row.channelId; delete cfg.poolStates[row.kind]; cfg.editor = null; closeModal(); settingsChanged(); poolFocus('cfg-pool-model-edit', row.kind, row.channelId, row.id); api.notify('模型已加入资源池草稿，请保存资源池后生效。', { tone: 'success' }); break;
      }
      case 'cfg-pool-channel-up': case 'cfg-pool-channel-down': {
        const channel = poolChannel(kind, channelId); if (!channel) break;
        if (reorderPool(poolSlot(kind).channels, channel.id, channel.priority + (action.endsWith('-up') ? -1 : 1))) { delete cfg.poolStates[kind]; api.render(); poolFocus(action, kind, channelId); api.notify(`${channel.name}渠道优先级已调整为 ${channel.priority}，保存后生效。`); } break;
      }
      case 'cfg-pool-model-up': case 'cfg-pool-model-down': {
        const channel = poolChannel(kind, channelId), row = channel?.models.find(row => row.id === id); if (!row) break;
        if (reorderPool(channel.models, row.id, row.priority + (action.endsWith('-up') ? -1 : 1))) { delete cfg.poolStates[kind]; api.render(); poolFocus(action, kind, channelId, id); api.notify(`${row.id}模型优先级已调整为 ${row.priority}，保存后生效。`); } break;
      }
      case 'cfg-pool-channel-delete': {
        const channel = poolChannel(kind, channelId); if (channel) openModal('cfg-pool-delete', '删除 AI 渠道？', `<p>将“${h(channel.name)}”及其模型移出设置草稿。已有任务的实际渠道与模型记录保留；保存设置后供新任务选择。</p>`, button('保留渠道', 'cfg-close', '', 'quiet') + button('删除渠道', 'cfg-pool-channel-delete-confirm', '', 'primary', poolAttrs(kind, channelId))); break;
      }
      case 'cfg-pool-channel-delete-confirm': {
        const slot = poolSlot(kind); if (!slot) break; slot.channels = priorityOrder(slot.channels).filter(row => row.id !== channelId); normalizePriorities(slot.channels); cfg.saveFailed = false; closeModal(); api.render(); break;
      }
      case 'cfg-pool-model-delete': {
        const channel = poolChannel(kind, channelId), row = channel?.models.find(row => row.id === id); if (row) openModal('cfg-pool-delete', '删除渠道模型？', `<p>将模型“${h(row.id)}”移出设置草稿。原任务及请求记录保留，保存前可放弃设置修改。</p>`, button('保留模型', 'cfg-close', '', 'quiet') + button('删除模型', 'cfg-pool-model-delete-confirm', '', 'primary', poolAttrs(kind, channelId, id))); break;
      }
      case 'cfg-pool-model-delete-confirm': {
        const channel = poolChannel(kind, channelId); if (!channel) break; channel.models = priorityOrder(channel.models).filter(row => row.id !== id); normalizePriorities(channel.models); cfg.saveFailed = false; closeModal(); api.render(); break;
      }
      case 'cfg-pool-detect': {
        if (poolDetection?.state === 'running' && modalKind === 'cfg-pool-detection') break;
        const channel = poolChannel(kind, channelId, cfg.saved);
        if (channel && savedPoolConnection(kind, channelId)) poolDetectionDialog(kind, channelId); else api.notify('先保存接口或密钥修改，再检测模型。', { tone: 'error' }); break;
      }
      case 'cfg-pool-detect-run': beginPoolDetection(); break;
      case 'cfg-pool-availability-reset': {
        if (!poolSlot(kind)) break;
        if (api.restoreAiPriority) api.restoreAiPriority(kind); else (model().demoAiAvailability ||= {})[kind] = { candidates: [] };
        api.render(); api.notify('已清除本机暂不可用记录，后续按已保存优先级重新尝试；不会连接模型服务。', { tone: 'success' }); break;
      }
      case 'cfg-pool-detect-merge': {
        const detection = poolDetection; if (detection?.state !== 'success') break;
        const channel = poolChannel(detection.kind, detection.channelId);
        if (!channel || !savedPoolConnection(detection.kind, detection.channelId) || poolSlot(detection.kind, cfg.saved).revision !== detection.revision) { api.notify('渠道配置已变化，请重新检测后核对候选。', { tone: 'error' }); break; }
        const additions = detection.detectedModels.filter(id => !channel.models.some(row => row.id === id));
        if (channel.models.length + additions.length > 64) { api.notify('合并后超过 64 个模型，请先清理手工列表。', { tone: 'error' }); break; }
        channel.models.push(...additions.map(id => ({ id, priority: 0, enabled: false, source: 'detected' }))); normalizePriorities(channel.models);
        cfg.saveFailed = false; closeModal(); api.render(); api.notify(`已将 ${additions.length} 个检测模型加入设置草稿，默认停用；保存后生效。`, { tone: 'success' }); break;
      }
      case 'cfg-channel-edit': channelDialog(id); break;
      case 'cfg-channel-save': {
        const row = cfg.editor; if (!row?.channel) break; cfg.errors = {};
        if (row.channel === 'fonts' && !publicationReady()) { api.notify(settingsReadStatus(), { tone: 'error' }); break; }
        if (!row.name.trim()) cfg.errors['channel.name'] = '请填写配置名称。';
        if (!/^[a-zA-Z0-9][a-zA-Z0-9_/-]{0,59}$/.test(row.namespace) || row.namespace.includes('..')) cfg.errors['channel.namespace'] = '请使用 1–60 位英文字母、数字、短横线或目录分隔符，不填真实账号。';
        if (row.channel === 'resources' && row.provider === row.fallback) cfg.errors['channel.fallback'] = '备用渠道应与主渠道不同。';
        if (Object.keys(cfg.errors).length) { cfg.editorFailed = true; channelDialog(row.channel, true); break; }
        const { channel, ...values } = clone(row); cfg.draft.channels[channel] = values; cfg.editor = null; cfg.saveFailed = false; closeModal(); api.render(); api.notify('渠道配置已加入设置草稿。', { tone: 'success' }); break;
      }
      case 'cfg-channel-test': testDialog('channel', id); break;
      case 'cfg-font-resource-refresh': fontResourceDemo.error = ''; if (fontResourceDemo.scenario === 'failed') fontResourceDemo.scenario = 'available'; syncFontResourceCard(); break;
      case 'cfg-font-resource-import': if (fontResourceDemo.scenario === 'available' && !fontResourceDemo.imported) { fontResourceDemo.imported = true; syncFontResourceCard(); api.notify('已完成本页字体导入演示。正式后台需刷新字体菜单，再到发布中心发布资源。', { tone: 'success' }); } break;
      case 'cfg-open-font-delivery': if (dirty()) requestNavigation('release'); else api.navigate('release'); break;
      case 'cfg-editor-close': editorClose(); break;
      case 'cfg-editor-discard': cfg.editor = null; cfg.editorFailed = false; closeModal(); break;
      case 'cfg-editor-continue': reopenPoolEditor(); break;
      case 'cfg-test-run': {
        const test = cfg.test; if (!test || test.phase === 'running') break;
        test.outcome = $('#nx-cfg-test-outcome').value; test.phase = 'running'; testDialog(test.kind, test.id, true);
        setTimeout(() => { if (cfg.test !== test) return; test.phase = test.outcome; if (modalKind === 'cfg-test' && $('#modal')?.open && $('[data-workflow-modal="cfg-test"]')) testDialog(test.kind, test.id, true); }, 500); break;
      }
      case 'cfg-preferences-reset': openModal('cfg-reset-preferences', '恢复默认界面偏好？', '<p>将恢复舒适密度、内容管理入口与操作提示。内容、采集和日期范围保留。</p>', button('取消', 'cfg-close', '', 'quiet') + button('恢复到设置草稿', 'cfg-preferences-reset-confirm', 'undo', 'primary')); break;
      case 'cfg-preferences-reset-confirm': cfg.draft.preferences = clone(defaults.preferences); closeModal(); api.render(); break;
      case 'cfg-reset': openModal('cfg-reset', '重置本页设置演示？', '<p>将默认处理规则、示例模型、渠道与初始有效日期写入设置草稿。底部保存后生效，不移除内容或排期。</p>', button('取消', 'cfg-close', '', 'quiet') + button('重置到设置草稿', 'cfg-reset-confirm', 'undo', 'primary')); break;
      case 'cfg-reset-confirm': cfg.draft = clone(defaults); cfg.errors = {}; cfg.saveFailed = false; closeModal(); api.render(); break;
      default: api.notify('该操作的上下文已失效，请重新打开当前页面。');
    }
    return true;
  }
  window.addEventListener('beforeunload', event => { if (dirty() || (col.edit && JSON.stringify(col.edit) !== col.original) || (cfg.editor && JSON.stringify(cfg.editor) !== cfg.editorOriginal)) { event.preventDefault(); event.returnValue = ''; } });
  return {
    render(page) { currentPage = page; return page === 'collect' ? collectPage() : page === 'settings' ? settingsPage() : null; },
    handle,
    afterRender,
    beforeNavigate(page) {
      if (currentPage === 'collect' && col.edit && JSON.stringify(col.edit) !== col.original) { closeCandidate(); return false; }
      if (currentPage === 'settings' && page !== 'settings' && editorDirty()) { editorClose(); return false; }
      if (currentPage === 'settings' && page !== 'settings' && dirty()) { requestNavigation(page); return false; }
      return true;
    },
    reset() {
      ++settingsReadRun; settingsRead = { state: 'ready', revision: 'demo-publication', error: '' };
      fontResourceDemo = { scenario: 'current', imported: false, error: '' };
      ++aiReadRun; Object.assign(aiAccess, { readState: 'ready', canEditConfig: true, safeMode: false, ...api.initialAiResourceState });
      routingUpgrade = clone(initialRoutingUpgrade); routingSequence = 0;
      clearTimeout(detectionTimer); detectionTimer = null; ++detectionRun; poolDetection = null; poolSequence = 1;
      clearTimeout(timer); clearTimeout(loginTimer); timer = null; loginTimer = null; ++loginRun; sequence = 20; modalKind = ''; pendingNavigation = null;
      Object.assign(col, { rows: seedCandidates(), search: '', source: 'all', filter: 'pending', page: 0, selected: new Set(), selectionMode: false, selectedMatching: false, task: null, edit: null, original: '', errors: {}, preview: null, undo: null, result: null });
      const initial = defaultSettings();
      Object.keys(defaults).forEach(key => { defaults[key] = clone(initial[key]); });
      Object.assign(cfg, { tab: 'workflow', poolKind: 'annotation', openChannels: {}, poolStates: {}, parameterStates: {}, saved: clone(initial), draft: clone(initial), errors: {}, editor: null, editorOriginal: '', test: null, savedAt: '', saveFailed: false, editorFailed: false, loginOutcome: 'success' });
      resetPoolDrafts();
      poolDisclosures.clear();
      document.documentElement.dataset.density = initial.preferences.density;
      document.documentElement.dataset.demoMotion = initial.preferences.motion ? 'on' : 'off';
    },
  };
}
