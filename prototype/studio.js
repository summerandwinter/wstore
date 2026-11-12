import { loadCatalog, paintPreview, backgroundImage, resourceUrl, escapeHTML as h, bindTheme, wireDialog } from './shared/card-preview.js';
import { POOLS, WEEK, createStudioModel, boundDates, cardSettings, moveEntry, replaceDates, applyScope, advanceRelease } from './shared/studio-state.js';

bindTheme();
let model = createStudioModel();
let catalog;
const pageNames = { review: '内容工作台', collect: '采集候选', schedule: '正式排期', assets: '素材中心', ai: 'AI 任务中心', release: '发布中心', settings: '统一设置' };
const state = { page: 'review', pool: 'draft', entryId: 'example-flower', tab: 'image', view: 'focus', currentDate: '', scope: 'default', selectedDates: new Set(), search: '', assetFilter: 'all', assetSearch: '', taskTab: 'tasks', source: 'all', selectedCandidates: new Set(), imported: new Set(), checked: false, lockOnConfirm: true, settings: {}, dirty: false, draft: {}, message: '', modal: '', modalTarget: '', pendingStep: -1, day: WEEK[3], tags: [], note: '', releaseTab: 'current' };
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
const simulatedDeliveries = new Map();
const simulatedRefreshBatch = { phase: 'prepared', accepted: new Set() };
const simulatedArticle = { date: WEEK[3], autoPublish: false, preferenceDraft: false, preview: null, confirmation: null, ready: false, revision: 0, outcome: 'normal', jobs: new Map() };
function invalidateArticleExample() {
  simulatedArticle.preview = null; simulatedArticle.confirmation = null; simulatedArticle.ready = false; simulatedArticle.revision++;
  if (state.modal === 'article') closeDialog();
}
function articleExampleMetadata(value) {
  return `<dl class="ds-detail-list"><dt>日期 / 版式</dt><dd>${h(value.date)} · ${h(value.template)}</dd><dt>标题</dt><dd>${h(value.title)}</dd><dt>摘要</dt><dd>${h(value.digest)}</dd><dt>作者</dt><dd>${h(value.author)}</dd><dt>本篇操作</dt><dd>${value.autoPublish ? '草稿后提交发布 · 提交不等于成功' : '只创建草稿，不提交发布'}</dd></dl>`;
}
function createArticleExample() {
  const date = simulatedArticle.date, binding = model.bindings[date], row = model.entries.find(item => item.id === binding?.entryId);
  if (!WEEK.includes(date) || !row) throw new Error('请先选择七天示例中的日期。');
  const settings = cardSettings(model, row.id, date), asset = model.assets.find(item => item.id === settings.imageId);
  const origin = new URL(location.href).origin, image = new URL(asset?.imageUrl || backgroundImage(asset?.art || 'mist'), location.href);
  // 只消费本原型已选的同源批准图；文章演示不加载任何渠道 URL 或字体。
  if (image.origin !== origin || !/^https?:$/.test(image.protocol) || image.username || image.password || image.hash || image.search) throw new Error('示例图片必须来自同源公开资源包。');
  const body = `<section style="max-width:578px;margin:auto;background:#faf8f0;padding:20px;box-sizing:border-box"><p style="font:13px/1.8 sans-serif;color:#5f7164">${h(date)} · 一卡一文流程示例</p><img src="${h(image.href)}" alt="同源批准素材的本地示例" style="display:block;width:100%;height:auto"><p style="white-space:pre-line;font:24px/1.8 Georgia,serif;color:#293d31">${h(row.text)}</p><p style="font:14px/1.8 Georgia,serif;color:#5f7164">${h(row.author)} · ${h(row.source)}</p></section>`;
  const policy = `default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src ${image.href}; font-src 'none'; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'`;
  return Object.freeze({ date, title: `拾光撷语 | ${date} · 公开诗句示例`, digest: row.text.replace(/\n/g, ''), author: row.author, template: settings.template, autoPublish: simulatedArticle.autoPublish, revision: simulatedArticle.revision, document: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="daylight-article-date" content="${h(date)}"><meta http-equiv="Content-Security-Policy" content="${h(policy)}"><meta name="referrer" content="no-referrer"></head><body style="margin:0;background:#fff">${body}</body></html>` });
}
function articleExampleFrame(value, label) {
  return `<iframe class="ds-article-frame" title="${h(value.date + ' · ' + label)}" data-demo-article-frame sandbox="allow-same-origin" referrerpolicy="no-referrer"></iframe><p class="ds-form-note" role="status" data-demo-article-frame-status>正在加载同源本地示例；没有业务调用。</p>`;
}
function bindArticleExampleFrame(scope, value, current, ready) {
  const frame = scope.querySelector('[data-demo-article-frame]'); if (!frame) return;
  frame.addEventListener('load', () => {
    if (!current() || !frame.isConnected) return;
    const doc = frame.contentDocument;
    if (!doc || doc.querySelector('[name="daylight-article-date"]')?.getAttribute('content') !== value.date) return;
    const images = [...doc.querySelectorAll('img')];
    const update = () => {
      if (!current() || !frame.isConnected) return;
      const loaded = images.every(image => image.complete && image.naturalWidth > 0);
      const status = scope.querySelector('[data-demo-article-frame-status]');
      if (status) status.textContent = loaded ? '本地示例资源已加载；仅为流程示意，不是版式还原或微信显示验收。' : '同源图片未就绪；不能确认演示，请重新生成预览。';
      ready(loaded);
    };
    images.forEach(image => { image.addEventListener('load', update); image.addEventListener('error', update); }); update();
  });
  frame.srcdoc = value.document;
}
function articleExamplePage() {
  const value = simulatedArticle.preview, job = simulatedArticle.jobs.get(simulatedArticle.date);
  return `<section class="ds-sheet ds-article"><div class="ds-sheet-heading"><h2>卡片 → 公众号图文</h2>${pill('纯内存演示，不是真实任务')}</div><div class="ds-article-body"><ol class="ds-article-steps"><li>选择日期</li><li>本地预览</li><li>逐文确认草稿 / 可选提交发布</li></ol><div class="ds-row"><label class="ds-field">示例日期<select class="ds-select" data-demo-article-date>${WEEK.map(date => `<option value="${date}"${simulatedArticle.date === date ? ' selected' : ''}>${date}</option>`).join('')}</select></label>${button('生成本地预览 · 示例', 'article-preview')}${button('刷新本机任务 · 示例', 'article-status', '', 'ds-quiet')}</div><p class="ds-form-note">仅用公开诗句、同源批准图与系统字体演示流程，不呈现正式适配器的逐款版式，不作为视觉还原样张。正式适配器已有15篇真实保存/回读的历史证据：15/15样式保留，不等于视觉还原。用户指出的10款问题已进行本地几何修复；15款375宽同文截图已逐款对照，94个浏览器边界场景无异常，但不是微信验收。新版尚未保存到远端或回读，新增 grid、contain:size、aspect-ratio 与叠层绘制方式仍须微信复测。微信编辑器二次保存与手机显示仍待独立验收。既有拼贴证据及旧定位、负间距过滤失败保留为历史基线。当前修订仍待远端复测，正式工作台既有逐文确认发送流程不变；此页不读取工作区、凭据或远端状态，演示确认不授权真实操作。</p><div class="ds-row">${pill(simulatedArticle.autoPublish ? '已保存示例偏好：逐文同意后提交发布' : '默认偏好：仅草稿')}${button('查看 / 修改逐文偏好 · 示例', 'article-settings', '', 'ds-quiet')}</div><label class="ds-field">回执场景（只选下一次内存演示）<select class="ds-select" data-demo-article-outcome${job ? ' disabled' : ''}><option value="normal"${simulatedArticle.outcome === 'normal' ? ' selected' : ''}>${simulatedArticle.autoPublish ? '草稿已创建并已提交，尚未发布成功' : '草稿已创建，不提交发布'}</option><option value="unknown"${simulatedArticle.outcome === 'unknown' ? ' selected' : ''}>结果未知，保留原任务，禁止重发</option></select></label>${job ? `<section class="ds-image-source" aria-label="公众号本机任务示例"><h3 data-demo-article-job-state>${job.state === 'unknown' ? '结果未知 · 示例' : job.published ? '已确认发布成功 · 示例' : job.submitted ? '已提交发布，尚未确认发布成功 · 示例' : '草稿已创建 · 示例'}</h3><dl class="ds-detail-list"><dt>原任务</dt><dd>${h(job.id)}</dd><dt>草稿创建</dt><dd>${job.draftCreated ? '已收到回执 · 示例' : '尚未确认'}</dd><dt>提交发布</dt><dd>${job.submitted ? '已收到提交回执 · 示例' : '尚未确认提交'}</dd><dt>发布成功</dt><dd>${job.published ? '已确认 · 示例' : '尚未确认'}</dd></dl><p class="ds-form-note">本日期已有任务，没有再次创建草稿入口。${job.state === 'unknown' ? '请到公众号后台核验草稿箱并保留原任务；此演示不会打开后台或重发。' : '仅展示本机记录；刷新不会访问远端。'}</p>${job.state === 'submitted' ? button('演示收到已发布回执（仅内存）', 'article-published', '', 'ds-quiet') : ''}</section>` : '<p class="ds-form-note" data-demo-article-empty>本日期暂无任务，未创建草稿。</p>'}${value ? `${articleExampleMetadata(value)}${articleExampleFrame(value, '本地正文流程示例')}<p class="ds-form-note">本篇内容与操作在确认弹层冻结；日期或已保存偏好改变后必须重新预览。</p>${button(value.autoPublish ? '创建草稿并提交发布 · 示例…' : '创建公众号草稿 · 示例…', 'article-publish', 'disabled', 'ds-primary')}` : '<p class="ds-form-note">先生成本地预览，再核对正文并逐文确认。未预览不能创建演示任务。</p>'}</div></section>`;
}
function confirmArticleExample() {
  const value = simulatedArticle.preview;
  if (!value || !simulatedArticle.ready || simulatedArticle.jobs.has(value.date) || simulatedArticle.confirmation) return;
  const frozen = Object.freeze({ value, outcome: simulatedArticle.outcome }); simulatedArticle.confirmation = frozen; state.modal = 'article';
  openDialog(value.autoPublish ? '本篇草稿并提交发布 · 模拟确认' : '本篇草稿 · 模拟确认', `<p>只演示下列这篇；日期、正文与本次自动发布设置已冻结，不读取或保存真实凭据。</p>${articleExampleMetadata(value)}${articleExampleFrame(value, '冻结的本篇预览')}<label class="ds-check"><input type="checkbox" data-demo-article-agree>我已核对 ${h(value.date)} 的内容，确认创建这篇草稿（仅模拟）</label>${value.autoPublish ? '<label class="ds-check ds-warning"><input type="checkbox" data-demo-article-publish-agree>我明确同意本篇草稿后提交发布（仅模拟）；已提交不代表发布成功</label>' : '<p class="ds-form-note">本次只创建草稿，不提交发布；没有真实上传。</p>'}`, button('取消', 'close-dialog') + button(value.autoPublish ? '确认草稿并提交发布 · 模拟' : '确认创建草稿 · 模拟', 'article-confirm', 'disabled', 'ds-primary'));
  let frameReady = false;
  const sync = () => { const submit = dialog.querySelector('[data-action="article-confirm"]'); if (submit) submit.disabled = simulatedArticle.confirmation !== frozen || value !== simulatedArticle.preview || simulatedArticle.jobs.has(value.date) || !frameReady || !dialog.querySelector('[data-demo-article-agree]')?.checked || value.autoPublish && !dialog.querySelector('[data-demo-article-publish-agree]')?.checked; };
  dialog.querySelector('[data-demo-article-agree]').addEventListener('change', sync);
  dialog.querySelector('[data-demo-article-publish-agree]')?.addEventListener('change', sync);
  bindArticleExampleFrame(dialog, value, () => simulatedArticle.confirmation === frozen && dialog.open, ready => { frameReady = ready; sync(); });
}
function applyArticleExample() {
  const frozen = simulatedArticle.confirmation, value = frozen?.value;
  if (!value || value !== simulatedArticle.preview || value.revision !== simulatedArticle.revision || value.date !== simulatedArticle.date || simulatedArticle.jobs.has(value.date) || dialog.querySelector('[data-action="article-confirm"]')?.disabled || !dialog.querySelector('[data-demo-article-agree]')?.checked || value.autoPublish && !dialog.querySelector('[data-demo-article-publish-agree]')?.checked) return;
  const unknown = frozen.outcome === 'unknown';
  simulatedArticle.jobs.set(value.date, { id: `article-demo-${value.date}`, state: unknown ? 'unknown' : value.autoPublish ? 'submitted' : 'drafted', draftCreated: !unknown, submitted: !unknown && value.autoPublish, published: false });
  closeDialog(); render(); announce('仅在内存记录本篇回执场景，没有创建真实草稿、上传或发布；重复点击不新增任务。');
}
function showRefreshBatchExample() {
  const rows = model.assets.slice(0, 2), compared = rows.length > 0 && rows.every(row => simulatedRefreshBatch.accepted.has(row.id));
  const names = { prepared: '候选已准备 · 待逐张比较', approved: '画质已批准 · 尚未上传', staged: '渠道证据备齐 · 待本地应用', applied: '本地派生已冻结 · 待普通发布' };
  openDialog('历史配图约100KB批次 · 纯内存示例', `<p>100 KiB 目标；准备、逐张画质批准、渠道交付、本地应用、普通发布分开。这里不压缩真实文件、不读取工作区、不上传或发布。</p><p>${names[simulatedRefreshBatch.phase]}</p>${rows.map(row => `<section class="ds-image-source"><h3>${h(row.name)}</h3><div class="ds-channel-grid"><figure><figcaption>压缩前 · 同源图示意</figcaption><img class="ds-detail-image" src="${h(row.imageUrl || backgroundImage(row.art))}" alt="${h(row.name)}压缩前示意"></figure><figure><figcaption>压缩后 · 同一示意图，非真实压缩</figcaption><img class="ds-detail-image" src="${h(row.imageUrl || backgroundImage(row.art))}" alt="${h(row.name)}压缩后示意"></figure></div><p class="ds-form-note">真实后台按本张 comparison.inputDigest 记录接受；数值达标不代替视觉比较。</p><label class="ds-check"><input type="checkbox" data-demo-refresh-accept="${h(row.id)}"${simulatedRefreshBatch.accepted.has(row.id) ? ' checked' : ''}${simulatedRefreshBatch.phase !== 'prepared' ? ' disabled' : ''}>只接受这张图片的比较示例</label></section>`).join('')}<p class="ds-form-note">没有“一键批准全部”。超目标例外在真实后台逐张填写理由；未知结果禁止重试，公开链接的404不证明未写入；须保留原任务供人工核对。已有上传回执而回读失败时只重试原地址验证，不重复上传。${simulatedRefreshBatch.phase === 'applied' ? 'sourceIntent.refreshBatch 需由“为本批次检查发布”进入普通预演，仍须独立发布确认。' : ''}</p>`, button('关闭', 'close-dialog') + (simulatedRefreshBatch.phase === 'prepared' ? button('提交逐张批准 · 模拟', 'refresh-batch-approve', compared ? '' : 'disabled', 'ds-primary') : simulatedRefreshBatch.phase === 'approved' ? button('上传与回读 · 模拟确认', 'refresh-batch-stage', '', 'ds-primary') : simulatedRefreshBatch.phase === 'staged' ? button('仅应用本地派生 · 模拟确认', 'refresh-batch-apply', '', 'ds-primary') : button('为本批次检查发布 · 模拟', 'refresh-batch-publication', '', 'ds-primary')));
}
const imageChannels = { 'wechat-material': '公众号素材库', ipic: 'ipic 图床' };
const imageStages = { queued: '排队中', sending: '发送中', uploaded: '已上传 · 待回读', verified: '回读已验证 · 待登记', attached: '已验证并登记', blocked: '阻塞', 'verification-failed': '回读验证失败', failed: '失败', unknown: '远端结果未知 · 禁止重试', superseded: '源版本变化 · 已失效' };
function imageDeliveryExample(id) {
  if (!simulatedDeliveries.has(id)) {
    const unknown = model.assets.findIndex(asset => asset.id === id) % 3 === 1;
    simulatedDeliveries.set(id, { sourceBytes: 94208, originalBytes: 436224, sourceSha256: 'a'.repeat(64), channels: [
      { providerId: 'wechat-material', state: unknown ? 'unknown' : 'attached', sequence: 4, bytes: 86016, sha256: 'b'.repeat(64), format: 'jpg', verified: !unknown },
      { providerId: 'ipic', state: 'verification-failed', sequence: 3, bytes: 94208, sha256: 'a'.repeat(64), format: 'jpg', verified: false },
    ] });
  }
  return simulatedDeliveries.get(id);
}
function simulateImageChannel(id, providerId, retry = false) {
  const channel = imageDeliveryExample(id).channels.find(row => row.providerId === providerId);
  if (!channel) throw new Error('没有此示例渠道');
  const next = { queued: 'sending', sending: 'uploaded', uploaded: 'verified', verified: 'attached' };
  if (retry) {
    if (!['failed', 'verification-failed', 'blocked'].includes(channel.state)) throw new Error('当前渠道不能重试；未知结果须核对原任务。');
    channel.state = channel.state === 'verification-failed' ? 'uploaded' : 'queued';
  } else {
    if (!next[channel.state]) throw new Error('此阶段没有可继续的模拟动作。');
    channel.state = next[channel.state];
  }
  channel.sequence++; channel.verified = ['verified', 'attached'].includes(channel.state);
  return channel;
}
function imageChannelsMarkup(asset) {
  const example = imageDeliveryExample(asset.id);
  return `<section class="ds-image-source"><h3>自动压缩与源文件 · 数值示例</h3><dl class="ds-detail-list"><dt>目标</dt><dd>100 KiB · 102400 B；超目标需另行复核</dd><dt>输入示例</dt><dd>${example.originalBytes} B</dd><dt>源文件示例</dt><dd>example.jpg · ${example.sourceBytes} B · 92.0 KiB · JPG 可用</dd><dt>源摘要示例</dt><dd>${example.sourceSha256}</dd></dl><p class="ds-form-note">下列数值与状态全为虚构；上方缩略图仍用同源批准素材，不读取渠道图片。</p></section><div class="ds-channel-grid">${example.channels.map(channel => `<section class="ds-channel" data-demo-channel="${channel.providerId}"><div class="ds-sectionhead"><h3>${imageChannels[channel.providerId]}</h3>${pill(imageStages[channel.state], channel.verified ? 'ds-good' : 'ds-warning')}</div><p class="ds-small ds-muted">示例任务 · 序号 ${channel.sequence} · 上传源 ${example.sourceBytes} B</p>${channel.verified ? `<dl class="ds-detail-list"><dt>实际文件示例</dt><dd>${channel.bytes} B · ${channel.format.toUpperCase()} · 1200 × 800</dd><dt>渠道摘要示例</dt><dd>${channel.sha256}</dd></dl><p class="ds-form-note">${channel.providerId === 'ipic' ? '本例渠道原字节与源文件一致。' : '本例渠道处理过图片，渠道实际字节 / 摘要与源文件分别记录。'}</p>` : `<p class="ds-form-note">${channel.state === 'unknown' ? '可能已经写入远端；保留原任务，不允许重试或再次发送。' : channel.state === 'verification-failed' ? '示例已有上传回执，只重试回读验证，不重新上传。' : '尚未取得当前渠道有效回读证据。'}</p>`}${channel.providerId === 'wechat-material' ? '<p class="ds-form-note">待官网归组「拾光颉语」；公开接口不支持归组，daylight- 文件名不表示已分组。</p>' : ''}<div class="ds-row">${['queued', 'sending', 'uploaded', 'verified'].includes(channel.state) ? button('演示下一阶段', 'asset-channel-step', `data-value="${channel.providerId}"`) : ''}${['failed', 'verification-failed', 'blocked'].includes(channel.state) ? button('仅重试本渠道 · 模拟', 'asset-channel-retry', `data-value="${channel.providerId}"`, 'ds-primary') : ''}</div></section>`).join('')}</div><p class="ds-form-note">两渠道独立推进。渠道已验证不修改兼容交付状态、不自动发布；未知结果没有重试入口。</p>`;
}
function showAssetExample(asset) {
  state.modalTarget = asset.id;
  openDialog(asset.name, `<img class="ds-detail-image" src="${h(asset.imageUrl || backgroundImage(asset.art))}" alt="${h(asset.name)}"><div class="ds-row">${pill(asset.scope)}${pill(asset.review)}${pill(asset.delivery)}</div><dl class="ds-detail-list"><dt>来源</dt><dd>同源批准素材；上传和字节状态为虚构样例</dd><dt>兼容交付</dt><dd>${h(asset.delivery)} · 渠道状态不覆盖旧发布回退</dd></dl>${imageChannelsMarkup(asset)}`, button('关闭', 'close-dialog') + button('模拟审核通过', 'asset-approve') + button('双渠道上传 · 模拟确认', 'asset-deliver', '', 'ds-primary'));
}
function newImageDisclosure() {
  return '<section class="ds-image-source"><h3>新图入库后双渠道上传 · 仅示意</h3><p>真实后台自动尝试 100 KiB 压缩目标，JPG/JPEG 与 PNG 均可使用；超目标结果须复核。按本机设置，新图可能在待审时已进入公众号素材库 + ipic 上传队列，各自回读验证，不自动确认图文或发布。</p><label class="ds-check"><input type="checkbox" data-demo-local-only>本次仅本地入库（localOnly: true），不创建图床上传意图</label><p class="ds-form-note" data-demo-upload-summary>上传范围示例：公众号素材库 + ipic；只演示确认文案，不执行上传。</p><label class="ds-check"><input type="checkbox" data-demo-upload-consent>我已阅读新图双渠道上传说明（仅模拟确认，不授权真实操作）</label></section>';
}

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
  if (state.page === 'release') url.searchParams.set('tab', state.releaseTab); else url.searchParams.delete('tab');
  if (state.page === 'release' && state.releaseTab === 'article') url.searchParams.set('date', simulatedArticle.date); else url.searchParams.delete('date');
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
  return head('素材中心', '素材审核与分发状态独立；“仅本地”不代表可发布。', button('登记素材 · 示例', 'asset-record') + button('生成素材 · 示例', 'generate', '', 'ds-primary')) + `<div class="ds-toolbar"><label class="ds-search"><input type="search" id="asset-search" aria-label="搜索素材名称标签" placeholder="搜索名称、标签或意象" value="${h(state.assetSearch)}"></label>${button('搜索', 'asset-search')}</div><div class="ds-viewbar"><div class="ds-pools" role="group" aria-label="素材状态筛选">${[['all', '全部'], ['shared', '共享'], ['exclusive', '本句专属'], ['pending', '待审核'], ['rejected', '已驳回'], ['delivery', '分发待处理']].map(([id, label]) => `<button type="button" data-action="asset-filter" data-value="${id}" aria-pressed="${state.assetFilter === id}">${label}</button>`).join('')}</div><span class="ds-small ds-muted">${rows.length} 张示例</span></div><div class="ds-asset-grid">${rows.map(asset => `<button type="button" class="ds-asset-card" data-action="asset-detail" data-value="${asset.id}"><img src="${h(asset.imageUrl || backgroundImage(asset.art))}" alt="${h(asset.name)}"><div class="ds-asset-copy"><div class="ds-asset-name"><h3>${h(asset.name)}</h3>${pill(asset.review, asset.review === '已审核' ? 'ds-good' : 'ds-warning')}</div><span class="ds-small ds-muted">${h(asset.tags.join(' / '))}</span><span class="ds-small ds-muted">压缩目标 100 KiB · 源 / 渠道字节分开核对</span><span class="ds-small ds-muted">${imageDeliveryExample(asset.id).channels.map(channel => `${imageChannels[channel.providerId]}：${imageStages[channel.state]}（示例）`).join(' · ')}</span></div><div class="ds-asset-footer"><span>${asset.scope}</span><span>${asset.delivery}</span></div></button>`).join('')}</div>`;
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
  const sections = [['current', '当前任务', model.release.blocked ? '1 项图文待核对 · 示例阻塞' : '五阶段演练进行中'], ['article', '公众号图文', '卡片 → 草稿箱 · 预览与确认示意'], ['history', '历史任务', '已完成的演练与回执摘要（虚构）'], ['resources', '资源包', '98 项公开资源 · 只读核验提示']];
  const activeId = state.releaseTab || 'current';
  const active = sections.find(([id]) => id === activeId) || sections[0];
  const tabButtons = sections.map(([id, label]) => `<button type="button" role="tab" aria-selected="${activeId === id}" aria-pressed="${activeId === id}" data-action="release-tab" data-value="${id}">${label}</button>`).join('');
  const pane = activeId === 'history'
    ? `<section class="ds-sheet"><div class="ds-sheet-heading"><h2>历史演练记录</h2>${pill('虚构示例')}</div><table class="ds-table"><thead><tr><th>任务</th><th>阶段</th><th>回执</th></tr></thead><tbody>${[['资源包 · 演练 A', '核验回执', '示例通过'], ['资源包 · 演练 B', '确认推送', '示例中断 · 保留证据'], ['内容包 · 演练 C', '生成发布包', '示例完成']].map(([task, stage, receipt]) => `<tr><td data-label="任务">${task}</td><td data-label="阶段">${stage}</td><td data-label="回执">${receipt}</td></tr>`).join('')}</tbody></table><p class="ds-small ds-muted">历史是设计样例，不代表真实发布；失败证据是锁，不能手动清除或用新发布覆盖。</p></section>`
    : activeId === 'article'
      ? articleExamplePage()
    : activeId === 'resources'
      ? `<section class="ds-sheet"><div class="ds-sheet-heading"><h2>公开资源包</h2>${pill('只读核验提示')}${button('历史配图约100KB批次 · 示例', 'refresh-batch', '', 'ds-quiet')}</div><div class="ds-version-row"><span class="ds-object-icon">▤</span><div><strong>98 项 · 17.59 MB（示例）</strong><small>含 TTF、OFL、批准配图、公开月份与版本绑定路由</small></div><span>冻结</span></div><p class="ds-small ds-muted">上传数据对象在前、入口索引在后；原字节/SHA 核验独立于完整 CDN 验收。此页不读取远端，也不触发构建或发布。</p></section>`
      : `<div class="ds-release-alert"><div><strong>${model.release.blocked ? '示例阻塞：1 项图文待核对' : '已选择无阻塞场景 · 仍不是业务校验'}</strong><span style="display:block;margin-top:3px">切换只改变演示状态，不会修复真实内容。</span></div>${button(model.release.blocked ? '模拟问题已处理' : '切回阻塞示例', 'release-block', '', 'ds-quiet')}</div><section class="ds-sheet"><div class="ds-stepper" aria-label="五个发布阶段">${['预检', '应用修订', '生成发布包', '确认推送', '核验回执'].map((label, index) => `<div class="ds-step ${index <= model.release.completed ? 'active' : ''}"><span class="ds-step-num">${index + 1}</span><span>${label}</span></div>`).join('')}</div><div class="ds-release-controls">${labels.map((label, index) => `<section class="ds-release-control"><strong class="ds-small">${String(index + 1).padStart(2, '0')} · ${index < model.release.completed ? '示例已完成' : '尚未演示'}</strong><span>${notes[index]}</span>${button(label + ' · 模拟', 'release-step', `data-value="${index}"${index !== model.release.completed ? ' disabled' : ''}`, index === model.release.completed ? 'ds-primary' : '')}</section>`).join('')}</div></section><section class="ds-sheet" style="margin-top:14px"><div class="ds-sheet-heading"><h2>恢复原任务 · 只读演示</h2>${pill('不重发未知写入')}</div><p class="ds-small ds-muted">真实后台按原计划、摘要与绑定恢复任务；未知远端结果会阻止继续写入，不盲目重试。这里只展示入口说明，不模拟任何恢复动作。</p>${button('查看恢复条件 · 模拟', 'recovery-info', '', 'ds-quiet')}</section>`;
  return head('发布中心', '五个阶段都可演练，任何阶段都不执行构建或网络发布。', button('数据健康 · 示例', 'health') + button('刷新对照 · 示例', 'refresh')) + `<div class="ds-readonly-notice">版本数字是纯设计样例：${WEEK.length} 天工作副本、${WEEK.length} 天模拟构建。远端从未读取。保存、审核、构建与发布不能互相替代。</div><div class="ds-viewbar"><div class="ds-pools" role="tablist" aria-label="发布分区">${tabButtons}</div><span class="ds-small ds-muted">${active[2]}</span></div>${pane}<div class="ds-release-grid" style="margin-top:14px"><section class="ds-sheet"><div class="ds-sheet-heading"><h2>版本对照</h2>${pill('虚构示例')}</div>${[['正式工作副本', '已编排，不代表线上已更新', '7 天'], ['模拟构建', '用于说明日期差异，未运行构建', '7 天'], ['远端内容', '没有联网核验', '未知']].map(([name, detail, amount]) => `<div class="ds-version-row"><span class="ds-object-icon">▤</span><div><strong>${name}</strong><small>${detail}</small></div><span>${amount}</span></div>`).join('')}</section><section class="ds-sheet"><div class="ds-sheet-heading"><h2>检查范围</h2>${pill(model.release.completed === 5 ? '演示结束' : '待演练', 'ds-warning')}</div><div class="ds-checklist">${['四池归属与日期关联', '图文确认与使用说明', '字体与图片交付产物', '推送结果独立核验'].map(label => `<div class="ds-check-item"><span class="ds-check-icon">·</span><div>${label}<small>只有真实环境校验能形成有效结论</small></div></div>`).join('')}</div></section></div>`;
}
function settingsPage() {
  const groups = [
    ['模型', [['语义标注模型', '模型名称 · 示例（禁用）'], ['图像生成模型', '模型名称 · 示例（禁用）'], ['服务地址', '设计页不接收真实地址']]],
    ['图床与账号', [['公众号 AppID', '示例字段 · 不接收真实账号'], ['公众号 AppSecret', '禁用占位 · 不接收、不回显真实密钥'], ['ipic 账号 / 密码', '本机后台加密保存 · 此处禁用'], ['新图自动上传', '开启示例：公众号素材库 + ipic；单次可选择仅本地'], ['自动压缩', '100 KiB（102400 B）目标；JPG/PNG，超目标需复核'], ['公众号素材分组', '拾光颉语 · 待官网归组；文件名前缀不等于分组'], ['发布账号', '本机凭据不进入设计页或公开包']]],
    ['安全与发布认证', [['GitHub SSH 私钥', '后台加密导入 Ed25519；此处禁用，不读取本机文件'], ['GitHub 主机公钥', '后台校验官方固定指纹；不接受任意 SSH 命令'], ['管理员密码', '已认证部署验证当前密码后修改；全部旧会话失效'], ['平台根密钥', '由宿主或容器 secret 管理，不放进业务设置库']]],
    ['资源路由', [['图片主源', '公众号素材库 → ipic → AxureShow → GitHub 镜像（目标示例，非上线证明）'], ['字体主源', 'AxureShow → GitHub 镜像（示例顺序）'], ['路由开关', 'resourceV3 / routing 示例展示；不在此切换']]],
  ];
  return head('统一设置', '模型、图床账号与资源路由统一在这里查看；真实输入在本机后台完成。', button('连接测试 · 说明', 'settings-info')) + `<div class="ds-readonly-notice">真实配置输入全部禁用。下方仅可切换非敏感的公众号逐文发布偏好示例，只存内存；设计资源不读取环境变量、加密文件或系统密钥存储，也不发起连接。</div><section class="ds-sheet ds-article" style="margin-bottom:14px"><div class="ds-sheet-heading"><h2>公众号一卡一文</h2>${pill('默认仅草稿 · 纯内存偏好')}</div><div class="ds-article-body"><label class="ds-check"><input type="checkbox" data-demo-article-auto-publish${simulatedArticle.preferenceDraft ? ' checked' : ''}>后续文章逐篇确认后，创建草稿并提交发布（autoPublish 示例）</label><p class="ds-form-note">默认关闭。这里只保存示例偏好，不创建草稿、不获取 token、不连接或发布。下次每篇仍须生成本地预览并明确同意提交发布；提交不代表发布成功。</p><div class="ds-row">${button('保存逐文偏好 · 仅内存', 'article-settings-save', simulatedArticle.preferenceDraft === simulatedArticle.autoPublish ? 'disabled' : '', 'ds-primary')}${button('返回公众号图文示例', 'article-return', '', 'ds-quiet')}</div></div></section>${groups.map(([title, fields]) => `<section class="ds-sheet" style="margin-bottom:14px"><div class="ds-sheet-heading"><h2>${title}</h2>${pill('真实配置在本机后台')}</div>${fields.map(([label, value]) => `<label class="ds-field">${label}<input class="ds-input ds-disabled-secret" value="${h(value)}" disabled autocomplete="off"></label>`).join('')}</section>`).join('')}<p class="ds-small ds-muted">账号与密钥的增删改、连接测试与保存都发生在本机工作台的设置页；设计页只示意分组与只读状态。</p>`;
}
function render() {
  main.innerHTML = ({ review: reviewPage, collect: collectPage, schedule: schedulePage, assets: assetsPage, ai: tasksPage, release: releasePage, settings: settingsPage })[state.page]() + `<div class="ds-toast" data-status role="status" aria-live="polite">${h(state.message)}</div>`;
  root.querySelectorAll('[data-page]').forEach(node => { if (node.dataset.page === state.page) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current'); });
  if (state.page === 'review') {
    const rows = availableRows();
    if (state.view === 'grid') rows.forEach((row, index) => paint(`grid-${index}`, row, row.defaults, ''));
    else if (rows.length) paint('studio-preview', { ...entry(), ...state.draft }, state.settings, state.currentDate);
  }
  if (state.page === 'schedule') { const row = model.entries.find(item => item.id === model.bindings[state.day].entryId); paint('schedule-preview', row, cardSettings(model, row.id, state.day), state.day); }
  simulatedArticle.ready = false;
  if (state.page === 'release' && state.releaseTab === 'article' && simulatedArticle.preview) {
    const value = simulatedArticle.preview;
    bindArticleExampleFrame(main, value, () => state.page === 'release' && state.releaseTab === 'article' && simulatedArticle.preview === value, ready => { simulatedArticle.ready = ready; const submit = main.querySelector('[data-action="article-publish"]'); if (submit) submit.disabled = !ready || simulatedArticle.jobs.has(value.date); });
  }
  rememberPage();
}
function openDialog(title, content, footer = '') {
  $('#studio-dialog-title').textContent = title;
  $('#studio-dialog-body').innerHTML = content + '<p class="ds-inline-error" id="dialog-error" role="alert"></p>';
  $('#studio-dialog-footer').innerHTML = footer || button('我知道了', 'close-dialog', '', 'ds-primary');
  if (!dialog.open) modal.open();
}
function closeDialog() { modal.close(); state.modal = ''; simulatedArticle.confirmation = null; }
dialog.addEventListener('close', () => { simulatedArticle.confirmation = null; if (state.modal === 'article') state.modal = ''; });
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
  if (node.dataset.page) { if (node.dataset.page !== state.page) invalidateArticleExample(); state.page = node.dataset.page; state.message = ''; render(); return; }
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
      case 'asset-detail': showAssetExample(model.assets.find(row => row.id === value)); break;
      case 'asset-approve': model.assets.find(row => row.id === state.modalTarget).review = '已审核'; closeDialog(); render(); announce('只更新素材审核示例；交付状态没有自动改变。'); break;
      case 'asset-deliver': {
        const asset = model.assets.find(row => row.id === state.modalTarget);
        openDialog('双渠道上传确认 · 纯内存模拟', `<p>${h(asset.name)}：演示同时向公众号素材库和 ipic 登记上传意图。不会实际发送任何图片，也不改兼容交付状态。</p><p>JPG 可用；源文件与每个渠道的实际字节 / SHA-256 独立核验。未知结果保留原任务，不能重试。</p><label class="ds-check"><input type="checkbox" data-demo-upload-consent>我理解这只是模拟排队，不是真实上传确认</label>`, button('取消', 'close-dialog') + button('模拟加入队列', 'asset-enqueue', 'disabled', 'ds-primary')); break;
      }
      case 'asset-enqueue': {
        if (!dialog.querySelector('[data-demo-upload-consent]')?.checked) break;
        const asset = model.assets.find(row => row.id === state.modalTarget), example = imageDeliveryExample(asset.id);
        for (const channel of example.channels) if (!['unknown', 'attached', 'superseded'].includes(channel.state)) { channel.state = channel.state === 'verification-failed' ? 'uploaded' : 'queued'; channel.sequence++; }
        showAssetExample(asset); announce('仅模拟持久任务排队；成功渠道与未知结果均未重发，没有真实网络请求。'); break;
      }
      case 'asset-channel-retry': {
        const channel = imageDeliveryExample(state.modalTarget).channels.find(row => row.providerId === value);
        if (!channel || !['failed', 'verification-failed', 'blocked'].includes(channel.state)) throw new Error('此示例渠道不允许重试。');
        openDialog('仅重试当前渠道 · 模拟确认', `<p>${imageChannels[value]} · 原任务序号 ${channel.sequence}。已有回执时只重试回读验证，不重复生图或上传；另一渠道不受影响。</p><p>这里只改变示例内存，没有真实调用。</p>`, button('取消', 'close-dialog') + button('确认模拟重试', 'asset-channel-retry-confirm', `data-value="${value}"`, 'ds-primary')); break;
      }
      case 'asset-channel-retry-confirm': simulateImageChannel(state.modalTarget, value, true); showAssetExample(model.assets.find(row => row.id === state.modalTarget)); break;
      case 'asset-channel-step': simulateImageChannel(state.modalTarget, value); showAssetExample(model.assets.find(row => row.id === state.modalTarget)); break;
      case 'task-tab': state.taskTab = value; render(); break;
      case 'new-task': openDialog('任务范围预演 · 不创建真实任务', `<p>提交前明确对象和范围，人工确认内容默认保护。</p><label class="ds-field">范围<select class="ds-select"><option>当前选中示例</option><option>当前筛选未标注样例</option><option>全部未标注样例</option></select></label><label class="ds-check"><input type="checkbox" checked disabled>跳过已确认、已锁定的人工结果</label><p class="ds-form-note">真实执行会向配置的模型发送正文、作者与出处；本设计页不会发送。</p>`, button('取消', 'close-dialog') + button('查看模拟任务', 'task-preview', '', 'ds-primary')); break;
      case 'task-preview': closeDialog(); state.page = 'ai'; state.taskTab = 'tasks'; render(); announce('只切换到已有虚构任务列表，未提交模型请求。'); break;
      case 'task-detail': openDialog(value === 'image' ? '后处理待恢复 · 示例' : '标注任务详情 · 示例', '<p>请求返回、文件校验、入库、人工审核分别显示。图像模型已返回而入库失败时，复用产物重试后处理，不重复生成。</p><div class="ds-row">' + pill('模型产物示例已保留') + pill('未执行真实任务') + '</div>', button('查看关联会话', 'open-sessions') + button('重试入库 · 模拟', 'retry-task', '', 'ds-primary')); break;
      case 'retry-task': closeDialog(); announce('后处理恢复反馈已演示；未下载、未入库、未重复生成。'); break;
      case 'open-sessions': closeDialog(); state.page = 'ai'; state.taskTab = 'sessions'; render(); break;
      case 'session': openDialog('会话详情 · 虚构记录', '<div class="ds-row">' + pill('请求与返回布局') + pill('不是脱敏后的真实日志') + '</div><dl class="ds-detail-list"><dt>关联任务</dt><dd>设计任务样例</dd><dt>模型</dt><dd>配置模型占位</dd><dt>凭据</dt><dd>从未采集或记录</dd></dl><pre class="ds-logcode">请求示意\n  目标：当前句子\n  内容：公开诗句样例\n\n返回示意\n  模型阶段：完成\n  产物：示例引用\n  后处理：等待恢复\n\n以上文本是手写虚构状态，不含真实日志。</pre>'); break;
      case 'config-save': announce('配置保存反馈示意；输入已禁用，未接受或保存地址、模型凭据。'); break;
      case 'generate': openDialog('生成专属图 · 流程设计', '<p>仅当前句子的生成产物进入“本句专属”组，待人工审核。模型完成、文件入库、图片审核、对外交付分别确认。</p>' + newImageDisclosure() + '<p>此页不会调用模型或图床，也不产生费用。</p>', button('关闭', 'close-dialog') + button('查看模拟任务', 'task-preview', 'disabled data-demo-intake-submit', 'ds-primary')); break;
      case 'asset-record': openDialog('登记素材 · 样式示例', '<label class="ds-field">素材名<input class="ds-input" placeholder="仅可填写演示名称"></label><label class="ds-field">权利说明<textarea class="ds-textarea" placeholder="来源、授权与适用范围示例"></textarea></label>' + newImageDisclosure() + '<p class="ds-form-note">不接收文件、URL 或真实素材；不会入库或上传。</p>', button('取消', 'close-dialog') + button('保存反馈 · 模拟', 'mock-save', 'disabled data-demo-intake-submit', 'ds-primary')); break;
      case 'import': openDialog('确认候选入库范围', `<p>只处理明确选择的 ${state.selectedCandidates.size} 条可见示例，进入草稿池，保留来源；不自动标为人工确认。</p>`, button('取消', 'close-dialog') + button('模拟入库', 'apply-import', '', 'ds-primary')); break;
      case 'apply-import': importSelected(); break;
      case 'undo-import': model.entries = model.entries.filter(row => !state.imported.has(row.id) || boundDates(model, row.id).length); state.imported.clear(); state.selectedCandidates.clear(); render(); announce('已重置候选演示；仍被示例排期引用的条目保留。'); break;
      case 'collect-info': openDialog('开始抓取 · 原有入口保留', '<p>正式采集应先选择来源与范围，并明确外部请求。此设计资源不接入采集模块，不联网抓取。</p><label class="ds-field">来源<select class="ds-select"><option>来源甲 · 示例</option><option>来源乙 · 示例</option></select></label>'); break;
      case 'refresh-batch': showRefreshBatchExample(); break;
      case 'refresh-batch-approve': if (!model.assets.slice(0, 2).every(row => simulatedRefreshBatch.accepted.has(row.id))) throw new Error('须逐张勾选接受比较示例。'); simulatedRefreshBatch.phase = 'approved'; showRefreshBatchExample(); break;
      case 'refresh-batch-stage': openDialog('渠道上传与回读 · 仅模拟确认', '<p>真实后台此步会上传本批次候选并回读；本原型仅展示确认，没有网络或真实图片处理。</p>', button('取消', 'refresh-batch') + button('确认模拟渠道就绪', 'refresh-batch-stage-confirm', '', 'ds-primary')); break;
      case 'refresh-batch-stage-confirm': simulatedRefreshBatch.phase = 'staged'; showRefreshBatchExample(); break;
      case 'refresh-batch-apply': openDialog('仅应用本地派生 · 模拟确认', '<p>真实后台按批次计划和源版本应用派生，冻结 sourceIntent.refreshBatch；不构建、不推送、不自动发布。本页只变更内存示例。</p>', button('取消', 'refresh-batch') + button('确认模拟本地应用', 'refresh-batch-apply-confirm', '', 'ds-primary')); break;
      case 'refresh-batch-apply-confirm': simulatedRefreshBatch.phase = 'applied'; showRefreshBatchExample(); break;
      case 'refresh-batch-publication': closeDialog(); state.page = 'release'; state.releaseTab = 'current'; render(); announce('模拟回到普通发布检查；批次绑定须独立预演与确认，未执行发布。'); break;
      case 'release-block': model.release.blocked = !model.release.blocked; model.release.completed = 0; render(); break;
      case 'article-preview': invalidateArticleExample(); simulatedArticle.preview = createArticleExample(); render(); break;
      case 'article-publish': confirmArticleExample(); break;
      case 'article-confirm': applyArticleExample(); break;
      case 'article-status': simulatedArticle.confirmation = null; if (state.modal === 'article') closeDialog(); render(); announce('仅读取内存里的原任务示例；没有远端核验，也不重发。'); break;
      case 'article-published': { const job = simulatedArticle.jobs.get(simulatedArticle.date); if (job?.state === 'submitted') { job.state = 'published'; job.published = true; render(); announce('仅演示收到明确发布成功回执；没有访问远端。'); } break; }
      case 'article-settings': invalidateArticleExample(); simulatedArticle.preferenceDraft = simulatedArticle.autoPublish; state.page = 'settings'; render(); break;
      case 'article-settings-save': simulatedArticle.autoPublish = simulatedArticle.preferenceDraft; invalidateArticleExample(); render(); announce('逐文偏好只保存到演示内存；下次仍须重新预览并单独确认本篇发布，没有创建任务。'); break;
      case 'article-return': state.page = 'release'; state.releaseTab = 'article'; render(); break;
      case 'release-tab': state.releaseTab = value; render(); break;
      case 'recovery-info': openDialog('恢复条件 · 设计说明', '<p>真实后台恢复一个未完成任务时，会核对原始计划、内容摘要与顺序绑定；远端结果未知时禁止重放或覆盖。</p><p class="ds-warning-note">这里只说明流程，不模拟恢复，也不产生任何写入。</p>', button('知道了', 'close-dialog', '', 'ds-primary')); break;
      case 'settings-info': openDialog('连接测试 · 设计说明', '<p>真实的模型/图床连接测试在本机后台设置页执行，需要账号已加密保存。</p><p>设计页不包含账号、密钥或服务地址，也不发起任何网络请求。</p>', button('知道了', 'close-dialog', '', 'ds-primary')); break;
      case 'release-step': { const step = Number(value); if (model.release.blocked) { announce('预检示例仍有阻塞；应用修订、打包和推送不可继续。'); break; } state.pendingStep = step; openDialog(['运行预检', '应用修订', '生成发布包', '确认推送', '核验回执'][step] + ' · 演示确认', `<p>将演示第 ${step + 1} 个阶段的反馈。没有业务调用、构建、网络推送或真实回执。</p>${step === 3 ? '<p class="ds-warning-note">真实推送必须单独确认目标和范围；这里不包含任何生产目标。</p>' : ''}`, button('取消', 'close-dialog') + button('继续模拟', 'apply-release-step', '', 'ds-primary')); break; }
      case 'apply-release-step': model = advanceRelease(model, state.pendingStep); closeDialog(); render(); announce(`第 ${model.release.completed} 阶段反馈已演示；仍未执行任何真实操作。`); break;
      case 'health': openDialog('数据健康 · 设计样例', `<dl class="ds-detail-list"><dt>内容实体</dt><dd>${model.entries.length} 条公开诗句样例</dd><dt>排期</dt><dd>${WEEK.length} 个虚构日期绑定</dd><dt>范围</dt><dd>只检查示例模型，不检查真实工作区</dd><dt>远端</dt><dd>从未读取</dd></dl><p>这里不恢复、合并、替换或发布真实内容。</p>`); break;
      case 'diff': openDialog('日期修订对照 · 示例', '<div class="ds-two-fields"><div><h3>模拟构建</h3><p class="ds-poem">明月松间照，\n清泉石上流。</p></div><div><h3>工作副本示例</h3><p class="ds-poem">行到水穷处，\n坐看云起时。</p></div></div><p>正文、出处、版式、字体和配图逐项核对，再形成日期修订。</p>'); break;
      case 'record': openDialog('录入内容 · 设计表单', '<label class="ds-field">正文<textarea class="ds-textarea" maxlength="240" placeholder="这里的输入只用于设计演示"></textarea></label><div class="ds-two-fields"><label class="ds-field">作者<input class="ds-input" maxlength="45"></label><label class="ds-field">出处<input class="ds-input" maxlength="45"></label></div>', button('取消', 'close-dialog') + button('保存反馈 · 模拟', 'mock-save', '', 'ds-primary')); break;
      case 'mock-save': closeDialog(); announce('保存反馈已演示，没有创建真实记录或文件。'); break;
      case 'legacy': openDialog('高级工具 / 旧版编辑器', '<p>旧版编辑器、采集与字体维护入口在真实后台保留。设计资源不会跳转到真实服务，避免混淆工作区。</p>'); break;
      case 'week-info': announce('本设计只提供七天示例；真实日期范围与地址恢复以后台为准。'); break;
      case 'refresh': announce('已演示刷新反馈；未读取真实版本或远端状态。'); break;
      case 'reset': simulatedDeliveries.clear(); simulatedRefreshBatch.phase = 'prepared'; simulatedRefreshBatch.accepted.clear(); simulatedArticle.jobs.clear(); simulatedArticle.date = WEEK[3]; simulatedArticle.autoPublish = false; simulatedArticle.preferenceDraft = false; simulatedArticle.outcome = 'normal'; invalidateArticleExample(); model = unifiedModel(); state.pool = 'draft'; state.page = 'review'; state.view = 'focus'; state.search = ''; state.imported.clear(); state.selectedCandidates.clear(); initializeEntry('example-flower'); render(); announce('所有内存演示状态已重置。'); break;
      case 'close-dialog': closeDialog(); break;
    }
  } catch (error) {
    if (dialog.open) $('#dialog-error').textContent = error.message;
    else announce(error.message);
  }
});
root.addEventListener('change', event => {
  const node = event.target;
  if (node.hasAttribute('data-demo-article-date')) { if (WEEK.includes(node.value)) { simulatedArticle.date = node.value; invalidateArticleExample(); render(); } }
  else if (node.hasAttribute('data-demo-article-auto-publish')) { simulatedArticle.preferenceDraft = node.checked; const save = main.querySelector('[data-action="article-settings-save"]'); if (save) save.disabled = simulatedArticle.preferenceDraft === simulatedArticle.autoPublish; }
  else if (node.hasAttribute('data-demo-article-outcome')) { if (['normal', 'unknown'].includes(node.value)) simulatedArticle.outcome = node.value; }
  else if (node.hasAttribute('data-demo-refresh-accept')) {
    if (simulatedRefreshBatch.phase !== 'prepared') return;
    node.checked ? simulatedRefreshBatch.accepted.add(node.dataset.demoRefreshAccept) : simulatedRefreshBatch.accepted.delete(node.dataset.demoRefreshAccept);
    const submit = dialog.querySelector('[data-action="refresh-batch-approve"]');
    if (submit) submit.disabled = !model.assets.slice(0, 2).every(row => simulatedRefreshBatch.accepted.has(row.id));
  }
  else if (node.hasAttribute('data-demo-local-only') || node.hasAttribute('data-demo-upload-consent')) {
    const onlyLocal = dialog.querySelector('[data-demo-local-only]')?.checked === true, consent = dialog.querySelector('[data-demo-upload-consent]');
    if (consent) { consent.disabled = onlyLocal; if (onlyLocal) consent.checked = false; }
    const submit = dialog.querySelector('[data-demo-intake-submit]') || dialog.querySelector('[data-action="asset-enqueue"]');
    if (submit) submit.disabled = !onlyLocal && consent?.checked !== true;
    const summary = dialog.querySelector('[data-demo-upload-summary]');
    if (summary) summary.textContent = onlyLocal ? '本次预演 localOnly: true，仅本地入库，不登记双渠道上传意图。' : '上传范围示例：公众号素材库 + ipic；只演示确认文案，不执行上传。';
  }
  else if (node.hasAttribute('data-entry')) { initializeEntry(node.value); render(); }
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
  const params = new URLSearchParams(location.search), requested = params.get('page');
  if (Object.hasOwn(pageNames, requested)) state.page = requested;
  if (['current', 'article', 'history', 'resources'].includes(params.get('tab'))) state.releaseTab = params.get('tab');
  if (WEEK.includes(params.get('date'))) simulatedArticle.date = params.get('date');
  render();
} catch (error) { main.textContent = `共享渲染目录不可用：${error.message}`; }
