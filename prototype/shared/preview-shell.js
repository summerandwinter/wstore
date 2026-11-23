// Shared navigation for public design previews. It does not touch the reading UI.
const icons = {
  home: '<path d="m3 10 9-7 9 7v10H3V10Zm6 10v-7h6v7"/>',
  cards: '<rect x="4" y="3" width="12" height="16" rx="2"/><path d="M8 7h4M8 11h4m7-5 2 14a2 2 0 0 1-2 2H9"/>',
  reader: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4m-3 14h2"/>',
  studio: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 3v18m0-12h13"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
document.querySelectorAll('[data-preview-menu-icon]').forEach(node => { node.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>'; });
document.querySelectorAll('[data-studio-brand-mark]').forEach(node => { node.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 23V11h5v12M19 23V6h5v17M6 27h20"/></svg>'; });
const links = [
  ['home', '../index.html', '资源首页', '设计与实现边界'],
  ['cards', './cards.html', '卡片与字体', '版式、字样与两端对照'],
  ['reader', './reader.html', '阅读端', '小程序交互预览'],
  ['studio', './studio.html', '管理端', '内容工作台原型'],
];
const homePage = document.body.classList.contains('preview-shell-home');
if (homePage) for (const row of links) row[1] = row[0] === 'home' ? './index.html' : `./prototype/${row[0]}.html`;
const navigation = (current, compact = false) => `<nav class="${compact ? 'preview-quick-links' : 'preview-side-links'}" aria-label="项目设计资源">${links.map(([id, href, title, description]) => `<a href="${href}"${id === current ? ' aria-current="page"' : ''}>${icon(id)}<span>${title}${compact ? '' : `<small>${description}</small>`}</span></a>`).join('')}</nav>`;
document.querySelectorAll('[data-preview-navigation]').forEach(node => {
  node.classList.add('preview-sidebar');
  node.id ||= 'preview-sidebar';
  node.innerHTML = `<a class="preview-brand" href="${homePage ? './index.html' : '../index.html'}"><span class="preview-brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M8 23V11h5v12M19 23V6h5v17M6 27h20"/></svg></span><span>拾光撷语<small>DAYLIGHT DESIGN</small></span></a><div class="preview-space"><span>拾</span><div>原型预览<small>同一套内容，不同的表达</small></div></div><p class="preview-nav-caption">设计工作空间</p>${navigation(node.dataset.previewNavigation)}<div class="preview-sidebar-bottom"><span class="preview-live-dot"></span><span>同源资源 · 交互演示<small>把值得的，留下。</small></span></div>`;
});
document.querySelectorAll('[data-preview-links]').forEach(node => {
  node.innerHTML = navigation(node.dataset.previewLinks, true);
});
document.querySelectorAll('[data-preview-menu]').forEach(button => {
  button.addEventListener('click', () => {
    const expanded = document.body.classList.toggle('preview-menu-open');
    button.setAttribute('aria-expanded', String(expanded));
  });
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    document.body.classList.remove('preview-menu-open');
    document.querySelector('[data-preview-menu]')?.setAttribute('aria-expanded', 'false');
  }
});
document.addEventListener('click', event => {
  if (document.body.classList.contains('preview-menu-open') && !event.target.closest('.preview-sidebar, [data-preview-menu]')) {
    document.body.classList.remove('preview-menu-open');
    document.querySelector('[data-preview-menu]')?.setAttribute('aria-expanded', 'false');
  }
});
