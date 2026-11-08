export const POOLS = { formal: '正式', reserve: '备选', draft: '草稿', trash: '垃圾桶' };
export const WEEK = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'];
export const ASSETS = [
  { id: 'sample-mist', name: '云起青山', art: 'mist', scope: '本句专属', owner: 'example-cloud', review: '已审核', delivery: '可交付', tags: ['释然', '平静', '山野', '云'] },
  { id: 'sample-dusk', name: '暮山有光', art: 'dusk', scope: '共享素材', review: '已审核', delivery: '可交付', tags: ['希望', '山野', '日'] },
  { id: 'sample-sea', name: '潮汐与远方', art: 'sea', scope: '共享素材', review: '已审核', delivery: '仅本地', tags: ['自由', '海岸', '水'] },
  { id: 'sample-pending', name: '山间初霁', art: 'mist', scope: '共享素材', review: '待审核', delivery: '仅本地', tags: ['成长', '山野', '云'] },
  { id: 'sample-address', name: '海风来信', art: 'sea', scope: '本句专属', owner: 'example-moon', review: '待审核', delivery: '地址待验证', tags: ['思念', '海岸', '水'] },
  { id: 'sample-rejected', name: '余晖小记', art: 'dusk', scope: '共享素材', review: '已驳回', delivery: '不可交付', tags: ['日常', '天空', '日'] },
];
const clone = value => JSON.parse(JSON.stringify(value));
function entry(id, text, author, source, pool, imageId, tags) {
  return { id, text, author, source, pool, defaults: { template: 'paper', fontId: 'wenkai', imageId, showDate: true, showBrand: true }, tags, note: '公开诗句 · 仅用于设计样例', annotationConfirmed: false, protected: false };
}
export function createStudioModel() {
  return {
    entries: [
      entry('example-cloud', '行到水穷处，\n坐看云起时。', '王维', '终南别业', 'formal', 'sample-mist', ['释然', '平静', '山野', '云']),
      entry('example-moon', '明月松间照，\n清泉石上流。', '王维', '山居秋暝', 'formal', 'sample-dusk', ['日常', '平静', '树林', '月']),
      entry('example-flower', '采菊东篱下，\n悠然见南山。', '陶渊明', '饮酒·其五', 'draft', 'sample-sea', ['自由', '平静', '田野', '花']),
      entry('example-river', '江流天地外，\n山色有无中。', '王维', '汉江临泛', 'reserve', 'sample-dusk', ['辽阔', '山野', '水']),
      entry('example-spring', '春眠不觉晓，\n处处闻啼鸟。', '孟浩然', '春晓', 'trash', 'sample-pending', ['春日', '树林', '鸟']),
    ],
    bindings: Object.fromEntries(WEEK.map((date, index) => [date, { entryId: index % 2 ? 'example-moon' : 'example-cloud', overrides: {}, confirmed: false, locked: false }])),
    assets: clone(ASSETS),
    release: { completed: 0, blocked: true },
  };
}
export function boundDates(model, entryId) {
  return Object.keys(model.bindings).filter(date => model.bindings[date].entryId === entryId).sort();
}
export function cardSettings(model, entryId, date = '') {
  const row = model.entries.find(item => item.id === entryId);
  if (!row) throw new Error('找不到示例内容');
  const binding = model.bindings[date];
  return { ...row.defaults, ...(binding?.entryId === entryId ? binding.overrides : {}) };
}

/** 纯内存事务：先校验全部替代日期，再复制并一次性替换。 */
export function moveEntry(model, entryId, targetPool, replacements = {}) {
  if (!Object.hasOwn(POOLS, targetPool)) throw new Error('未知目标池');
  const source = model.entries.find(row => row.id === entryId);
  if (!source) throw new Error('找不到示例内容');
  const dates = targetPool === 'formal' ? [] : boundDates(model, entryId);
  for (const date of dates) {
    const replacement = model.entries.find(row => row.id === replacements[date]);
    if (!replacement || replacement.id === entryId || replacement.pool === 'trash') throw new Error(`${date} 需要选择有效替代句；未应用任何变更。`);
  }
  const next = clone(model);
  for (const date of dates) {
    const replacement = next.entries.find(row => row.id === replacements[date]);
    replacement.pool = 'formal';
    next.bindings[date] = { entryId: replacement.id, overrides: {}, confirmed: false, locked: false };
  }
  next.entries.find(row => row.id === entryId).pool = targetPool;
  next.release = { ...next.release, completed: 0 };
  return next;
}
export function replaceDates(model, dates, replacementId) {
  const row = model.entries.find(item => item.id === replacementId);
  if (!row || row.pool === 'trash' || !dates.length || dates.some(date => !model.bindings[date])) throw new Error('替代句或日期范围无效；未应用任何变更。');
  const next = clone(model);
  next.entries.find(item => item.id === replacementId).pool = 'formal';
  for (const date of dates) next.bindings[date] = { entryId: replacementId, overrides: {}, confirmed: false, locked: false };
  next.release = { ...next.release, completed: 0 };
  return next;
}
export function applyScope(model, entryId, patch, scope, currentDate, dates = []) {
  if (!['current', 'default', 'dates'].includes(scope)) throw new Error('未知应用范围');
  const row = model.entries.find(item => item.id === entryId);
  if (!row) throw new Error('找不到示例内容');
  const targets = scope === 'current' ? [currentDate] : scope === 'dates' ? dates : [];
  if (scope !== 'default' && (!targets.length || targets.some(date => model.bindings[date]?.entryId !== entryId))) throw new Error('请明确选择本句关联日期；没有应用到其他日期。');
  const allowed = ['template', 'fontId', 'imageId', 'showDate', 'showBrand'];
  if (Object.keys(patch).some(key => !allowed.includes(key))) throw new Error('不支持的示例设置');
  const next = clone(model);
  if (scope === 'default') {
    Object.assign(next.entries.find(item => item.id === entryId).defaults, patch);
    for (const date of boundDates(next, entryId)) { next.bindings[date].confirmed = false; next.bindings[date].locked = false; }
  } else for (const date of targets) {
    Object.assign(next.bindings[date].overrides, patch);
    next.bindings[date].confirmed = false;
    next.bindings[date].locked = false;
  }
  next.release.completed = 0;
  return next;
}
export function advanceRelease(model, step) {
  if (step !== model.release.completed || step < 0 || step > 4) throw new Error('请按预检、应用修订、生成发布包、确认推送、核验回执的顺序演示。');
  if (model.release.blocked) throw new Error('仍有示例阻塞；后续阶段保持关闭。');
  const next = clone(model);
  next.release.completed += 1;
  return next;
}
