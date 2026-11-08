import { publicResources, productionFonts } from '../../runtime/public-resources.js';
let catalogRequest;
let rendererRequest;
const renderVersions = new WeakMap();
export async function loadCatalog() {
  if (!catalogRequest) {
    const pending = Promise.all([import('../../runtime/card-catalog.js'), publicResources.catalog()]).then(([{ templateDefinitions }, resources]) => {
      if (!Array.isArray(templateDefinitions) || new Set(templateDefinitions.map(row => row.id)).size !== templateDefinitions.length) throw new Error('共享目录格式不正确。');
      const ids = new Set(resources.fonts.map(row => row.id));
      if (templateDefinitions.some(row => [row.recommendedFont, row.longTextFont, ...(row.recommendedFonts || [])].filter(Boolean).some(id => !ids.has(id)))) throw new Error('版式推荐字体不在正式目录。');
      return { templates: templateDefinitions, fonts: resources.fonts.map(font => ({ ...font, licenseUrl: resources.documents.fonts.fonts.find(row => row.id === font.id)?.licenseUrl })), imagery: resources.imagery };
    });
    catalogRequest = pending;
    pending.catch(() => { if (catalogRequest === pending) catalogRequest = undefined; });
  }
  return catalogRequest;
}
// Candidates stay archived; never download or activate proposal/sample fonts.
export async function loadProposalFonts() { return []; }
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
export const backgroundImage = id => publicResources.resolve(`backgrounds/${['mist', 'sea', 'dusk'].includes(id) ? id : 'mist'}.png`);
export const resolveImage = id => publicResources.resolveImage(id);
export const resourceUrl = path => publicResources.resolve(path);
export async function loadPreviewFont(fontId, text = '') {
  const family = await productionFonts.ensureFont(fontId);
  return { family, state: productionFonts.stateFor(fontId, text), notice: productionFonts.noticeFor(fontId, text) };
}
/** Resource loading only; all measurements and drawing use the production renderer. */
export async function paintPreview(canvas, card, options, status) {
  const version = (renderVersions.get(canvas) || 0) + 1;
  renderVersions.set(canvas, version);
  if (status) status.textContent = '正在加载正式 TTF 与同源排版…';
  try {
    const font = await loadPreviewFont(options.fontId, card.text);
    if (renderVersions.get(canvas) !== version) return null;
    if (!rendererRequest) rendererRequest = import('../../runtime/browser-canvas.js');
    const { drawCard } = await rendererRequest;
    const imagePath = card.imageId ? await resolveImage(card.imageId) : card.imagePath || backgroundImage(card.background);
    if (renderVersions.get(canvas) !== version) return null;
    const result = await drawCard(canvas, { ...card, imagePath }, options, font.family);
    if (renderVersions.get(canvas) !== version || result.imageState === 'stale') return null;
    canvas.dataset.template = result.template.id;
    canvas.dataset.fontState = font.state;
    canvas.dataset.renderState = 'ready';
    if (status) status.textContent = `${font.notice} · 1080 × 1440${result.imageState === 'failed' ? ' · 配图未加载，当前显示底色' : ' · 同源画布'}`;
    return result;
  } catch (error) {
    if (renderVersions.get(canvas) !== version) return null;
    canvas.dataset.renderState = 'error';
    if (status) status.textContent = `无法生成预览：${error.message}。不会用独立示意图冒充渲染结果。`;
    return null;
  }
}
export function bindTheme() {
  const query = new URLSearchParams(location.search);
  document.documentElement.dataset.theme = query.get('theme') === 'dark' ? 'dark' : 'light';
  document.querySelector('[data-theme-toggle]')?.addEventListener('click', event => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    event.currentTarget.setAttribute('aria-pressed', String(dark));
    const url = new URL(location.href);
    url.searchParams.set('theme', dark ? 'dark' : 'light');
    history.replaceState(null, '', url);
  });
}
export function wireDialog(dialog) {
  let previous;
  return {
    open() { previous = document.activeElement; dialog.showModal(); },
    close() { dialog.close(); if (previous?.isConnected) previous.focus(); },
  };
}
