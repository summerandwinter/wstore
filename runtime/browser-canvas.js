// 浏览器与小程序只在图片加载/导出处不同；布局与全部绘制命令共享同一实现。
import { layoutCard } from './rendering/layout.js';
import { paintCardLayout } from './rendering/painter.js';
import { EXPORT_WIDTH, EXPORT_HEIGHT, FONT_FAMILIES } from './rendering/templates.js';
import { fontStackForFamily, publicBase } from './public-resources.js';

const loadedImages = new Map();
const renderVersions = new WeakMap();
const validSize = (width, height) => Number.isFinite(width) && Number.isFinite(height) &&
  width > 0 && height > 0 && width * height <= 24000000;

function loadImage(src) {
  if (!src) return Promise.resolve(undefined);
  if (loadedImages.has(src)) return loadedImages.get(src);
  const controller = new AbortController();
  let timer;
  let expired = false;
  let cancelDecode;
  const loading = (async () => {
    const response = await fetch(src, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    if (blob.size > 6 * 1024 * 1024) throw new Error('图片过大');
    if (expired) throw new Error('图片加载超时');
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(blob);
      if (expired || !validSize(bitmap.width, bitmap.height)) {
        bitmap.close();
        throw new Error(expired ? '图片加载超时' : '图片尺寸不合法');
      }
      return bitmap;
    }
    const url = URL.createObjectURL(blob);
    try {
      return await new Promise((resolve, reject) => {
        const image = new Image();
        const finish = error => {
          image.onload = null;
          image.onerror = null;
          cancelDecode = undefined;
          if (error) reject(error);
          else resolve(image);
        };
        cancelDecode = () => finish(new Error('图片加载超时'));
        image.onload = () => validSize(image.naturalWidth, image.naturalHeight)
          ? finish() : finish(new Error('图片尺寸不合法'));
        image.onerror = () => finish(new Error('图片解码失败'));
        image.src = url;
      });
    } finally { URL.revokeObjectURL(url); }
  })();
  const task = Promise.race([loading, new Promise((_, reject) => {
    timer = setTimeout(() => {
      expired = true;
      controller.abort();
      if (cancelDecode) cancelDecode();
      reject(new Error('图片加载超时'));
    }, 8000);
  })])
    .catch(() => {
      // 被容量淘汰的旧任务不能删除同 URL 后发的新任务。
      if (loadedImages.get(src) === task) loadedImages.delete(src);
      return undefined;
    })
    .finally(() => clearTimeout(timer));
  if (loadedImages.size >= 48) loadedImages.delete(loadedImages.keys().next().value);
  loadedImages.set(src, task);
  return task;
}

/**
 * 固定 1080×1440 物理像素；loadedFamily 由调用者在字体加载后传入。
 * 第一次文字绘制同步完成，Promise 在图片成功或失败后才返回最终 imageState。
 */
export async function drawCard(canvas, card, options, loadedFamily) {
  const version = (renderVersions.get(canvas) || 0) + 1;
  renderVersions.set(canvas, version);
  if (canvas.dataset) canvas.dataset.imageState = 'loading';
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建画布上下文');
  const roleStack = fontStackForFamily(loadedFamily);
  const stack = value => loadedFamily && value.startsWith(`"${loadedFamily}",`) ? roleStack : value;
  const layout = layoutCard(card, options, (text, fontSize, fontFamily) => {
    context.font = `${fontSize}px ${stack(fontFamily)}`;
    return context.measureText(text).width;
  }, loadedFamily);
  const applyStack = value => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.fontFamily === 'string') value.fontFamily = stack(value.fontFamily);
    for (const child of Object.values(value)) if (child && typeof child === 'object') applyStack(child);
  };
  applyStack(layout);
  // 先完成纯色 + 文字版，保证首帧不受下载或解码阻塞。
  paintCardLayout(context, layout);
  const imagePath = card.imagePath || new URL(`backgrounds/${['mist', 'sea', 'dusk'].includes(card.background) ? card.background : 'mist'}.png`, publicBase).href;
  const task = loadImage(imagePath);
  const image = await task;
  // 旧任务、移除的预览不再触碰画布或新任务的 dataset。
  if (renderVersions.get(canvas) !== version || canvas.isConnected === false) return { ...layout, imageState: 'stale' };
  const { imageDrawn } = paintCardLayout(context, layout, image);
  const imageState = imageDrawn ? 'ready' : 'failed';
  // 解码成功但 drawImage 报错的图也允许重试，不能永久缓存一个坏句柄。
  if (image && !imageDrawn && loadedImages.get(imagePath) === task) loadedImages.delete(imagePath);
  if (canvas.dataset) canvas.dataset.imageState = imageState;
  return { ...layout, imageState };
}

export { FONT_FAMILIES, EXPORT_WIDTH, EXPORT_HEIGHT };

window.drawCard = drawCard;
