// Review-only workspaces. Every task, account name and receipt below is fictional and memory-only.
// Same display contract as the protected workbench helper; all prototype pages share this export.
export function formatStudioDateTime(value, { timeZone, locale = 'zh-CN' } = {}) {
  const text = String(value ?? '').trim();
  if (!text) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (!Number.isFinite(date.getTime())) return text;
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23', timeZoneName: 'shortOffset', ...(timeZone ? { timeZone } : {}),
    });
    const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} ${parts.timeZoneName}`;
  } catch { return `${date.toISOString().replace('T', ' ').slice(0, 19)} UTC`; }
}

// Display-only state contract. A past receipt, a live session and a new package
// are separate facts; none of these labels authorizes an upload.
export function studioHostingStatus(value = {}) {
  const operation = value.lastOperation, phase = operation?.state;
  if (value.running === true) return { label: '执行中', tone: 'blue', attention: false };
  if (value.readNeedsVerify === true || phase === 'unknown' || phase === 'published' && operation?.verified !== true) return { label: '结果待核验', tone: 'warn', attention: true };
  if (['pending', 'queued', 'running'].includes(phase)) return { label: '执行状态待核验', tone: 'warn', attention: true };
  if (operation?.verified === true && phase === 'published') return { label: '已发布并核验', tone: 'good', attention: false };
  if (operation?.verified === true && phase === 'unchanged') return { label: '已核验 · 未变更', tone: 'good', attention: false };
  if (phase === 'failed') return { label: '操作失败', tone: 'warn', attention: true };
  if (phase === 'paused') return { label: '已暂停', tone: '', attention: false };
  if (phase === 'cancelled') return { label: '后续已取消', tone: '', attention: false };
  return { label: operation ? '状态待确认' : '暂无托管记录', tone: operation ? 'warn' : '', attention: !!operation };
}

// One fictional resource pool feeds settings, task planning and simulated requests.
// It contains no endpoints, credentials or projections from the protected workbench.
export function createStudioAiResourcePool() {
  const channel = (id, name, priority, models) => ({
    id, name, priority, enabled: true, keyStored: true, channelRevision: `demo-${id}-1`,
    models: models.map((id, index) => ({ id, priority: index + 1, enabled: true, source: 'manual' })),
  });
  return {
    schemaVersion: 1,
    annotation: { revision: 'demo-annotation-1', configured: true, channels: [
      channel('demo-annotation-main', '标注主渠道 · 示例', 1, ['annotation-demo', 'annotation-compact-demo']),
      channel('demo-annotation-backup', '标注备用渠道 · 示例', 2, ['annotation-backup-demo']),
    ] },
    generation: { revision: 'demo-generation-1', configured: true, channels: [
      channel('demo-generation-main', '图像主渠道 · 示例', 1, ['image-demo', 'image-light-demo']),
      channel('demo-generation-backup', '图像备用渠道 · 示例', 2, ['image-backup-demo']),
    ] },
  };
}

export function studioAiCandidates(pool, kind, availability = {}) {
  const slot = pool?.[kind];
  if (!Array.isArray(slot?.channels)) return [];
  const ordered = rows => [...rows].sort((a, b) => a.priority - b.priority || String(a.id).localeCompare(String(b.id)));
  const candidates = ordered(slot.channels).filter(channel => channel.enabled && channel.keyStored).flatMap(channel =>
    ordered(channel.models || []).filter(model => model.enabled).map(model => ({
      kind, channelId: channel.id, channelName: channel.name, model: model.id,
      channelPriority: channel.priority, modelPriority: model.priority, poolRevision: slot.revision, channelRevision: channel.channelRevision,
    }))).filter(route => !(availability[kind]?.candidates || []).some(row => row.channelId === route.channelId && row.model === route.model && (row.channelRevision === undefined || row.channelRevision === route.channelRevision) && row.available === false));
  return candidates.map(route => ({ ...route, candidateCount: candidates.length }));
}

export function createDeliveryPages(api) {
  const { h, icon, button: b, status, tags } = api;
  const $ = selector => document.querySelector(selector);
  const model = () => api.getModel();
  const entries = () => model().entries.filter(row => row.pool !== 'trash');
  const find = id => model().entries.find(row => row.id === id);
  const text = row => row?.text?.replace(/\n/g, '') || '内容待补充';
  const firstId = () => entries()[0]?.id || '';
  const dateRows = () => {
    const start = new Date(`${model().schedule.start}T00:00:00Z`), end = new Date(`${model().schedule.end}T00:00:00Z`), result = [];
    for (let date = start; date <= end && result.length < 366; date = new Date(date.getTime() + 86400000)) result.push(date.toISOString().slice(0, 10));
    return result;
  };
  const image = row => {
    const asset = model().assets.find(asset => asset.id === row?.defaults?.imageId);
    return asset?.previewUrl || api.backgroundImage(asset?.art || 'mist');
  };
  const close = () => api.closeModal();
  const attrs = (key, value) => `data-${key}="${h(value)}"`;
  const head = (title, subtitle, action = '') => `<div class="page-heading"><div><h1>${h(title)}</h1><p>${subtitle}</p></div>${action}</div>`;
  const back = (title, action) => `<div class="nx-subhead">${b('返回列表', action, 'left', 'quiet small')}<span>/</span><strong>${h(title)}</strong></div>`;
  const empty = (title, description) => `<div class="empty">${icon('inbox')}<strong>${h(title)}</strong>${h(description)}</div>`;
  const tabs = (rows, value, action) => `<div class="tabs" role="tablist">${rows.map(([id, label]) => `<button role="tab" class="tab" data-action="${action}" data-value="${id}" aria-selected="${id === value}">${label}</button>`).join('')}</div>`;
  const field = (label, body, hint = '') => `<label class="field"><span>${label}</span>${body}${hint ? `<small class="nx-field-note">${hint}</small>` : ''}</label>`;
  const select = (id, rows, value) => `<select id="${id}">${rows.map(([key, label]) => `<option value="${h(key)}" ${key === value ? 'selected' : ''}>${h(label)}</option>`).join('')}</select>`;
  const checkbox = (id, label, checked = true) => `<label class="nx-check"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>${label}</label>`;
  const badge = state => status(({ queued: '等待处理', running: '处理中', paused: '已暂停', completed: '已完成 · 模拟', failed: '处理失败', unknown: '结果待核对', cancelled: '已取消', blocked: '条件不足' })[state] || state, ({ completed: 'good', running: 'blue', failed: 'warn', unknown: 'warn', blocked: 'warn' })[state] || '');
  const notice = (message, warn = false) => `<div class="notice${warn ? ' warn' : ''}">${icon(warn ? 'help' : 'check')}${message}</div>`;
  let sequence = 10;
  let lastModel = model();
  let aiView = 'list', aiTab = 'tasks', aiFilter = 'all', aiSearch = '', activeTask = '', detailTab = 'overview';
  let taskForm = null, taskPreview = null, taskFormBaseline = '', focusTarget = '';
  const defaultAiPool = createStudioAiResourcePool();
  const aiPool = () => model().demoAiResourcePool || defaultAiPool;
  const aiPurpose = kind => kind === 'image' ? 'generation' : 'annotation';
  const aiPoolBindings = (kind, pool = aiPool()) => Object.fromEntries((kind === 'image' ? ['annotation', 'generation'] : ['annotation']).map(purpose => [purpose, pool[purpose]?.revision]));
  const taskPoolStale = task => Object.entries(task.poolBindings || { [aiPurpose(task.kind)]: task.plannedResourceRoute?.poolRevision }).some(([purpose, revision]) => !revision || revision !== aiPool()[purpose]?.revision);
  const taskNeedsRepreview = task => task.repreviewRequired || taskPoolStale(task);
  const aiCandidates = kind => studioAiCandidates(aiPool(), aiPurpose(kind), model().demoAiAvailability || {});
  const routeLabel = route => route ? `${route.channelName} / ${route.model}` : '暂无可用渠道与模型';
  const sameRoute = (a, b) => !!a && !!b && a.channelId === b.channelId && a.model === b.model;
  const routeFailureMessage = failure => ({ 'quota-exhausted': '原渠道额度耗尽', 'auth-invalid': '原渠道认证失效', 'endpoint-unavailable': '原渠道接口不可用', 'model-unavailable': '原模型不可用', 'rate-limited': '原渠道短暂限流，当前暂缓，冷却后恢复已保存优先级' })[failure?.reason] || '原候选暂不可用';
  const requestRoute = route => route && ({ kind: route.kind, channelId: route.channelId, channelName: route.channelName, model: route.model, channelPriority: route.channelPriority, modelPriority: route.modelPriority, poolRevision: route.poolRevision });
  function initialTaskRoute(kind, completed) {
    const route = requestRoute(aiCandidates(kind)[0]);
    return { plannedResourceRoute: route, resourceRoute: completed ? structuredClone(route) : null, poolBindings: aiPoolBindings(kind), repreviewRequired: false, resourceRequests: [], excludedChannels: [], excludedModels: [], nextResourceRoute: null };
  }
  const initialTasks = () => [
    { id: 'demo-ai-01', name: '本周内容语义标注', kind: 'annotate', ids: entries().slice(0, 3).map(row => row.id), state: 'completed', done: Math.min(3, entries().length), created: '2026-11-02T01:30:00.000Z', skipProtected: true, log: ['已冻结示例范围', '主题、情绪与意象已展示'], scenario: 'normal' },
    { id: 'demo-ai-02', name: '山野主题配图', kind: 'image', ids: entries().slice(0, 2).map(row => row.id), state: 'paused', done: 1, created: '2026-11-02T02:10:00.000Z', skipProtected: true, log: ['已准备首张示例配图', '已在阶段边界暂停'], scenario: 'normal' },
    { id: 'demo-ai-03', name: '备选内容标注', kind: 'annotate', ids: entries().slice(-1).map(row => row.id), state: 'failed', done: 0, created: '2026-11-02T02:20:00.000Z', skipProtected: true, log: ['示例服务明确拒绝请求，未执行处理'], scenario: 'failure' },
  ].map(task => {
    const route = requestRoute(studioAiCandidates(defaultAiPool, aiPurpose(task.kind))[0]);
    return { ...task, model: route.model, plannedResourceRoute: structuredClone(route), resourceRoute: structuredClone(route), poolBindings: aiPoolBindings(task.kind, defaultAiPool), repreviewRequired: false, excludedChannels: [], excludedModels: [], nextResourceRoute: null,
      resourceRequests: [{ id: `${task.id}-request-01`, state: task.state === 'failed' ? 'failed' : 'success', resourceRoute: structuredClone(route) }] };
  });
  let tasks = initialTasks();
  let pubTab = 'current', pubView = 'home', articleMode = 'single', articleKind = 'news', articleTarget = 'draft';
  let articleDate = Object.keys(model().bindings).sort()[0] || dateRows()[0];
  let articleTitle = '', articleSummary = '', articleAuthor = '', articlePreview = false, articleSignature = '', articleLink = true;
  const previewMedia = typeof window !== 'undefined' ? window.matchMedia?.('(max-width: 800px)') : null;
  let articlePreviewOpen = null, articlePreviewRevision = 0, rememberedPreview = null, mountedPreviewKey = '';
  const paintedPreviews = new WeakSet();
  let batchDates = new Set(dateRows().slice(0, 7)), resourceDates = new Set(Object.keys(model().bindings));
  let batchRangeStart = model().schedule.start, batchRangeEnd = model().schedule.end;
  let loadedBatchRange = { start: batchRangeStart, end: batchRangeEnd }, batchResultFilter = 'all', jobResultFilter = 'all';
  const publicationDetails = new Map();
  let resourceChecked = false, resourceDraft = null, pubPlan = null, activeJob = null, inspectedJob = null, historyRows = [], recordId = '', historyFilter = 'all';
  let hostingConnected = false, resourceCheckSignature = '';
  let channelState = { mirror: true, archive: true }, simulatedScenario = 'normal';
  const fontChannels = [['uploadthing', 'UploadThing'], ['github-mirror', 'GitHub 镜像'], ['axxiu', 'AxureShow']];
  const fontReceipts = new Map();
  let fontPlan = null, fontReconcile = null, fontBenchmark = null, fontApplyPlan = null, fontSelection = '', fontScenario = 'normal', fontSpeedScenario = 'normal';
  const formalFonts = () => (api.getFontCatalog?.() || api.getCatalog?.()?.fonts || []).filter(row => row.id !== 'system');
  const fontChannel = () => model().demoFontChannel || { enabled: true, sampleToken: false };
  const fontOrder = () => model().demoFontRouting || fontChannels.map(([id]) => id);
  const fontChannelName = id => fontChannels.find(([key]) => key === id)?.[1] || id;
  const fontOrderText = order => order.map(fontChannelName).join(' → ');
  // Freeze the validated shared metadata. This prototype never creates a byte-verification digest.
  const fontSource = font => font && ({ id: font.id, name: font.name, family: font.family, nativeUrl: font.nativeUrl, nativeBytes: font.nativeBytes, nativeSha256: font.nativeSha256, licenseUrl: font.licenseUrl, licenseSha256: font.licenseSha256 });
  const fontSourceReady = font => !!font && /\.ttf$/.test(font.nativeUrl || '') && Number.isSafeInteger(font.nativeBytes) && font.nativeBytes > 0 && /^[a-f0-9]{64}$/.test(font.nativeSha256 || '') && !!font.licenseUrl && /^[a-f0-9]{64}$/.test(font.licenseSha256 || '');
  const fontSourceSignature = font => JSON.stringify(fontSource(font));
  const fontBinding = id => JSON.stringify([fontSource(formalFonts().find(row => row.id === id)), fontChannel(), fontOrder(), fontReceipts.get(id)]);
  const selectedFont = () => formalFonts().find(row => row.id === fontSelection) || formalFonts()[0];
  const receiptMatches = font => fontChannel().enabled && fontReceipts.get(font.id)?.state === 'completed' && fontReceipts.get(font.id).sourceSignature === fontSourceSignature(font);
  const effectiveFontOrder = font => fontOrder().filter(id => id !== 'uploadthing' || receiptMatches(font));
  const pendingFontReceipt = () => [...fontReceipts.values()].find(row => ['unknown', 'verification-failed'].includes(row.state));
  function clearFontPlans() { fontPlan = null; fontReconcile = null; fontApplyPlan = null; }
  const validDates = dates => { const valid = new Set(dateRows()); return [...dates].filter(date => valid.has(date)).sort(); };
  const signature = dates => JSON.stringify([...dates].sort().map(date => [date, model().bindings[date], find(model().bindings[date]?.entryId)]));
  const snapshot = dates => [...dates].sort().map(date => { const row = find(model().bindings[date]?.entryId); return { date, entry: structuredClone(row), imagePath: image(row) }; });
  const problems = dates => [...dates].sort().map(date => ({ date, binding: model().bindings[date], entry: find(model().bindings[date]?.entryId) })).filter(row => !row.entry || row.entry.pool !== 'formal' || !row.entry.text?.trim() || model().assets.find(asset => asset.id === row.entry.defaults?.imageId)?.review !== '已审核');
  const batchRangeStale = () => batchRangeStart !== loadedBatchRange.start || batchRangeEnd !== loadedBatchRange.end;
  const batchAvailableDates = () => dateRows().filter(date => date >= loadedBatchRange.start && date <= loadedBatchRange.end);
  const detailAttrs = (key, initial = false) => `data-pub-details="${h(key)}" ${(publicationDetails.get(key) ?? initial) ? 'open' : ''}`;
  function capturePublicationDetails() {
    document.querySelectorAll('details[data-pub-details]').forEach(node => publicationDetails.set(node.dataset.pubDetails, node.open));
  }
  const previewViewportChanged = () => {
    const disclosure = $('[data-article-preview-toggle]');
    if (disclosure && articlePreviewOpen === null) disclosure.open = !previewMedia?.matches;
  };
  previewMedia?.addEventListener?.('change', previewViewportChanged);
  function articlePreviewKey() {
    return articlePreview ? JSON.stringify([articleKind, articleDate, articlePreviewRevision, articleTitle, articleAuthor, articleSummary, signature([articleDate])]) : `empty:${articleKind}:${articleDate}`;
  }
  function publicationFilters(rows, value, action) {
    return `<div class="nx-result-filters" role="group" aria-label="结果筛选">${rows.map(([key, label, count]) => b(`${label} ${count}`, action, '', value === key ? 'small filter-active' : 'small quiet', `${attrs('value', key)} aria-pressed="${value === key}"`)).join('')}</div>`;
  }
  function ensureReset() {
    if (lastModel === model()) return;
    // Shared content transactions may replace the model. A full reset is identified by its initial records.
    lastModel = model();
    if (!find(firstId())) { articlePreview = false; resourceChecked = false; }
  }
  function taskActions(task, compact = false) {
    const id = attrs('id', task.id), size = compact ? 'quiet small' : 'small';
    let buttons = b('查看详情', 'ai-detail', 'right', size, id);
    if (!['completed', 'cancelled', 'unknown'].includes(task.state) && taskNeedsRepreview(task)) return buttons + b('重新预演任务', 'ai-repreview', 'arrow', 'primary small', id);
    if (['queued', 'running'].includes(task.state)) buttons += b('暂停', 'ai-pause', '', 'small', id);
    if (task.state === 'paused') buttons += b('继续', 'ai-resume', '', 'primary small', id);
    if (task.state === 'failed') buttons += b('从失败阶段恢复', 'ai-retry', '', 'primary small', id);
    if (task.state === 'unknown') buttons += b('核对原任务', 'ai-reconcile', '', 'small', id);
    return buttons;
  }
  const sessionResult = task => ({ completed: '请求成功', failed: '请求失败', unknown: '请求结果待核对', running: '请求中', paused: '请求已暂停', cancelled: '请求已取消', queued: '等待请求' })[task.state] || '状态未记录';
  const taskSteps = confirmation => `<ol class="nx-task-wizard-steps" aria-label="创建任务步骤"><li aria-current="${confirmation ? 'false' : 'step'}">1 · 配置任务</li><li aria-current="${confirmation ? 'step' : 'false'}">2 · 核对并确认</li></ol>`;
  function availableTaskRoutes(task) {
    return aiCandidates(task.kind).filter(route => !(task.excludedChannels || []).includes(route.channelId) && !(task.excludedModels || []).includes(`${route.channelId}/${route.model}`));
  }
  function taskRoutingState(task) {
    if (['completed', 'cancelled', 'unknown'].includes(task.state)) return { next: null, message: '' };
    const routes = availableTaskRoutes(task), selected = task.nextResourceRoute || task.resourceRoute || task.plannedResourceRoute;
    if (taskNeedsRepreview(task)) {
      const channel = aiPool()[aiPurpose(task.kind)]?.channels.find(channel => channel.id === task.plannedResourceRoute?.channelId);
      const reason = !channel || !channel.enabled || !channel.keyStored ? '预选渠道已停用、移除或缺少示例凭据' : '资源池已变化';
      return { next: routes[0], repreviewRequired: true, message: `${reason}；请重新预演并创建任务；下一候选：${routeLabel(routes[0])}` };
    }
    if (task.nextResourceRoute) {
      const next = routes[0], reason = task.resourceFailure ? routeFailureMessage(task.resourceFailure) : '按已保存优先级重新选择';
      return { next, message: `${reason}；下一候选：${routeLabel(next)}` };
    }
    if (selected && !routes.some(route => sameRoute(route, selected))) {
      const channel = aiPool()[aiPurpose(task.kind)]?.channels.find(channel => channel.id === selected.channelId);
      const unavailable = model().demoAiAvailability?.[aiPurpose(task.kind)]?.candidates?.find(row => sameRoute(row, selected) && row.available === false);
      const reason = task.resourceFailure || unavailable ? routeFailureMessage(task.resourceFailure || unavailable) : !channel || !channel.enabled || !channel.keyStored ? '预选渠道已停用、移除或缺少示例凭据' : '预选模型已停用或移除';
      return { next: routes[0], message: `${reason}；下一候选：${routeLabel(routes[0])}` };
    }
    if (task.simulatedRateLimitCooldown?.phase === 'elapsed') return { next: routes[0], message: '已沿备用渠道继续；下一次推进会模拟 60 秒冷却结束，按已保存优先级重新选择候选' };
    return { next: null, message: '' };
  }
  function taskRouteLine(task) {
    const routing = taskRoutingState(task);
    return `<p class="nx-ai-route-line">${task.resourceRoute ? '实际使用 · 模拟' : '预选渠道 / 模型'}：${h(routeLabel(task.resourceRoute || task.plannedResourceRoute))}</p>${routing.message ? `<p class="nx-ai-route-warning">${h(routing.message)}</p>` : ''}`;
  }
  function taskRoutingPanel(task) {
    const routing = taskRoutingState(task);
    const reasons = { 'quota-exhausted': '额度耗尽', 'auth-invalid': '认证失效', 'endpoint-unavailable': '接口不可用', 'model-unavailable': '模型不可用', 'rate-limited': '短暂限流' };
    return `<section class="nx-ai-routing" data-task-routing><h3>渠道与模型</h3><dl class="nx-definition"><dt>预选候选</dt><dd>${h(routeLabel(task.plannedResourceRoute))}</dd><dt>实际使用</dt><dd>${task.resourceRoute ? h(routeLabel(task.resourceRoute)) + ' · 模拟请求' : '尚未发起演示请求'}</dd><dt>选择规则</dt><dd>用途匹配 → 渠道优先级 → 模型优先级，1 最高</dd></dl>
      ${routing.message ? `<p class="notice warn" role="status" data-next-resource-route>${h(routing.message)}${routing.repreviewRequired ? '；原任务已暂停，已有产物和请求记录保留。' : routing.next ? '；下一阶段沿原任务继续。' : '；请先保存可用资源池，再沿原任务恢复。'}</p>` : ''}
      ${task.resourceRequests.length ? `<details class="nx-ai-resource-requests"><summary>本任务的模拟请求记录 · ${task.resourceRequests.length} 次</summary><ol>${task.resourceRequests.map(request => `<li data-resource-request="${h(request.id)}"><strong>${h(routeLabel(request.resourceRoute))}</strong><small>${h(request.id)} · ${request.state === 'success' ? '请求成功 · 模拟' : request.state === 'unknown' ? '结果待核对 · 未重放' : '请求失败 · 模拟'}${request.resourceFailure ? ` · ${reasons[request.resourceFailure.reason] || '明确失败'}（${request.resourceFailure.scope === 'channel' ? '切换渠道' : '处理当前模型'}）` : ''}</small></li>`).join('')}</ol></details>` : ''}</section>`;
  }
  const previewRouteCurrent = () => !!taskPreview && taskPreview.plannedResourceRoute?.poolRevision === aiPool()[aiPurpose(taskPreview.kind)]?.revision && sameRoute(taskPreview.plannedResourceRoute, aiCandidates(taskPreview.kind)[0]);
  function rememberUnavailable(route, failure) {
    const availability = model().demoAiAvailability ||= {}, slot = availability[route.kind] ||= { candidates: [] };
    const routes = studioAiCandidates(aiPool(), route.kind).filter(candidate => failure.scope === 'channel' ? candidate.channelId === route.channelId : sameRoute(candidate, route));
    for (const candidate of routes) {
      slot.candidates = slot.candidates.filter(row => !sameRoute(row, candidate));
      slot.candidates.push({ channelId: candidate.channelId, model: candidate.model, channelRevision: candidate.channelRevision, available: false, reason: failure.reason, ...(failure.reason === 'rate-limited' ? { retryAt: new Date(Date.now() + 60_000).toISOString() } : {}) });
    }
  }
  function restoreAiPriority(kind) {
    if (!['annotation', 'generation'].includes(kind)) return;
    (model().demoAiAvailability ||= {})[kind] = { candidates: [] };
    for (const task of tasks.filter(task => aiPurpose(task.kind) === kind && !['unknown', 'completed', 'cancelled'].includes(task.state))) {
      task.excludedChannels = []; task.excludedModels = []; task.nextResourceRoute = requestRoute(aiCandidates(task.kind)[0]); task.resourceFailure = null; task.simulatedRateLimitCooldown = null;
      task.log.push('已清除本机暂不可用记录；后续按已保存优先级重新尝试 · 模拟');
    }
  }
  function pauseTaskForPool(task) {
    if (!task.repreviewRequired) task.log.push('资源池已保存新配置，原任务暂停；重新预演后才可创建新的演示请求，已有产物保留');
    task.state = 'paused'; task.repreviewRequired = true; task.nextResourceRoute = requestRoute(aiCandidates(task.kind)[0]);
  }
  function syncAiResourcePool() {
    for (const task of tasks.filter(task => ['queued', 'running', 'paused'].includes(task.state) && taskPoolStale(task))) pauseTaskForPool(task);
  }
  function aiList() {
    const rows = tasks.filter(task => (aiFilter === 'all' || task.state === aiFilter) && (!aiSearch || task.name.includes(aiSearch)));
    return head('AI 任务', '进度、产物与异常集中在一起，每一步都有迹可循。', b('新建任务', 'ai-new', 'plus', 'primary')) + `<section class="panel nx-ai ${aiTab === 'sessions' ? 'nx-ai-session-list' : 'nx-ai-task-list'}"><div class="panel-top">${tabs([['tasks', '任务列表'], ['sessions', '会话记录']], aiTab, 'ai-tab')}<span class="nx-demo-label">内存模拟 · 未连接模型</span></div><div class="toolbar nx-ai-list-filters"><label class="search-field">${icon('search')}<input id="ai-search" value="${h(aiSearch)}" placeholder="搜索任务名称" aria-label="搜索任务名称"></label><div class="toolbar-right">${select('ai-status', [['all', '全部状态'], ['running', '处理中'], ['paused', '已暂停'], ['completed', '已完成'], ['failed', '处理失败'], ['unknown', '待核对']], aiFilter)}${b('搜索', 'ai-search', 'search', 'small')}</div></div>${rows.length ? `<div class="task-list">${rows.map(task => `<div class="task-row"><span class="task-symbol">${icon(task.kind === 'image' ? 'image' : 'sparkle')}</span><div class="task-description"><h3>${h(aiTab === 'sessions' ? task.model : task.name)}</h3>${aiTab === 'sessions' ? `<p><time datetime="${h(task.created)}">${h(formatStudioDateTime(task.created))}</time></p>` : `<p>${task.kind === 'image' ? '内容配图' : '语义标注'} · ${task.ids.length} 条准确内容 · <time datetime="${h(task.created)}">${h(formatStudioDateTime(task.created))}</time></p>`}${taskRouteLine(task)}</div>${aiTab === 'sessions' ? `<details class="nx-session-identifiers nx-session-list-identifiers"><summary>会话与关联标识</summary><dl class="nx-definition"><dt>演示任务</dt><dd>${h(task.name)}<br><code>${h(task.id)}</code></dd><dt>所选内容</dt><dd>${task.ids.length} 条 · ${task.ids.map(h).join('、')}</dd></dl></details><div class="nx-session-list-result">${status(sessionResult(task), task.state === 'failed' || task.state === 'unknown' ? 'warn' : task.state === 'completed' ? 'good' : '')}<p class="nx-tiny">${task.kind === 'image' ? '图像生成' : '语义标注'} · 模拟会话</p></div>${b('查看会话', 'ai-session', 'right', 'small nx-session-list-action', attrs('id', task.id))}` : `<div class="nx-task-progress-summary"><div class="task-progress"><div class="progress"><span style="width:${task.ids.length ? task.done / task.ids.length * 100 : 0}%"></span></div><small>${task.done} / ${task.ids.length} 已处理</small></div>${badge(task.state)}</div><div class="button-row">${taskActions(task, true)}</div>`}</div>`).join('')}</div>` : empty('暂无符合条件的任务', '更换筛选，或创建一个新的演示任务。')}<div class="split-note"><span>共 ${rows.length} 个任务</span><span>模拟状态不代表模型调用或真实产物生成</span></div></section>`;
  }
  function newTask() {
    if (!taskForm) {
      taskForm = { name: '', kind: 'annotate', ids: entries().slice(0, 2).map(row => row.id), model: aiCandidates('annotate')[0]?.model || '', skip: true, protect: true, prompt: '', scenario: 'normal' };
      taskFormBaseline = JSON.stringify(taskForm);
    }
    if (taskPreview) return taskConfirmation();
    const form = taskForm, candidates = aiCandidates(form.kind), primary = candidates[0];
    return back('新建任务', 'ai-list') + head('新建 AI 任务', '先选择准确内容范围，再核对并确认。') + taskSteps(false) + `<div class="nx-form-layout nx-ai nx-task-configuration"><section class="panel nx-form-card"><h2>任务信息</h2>${field('任务名称（选填）', `<input id="ai-name" maxlength="50" placeholder="例如：下周内容语义标注" value="${h(form.name)}">`)}${field('任务类型', select('ai-kind', [['annotate', '内容语义标注'], ['image', '内容配图']], form.kind))}
      <section class="nx-ai-plan-routing" aria-label="资源池选择"><div class="field-grid">${field('优先渠道', `<input value="${h(primary?.channelName || '暂无可用渠道')}" readonly>`)}${field('优先模型', `<input id="ai-model" value="${h(primary?.model || '暂无可用模型')}" readonly>`)}</div><p>${candidates.length} 个启用候选 · 渠道与模型优先级均为 1 最高。${primary ? '失效后保留实际请求记录，按范围切换候选。' : '请先配置并保存可用的渠道与模型。'}</p>${b('管理 AI 资源池', 'ai-resource-pool', 'settings', 'quiet small')}</section>
      ${field('准确内容范围', `<div class="nx-selection-list">${entries().map(row => `<label class="nx-selection"><input type="checkbox" data-ai-entry="${row.id}" ${form.ids.includes(row.id) ? 'checked' : ''}><span><strong>${h(text(row))}</strong><small>${h(row.author)} · ${row.pool === 'formal' ? '正式' : row.pool === 'draft' ? '草稿' : '备选'}</small></span></label>`).join('')}</div>`)}${field(form.kind === 'image' ? '补充画面要求' : '补充标注要求', `<textarea id="ai-prompt" maxlength="300" placeholder="选填；例如：优先自然意象，保持表达克制">${h(form.prompt)}</textarea>`)}<div class="nx-check-stack">${checkbox('ai-skip', '跳过已保护的人工标签或配图', form.skip)}${checkbox('ai-protect', '保留已有结果，失败后从原阶段恢复', form.protect)}</div><details class="nx-scenario"><summary>查看异常交互</summary>${field('本次演示状态', select('ai-scenario', [['normal', '正常推进'], ['channel-quota', '渠道额度耗尽，切换下一渠道'], ['auth-invalid', '认证失效，切换下一渠道'], ['endpoint-unavailable', '接口不可用，切换下一渠道'], ['model-unavailable', '模型不可用，优先同渠道下一模型'], ['rate-limited', '渠道短暂限流，先切备用，冷却后恢复优先级'], ['failure', '请求明确失败，保留阶段'], ['unknown', '结果未知，等待核对']], form.scenario))}</details><div class="nx-form-footer">${b('取消', 'ai-list', '', 'quiet')}${b('预演任务范围', 'ai-plan', 'arrow', 'primary', primary ? '' : 'disabled')}</div><p id="ai-form-error" class="nx-error" role="alert"></p></section><aside class="panel nx-aside-card"><span class="nx-eyebrow">任务流程</span><h3>一次发起，按原任务继续</h3><div class="steps">${[['选择范围', '只处理明确选中的内容。'], ['确认任务', '展示数量、类型、首选候选与保护策略。'], ['追踪结果', '实际渠道、模型和切换原因保留在原任务。']].map(([title, desc], index) => `<div class="step"><span class="step-number">${index + 1}</span><div><h4>${title}</h4><p>${desc}</p></div></div>`).join('')}</div>${notice('本稿不调用模型，进度和回执均为演示。')}</aside></div>`;
  }
  function taskConfirmation() {
    const form = taskPreview, rows = form.ids.map(find).filter(Boolean);
    return back('新建任务', 'ai-list') + head('新建 AI 任务', '预演已完成，核对范围后再确认。') + taskSteps(true) + `<section class="panel nx-form-card nx-task-confirmation"><h2 id="ai-preview-heading" tabindex="-1">核对本次发送</h2><p class="nx-modal-lead">${h(form.name || '未命名任务')}</p><dl class="nx-definition"><dt>任务类型</dt><dd>${form.kind === 'image' ? '内容配图' : '语义标注'}</dd><dt>准确数量</dt><dd>${rows.length} 条内容</dd><dt>优先渠道</dt><dd>${h(form.plannedResourceRoute.channelName)}</dd><dt>优先模型</dt><dd>${h(form.plannedResourceRoute.model)}</dd><dt>候选数量</dt><dd>${form.candidateCount} 个 · 按渠道与模型优先级选择</dd><dt>保护策略</dt><dd>${form.skip ? '跳过已保护项' : '展示范围内处理'}</dd><dt>费用</dt><dd>本页内存模拟；真实费用未知</dd></dl><div class="nx-freeze-list">${rows.map(row => `<p>${h(text(row))}<small>${h(row.author)}</small></p>`).join('')}</div>${!previewRouteCurrent() ? notice('资源池已变化，请返回调整并重新预演渠道与模型。', true) : ''}${notice('只创建内存演示任务，不调用模型；演示完成不代表真实业务结果。')}${checkbox('ai-task-consent', '我已核对准确范围、任务类型与首选渠道模型，确认创建这份演示任务', false)}<div class="nx-form-footer">${b('返回调整', 'ai-preview-back', '', 'quiet')}${b('确认创建演示任务', 'ai-create', 'check', 'primary', 'id="ai-create-confirm" disabled')}</div></section>`;
  }
  function sessionDetails(task, rows, done) {
    const failure = task.state === 'failed' ? task.log.at(-1) || '示例模型请求失败，原任务保留。' : task.state === 'unknown' ? '本次请求结果待核对，不能直接重试。' : '';
    const failureSummary = failure.length > 160 ? failure.slice(0, 160) + '…（完整内容见错误详情）' : failure;
    const request = JSON.stringify({ model: task.resourceRoute?.model || task.model, resourceRoute: task.resourceRoute, taskId: task.id, contents: rows.map(row => ({ text: text(row), author: row.author })) }, null, 2);
    const response = done ? '演示请求已完成；产物与后续处理仍需分别查看。' : task.state === 'failed' ? '示例请求被明确拒绝，没有返回新的结果。' : task.state === 'unknown' ? '响应未得到确认，保留原任务。' : '示例任务等待继续推进。';
    return `<div class="nx-session"><section class="nx-session-summary"><div class="nx-session-meta"><h3 id="ai-session-heading" tabindex="-1">会话概况</h3>${status(sessionResult(task), failure ? 'warn' : done ? 'good' : '')}</div>${failure ? `<p class="notice warn" role="alert">${h(failureSummary)}</p>` : '<p class="nx-tiny">本条演示未记录错误；不代表真实模型或后处理已经成功。</p>'}<dl class="nx-definition"><dt>实际渠道</dt><dd>${h(task.resourceRoute?.channelName || '尚未发起演示请求')}</dd><dt>实际模型</dt><dd>${h(task.resourceRoute?.model || '—')}</dd><dt>请求时间</dt><dd>${h(formatStudioDateTime(task.created))}</dd><dt>完成时间</dt><dd>${done ? h(formatStudioDateTime(task.created)) + ' · 演示时间' : '—'}</dd><dt>阶段</dt><dd>${task.kind === 'image' ? '图像生成' : '语义标注'} · 模拟会话</dd></dl>${b('查看原任务', 'ai-session-task', 'arrow', 'small', attrs('id', task.id))}<details class="nx-session-identifiers"><summary>任务与会话标识</summary><p>演示任务：<code>${h(task.id)}</code></p><p>所选内容：${task.ids.map(h).join('、')}</p></details></section><details class="nx-session-code" data-session-code="request"><summary>请求详情</summary><pre>${h(request)}</pre></details><details class="nx-session-code" data-session-code="response"><summary>响应详情</summary><pre>${h(response)}</pre></details><details class="nx-session-code" data-session-code="error"><summary>错误详情</summary><pre>${h(failure || '未记录错误')}</pre></details><p class="nx-tiny">示例会话只读；展开不会重放请求或下载产物。</p></div>`;
  }
  function taskDetail() {
    const task = tasks.find(row => row.id === activeTask);
    if (!task) { aiView = 'list'; return aiList(); }
    const done = task.state === 'completed', rows = task.ids.map(find).filter(Boolean), needsRepreview = !['completed', 'cancelled', 'unknown'].includes(task.state) && taskNeedsRepreview(task);
    const controls = `${needsRepreview ? b('重新预演任务', 'ai-repreview', 'arrow', 'primary small', attrs('id', task.id)) : ['queued', 'running'].includes(task.state) ? b('推进下一阶段', 'ai-advance', 'arrow', 'primary small', attrs('id', task.id)) + b('暂停任务', 'ai-pause', '', 'small', attrs('id', task.id)) : task.state === 'paused' ? b('继续任务', 'ai-resume', 'arrow', 'primary small', attrs('id', task.id)) : task.state === 'failed' ? b('恢复失败阶段', 'ai-retry', 'arrow', 'primary small', attrs('id', task.id)) : task.state === 'unknown' ? b('核对原任务', 'ai-reconcile', 'check', 'primary small', attrs('id', task.id)) : ''}${!['completed', 'cancelled', 'unknown'].includes(task.state) ? b('取消任务', 'ai-cancel', '', 'quiet small', attrs('id', task.id)) : ''}`;
    let body;
    if (detailTab === 'session') body = sessionDetails(task, rows, done);
    else if (detailTab === 'outputs') body = `<div class="task-list">${rows.slice(0, task.done).map(row => `<div class="task-row"><span class="task-symbol">${icon(task.kind === 'image' ? 'image' : 'sparkle')}</span><div class="task-description"><h3>${h(text(row))}</h3><p>${task.kind === 'image' ? '复用已有批准背景，不生成新图片' : `标签示意：${h(row.tags.join('、'))}`}</p></div>${b('查看内容', 'ai-open-entry', 'right', 'small', attrs('id', row.id))}</div>`).join('') || empty('暂时没有产物', '先推进任务；已有产物始终保留。')}</div>`;
    else body = `<div class="nx-detail-grid"><div><h3>准确处理范围</h3><div class="nx-selection-list">${rows.map(row => `<div class="nx-selection"><span class="nx-round">${icon('content')}</span><span><strong>${h(text(row))}</strong><small>${h(row.author)} · ${row.id}</small></span></div>`).join('')}</div></div><div><h3>任务设置</h3><dl class="nx-definition"><dt>任务类型</dt><dd>${task.kind === 'image' ? '内容配图' : '语义标注'}</dd><dt>预选模型</dt><dd>${h(task.plannedResourceRoute?.model || task.model)}</dd><dt>保护策略</dt><dd>${task.skipProtected ? '跳过人工保护项' : '展示范围内逐条处理'}</dd><dt>恢复方式</dt><dd>保留原任务及已有产物</dd></dl><h3 style="margin-top:25px">处理记录</h3><ol class="nx-timeline">${task.log.map(log => `<li>${h(log)}</li>`).join('')}</ol></div></div>`;
    return back('任务详情', 'ai-list') + head(task.name, `${task.id} · ${task.ids.length} 条内容 · ${task.kind === 'image' ? '内容配图' : '语义标注'}`, badge(task.state)) + `<section class="panel nx-ai"><div class="panel-top">${tabs([['overview', '任务详情'], ['outputs', `产物 ${task.done}`], ['session', '会话记录']], detailTab, 'ai-detail-tab')}<div class="button-row">${controls}</div></div><div class="nx-task-overview"><div class="nx-wide-progress"><span style="width:${task.ids.length ? task.done / task.ids.length * 100 : 0}%"></span></div><small>${task.done} / ${task.ids.length} 已处理</small>${task.state === 'failed' ? notice('示例模型阶段失败；原范围和已有产物保留，可从失败阶段恢复。', true) : task.state === 'unknown' ? notice('结果未知。核对原任务前不能重试，也不能新建同一任务来覆盖结果。', true) : ''}</div>${taskRoutingPanel(task)}${body}<div class="split-note"><span>演示任务没有发起模型请求</span><span>已完成也不代表新的业务数据已写入</span></div></section>`;
  }
  function captureTaskForm() {
    if (!taskForm || !$('#ai-name')) return;
    const kind = $('#ai-kind').value;
    taskForm = { name: $('#ai-name').value.trim(), kind, ids: [...document.querySelectorAll('[data-ai-entry]:checked')].map(node => node.dataset.aiEntry), model: aiCandidates(kind)[0]?.model || '', skip: $('#ai-skip').checked, protect: $('#ai-protect').checked, prompt: $('#ai-prompt').value, scenario: $('#ai-scenario').value };
  }
  function taskPlan() {
    captureTaskForm();
    const primary = aiCandidates(taskForm.kind)[0];
    const error = !taskForm.ids.length ? '请至少选择一条内容。' : !['annotate', 'image'].includes(taskForm.kind) ? '请选择有效的任务类型。' : !primary ? '当前用途没有可用的渠道与模型，请先保存 AI 资源池。' : '';
    if (error) { $('#ai-form-error').textContent = error; return; }
    const overlapping = tasks.find(task => (task.state === 'unknown' || ['queued', 'running', 'paused'].includes(task.state) && !taskNeedsRepreview(task)) && task.kind === taskForm.kind && task.ids.some(id => taskForm.ids.includes(id)));
    if (overlapping) { api.modal('已有相关任务', `<div class="nx-ai"><p>所选内容已有“${h(overlapping.name)}”在处理或等待核对。请先查看原任务，避免重复发起。</p></div>`, b('返回修改', 'ai-close', '', 'quiet') + b('查看原任务', 'ai-detail', 'arrow', 'primary', attrs('id', overlapping.id))); return; }
    taskPreview = { ...structuredClone(taskForm), plannedResourceRoute: requestRoute(primary), candidateCount: primary.candidateCount };
    focusTarget = '#ai-preview-heading'; api.render();
  }
  function resourceHome() {
    resourceDates = new Set(validDates(Object.keys(model().bindings)));
    const selected = validDates(resourceDates), issues = problems(selected), formal = new Set(selected.map(date => model().bindings[date]?.entryId).filter(Boolean));
    return `<div class="nx-pub-grid"><section class="panel"><div class="panel-top"><div class="panel-title"><h2>本次发布范围</h2><span>${selected.length} 个准确日期</span></div>${b('查看整包范围', 'pub-range', 'calendar', 'small')}</div><div class="release-content"><h3>${selected.length ? `${selected[0]} — ${selected.at(-1)}` : '尚未选择日期'}</h3><p>有效日期内的正式内容、批准配图与字体整体发布；公众号单篇和批量草稿独立选择日期。</p><div class="release-summary"><div><strong>${selected.length}</strong><span>准确日期</span></div><div><strong>${formal.size}</strong><span>关联内容</span></div><div><strong>${issues.length}</strong><span>待处理日期</span></div></div><div class="nx-date-chips">${selected.map(date => `<span>${date.slice(5).replace('-', '.')}</span>`).join('') || '<span>请选择日期</span>'}</div>${resourceChecked ? notice(issues.length ? `有 ${issues.length} 个日期需处理，请查看预检明细。` : '本地演示条件已满足；未核验真实原字节或远端状态。', !!issues.length) : notice('范围已展示；先查看本地预检，再确认交付。') }<div class="button-row nx-spaced">${b('查看本地预检', 'pub-preflight', 'check', 'small')}${b('按此范围发布 · 模拟', 'pub-freeze', 'send', 'primary', !selected.length ? 'disabled' : '')}</div><div class="editor-hint">资源发布与公众号草稿分开，内存演示不执行远端动作。</div><div class="nx-pending-summary"><strong>内容条件 ${issues.length ? `有 ${issues.length} 个日期需处理` : '当前无待处理日期'}</strong><p>这是演示内容条件，不是正式待发布变更数。内容变更与公开资源包分别核对；原型、字体或配图更新不按内容差异数计算。</p></div></div></section><aside class="panel nx-aside-card"><span class="nx-eyebrow">交付目标</span><h3>一次确认，分阶段追踪</h3><div class="nx-channel"><span>${icon('send')}公开资源主渠道</span>${status(channelState.mirror ? '已选择' : '未选择', channelState.mirror ? 'good' : '')}</div><div class="nx-channel"><span>${icon('book')}资源备份渠道</span>${status(channelState.archive ? '已选择' : '未选择', channelState.archive ? 'good' : '')}</div>${b('调整目标渠道', 'pub-channels', 'settings', 'quiet small')}<div class="steps">${[['冻结范围', '绑定准确日期和当前内容版本。'], ['准备与交付', '保留本次成品，不重放未知写入。'], ['核验结果', '提交与核验分别呈现。']].map(([title, desc], index) => `<div class="step"><span class="step-number">${index + 1}</span><div><h4>${title}</h4><p>${desc}</p></div></div>`).join('')}</div></aside></div>${hostingPanel()}`;
  }
  function hostingPanel() {
    const job = activeJob?.kind === 'resources' ? activeJob : historyRows.find(row => row.kind === 'resources');
    const operation = job ? { id: job.id, state: job.state === 'completed' ? 'published' : job.state, verified: job.state === 'completed', checkedAt: job.createdAt } : null;
    const shown = studioHostingStatus({ lastOperation: operation, running: !!job && ['queued', 'running'].includes(job.state), readNeedsVerify: job?.state === 'unknown' });
    const originalPending = activeJob && !['completed', 'cancelled'].includes(activeJob.state);
    const dates = validDates(resourceDates), preflightFresh = resourceChecked && resourceCheckSignature === signature(dates);
    const issueCount = problems(dates).length, checked = preflightFresh && dates.length > 0 && issueCount === 0;
    let action = 'pub-hosting-connect', label = '连接示例账号', hint = '先连接示例账号，再核对整包范围。';
    if (originalPending) { action = 'pub-existing-job'; label = activeJob.state === 'unknown' ? '核对原任务' : '查看原任务'; hint = activeJob.state === 'unknown' ? '原任务结果待核验；保留准确范围，不重复上传。' : '沿原任务继续，已有成品与记录保留。'; }
    else if (job?.state === 'completed') { action = 'pub-record'; label = '查看核验记录'; hint = '这条历史任务的模拟核验已完成；不代表当前账号在线或新包已发布。'; }
    else if (hostingConnected) { action = checked ? 'pub-freeze' : 'pub-hosting-preflight'; label = checked ? '核对并确认交付 · 模拟' : preflightFresh && issueCount ? '处理预检问题' : '预检整包范围 · 模拟'; hint = checked ? '确认准确日期、目标及完整覆盖影响，再开始演示交付。' : preflightFresh && issueCount ? `${issueCount} 个日期条件不足，先处理问题日期再重新核对。` : '连接仅保留在本页内存；本地预检不会上传。'; }
    const headline = operation ? `${shown.label} · 模拟` : hostingConnected ? checked ? '待确认交付 · 模拟' : preflightFresh && issueCount ? '条件不足 · 模拟' : '待本地预检 · 模拟' : '账号待连接 · 模拟';
    const buttonAttrs = `${action === 'pub-record' ? attrs('id', job.id) + ' ' : ''}aria-describedby="pub-hosting-next-step"`;
    return `<details class="nx-hosting-compatibility" ${detailAttrs('hosting-compatibility')}><summary>高级资源托管 · AxureShow</summary><section class="panel nx-hosting" aria-label="原型与资源托管演示"><div class="panel-top"><div class="panel-title"><h2>原型与资源托管</h2><span>AxureShow · 内存模拟</span></div>${status(headline, operation ? shown.tone : '')}</div><div class="nx-hosting-summary"><div class="nx-hosting-summary-copy"><h3>当前下一步</h3><p id="pub-hosting-next-step">${hint}</p></div><div class="nx-hosting-primary button-row">${b(label, action, operation?.state === 'unknown' ? 'check' : 'arrow', 'primary', buttonAttrs)}</div></div><div class="nx-hosting-metrics"><section><h3>本地公开包</h3><dl class="nx-definition"><dt>包状态</dt><dd>本页未构建，文件数与字节待正式构建核对</dd><dt>大小目标</dt><dd>24 MB（24,000,000 字节）</dd><dt>包硬上限</dt><dd>30 MB（30,000,000 字节）</dd></dl><p>本地包预算单独核对，不代表远端账户余量。</p></section><section><h3>远端托管</h3><dl class="nx-definition"><dt>目标项目</dt><dd>示例托管项目</dd><dt>示例连接</dt><dd>${hostingConnected ? '本页模拟已连接' : '尚未连接示例账号'}</dd><dt>远端占用</dt><dd>尚未查询</dd></dl><p>真实账号与当前会话分别核验；页面读取不登录或查询远端。</p></section></div>${operation ? `<div class="nx-hosting-operation"${shown.attention ? ' role="alert"' : ''}>${status(`${shown.label} · 模拟`, shown.tone)}<p>记录时间：<time datetime="${h(operation.checkedAt)}">${h(formatStudioDateTime(operation.checkedAt))}</time></p><p>${shown.attention ? '仅从原任务核对结果；核对完成前不能创建重复交付。' : operation.verified ? '此记录只说明原任务的模拟结果，新包和当前账号状态需另行核对。' : '原范围与已准备结果保留，查看原任务继续。'}</p></div>` : ''}<div class="nx-hosting-impact"><strong>完整覆盖影响</strong><p>本地完整发布包覆盖线上项目，线上独有文件不保留；没有远端备份或自动回滚保证。开始前仍需二次确认，未知写入不自动重传。</p></div><details class="nx-hosting-details" ${detailAttrs('hosting-technical')}><summary>技术详情与冻结文件范围</summary><dl class="nx-definition"><dt>完整包摘要</dt><dd>本页未构建，不生成或伪造 SHA-256</dd><dt>冻结身份</dt><dd>${h(operation?.id || '尚未冻结演示任务')}</dd><dt>文件清单</dt><dd>以正式构建生成的公开清单为准；不读取工作库</dd></dl><div class="nx-hosting-file-list"><p>公开范围：正式有效内容、批准配图、生产 TTF 与完整许可、reader/cards/studio 原型及共享资源。</p><p>工作台草稿、采集池、AI 任务、账号和凭据不进入公开包。</p></div></details><details class="nx-hosting-details" ${detailAttrs('hosting-tools')}><summary>更多托管工具</summary><div class="button-row">${b('调整交付渠道', 'pub-channels', 'settings', 'quiet small')}${b('查看资源与测速', 'pub-hosting-resources', 'clock', 'quiet small')}${b('查看演示记录', 'pub-history', 'list', 'quiet small')}${b('刷新本页状态', 'pub-hosting-refresh', '', 'quiet small')}</div><p>这些工具只改变本页内存或查看共享资源，不执行真实登录、构建或上传。</p></details></section></details>`;
  }
  function rangeModal() {
    resourceDraft = new Set(resourceDates);
    api.modal('整包发布范围', `<div class="nx-pub"><p>有效范围：${h(model().schedule.start)} — ${h(model().schedule.end)}</p><p>资源按正式公开包整体冻结。调整有效日期请到工作台设置；本页不能临时排除有问题的日期。</p><div id="pub-range-list" class="nx-date-selection">${rangeChoices()}</div></div>`, b('关闭', 'pub-close', '', 'primary'));
  }
  function rangeChoices() { return dateRows().map(date => `<label class="nx-date-option"><input type="checkbox" disabled data-pub-range="${date}" ${resourceDraft.has(date) ? 'checked' : ''}><strong>${date}</strong><small>${find(model().bindings[date]?.entryId) ? h(text(find(model().bindings[date].entryId))) : '空白日期 · 需安排'}</small></label>`).join(''); }
  function preflight() {
    resourceChecked = true;
    const dates = validDates(resourceDates), issues = problems(dates);
    resourceCheckSignature = signature(dates);
    api.render();
    api.modal('本地预检明细', `<div class="nx-pub"><div class="nx-mini-stats"><div><strong>${dates.length}</strong><small>准确日期</small></div><div><strong>${dates.length - issues.length}</strong><small>条件完整</small></div><div><strong>${issues.length}</strong><small>待处理</small></div></div><div class="nx-freeze-list">${dates.map(date => { const issue = issues.find(row => row.date === date), row = find(model().bindings[date]?.entryId); return `<div class="nx-preflight-row"><span><strong>${date}</strong><small>${row ? h(text(row)) : '尚未安排内容'}</small></span>${issue ? b('处理', 'pub-fix-date', 'right', 'quiet small', attrs('date', date)) : status('条件完整', 'good')}</div>`; }).join('')}</div>${notice('这里只核对演示模型中的条件，不构建文件、不验证真实字节、不连接远端。')}</div>`, (issues.length ? b('先处理问题日期', 'pub-exclude-issues', '', 'small') : '') + b('完成', 'pub-close', '', 'primary'));
  }
  function articleHome() {
    const dates = dateRows();
    if (!dates.includes(articleDate)) { articleDate = dates[0] || ''; articlePreview = false; }
    const toolbar = `<div class="nx-article-toolbar"><div class="button-row">${b('单篇', 'pub-mode', '', articleMode === 'single' ? 'small filter-active' : 'small quiet', attrs('value', 'single'))}${b('按日期批量', 'pub-mode', '', articleMode === 'batch' ? 'small filter-active' : 'small quiet', attrs('value', 'batch'))}</div><span>仅保存草稿，正式发表在公众号后台完成</span></div>`;
    if (articleMode === 'batch') return toolbar + batchArticleHome();
    const row = find(model().bindings[articleDate]?.entryId);
    const preview = articlePreview && row ? `<div class="nx-pub-preview">${articleKind === 'news' ? `<article class="nx-news"><small>拾光撷语 · 每日摘抄</small><h2>${h(articleTitle || `${articleDate} · ${row.author}`)}</h2><p class="nx-news-meta">${h(articleAuthor || row.author)} · ${articleDate}</p><img src="${h(image(row))}" alt="内容配图"><blockquote>${h(row.text).replace(/\n/g, '<br>')}</blockquote><p class="nx-news-source">—— ${h(row.author)}《${h(row.source)}》</p><p class="nx-news-summary">${h(articleSummary || '把值得的，留下。')}</p></article><p class="nx-preview-note">正文布局示意 · 非微信客户端验收样张</p>` : `<canvas id="pub-card-preview" width="1080" height="1440" role="img" aria-label="公众号图片帖卡片预览"></canvas><p class="nx-preview-note" id="pub-paint-status">同源卡面 1080 × 1440；图片帖导出将采用完整带码成品。</p><div class="nx-code-note">小程序码页脚将在生产导出中沿用共享规则<br><small>此预览不冒充完整 1080 × 1800 PNG 验收成品</small></div>`}</div>` : `<div class="nx-pub-preview">${empty(row ? '准备一份本地预览' : '这个日期还没有内容', row ? '确认草稿信息后，点击生成预览。' : '先安排当天内容，再继续保存草稿。')}${!row ? b('前往排期', 'pub-open-schedule', 'arrow', 'small') : ''}</div>`;
    const originalJob = activeJob?.kind === 'draft' && activeJob.dates.includes(articleDate) && !['completed', 'cancelled'].includes(activeJob.state) ? activeJob : null;
    const blockedReason = originalJob ? originalJob.state === 'unknown' ? '原草稿任务结果待核对；先查看原任务、核对原回执，再继续保存。' : originalJob.state === 'failed' ? '原草稿任务处理失败，已准备成品保留；请查看原任务并从失败阶段恢复。' : '原草稿任务尚未完成；请查看并继续原任务，再创建新的草稿。' : '';
    return toolbar + `<section class="panel nx-article-status-panel" aria-label="单篇状态与操作"><div class="nx-article-setting-fields">${field('内容日期', select('pub-date', dates.map(date => [date, `${date}${model().bindings[date] ? ` · ${find(model().bindings[date].entryId)?.author || ''}` : ' · 尚未安排'}`]), articleDate))}${articleKindFields()}${articleAccountField()}</div><div class="nx-article-status-copy"><strong>${h(articleDate)} · ${originalJob ? '原任务待处理' : articlePreview ? '本地预览已准备' : '尚未生成预览'}</strong><p id="pub-form-error" class="nx-error" role="alert"></p>${blockedReason ? `<p id="pub-original-task-reason" class="nx-error">${h(blockedReason)}</p>` : '<p>预览与保存分别操作；核对准确日期后，再确认保存草稿。</p>'}</div><div class="nx-article-primary button-row">${b(articleTarget === 'material' ? '仅上传图片素材 · 模拟' : '保存草稿 · 模拟', 'pub-article-freeze', 'send', 'primary', `${!articleDate || originalJob ? 'disabled' : ''}${originalJob ? ' aria-describedby="pub-original-task-reason"' : ''}`)}</div><div class="nx-article-secondary button-row">${b('生成本地预览', 'pub-local-preview', 'image', 'small')}${originalJob ? b('查看原任务', 'pub-existing-job', 'arrow', 'small') : ''}</div></section><div class="nx-pub-grid article"><details class="panel nx-preview-workspace nx-article-preview" data-article-preview-toggle${(articlePreviewOpen ?? !previewMedia?.matches) ? ' open' : ''}><summary class="nx-article-preview-heading"><strong>${articleKind === 'news' ? '本地正文预览' : '本地成品预览'}</strong>${status(articlePreview ? '本地预览已准备' : '等待预览', articlePreview ? 'good' : '')}</summary><div class="nx-article-preview-content" data-article-live-preview>${preview}</div></details><section class="panel nx-form-card"><h2>草稿信息</h2>${field('标题', `<input id="pub-title" maxlength="64" value="${h(articleTitle)}" placeholder="${h(row ? `${articleDate} · ${row.author}` : '请选择内容日期')}">`)}${field('作者署名', `<input id="pub-author" maxlength="30" value="${h(articleAuthor)}" placeholder="${h(row?.author || '选填')}">`)}${field('摘要', `<textarea id="pub-summary" maxlength="120" placeholder="选填，最多120字">${h(articleSummary)}</textarea>`)}${articleOptions()}</section></div>`;
  }
  function articleKindFields() {
    return field('草稿类型', select('pub-kind', [['news', '图文正文'], ['newspic', '完整卡片图片帖']], articleKind)) + field('操作目标', select('pub-target', articleKind === 'newspic' ? [['draft', '保存公众号草稿'], ['material', '仅上传图片素材']] : [['draft', '保存公众号草稿']], articleTarget));
  }
  function articleAccountField() {
    return field('目标账号', select('pub-account', [['demo-account', '拾光撷语 · 示例账号']], 'demo-account'));
  }
  function articleOptions() {
    return `<div class="nx-article-options"><div class="nx-check-stack">${articleTarget === 'draft' ? checkbox('pub-link', '草稿中关联小程序阅读入口', articleLink) : '<p class="nx-tiny">仅上传素材，不创建草稿或阅读入口。</p>'}</div><details class="nx-scenario" ${detailAttrs('article-scenario')}><summary>查看异常交互</summary>${field('本次演示状态', select('pub-scenario', [['normal', '正常推进'], ['failure', '上传阶段失败'], ['unknown', '结果未知，等待核对']], simulatedScenario))}</details></div>`;
  }
  function batchArticleHome() {
    const selected = validDates(batchDates), stale = batchRangeStale(), checked = articlePreview && articleSignature === signature(selected) && !stale;
    const issues = problems(selected), required = articleKind === 'news', ready = !required || checked && !issues.length;
    const label = required ? '预检选中日期（必需 · 只读）' : '预检选中日期（可选 · 只读）';
    const hint = stale ? '日期范围已修改。请重新读取日期，旧选择与预检不能直接提交。' : !selected.length ? '请在上方选择至少一个准确日期。' : required && !checked ? '先预检所选日期，再核对结果并保存图文正文草稿。' : issues.length ? `${issues.length} 个日期条件不足，请先补齐内容或取消问题日期。` : required ? '预检通过。核对所选日期后，确认保存公众号草稿。' : '可先查看只读预检；提交时将核对并准备所选图片。';
    return `<section class="panel nx-batch-workspace"><div class="nx-batch-settings"><h2>批次设置</h2><div class="nx-batch-settings-grid">${articleKindFields()}${field('开始日期', `<input type="date" id="pub-batch-start" min="${model().schedule.start}" max="${model().schedule.end}" value="${h(batchRangeStart)}">`)}${field('结束日期', `<input type="date" id="pub-batch-end" min="${model().schedule.start}" max="${model().schedule.end}" value="${h(batchRangeEnd)}">`)}${b('读取日期', 'pub-batch-load', 'calendar', 'small')}</div><div class="nx-batch-settings-secondary">${articleAccountField()}${articleOptions()}</div></div><div class="nx-batch-main"><ol class="nx-batch-steps" aria-label="操作步骤"><li class="${selected.length && !stale ? 'done' : 'current'}"><span>1</span>选择日期</li><li class="${checked ? 'done' : selected.length && !stale ? 'current' : ''}"><span>2</span>${required ? '只读预检' : '预检（可选）'}</li><li class="${checked ? 'current' : ''}"><span>3</span>核对结果</li><li><span>4</span>${articleTarget === 'material' ? '上传所选素材' : '保存所选草稿'}</li></ol>${stale ? notice('日期范围已修改，以下仍是上次读取的日期；重新读取后再预检或提交。', true) : ''}<details class="nx-batch-dates" ${detailAttrs('batch-dates', true)}><summary><strong>日期选择</strong><span>${selected.length} 个准确日期${selected.length ? ` · ${selected[0]} — ${selected.at(-1)}` : ''}</span></summary><div class="nx-batch-picker"><span>每批选择 1–31 天；保留未排期日期，便于核对缺项。</span>${b('选择前31个已排期', 'pub-batch-scheduled', '', 'quiet small', stale ? 'disabled' : '')}${b('清空选择', 'pub-batch-clear', '', 'quiet small', stale ? 'disabled' : '')}</div><div class="nx-batch-date-grid">${batchAvailableDates().map(date => `<label><input type="checkbox" data-pub-batch="${date}" ${batchDates.has(date) ? 'checked' : ''} ${stale ? 'disabled' : ''}><span>${date}<small>${model().bindings[date] ? '已排期' : '尚未安排'}</small></span></label>`).join('')}</div></details>${batchPreview()}</div><footer class="nx-publication-footer nx-batch-footer"><div class="nx-footer-copy"><strong>已选 ${selected.length} 个日期 · 内存模拟</strong><p id="pub-batch-next-step">${h(hint)}</p><p class="nx-error" id="pub-form-error" role="alert"></p></div><div class="button-row">${b('预检所选日期', 'pub-local-preview', 'check', 'small', `title="${label}" aria-describedby="pub-batch-next-step" ${stale || !selected.length ? 'disabled' : ''}`)}${b(articleTarget === 'material' ? '上传所选素材' : '保存所选草稿', 'pub-article-freeze', 'send', 'primary', `aria-describedby="pub-batch-next-step" ${stale || !selected.length || !ready ? 'disabled' : ''}`)}</div></footer></section>`;
  }
  function batchPreview() {
    const dates = validDates(batchDates), issues = problems(dates), checked = articlePreview && articleSignature === signature(dates) && !batchRangeStale();
    const issueDates = new Set(issues.map(item => item.date)), readyCount = checked ? dates.length - issues.length : 0;
    const rows = dates.filter(date => batchResultFilter === 'all' || batchResultFilter === 'attention' && issueDates.has(date) || batchResultFilter === 'ready' && checked && !issueDates.has(date));
    return `<section class="nx-batch-results"><div class="nx-batch-summary"><h2>预检结果</h2><span>${checked ? '本页预检已完成' : '等待预检'} · 预检通过不代表草稿已保存</span>${issues.length ? b('取消勾选问题日期', 'pub-batch-exclude', '', 'quiet small', batchRangeStale() ? 'disabled' : '') : ''}</div><div class="nx-result-toolbar">${publicationFilters([['all', '全部', dates.length], ['attention', '需处理', issues.length], ['ready', '预检通过', readyCount]], batchResultFilter, 'pub-batch-filter')}<span>待预检 ${checked ? 0 : dates.length - issues.length}</span></div>${rows.length ? `<table class="nx-result-table"><thead><tr><th>准确日期</th><th>对应内容</th><th>预检结果</th><th>操作</th></tr></thead><tbody>${rows.map(date => { const row = find(model().bindings[date]?.entryId), issue = issueDates.has(date); const reason = !row ? '当天内容缺失，请先安排内容' : row.pool !== 'formal' ? '内容尚未进入正式库' : !row.text?.trim() ? '内容正文为空' : issue ? '配图尚未审核' : checked ? '条件完整，可核对提交' : articleKind === 'news' ? '保存前需要只读预检' : '提交时自动准备，也可提前预检'; return `<tr><td data-label="准确日期"><strong>${date}</strong></td><td data-label="对应内容"><span>${row ? h(text(row)) : '当天内容缺失'}</span></td><td data-label="预检结果">${status(issue ? '条件不足' : checked ? '预检通过' : '等待预检', issue ? 'warn' : checked ? 'good' : '')}<small>${h(reason)}</small></td><td data-label="操作">${b('取消选择', 'pub-batch-remove', '', 'quiet small', `${attrs('date', date)} ${batchRangeStale() ? 'disabled' : ''}`)}</td></tr>`; }).join('')}</tbody></table>` : empty(dates.length ? '此筛选下暂无结果' : '还没有选择日期', dates.length ? '切换筛选不会改变所选日期。' : '展开上方日期选择，勾选准确日期。')}</section>`;
  }
  function captureArticle() {
    if (!$('#pub-kind')) return;
    articleKind = $('#pub-kind').value; articleTarget = $('#pub-target').value;
    if ($('#pub-title')) articleTitle = $('#pub-title').value.trim();
    if ($('#pub-author')) articleAuthor = $('#pub-author').value.trim();
    if ($('#pub-summary')) articleSummary = $('#pub-summary').value;
    if ($('#pub-date')) articleDate = $('#pub-date').value;
    if ($('#pub-scenario')) simulatedScenario = $('#pub-scenario').value;
    if ($('#pub-link')) articleLink = $('#pub-link').checked;
    if ($('#pub-batch-start')) batchRangeStart = $('#pub-batch-start').value;
    if ($('#pub-batch-end')) batchRangeEnd = $('#pub-batch-end').value;
    if (articleMode === 'batch') batchDates = new Set([...document.querySelectorAll('[data-pub-batch]:checked')].map(node => node.dataset.pubBatch));
  }
  function loadBatchRange() {
    captureArticle();
    const dates = dateRows().filter(date => date >= batchRangeStart && date <= batchRangeEnd);
    const error = !batchRangeStart || !batchRangeEnd || batchRangeStart > batchRangeEnd ? '请选择有效的起止日期，结束日期不能早于开始日期。' : batchRangeStart < model().schedule.start || batchRangeEnd > model().schedule.end ? '日期必须位于当前有效日期范围内。' : dates.length > 31 ? '单个批次最多选择 31 个准确日期，请缩小本次范围。' : !dates.length ? '此范围没有有效日期。' : '';
    if (error) { $('#pub-form-error').textContent = error; return; }
    loadedBatchRange = { start: batchRangeStart, end: batchRangeEnd };
    batchDates = new Set(dates); articlePreview = false; pubPlan = null;
    api.render(); api.notify(`已读取 ${dates.length} 个准确日期；缺项保留，等待预检。`);
  }
  function previewArticle() {
    captureArticle();
    if (articleMode === 'batch' && batchRangeStale()) { $('#pub-form-error').textContent = '日期范围已修改，请先重新读取日期。'; return; }
    const dates = articleMode === 'single' ? validDates([articleDate]) : validDates(batchDates);
    if (!dates.length) { $('#pub-form-error').textContent = '请至少选择一个日期。'; return; }
    if (dates.length > 31) { $('#pub-form-error').textContent = '单个批次最多选择 31 个准确日期，请缩小本次范围。'; return; }
    if (articleMode === 'single' && !find(model().bindings[articleDate]?.entryId)) { $('#pub-form-error').textContent = '当前日期没有内容，请先安排。'; return; }
    const issues = articleMode === 'batch' ? problems(dates) : [];
    articlePreview = true; articleSignature = signature(dates); articlePreviewRevision++; api.render();
    if (issues.length) { $('#pub-form-error').textContent = `${issues.length} 个日期条件不足，请先安排内容或取消问题日期。`; return; }
    api.notify(articleMode === 'batch' ? '已完成本页日期预检；未上传或建稿。' : '已准备本地布局预览，未上传或建稿。');
  }
  function freezeResource() {
    if (pendingJob()) return;
    const dates = validDates(resourceDates);
    if (!dates.length) { api.notify('请先选择有效范围内的准确日期。'); return; }
    const issues = problems(dates);
    if (issues.length) { preflight(); return; }
    if (!channelState.mirror && !channelState.archive) { api.notify('请至少选择一个交付渠道。'); return; }
    pubPlan = { kind: 'resources', dates, records: snapshot(dates), signature: signature(dates), scenario: simulatedScenario, channels: { ...channelState } };
    freezeModal();
  }
  function freezeArticle() {
    if (pendingJob()) return;
    captureArticle();
    if (articleMode === 'batch' && batchRangeStale()) { $('#pub-form-error').textContent = '日期范围已修改，请先重新读取日期。'; return; }
    const dates = articleMode === 'single' ? validDates([articleDate]) : validDates(batchDates);
    const issues = problems(dates);
    if (!dates.length) { $('#pub-form-error').textContent = '请至少选择一个日期。'; return; }
    if (dates.length > 31) { $('#pub-form-error').textContent = '单个批次最多选择 31 个准确日期，请缩小本次范围。'; return; }
    if (issues.length) { $('#pub-form-error').textContent = `${issues.length} 个日期条件不足，请先安排内容或取消问题日期。`; articlePreview = true; api.render(); const node = $('#pub-form-error'); if (node) node.textContent = `${issues.length} 个日期条件不足，请先处理。`; return; }
    if (articleMode === 'batch' && articleKind === 'news' && (!articlePreview || articleSignature !== signature(dates))) { $('#pub-form-error').textContent = '请先预检选中日期，再确认保存图文正文草稿。'; return; }
    pubPlan = { kind: articleTarget === 'material' ? 'material' : 'draft', dates, records: snapshot(dates), signature: signature(dates), articleKind, title: articleMode === 'single' ? articleTitle : '', author: articleMode === 'single' ? articleAuthor : '', summary: articleMode === 'single' ? articleSummary : '', includeLink: articleTarget === 'draft' && articleLink, scenario: simulatedScenario };
    if (!articlePreview || articleSignature !== signature(dates)) articlePreviewRevision++;
    articlePreview = true; articleSignature = signature(dates); api.render(); freezeModal();
  }
  function pendingJob() {
    if (!activeJob || ['completed', 'cancelled'].includes(activeJob.state)) return false;
    api.modal('先继续原任务', `<div class="nx-pub"><p>原任务 ${h(activeJob.id)} ${activeJob.state === 'unknown' ? '结果待核对' : '尚未处理完成'}，已经准备的范围与成品保留。继续原任务后再创建新的演示交付。</p></div>`, b('暂不处理', 'pub-close', '', 'quiet') + b('查看原任务', 'pub-existing-job', 'arrow', 'primary'));
    return true;
  }
  function freezeModal() {
    const plan = pubPlan;
    if (!plan) return;
    const actionName = plan.kind === 'resources' ? '资源交付' : plan.kind === 'material' ? '仅上传图片素材' : '保存公众号草稿';
    api.modal(`确认${actionName}`, `<div class="nx-pub"><p class="nx-modal-lead">${plan.dates.length} 个准确日期 · ${actionName}</p><dl class="nx-definition"><dt>操作范围</dt><dd>${plan.dates[0]} — ${plan.dates.at(-1)}</dd><dt>目标</dt><dd>${plan.kind === 'resources' ? Object.entries(plan.channels).filter(([, value]) => value).map(([key]) => key === 'mirror' ? '主渠道' : '备份渠道').join('、') : '拾光撷语 · 示例账号'}</dd>${plan.kind !== 'resources' ? `<dt>成品类型</dt><dd>${plan.articleKind === 'news' ? '图文正文' : '完整卡片图片帖'}</dd><dt>阅读入口</dt><dd>${plan.includeLink ? '关联小程序阅读' : '不添加阅读入口'}</dd>` : ''}</dl><div class="nx-freeze-list">${plan.dates.map(date => `<p><strong>${date}</strong><small>${h(text(find(model().bindings[date]?.entryId)))}</small></p>`).join('')}</div>${notice(plan.kind === 'material' ? '本操作只演示素材上传，0 草稿、0 发表。' : plan.kind === 'draft' ? '停在草稿结果；不模拟已发表。' : '上传和结果核验为独立演示阶段。')}${plan.kind === 'resources' ? '<div class="nx-hosting-impact"><strong>完整覆盖影响</strong><p>本地完整包覆盖线上项目，线上独有文件不保留；没有远端备份或自动回滚保证。结果未知时保留原任务，不自动重传。</p></div>' : ''}${checkbox('pub-consent', plan.kind === 'resources' ? '我已核对准确日期、操作目标与完整覆盖影响，开始本次模拟' : '我已核对准确日期与操作目标，开始本次模拟', false)}</div>`, b('返回修改', 'pub-close', '', 'quiet') + b('确认并开始模拟', 'pub-start', 'check', 'primary', 'id="pub-confirm" disabled'));
  }
  function jobDateState(job, date) {
    if (job.rowPause?.includes(date) && !['completed', 'cancelled'].includes(job.state)) return { state: 'paused', label: '单项已暂停', tone: 'warn', attention: true };
    const labels = { queued: '等待处理', running: job.step < 2 ? '准备成品中 · 模拟' : job.step === 2 ? '上传素材中 · 模拟' : job.kind === 'draft' ? '保存草稿中 · 模拟' : '核验结果中 · 模拟', paused: '任务已暂停', failed: '处理失败', unknown: '结果待核对', cancelled: '后续已取消', completed: job.kind === 'draft' ? '草稿已保存 · 模拟' : job.kind === 'material' ? '素材已上传 · 模拟' : '交付已核验 · 模拟' };
    return { state: job.state, label: labels[job.state] || '等待处理', tone: job.state === 'completed' ? 'good' : job.state === 'running' ? 'blue' : ['failed', 'unknown', 'paused'].includes(job.state) ? 'warn' : '', attention: ['failed', 'unknown', 'paused'].includes(job.state) };
  }
  function jobPanel() {
    const job = inspectedJob || activeJob;
    if (!job) { pubView = 'home'; return ''; }
    const operation = job.kind === 'resources' ? '资源交付' : job.kind === 'material' ? '图片素材上传' : '公众号草稿保存';
    const steps = job.kind === 'resources' ? ['范围冻结', '本地准备', '渠道交付', '结果核验'] : ['范围冻结', '准备成品', '上传素材', job.kind === 'material' ? '核对素材结果' : '保存草稿'];
    const rows = job.dates.map(date => ({ date, ...jobDateState(job, date) }));
    const count = state => rows.filter(row => row.state === state).length, attention = rows.filter(row => row.attention).length;
    const shown = rows.filter(row => jobResultFilter === 'all' || jobResultFilter === 'attention' && row.attention || jobResultFilter === 'completed' && row.state === 'completed');
    const controls = `${['queued', 'running'].includes(job.state) ? b('推进下一阶段', 'pub-job-next', 'arrow', 'primary small') + b('暂停', 'pub-job-pause', '', 'small') : ''}${job.state === 'paused' ? b('继续原任务', 'pub-job-resume', 'arrow', 'primary small') : ''}${job.state === 'failed' ? b('恢复失败阶段', 'pub-job-retry', 'arrow', 'primary small') : ''}${job.state === 'unknown' ? b('核对原回执', 'pub-job-reconcile', 'check', 'primary small') : ''}${!['completed', 'cancelled', 'unknown'].includes(job.state) ? b('取消后续', 'pub-job-cancel', '', 'quiet small') : ''}`;
    return back('处理详情', 'pub-job-back') + head(operation, `${job.id} · ${job.dates.length} 个准确日期 · ${job.kind === 'resources' ? '公开资源' : job.articleKind === 'news' ? '图文正文' : '完整卡片图片帖'}`, badge(job.state)) + `<section class="panel nx-pub nx-job-workspace"><div class="panel-top"><div class="panel-title"><h2>本次进度</h2><span>原任务继续，不重复创建</span></div></div><div class="nx-stage-grid">${steps.map((step, index) => `<div class="nx-stage ${index < job.step || job.state === 'completed' ? 'done' : ''}"><span>${index < job.step || job.state === 'completed' ? icon('check') : index + 1}</span><strong>${step}</strong><small>${index < job.step || job.state === 'completed' ? '本阶段演示完成' : index === job.step ? '当前阶段' : '等待前一步'}</small></div>`).join('')}</div>${job.state === 'unknown' ? `<div class="nx-panel-pad">${notice('原任务结果未知，后续已停止。请核对原回执，再决定是否继续；当前不能重试或创建重复任务。', true)}</div>` : job.state === 'failed' ? `<div class="nx-panel-pad">${notice('模拟上传失败，已准备成品和原任务保留。恢复失败阶段时沿用原范围。', true)}</div>` : ''}<div class="nx-job-results"><div class="nx-execution-counts" aria-label="执行状态汇总">${[['completed', '已完成'], ['queued', '待处理'], ['running', '处理中'], ['failed', '失败'], ['unknown', '待核对'], ['paused', '已暂停'], ['cancelled', '已取消']].map(([state, label]) => `<span class="${state === 'completed' ? 'good' : ['failed', 'unknown', 'paused'].includes(state) && count(state) ? 'warn' : ''}">${label}<strong>${count(state)}</strong></span>`).join('')}</div>${publicationFilters([['all', '全部', rows.length], ['attention', '需处理', attention], ['completed', '已完成', count('completed')]], jobResultFilter, 'pub-job-filter')}${shown.length ? `<table class="nx-result-table"><thead><tr><th>准确日期</th><th>冻结内容</th><th>执行结果</th><th>操作</th></tr></thead><tbody>${shown.map(row => `<tr><td data-label="准确日期"><strong>${row.date}</strong></td><td data-label="冻结内容">${h(text(job.records?.find(item => item.date === row.date)?.entry))}</td><td data-label="执行结果">${status(row.label, row.tone)}</td><td data-label="操作">${['running', 'paused'].includes(job.state) ? b(job.rowPause?.includes(row.date) ? '继续此项' : '暂停此项', 'pub-row-toggle', '', 'quiet small', attrs('date', row.date)) : '<span>—</span>'}</td></tr>`).join('')}</tbody></table>` : empty('此筛选下暂无结果', '切换筛选不会改变原任务的准确日期。')}</div><details class="nx-job-details" ${detailAttrs(`job-log-${job.id}`, true)}><summary>处理记录 <span>${job.log.length} 条</span></summary><ol class="nx-timeline">${job.log.map(row => `<li>${h(row)}</li>`).join('')}</ol></details><footer class="nx-publication-footer"><div class="nx-footer-copy"><p>${job.state === 'unknown' ? '先核对原回执；原任务和已准备成品保留。' : job.state === 'failed' ? '确认问题已处理后，恢复原任务的失败阶段。' : job.state === 'completed' ? '所选日期已完成本次模拟，准确范围与原稿保留在记录中。' : '本页仅模拟推进；不会读取或写入真实公众号。'}</p></div><div class="button-row">${controls}${job.state === 'completed' ? b('查看记录', 'pub-history', 'arrow', 'small') : ''}</div></footer></section>`;
  }
  function saveHistory(job) {
    const existing = historyRows.find(row => row.id === job.id);
    if (existing) Object.assign(existing, structuredClone(job)); else historyRows.unshift(structuredClone(job));
  }
  function historyPage() {
    const rows = historyRows.filter(row => historyFilter === 'all' || row.kind === historyFilter);
    return `<section class="panel"><div class="toolbar"><div class="panel-title"><h2>处理记录</h2><span>${rows.length} 条</span></div>${select('pub-history-filter', [['all', '全部记录'], ['resources', '资源交付'], ['draft', '公众号草稿'], ['material', '仅图片素材']], historyFilter)}</div>${rows.length ? `<div class="task-list">${rows.map(row => `<div class="task-row"><span class="task-symbol">${icon(row.kind === 'resources' ? 'send' : row.kind === 'material' ? 'image' : 'content')}</span><div class="task-description"><h3>${row.kind === 'resources' ? '资源交付' : row.kind === 'material' ? '仅上传图片素材' : '公众号草稿'} · ${row.dates.length} 个日期</h3><p>${row.createdAt ? `<time datetime="${h(row.createdAt)}">${h(formatStudioDateTime(row.createdAt))}</time> · ` : ''}${row.dates[0]} — ${row.dates.at(-1)}</p><p class="nx-tiny">${h(row.id)}</p></div>${badge(row.state)}${b('查看记录', 'pub-record', 'right', 'small', attrs('id', row.id))}</div>`).join('')}</div>` : empty('还没有处理记录', '完成一次模拟后，可在这里查看范围、成品与原回执。')}<div class="split-note"><span>保存草稿、上传素材与资源交付分别记录</span><span>没有任何真实发表记录</span></div></section>`;
  }
  function resourcesPage() {
    const fonts = formalFonts(), font = selectedFont(), cfg = fontChannel();
    const receiptSummary = row => {
      const receipt = fontReceipts.get(row.id);
      if (!receipt) return '暂无 UploadThing 回执';
      if (receipt.sourceSignature !== fontSourceSignature(row)) return '目录身份已变化 · 原回执保留';
      return ({ completed: '直链核验完成 · 模拟', unknown: '上传结果未知 · 等待核对', 'verification-failed': '原直链核验失败 · 等待核对' })[receipt.state] || '回执待核对';
    };
    return `<div class="nx-pub-grid"><section class="panel nx-font-resources"><div class="panel-top"><div class="panel-title"><h2>正式资源</h2></div>${status('共享目录', 'good')}</div><div class="release-content"><div class="nx-mini-stats"><div><strong>${fonts.length}</strong><small>正式字体</small></div><div><strong>${model().assets.filter(row => row.review === '已审核').length}</strong><small>已审核示例素材</small></div><div><strong>${api.getCatalog?.()?.templates?.length || 0}</strong><small>共享版式</small></div></div><div class="nx-freeze-list">${fonts.map(row => { const receipt = fontReceipts.get(row.id); return `<div class="nx-preflight-row" data-font-resource="${h(row.id)}"><span><strong>${h(row.name)}</strong><small>正式 TTF · ${fontSourceReady(row) ? `${row.nativeBytes.toLocaleString('zh-CN')} B · 完整 OFL 来自同源目录` : '同源大小与摘要待就绪'}</small><small>${h(receiptSummary(row))}</small><small>可用顺序：${h(fontOrderText(effectiveFontOrder(row)))}</small>${receipt ? `<small>模拟对象：${h(receipt.objectReference)}</small>` : ''}</span><div class="button-row">${b('查看字体', 'pub-font', 'right', 'quiet small', attrs('id', row.id))}${receipt && ['unknown', 'verification-failed'].includes(receipt.state) ? b('核对原直链', 'pub-font-reconcile', 'check', 'small', attrs('id', row.id)) : ''}</div></div>`; }).join('')}</div></div></section><aside class="panel nx-aside-card nx-font-upload"><h3>UploadThing 字体上传</h3><p>只预演共享批准目录中的生产 TTF；字体上传与整包覆盖分别操作。</p>${status(cfg.enabled && cfg.sampleToken ? '示例 Token 已保存' : cfg.enabled ? '示例 Token 未保存' : '字体上传演示已停用', cfg.enabled && cfg.sampleToken ? 'good' : 'warn')}${field('预演字体', select('pub-font-selection', fonts.map(row => [row.id, row.name]), font?.id))}${field('本次模拟结果', select('pub-font-scenario', [['normal', '上传及原直链核验完成'], ['unknown', '上传结果未知'], ['verification-failed', '上传后原直链核验失败']], fontScenario))}${b('只读预演批准 TTF', 'pub-font-preview', 'check', 'primary', !fontSourceReady(font) ? 'disabled' : '')}${notice('演示回执只保存在本页内存；真实后台核对完整大小、SHA-256、格式与许可后，才登记 UploadThing 直链。')}${b('配置字体上传', 'pub-font-settings', 'settings', 'quiet small')}<details ${detailAttrs('font-bundle-boundary')}><summary>整包资源渠道</summary><p>AxureShow 整包发布沿用「本次发布」的日期范围、预检与完整覆盖确认。</p>${b('查看整包渠道', 'pub-channels', 'settings', 'quiet small')}</details></aside></div>${fontBenchmarkPanel()}`;
  }
  function fontMetadata(font) {
    return `<dl class="nx-definition"><dt>批准字体</dt><dd>${h(font.name)} · ${h(font.id)}</dd><dt>生产文件</dt><dd><code>${h(font.nativeUrl)}</code> · TTF</dd><dt>大小</dt><dd>${font.nativeBytes.toLocaleString('zh-CN')} B</dd><dt>目录 SHA-256</dt><dd><code>${h(font.nativeSha256)}</code></dd><dt>完整许可</dt><dd><code>${h(font.licenseUrl)}</code><br>OFL · 许可摘要：<code>${h(font.licenseSha256)}</code></dd></dl>`;
  }
  function previewFontUpload() {
    clearFontPlans();
    const pending = pendingFontReceipt();
    if (pending) {
      api.modal('先核对原字体上传', `<div class="nx-pub"><p>原操作 ${h(pending.operationId)} 的结果仍待核对；保留同一个模拟对象引用，不能重复创建上传。</p></div>`, b('稍后核对', 'pub-close', '', 'quiet') + b('核对原直链', 'pub-font-reconcile', 'check', 'primary', attrs('id', pending.id)));
      return;
    }
    const font = selectedFont();
    if (!fontSourceReady(font)) { api.notify('共享目录中的 TTF 大小、摘要或完整许可尚未就绪。'); return; }
    if (receiptMatches(font)) { api.notify('该批准 TTF 已有匹配的模拟回执，可直接比较渠道速度。'); return; }
    const cfg = fontChannel();
    fontPlan = { font: structuredClone(fontSource(font)), sourceSignature: fontSourceSignature(font), configSignature: JSON.stringify(cfg), scenario: fontScenario };
    const ready = cfg.enabled && cfg.sampleToken;
    api.modal('预演 UploadThing 字体上传', `<div class="nx-pub nx-font-upload-preview"><p class="nx-modal-lead">冻结批准 TTF 与完整许可身份</p>${fontMetadata(fontPlan.font)}${notice('这些大小与摘要来自已验证的同源目录；本页未读取 TTF 原字节，也未上传或核验远端。')}${!ready ? notice('先在设置中保存已启用的示例 Token 配置，再重新预演。', true) : ''}${checkbox('pub-font-upload-consent', '我已核对批准文件与目标，开始这一次上传模拟', false)}</div>`, b('返回调整', 'pub-close', '', 'quiet') + b('确认上传模拟', 'pub-font-upload', 'check', 'primary', 'id="pub-font-upload-confirm" disabled'));
  }
  function uploadFontSimulation() {
    if (!fontPlan || !$('#pub-font-upload-consent')?.checked) return;
    const cfg = fontChannel(), current = formalFonts().find(row => row.id === fontPlan.font.id);
    if (!cfg.enabled || !cfg.sampleToken) { api.notify('请先保存已启用的示例 Token 配置。'); return; }
    if (pendingFontReceipt()) { clearFontPlans(); close(); api.notify('原字体上传尚未核对，不能重复创建上传模拟。'); return; }
    if (!fontSourceReady(current) || fontPlan.sourceSignature !== fontSourceSignature(current) || fontPlan.configSignature !== JSON.stringify(cfg)) { clearFontPlans(); close(); api.notify('字体或已保存配置已变化，请重新预演批准 TTF。'); return; }
    const number = ++sequence, state = fontPlan.scenario === 'normal' ? 'completed' : fontPlan.scenario;
    fontReceipts.set(current.id, { id: current.id, operationId: `demo-font-${number}`, objectReference: `demo-font-object-${number}`, font: structuredClone(fontPlan.font), sourceSignature: fontPlan.sourceSignature, state, uploads: 1, reads: state === 'unknown' ? 0 : 1 });
    clearFontPlans(); close(); api.render();
    api.notify(state === 'completed' ? '已保存匹配目录身份的模拟回执；未真实上传。' : '原上传结果待核对，保留模拟对象引用；下一步核对原直链。', { tone: state === 'completed' ? 'success' : 'error' });
  }
  function reconcileFontModal(id) {
    clearFontPlans();
    const receipt = fontReceipts.get(id);
    if (!receipt || !['unknown', 'verification-failed'].includes(receipt.state)) return;
    fontReconcile = { id, operationId: receipt.operationId, objectReference: receipt.objectReference };
    api.modal('核对原字体公开直链', `<div class="nx-pub nx-font-reconcile"><p class="nx-modal-lead">${h(receipt.font.name)} · 原操作 ${h(receipt.operationId)}</p>${field('原直链引用 · 演示占位', `<input value="${h(receipt.objectReference)}" readonly aria-label="原直链模拟对象引用">`)}<p>真实后台只回读原操作记录中的公开 URL，核对完整大小、SHA-256 与格式；本页用对象引用演示该流程，不输入真实直链。</p>${fontMetadata(receipt.font)}${field('本次回读模拟结果', select('pub-font-reconcile-result', [['verified', '完整字节与目录身份一致'], ['mismatch', '大小、摘要或格式不符'], ['unavailable', '原直链暂不可读']], 'verified'))}${checkbox('pub-font-reconcile-consent', '仅核对原对象，不创建第二次上传模拟', false)}</div>`, b('稍后核对', 'pub-close', '', 'quiet') + b('确认核对模拟', 'pub-font-reconcile-confirm', 'check', 'primary', 'id="pub-font-reconcile-confirm" disabled'));
  }
  function reconcileFontSimulation() {
    if (!fontReconcile || !$('#pub-font-reconcile-consent')?.checked) return;
    const receipt = fontReceipts.get(fontReconcile.id), result = $('#pub-font-reconcile-result')?.value;
    if (!receipt || receipt.operationId !== fontReconcile.operationId || receipt.objectReference !== fontReconcile.objectReference || !['unknown', 'verification-failed'].includes(receipt.state) || !['verified', 'mismatch', 'unavailable'].includes(result)) return;
    const current = formalFonts().find(row => row.id === receipt.id);
    receipt.reads++;
    receipt.state = result === 'verified' && fontSourceReady(current) && receipt.sourceSignature === fontSourceSignature(current) ? 'completed' : result === 'unavailable' ? 'unknown' : 'verification-failed';
    clearFontPlans(); close(); api.render();
    api.notify(receipt.state === 'completed' ? '原对象回读模拟完成；沿用原回执，未再次上传。' : '原对象仍未通过模拟核验，继续保留回退渠道。', { tone: receipt.state === 'completed' ? 'success' : 'error' });
  }
  function fontBenchmarkPanel() {
    const fonts = formalFonts(), font = selectedFont(), report = fontBenchmark;
    const fresh = report && report.binding === fontBinding(report.font.id);
    return `<section class="panel nx-aside-card nx-font-benchmark"><div class="panel-top"><div class="panel-title"><h2>字体同文件测速与优先级</h2></div>${status('内存模拟 · 非网络实测')}</div><p>同一个批准 TTF，每个有效渠道完整下载三轮，轮换先后顺序；完整校验成功率优先，再按完整下载中位耗时排序。</p><div class="field-grid">${field('测速字体', select('pub-font-benchmark-selection', fonts.map(row => [row.id, row.name]), font?.id))}${field('本次测速模拟', select('pub-font-speed-scenario', [['normal', '完整核验通过，UploadThing 较快'], ['mirror-faster', '完整核验通过，GitHub 镜像较快'], ['failure', '一个渠道三轮均核验失败']], fontSpeedScenario))}</div>${b('比较同字体三轮速度 · 模拟', 'pub-font-benchmark', 'clock', 'primary', !fontSourceReady(font) ? 'disabled' : '')}<p class="nx-tiny" data-font-routing-order>当前本页默认：${h(fontOrderText(fontOrder()))}</p><div class="nx-speed-result">${report ? `<p><strong>${h(report.font.name)} · ${report.font.nativeBytes.toLocaleString('zh-CN')} B · 三轮模拟</strong></p><p>SHA-256 沿用目录：<code>${h(report.font.nativeSha256)}</code></p>${report.omitted ? '<p>UploadThing 缺少匹配回执或已停用，本次不参与测速。</p>' : ''}<table class="nx-result-table"><thead><tr><th>渠道</th><th>完整核验 · 模拟</th><th>三轮完整耗时 · 示例</th><th>中位耗时 · 示例</th></tr></thead><tbody>${report.rows.map(row => `<tr><td data-label="渠道">${h(fontChannelName(row.id))}</td><td data-label="完整核验 · 模拟">${row.verified} / 3</td><td data-label="三轮完整耗时 · 示例">${row.times.map(time => time === null ? '核验失败' : `${time} ms`).join(' / ')}</td><td data-label="中位耗时 · 示例">${row.median === null ? '无有效完整字节' : `${row.median} ms`}</td></tr>`).join('')}</tbody></table><p>${report.eligible ? `本次推荐：${h(fontOrderText(report.recommended))}` : '完整校验结果不足，本次不能应用排序。'}</p>${!fresh ? notice('字体、回执、已保存配置或当前排序已变化，请重新比较。', true) : ''}` : '<p>尚未运行三轮模拟。</p>'}</div><div class="nx-form-footer"><span>模拟结果只作用于本页草稿；真实排序须发布后才能分发，客户端仍优先复用有效缓存并保留本机自适应选路。</span>${b('应用推荐到本页草稿', 'pub-font-benchmark-apply', 'check', 'small', !report?.eligible || !fresh ? 'disabled' : '')}</div>${notice('这里的延迟与核验状态均为示例，未联网；不能代替后台网络、小程序或手机实测。')}</section>`;
  }
  function benchmarkFontSimulation() {
    clearFontPlans();
    const font = selectedFont();
    if (!fontSourceReady(font)) { api.notify('同源 TTF 大小与摘要未就绪，不能演示同文件比较。'); return; }
    const targets = effectiveFontOrder(font), fixtures = fontSpeedScenario === 'mirror-faster' ? { uploadthing: [1600, 1700, 1650], 'github-mirror': [800, 900, 850], axxiu: [3100, 3200, 3300] } : { uploadthing: [860, 900, 920], 'github-mirror': [1160, 1100, 1220], axxiu: [3100, 3300, 3200] };
    const rows = targets.map(id => { const times = fontSpeedScenario === 'failure' && id === targets.at(-1) ? [null, null, null] : [...fixtures[id]]; const valid = times.filter(time => time !== null).sort((a, b) => a - b); return { id, times, verified: valid.length, median: valid.length ? valid[Math.floor(valid.length / 2)] : null }; });
    const ranked = [...rows].sort((a, b) => b.verified - a.verified || (a.median ?? Infinity) - (b.median ?? Infinity)).map(row => row.id);
    // Keep the unmeasured providers' relative order after the measured providers, as the workbench does.
    fontBenchmark = { font: structuredClone(fontSource(font)), binding: fontBinding(font.id), rows, omitted: !targets.includes('uploadthing'), eligible: rows.length >= 2 && rows.every(row => row.verified > 0), recommended: [...ranked, ...fontOrder().filter(id => !ranked.includes(id))] };
    api.render(); api.notify('同一字体的三轮测速模拟已完成，当前排序尚未修改。');
  }
  function applyFontBenchmarkModal() {
    clearFontPlans();
    if (!fontBenchmark?.eligible || fontBenchmark.binding !== fontBinding(fontBenchmark.font.id)) { api.notify('请先完成当前字体的三轮完整核验模拟。'); return; }
    fontApplyPlan = structuredClone(fontBenchmark);
    api.modal('应用字体渠道推荐 · 仅本页草稿', `<div class="nx-pub"><p>来源：${h(fontApplyPlan.font.name)} 的三轮同文件模拟，非网络实测。</p><dl class="nx-definition"><dt>当前默认顺序</dt><dd>${h(fontOrderText(fontOrder()))}</dd><dt>本次推荐顺序</dt><dd>${h(fontOrderText(fontApplyPlan.recommended))}</dd></dl><p>只更新本页模拟字体草稿。缺少 UploadThing 回执的字体继续按可用渠道回退；未测渠道保留彼此顺序，排在本次已测渠道之后。</p>${checkbox('pub-font-apply-consent', '确认将推荐顺序应用到本页草稿', false)}</div>`, b('返回比较', 'pub-close', '', 'quiet') + b('确认应用到草稿', 'pub-font-apply-confirm', 'check', 'primary', 'id="pub-font-apply-confirm" disabled'));
  }
  function applyFontBenchmarkSimulation() {
    if (!fontApplyPlan || !$('#pub-font-apply-consent')?.checked) return;
    if (fontApplyPlan.binding !== fontBinding(fontApplyPlan.font.id)) { clearFontPlans(); close(); api.notify('字体、回执或配置已变化，请重新比较后再应用。'); return; }
    model().demoFontRouting = [...fontApplyPlan.recommended];
    clearFontPlans(); close(); api.render(); api.notify('字体默认顺序已应用到本页草稿；未发布。', { tone: 'success' });
  }
  function pubPage() {
    if (pubView === 'job') return `<div class="nx-pub">${jobPanel()}</div>`;
    return `<div class="nx-pub">${head('发布中心', '清楚看见范围、目标和结果，再从容交付。')}<section class="panel nx-pub-tabs"><div class="panel-top">${tabs([['current', '本次发布'], ['article', '公众号图文'], ['history', '发布记录'], ['resources', '资源与测速']], pubTab, 'pub-tab')}<span class="nx-demo-label">内存模拟</span></div></section>${pubTab === 'current' ? resourceHome() : pubTab === 'article' ? articleHome() : pubTab === 'history' ? historyPage() : resourcesPage()}</div>`;
  }
  function stepTask(task) {
    if (!['queued', 'running'].includes(task.state)) return;
    if (taskNeedsRepreview(task)) { pauseTaskForPool(task); api.render(); return; }
    if (task.simulatedRateLimitCooldown?.phase === 'elapsed') {
      const slot = model().demoAiAvailability?.[aiPurpose(task.kind)];
      if (slot) slot.candidates = slot.candidates.filter(row => row.reason !== 'rate-limited' || row.channelId !== task.simulatedRateLimitCooldown.channelId);
      task.simulatedRateLimitCooldown = null;
      task.log.push('已推进模拟 60 秒冷却阶段，重新按已保存优先级选择候选；未做远端连通检测');
    }
    const routes = availableTaskRoutes(task), selected = task.nextResourceRoute || task.resourceRoute || task.plannedResourceRoute;
    const route = requestRoute(routes[0]);
    if (!route) { task.state = 'failed'; task.log.push('当前没有可用的渠道与模型，未发起演示请求；请先保存资源池。'); api.render(); return; }
    if (selected && !sameRoute(route, selected)) task.log.push(`${routes.some(route => sameRoute(route, selected)) ? '按当前优先级重新选择' : '原候选已失效，沿原任务选择下一候选'}：${routeLabel(route)} · 模拟`);
    task.resourceRoute = route; task.model = route.model;
    const request = { id: `demo-request-${++sequence}`, resourceRoute: structuredClone(route), state: 'success' };
    task.resourceRequests.push(request);
    task.state = 'running';
    const failures = { 'channel-quota': { scope: 'channel', reason: 'quota-exhausted' }, 'auth-invalid': { scope: 'channel', reason: 'auth-invalid' }, 'endpoint-unavailable': { scope: 'channel', reason: 'endpoint-unavailable' }, 'model-unavailable': { scope: 'model', reason: 'model-unavailable' }, 'rate-limited': { scope: 'channel', reason: 'rate-limited' } };
    const failure = failures[task.scenario];
    if (failure) {
      request.state = 'failed'; request.resourceFailure = structuredClone(failure); task.resourceFailure = structuredClone(failure);
      rememberUnavailable(route, failure);
      if (failure.reason === 'rate-limited') task.simulatedRateLimitCooldown = { channelId: route.channelId, phase: 'fallback' };
      else if (failure.scope === 'channel') task.excludedChannels.push(route.channelId);
      else if (failure.reason === 'model-unavailable') task.excludedModels.push(`${route.channelId}/${route.model}`);
      const next = requestRoute(availableTaskRoutes(task)[0]); task.nextResourceRoute = next; task.state = next ? 'running' : 'failed'; task.scenario = 'normal';
      task.log.push(`${routeFailureMessage(failure)}：${routeLabel(route)}；下一候选：${routeLabel(next)} · 模拟`);
    } else if (task.scenario === 'failure') { request.state = 'failed'; task.state = 'failed'; task.log.push('模拟请求明确被拒绝，未执行处理；保留原范围与已有产物'); }
    else if (task.scenario === 'unknown') { request.state = 'unknown'; task.state = 'unknown'; task.log.push('模拟结果未知，暂停后续阶段等待核对；不自动切换重传'); }
    else { task.nextResourceRoute = null; task.resourceFailure = null; if (task.simulatedRateLimitCooldown?.phase === 'fallback') task.simulatedRateLimitCooldown.phase = 'elapsed'; task.done = Math.min(task.ids.length, task.done + 1); task.log.push(`实际使用 ${routeLabel(route)}，已处理 ${task.done} / ${task.ids.length} 条 · 模拟`); if (task.done === task.ids.length) task.state = 'completed'; }
    api.render();
  }
  function stepJob() {
    const job = activeJob;
    if (!job || !['queued', 'running'].includes(job.state)) return;
    if (job.rowPause?.length) { api.notify('仍有单项暂停，请先继续这些日期。'); return; }
    if (signature(job.dates) !== job.signature) { job.state = 'failed'; job.log.push('演示内容已变化，需重新核对当前范围；未继续后续阶段'); api.render(); return; }
    job.state = 'running';
    if (job.step === 2 && job.scenario === 'failure') { job.state = 'failed'; job.log.push('模拟上传失败；准备成品保留'); }
    else if (job.step === 2 && job.scenario === 'unknown') { job.state = 'unknown'; job.log.push('模拟上传结果未知，锁定本次结果，等待核对原回执'); }
    else { api.clearNotice?.(); job.step++; job.log.push(`阶段 ${job.step} 已完成 · 模拟`); if (job.step >= 4) { job.state = 'completed'; job.log.push(job.kind === 'draft' ? '模拟草稿已保存，未发表' : job.kind === 'material' ? '仅模拟素材回执，0 草稿、0 发表' : '模拟交付与核验阶段已完成'); saveHistory(job); } }
    api.render();
  }
  function channelsModal() {
    api.modal('目标渠道与演示策略', `<div class="nx-pub"><p>交付目标在提交前展示，调整后旧预检失效。</p><div class="nx-check-stack nx-spaced">${checkbox('pub-channel-mirror', '公开资源主渠道', channelState.mirror)}${checkbox('pub-channel-archive', '资源备份渠道', channelState.archive)}</div>${field('本次异常交互', select('pub-channel-scenario', [['normal', '正常推进'], ['failure', '上传失败'], ['unknown', '结果未知']], simulatedScenario))}</div>`, b('取消', 'pub-close', '', 'quiet') + b('保存渠道', 'pub-channels-save', 'check', 'primary'));
  }
  function recordModal(id) {
    const record = historyRows.find(row => row.id === id);
    if (!record) return;
    recordId = id;
    api.modal('处理记录详情', `<div class="nx-pub"><p class="nx-modal-lead">${record.kind === 'draft' ? '公众号草稿' : record.kind === 'material' ? '仅图片素材' : '资源交付'} · ${record.dates.length} 个日期</p>${badge(record.state)}<dl class="nx-definition"><dt>创建时间</dt><dd>${record.createdAt ? `<time datetime="${h(record.createdAt)}">${h(formatStudioDateTime(record.createdAt))}</time>` : '—'}</dd><dt>原任务</dt><dd>${h(record.id)}</dd><dt>结果含义</dt><dd>${record.kind === 'draft' ? '模拟草稿已保存，未发表' : record.kind === 'material' ? '仅模拟素材，未建稿' : '模拟资源交付核验'}</dd></dl><div class="nx-freeze-list">${record.dates.map(date => `<div class="nx-preflight-row"><span><strong>${date}</strong><small>${h(text(record.records?.find(item => item.date === date)?.entry))}</small></span>${b('查看原稿', 'pub-record-artifact', 'right', 'quiet small', attrs('date', date))}</div>`).join('')}</div><p class="nx-tiny">模拟回执：${record.id}-receipt；不是远端身份或上传证据。</p></div>`, b('下载演示记录', 'pub-record-download', 'collect', 'small') + b('查看原任务', 'pub-record-task', 'arrow', 'primary'));
  }
  async function handle(action, target) {
    if (!action.startsWith('ai-') && !action.startsWith('pub-')) return false;
    if (action.startsWith('pub-')) capturePublicationDetails();
    const { id, value, date } = target.dataset;
    const task = tasks.find(row => row.id === (id || activeTask));
    switch (action) {
      case 'ai-list':
        if (aiView === 'new' && taskForm) captureTaskForm();
        if (aiView === 'new' && taskForm && JSON.stringify(taskForm) !== taskFormBaseline) {
          api.modal('离开新建任务？', '<div class="nx-ai"><p>当前表单尚未创建任务。预演和返回修改后仍保留最初的未保存状态，可以继续填写或明确放弃。</p></div>', b('继续填写', 'ai-close', '', 'quiet') + b('放弃并返回', 'ai-discard', '', 'primary'));
        } else { aiView = 'list'; taskForm = null; taskPreview = null; taskFormBaseline = ''; api.render(); }
        break;
      case 'ai-discard': aiView = 'list'; taskForm = null; taskPreview = null; taskFormBaseline = ''; close(); api.render(); break;
      case 'ai-leave-confirm': aiView = 'list'; taskForm = null; taskPreview = null; taskFormBaseline = ''; close(); api.navigate(value); break;
      case 'ai-tab': if (aiTab !== value) api.clearNotice?.(); aiTab = value; aiView = 'list'; api.render(); break;
      case 'ai-search': aiSearch = $('#ai-search').value.trim(); aiFilter = $('#ai-status').value; api.render(); break;
      case 'ai-new': taskForm = null; taskPreview = null; taskFormBaseline = ''; aiView = 'new'; api.render(); break;
      case 'ai-repreview': if (task && !['completed', 'cancelled', 'unknown'].includes(task.state) && taskNeedsRepreview(task)) {
        pauseTaskForPool(task);
        taskForm = { name: task.name, kind: task.kind, ids: task.ids.slice(task.done), model: aiCandidates(task.kind)[0]?.model || '', skip: task.skipProtected, protect: true, prompt: '', scenario: 'normal' };
        taskFormBaseline = JSON.stringify(taskForm); taskPreview = null; aiView = 'new'; api.render();
      } break;
      case 'ai-plan': taskPlan(); break;
      case 'ai-preview-back': taskPreview = null; focusTarget = '#ai-name'; api.render(); break;
      case 'ai-close': close(); break;
      case 'ai-create': {
        if (!taskPreview || !$('#ai-task-consent')?.checked) break;
        if (!previewRouteCurrent()) { api.notify('资源池已变化，请返回调整并重新预演。', { tone: 'error' }); api.render(); break; }
        const form = taskPreview;
        const created = { ...initialTaskRoute(form.kind, false), id: `demo-ai-${++sequence}`, name: form.name || `${form.kind === 'image' ? '内容配图' : '语义标注'} · ${form.ids.length} 条`, kind: form.kind, ids: structuredClone(form.ids), model: form.plannedResourceRoute.model, plannedResourceRoute: structuredClone(form.plannedResourceRoute), state: 'queued', done: 0, created: new Date().toISOString(), skipProtected: form.skip, scenario: form.scenario, log: ['准确范围与优先候选已冻结；等待推进演示阶段'] };
        tasks.unshift(created); activeTask = created.id; detailTab = 'overview'; taskForm = null; taskFormBaseline = ''; taskPreview = null; aiView = 'detail'; close(); api.render(); api.notify('演示任务已创建；未调用模型。', { tone: 'success' }); break;
      }
      case 'ai-resource-pool': if (api.openAiResourcePool) api.openAiResourcePool(); else api.navigate('settings'); break;
      case 'ai-session-task': detailTab = 'overview'; api.render(); break;
      case 'ai-detail': case 'ai-session': if (task) { close(); activeTask = task.id; detailTab = action === 'ai-session' ? 'session' : 'overview'; focusTarget = detailTab === 'session' ? '#ai-session-heading' : ''; aiView = 'detail'; api.render(); } break;
      case 'ai-detail-tab': if (detailTab !== value) api.clearNotice?.(); detailTab = value; if (value === 'session') focusTarget = '#ai-session-heading'; api.render(); break;
      case 'ai-advance': if (task) stepTask(task); break;
      case 'ai-pause': if (task && ['queued', 'running'].includes(task.state)) { task.state = 'paused'; task.log.push('已在阶段边界暂停 · 模拟'); api.render(); } break;
      case 'ai-resume': case 'ai-retry': if (task && ['paused', 'failed'].includes(task.state)) { if (taskNeedsRepreview(task)) pauseTaskForPool(task); else { task.state = 'running'; task.scenario = 'normal'; task.log.push('沿原范围与已有产物恢复 · 模拟'); } activeTask = task.id; aiView = 'detail'; api.render(); } break;
      case 'ai-cancel': if (task) api.modal('取消后续处理', `<div class="nx-ai"><p>将停止“${h(task.name)}”后续处理，已完成 ${task.done} 条的示例产物保留。</p></div>`, b('继续任务', 'ai-close', '', 'quiet') + b('确认取消', 'ai-cancel-confirm', '', 'primary', attrs('id', task.id))); break;
      case 'ai-cancel-confirm': if (task) { task.state = 'cancelled'; task.log.push('后续已取消，已有产物保留'); close(); api.render(); } break;
      case 'ai-reconcile': if (task?.state === 'unknown') api.modal('核对原任务结果', `<div class="nx-ai"><p>原任务 ${h(task.id)} 保留未知结果，核对完成前不会重新请求。</p><p>在原型中选择一种核对结果，体验恢复分支。</p></div>`, b('暂不处理', 'ai-close', '', 'quiet') + b('核对为未执行', 'ai-reconcile-none', '', 'small', attrs('id', task.id)) + b('核对为已完成', 'ai-reconcile-done', 'check', 'primary', attrs('id', task.id))); break;
      case 'ai-reconcile-none': if (task?.state === 'unknown') { task.state = 'failed'; task.scenario = 'normal'; task.log.push('模拟核对：原任务未执行，可恢复'); close(); api.render(); } break;
      case 'ai-reconcile-done': if (task?.state === 'unknown') { task.state = 'completed'; task.done = task.ids.length; task.log.push('模拟核对：已完成，未重放任务'); close(); api.render(); } break;
      case 'ai-open-entry': api.openEntry(id); break;
      case 'pub-tab': if (pubTab !== value) api.clearNotice?.(); clearFontPlans(); pubTab = value; pubView = 'home'; api.render(); break;
      case 'pub-close': pubPlan = null; clearFontPlans(); close(); break;
      case 'pub-range': rangeModal(); break;
      case 'pub-range-scheduled': resourceDraft = new Set(validDates(Object.keys(model().bindings))); $('#pub-range-list').innerHTML = rangeChoices(); break;
      case 'pub-range-all': resourceDraft = new Set(dateRows()); $('#pub-range-list').innerHTML = rangeChoices(); break;
      case 'pub-range-none': resourceDraft.clear(); $('#pub-range-list').innerHTML = rangeChoices(); break;
      case 'pub-range-save': resourceDates = new Set([...document.querySelectorAll('[data-pub-range]:checked')].map(node => node.dataset.pubRange)); resourceChecked = false; pubPlan = null; close(); api.render(); break;
      case 'pub-preflight': preflight(); break;
      case 'pub-hosting-connect': hostingConnected = true; api.clearNotice?.(); api.render(); api.notify('示例账号已在本页内存连接；没有真实登录。'); break;
      case 'pub-hosting-preflight': preflight(); break;
      case 'pub-hosting-refresh': api.render(); break;
      case 'pub-hosting-resources': pubTab = 'resources'; pubView = 'home'; api.render(); break;
      case 'pub-exclude-issues': api.notify('请修复问题日期后重新预检整包。'); break;
      case 'pub-fix-date': close(); { const row = find(model().bindings[date]?.entryId); if (row) api.openEntry(row.id); else api.navigate('schedule'); } break;
      case 'pub-freeze': freezeResource(); break;
      case 'pub-channels': channelsModal(); break;
      case 'pub-channels-save': channelState = { mirror: $('#pub-channel-mirror').checked, archive: $('#pub-channel-archive').checked }; simulatedScenario = $('#pub-channel-scenario').value; resourceChecked = false; close(); api.render(); break;
      case 'pub-mode': captureArticle(); articleMode = value;  articlePreview = false; api.render(); break;
      case 'pub-batch-load': loadBatchRange(); break;
      case 'pub-batch-filter': if (['all', 'attention', 'ready'].includes(value)) { batchResultFilter = value; api.render(); } break;
      case 'pub-job-filter': if (['all', 'attention', 'completed'].includes(value)) { jobResultFilter = value; api.render(); } break;
      case 'pub-local-preview': previewArticle(); break;
      case 'pub-article-freeze': freezeArticle(); break;
      case 'pub-batch-scheduled': captureArticle(); batchDates = new Set(batchAvailableDates().filter(date => model().bindings[date]).slice(0, 31)); articlePreview = false; api.render(); break;
      case 'pub-batch-clear': captureArticle(); batchDates.clear(); articlePreview = false; api.render(); break;
      case 'pub-batch-exclude': { const issues = new Set(problems(batchDates).map(row => row.date)); batchDates = new Set([...batchDates].filter(date => !issues.has(date))); articlePreview = false; api.render(); break; }
      case 'pub-batch-remove': captureArticle(); batchDates.delete(date); articlePreview = false; api.render(); break;
      case 'pub-open-schedule': api.navigate('schedule'); break;
      case 'pub-start': if (pubPlan && $('#pub-consent')?.checked) { if (pubPlan.signature !== signature(pubPlan.dates)) { pubPlan = null; close(); api.notify('内容已变化，请重新准备并核对范围。'); break; } api.clearNotice?.(); activeJob = { ...structuredClone(pubPlan), id: `demo-pub-${++sequence}`, createdAt: new Date().toISOString(), state: 'queued', step: 0, rowPause: [], log: ['准确日期、类型与目标已冻结 · 模拟'] }; pubPlan = null; inspectedJob = null; jobResultFilter = 'all'; pubView = 'job'; close(); api.render(); } break;
      case 'pub-job-back': inspectedJob = null; pubView = 'home'; api.render(); break;
      case 'pub-existing-job': inspectedJob = null; pubView = 'job'; close(); api.render(); break;
      case 'pub-job-next': stepJob(); break;
      case 'pub-job-pause': if (activeJob && ['queued', 'running'].includes(activeJob.state)) { activeJob.state = 'paused'; activeJob.log.push('阶段边界已暂停 · 模拟'); api.render(); } break;
      case 'pub-job-resume': case 'pub-job-retry': if (activeJob && ['paused', 'failed'].includes(activeJob.state)) { if (signature(activeJob.dates) !== activeJob.signature) { api.notify('原范围内容已变化，先核对内容后重新准备。'); break; } activeJob.state = 'running'; activeJob.scenario = 'normal'; activeJob.log.push('沿原计划和已准备成品继续 · 模拟'); api.render(); } break;
      case 'pub-row-toggle': if (activeJob) { const rows = new Set(activeJob.rowPause); rows.has(date) ? rows.delete(date) : rows.add(date); activeJob.rowPause = [...rows]; api.render(); } break;
      case 'pub-job-cancel': if (activeJob) api.modal('取消后续阶段', `<div class="nx-pub"><p>保留 ${activeJob.dates.length} 个日期已准备的模拟成品与回执，仅取消尚未开始的阶段。</p></div>`, b('返回任务', 'pub-close', '', 'quiet') + b('取消后续', 'pub-job-cancel-confirm', '', 'primary')); break;
      case 'pub-job-cancel-confirm': if (activeJob) { activeJob.state = 'cancelled'; activeJob.log.push('已取消后续，保留既有准备和回执'); saveHistory(activeJob); close(); api.render(); } break;
      case 'pub-job-reconcile': if (activeJob?.state === 'unknown') api.modal('核对原回执', `<div class="nx-pub"><p>核对原任务 ${h(activeJob.id)} 的上传结果。未知结果不能直接重试。</p><p>以下为原型演示分支，不读取远端。</p></div>`, b('稍后核对', 'pub-close', '', 'quiet') + b('确认未上传', 'pub-reconcile-none', '', 'small') + b('确认已有回执', 'pub-reconcile-done', 'check', 'primary')); break;
      case 'pub-reconcile-none': if (activeJob?.state === 'unknown') { activeJob.state = 'failed'; activeJob.scenario = 'normal'; activeJob.log.push('模拟核对：未上传，可从原阶段恢复'); close(); api.render(); } break;
      case 'pub-reconcile-done': if (activeJob?.state === 'unknown') { activeJob.state = 'running'; activeJob.step = 3; activeJob.scenario = 'normal'; activeJob.log.push('模拟核对：已有素材回执，不重复上传，继续核验/建稿'); close(); api.render(); } break;
      case 'pub-history': inspectedJob = null; pubTab = 'history'; pubView = 'home'; api.render(); break;
      case 'pub-record': recordModal(id); break;
      case 'pub-record-artifact': { const record = historyRows.find(row => row.id === recordId), original = record?.records?.find(item => item.date === date); if (original?.entry) { api.modal('冻结原稿', `<div class="nx-pub"><p class="nx-modal-lead">${date} · ${h(original.entry.author)}</p><p>${h(original.entry.text).replace(/\n/g, '<br>')}</p><p>——《${h(original.entry.source)}》</p><div class="nx-frozen-preview"><canvas id="pub-frozen-card" width="1080" height="1440" role="img" aria-label="冻结原稿卡面"></canvas><small id="pub-frozen-status">读取冻结内容预览</small></div>${notice('保留提交时的正文与样式快照；此卡面是同源预览，不冒充已上传 PNG 原字节。')}</div>`, b('返回记录', 'pub-record', 'left', 'small', attrs('id', record.id))); void api.paintPreview($('#pub-frozen-card'), { ...original.entry, date, imagePath: original.imagePath }, original.entry.defaults, $('#pub-frozen-status')).catch(() => { const node = $('#pub-frozen-status'); if (node) node.textContent = '卡面资源未就绪，冻结正文保留。'; }); } break; }
      case 'pub-record-entry': close(); { const record = historyRows.find(row => row.id === recordId), row = record?.dates.includes(date) && find(model().bindings[date]?.entryId); if (row) api.openEntry(row.id); } break;
      case 'pub-record-task': { const record = historyRows.find(row => row.id === recordId); if (record) { inspectedJob = structuredClone(record); pubView = 'job'; close(); api.render(); } break; }
      case 'pub-record-download': { const record = historyRows.find(row => row.id === recordId); if (record) { const url = URL.createObjectURL(new Blob([JSON.stringify({ prototype: true, externalAction: false, ...record }, null, 2)], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${record.id}-demo.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); api.notify('已请求下载演示记录；不是远端回执。', { tone: 'success' }); } break; }
      case 'pub-font': { const font = formalFonts().find(row => row.id === id); if (font) api.modal('字体资源', `<div class="nx-pub"><p class="nx-modal-lead">${h(font.name)}</p><p>${h(font.description || '正式 TTF 字体')}</p>${fontSourceReady(font) ? fontMetadata(font) : ''}${notice('名称与资源来自共享正式目录，没有启用候选字体。')}<p>可在卡片模板页切换字体并查看真实卡面。</p></div>`, b('关闭', 'pub-close', '', 'quiet') + b('前往模板', 'pub-open-templates', 'arrow', 'primary')); break; }
      case 'pub-open-templates': close(); api.navigate('templates'); break;
      case 'pub-font-settings': clearFontPlans(); close(); api.navigate('settings'); break;
      case 'pub-font-preview': if (id) fontSelection = id; previewFontUpload(); break;
      case 'pub-font-upload': uploadFontSimulation(); break;
      case 'pub-font-reconcile': reconcileFontModal(id); break;
      case 'pub-font-reconcile-confirm': reconcileFontSimulation(); break;
      case 'pub-speed': case 'pub-font-benchmark': benchmarkFontSimulation(); break;
      case 'pub-font-benchmark-apply': applyFontBenchmarkModal(); break;
      case 'pub-font-apply-confirm': applyFontBenchmarkSimulation(); break;
    }
    return true;
  }
  document.addEventListener('change', event => {
    const target = event.target;
    if (target.id?.startsWith('pub-') || target.dataset.pubBatch) capturePublicationDetails();
    if (target.id === 'ai-kind' && taskForm) { captureTaskForm(); taskForm.model = aiCandidates(taskForm.kind)[0]?.model || ''; api.render(); }
    if (target.id === 'ai-task-consent' && $('#ai-create-confirm')) $('#ai-create-confirm').disabled = !target.checked || !previewRouteCurrent();
    if (target.id === 'ai-status') { aiFilter = target.value; api.render(); }
    if (['pub-date', 'pub-kind', 'pub-target'].includes(target.id)) { captureArticle(); if (articleKind === 'news') articleTarget = 'draft'; articlePreview = false; api.render(); }
    if (['pub-batch-start', 'pub-batch-end'].includes(target.id)) { captureArticle(); articlePreview = false; pubPlan = null; api.render(); }
    if (target.dataset.pubBatch) { if (target.checked && validDates(batchDates).length >= 31) { target.checked = false; api.notify('单个批次最多选择 31 个准确日期。'); return; } target.checked ? batchDates.add(target.dataset.pubBatch) : batchDates.delete(target.dataset.pubBatch); articlePreview = false; captureArticle(); api.render(); }
    if (target.dataset.pubRange && resourceDraft) target.checked ? resourceDraft.add(target.dataset.pubRange) : resourceDraft.delete(target.dataset.pubRange);
    if (target.id === 'pub-consent' && $('#pub-confirm')) $('#pub-confirm').disabled = !target.checked || !pubPlan;
    if (target.id === 'pub-link') articleLink = target.checked;
    if (target.id === 'pub-scenario') simulatedScenario = target.value;
    if (target.id === 'pub-history-filter') { historyFilter = target.value; api.render(); }
    if (['pub-font-selection', 'pub-font-benchmark-selection'].includes(target.id)) { fontSelection = target.value; clearFontPlans(); api.render(); }
    if (target.id === 'pub-font-scenario') fontScenario = target.value;
    if (target.id === 'pub-font-speed-scenario') fontSpeedScenario = target.value;
    if (target.id === 'pub-font-upload-consent' && $('#pub-font-upload-confirm')) $('#pub-font-upload-confirm').disabled = !target.checked || !fontPlan || !fontChannel().enabled || !fontChannel().sampleToken;
    if (target.id === 'pub-font-reconcile-consent' && $('#pub-font-reconcile-confirm')) $('#pub-font-reconcile-confirm').disabled = !target.checked || !fontReconcile;
    if (target.id === 'pub-font-apply-consent' && $('#pub-font-apply-confirm')) $('#pub-font-apply-confirm').disabled = !target.checked || !fontApplyPlan;
  });
  document.addEventListener('input', event => {
    const target = event.target;
    if (taskForm && target.id === 'ai-name') taskForm.name = target.value;
    if (taskForm && target.id === 'ai-prompt') taskForm.prompt = target.value;
    if (target.id === 'pub-title') articleTitle = target.value;
    if (target.id === 'pub-author') articleAuthor = target.value;
    if (target.id === 'pub-summary') articleSummary = target.value;
    if (['pub-title', 'pub-author', 'pub-summary'].includes(target.id)) {
      articlePreview = false;
      const label = document.querySelector('.nx-preview-workspace .status');
      if (label) { label.textContent = '内容已变化 · 重新预览'; label.classList.remove('good'); }
    }
  });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-action="close-modal"]')) { pubPlan = null; clearFontPlans(); }
  });
  document.addEventListener('toggle', event => {
    const node = event.target;
    if (node.dataset?.pubDetails) publicationDetails.set(node.dataset.pubDetails, node.open);
    if (node.dataset?.articlePreviewToggle !== undefined && node.isConnected && node.open !== (articlePreviewOpen ?? !previewMedia?.matches)) articlePreviewOpen = node.open;
  }, true);
  document.querySelector('#modal')?.addEventListener('cancel', () => { pubPlan = null; clearFontPlans(); });
  function afterRender(page) {
    if (page === 'ai' && focusTarget) {
      const target = $(focusTarget); focusTarget = '';
      target?.focus?.({ preventScroll: true }); target?.scrollIntoView?.({ block: target?.id === 'ai-session-heading' ? 'nearest' : 'start', behavior: 'auto' });
    }
    if (page !== 'release' || pubView !== 'home' || pubTab !== 'article' || articleMode !== 'single') return;
    let preview = $('[data-article-live-preview]');
    if (rememberedPreview && preview && rememberedPreview !== preview && preview.replaceWith) { preview.replaceWith(rememberedPreview); preview = rememberedPreview; }
    rememberedPreview = preview; mountedPreviewKey = articlePreviewKey();
    if (articleKind !== 'newspic' || !articlePreview) return;
    const canvas = $('#pub-card-preview'), node = $('#pub-paint-status'), row = find(model().bindings[articleDate]?.entryId);
    if (canvas && row && !paintedPreviews.has(canvas)) {
      paintedPreviews.add(canvas);
      void api.paintPreview(canvas, { ...row, date: articleDate, imagePath: image(row) }, row.defaults, node).catch(() => { if (node?.isConnected) node.textContent = '卡面资源未就绪，内容与设置保留，可重新生成预览。'; });
    }
  }
  return {
    render(page) {
      ensureReset();
      const markup = page === 'ai' ? `<div class="nx-ai">${aiView === 'new' ? newTask() : aiView === 'detail' ? taskDetail() : aiList()}</div>` : page === 'release' ? pubPage() : null;
      if (page === 'release' && pubView === 'home' && pubTab === 'article' && articleMode === 'single') {
        const previous = $('[data-article-live-preview]'), key = articlePreviewKey();
        rememberedPreview = mountedPreviewKey === key ? previous || rememberedPreview : null; mountedPreviewKey = key;
      } else { rememberedPreview = null; mountedPreviewKey = ''; }
      return markup;
    },
    handle,
    afterRender,
    restoreAiPriority,
    syncAiResourcePool,
    beforeNavigate(page) {
      if (page !== 'release') clearFontPlans();
      if (page === 'ai' || aiView !== 'new' || !taskForm) return true;
      captureTaskForm();
      if (JSON.stringify(taskForm) === taskFormBaseline) return true;
      api.modal('任务配置尚未提交', '<div class="nx-ai"><p>配置与预演结果尚未创建任务。返回调整仍保留最初的未保存状态；可以继续填写或明确放弃。</p></div>', b('继续填写', 'ai-close', '', 'quiet') + b('放弃并离开', 'ai-leave-confirm', '', 'primary', attrs('value', page)));
      return false;
    },
    dispose() { previewMedia?.removeEventListener?.('change', previewViewportChanged); rememberedPreview = null; },
    reset() { delete model().demoAiAvailability; tasks = initialTasks(); aiView = 'list'; aiTab = 'tasks'; aiFilter = 'all'; aiSearch = ''; taskForm = null; taskPreview = null; activeTask = ''; focusTarget = ''; pubTab = 'current'; pubView = 'home'; articleMode = 'single'; articleKind = 'news'; articleTarget = 'draft'; articleDate = Object.keys(model().bindings).sort()[0] || dateRows()[0]; articleTitle = ''; articleSummary = ''; articleAuthor = ''; articlePreview = false; articlePreviewOpen = null; articlePreviewRevision = 0; rememberedPreview = null; mountedPreviewKey = ''; articleLink = true; inspectedJob = null; resourceDates = new Set(Object.keys(model().bindings)); batchDates = new Set(dateRows().slice(0, 7)); batchRangeStart = model().schedule.start; batchRangeEnd = model().schedule.end; loadedBatchRange = { start: batchRangeStart, end: batchRangeEnd }; batchResultFilter = 'all'; jobResultFilter = 'all'; publicationDetails.clear(); resourceChecked = false; resourceCheckSignature = ''; hostingConnected = false; pubPlan = null; activeJob = null; historyRows = []; simulatedScenario = 'normal'; clearFontPlans(); fontReceipts.clear(); fontBenchmark = null; fontSelection = ''; fontScenario = 'normal'; fontSpeedScenario = 'normal'; delete model().demoFontRouting; },
  };
}
