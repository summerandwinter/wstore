// Browser-only compositor for the shared fixed-code footer. PNG encoding remains the caller's responsibility.
import {
  FIXED_CODE_PATH, FIXED_CODE_SHA256, CODED_CARD_WIDTH, CODED_CARD_HEIGHT,
  CODED_CARD_BASE_WIDTH, CODED_CARD_BASE_HEIGHT, CODE_SIZE, CODED_CARD_VARIANT,
  paintCardCodeFooter,
} from './rendering/card-code-footer.js';
import { sha256Hex } from './services/resource-digest.js';

const CODE_MAX_BYTES = 64 * 1024;
const CODE_TIMEOUT_MS = 3000;

class BrowserCodedCardCancelledError extends Error {
  constructor() { super('带码卡片生成已取消。'); this.name = 'BrowserCodedCardCancelledError'; this.code = 'CARD_RENDER_CANCELLED'; }
}

function assertActive(isActive) {
  if (!isActive()) throw new BrowserCodedCardCancelledError();
}

function connected(canvas, label) {
  if (!canvas || canvas.isConnected !== true) throw new Error(`${label}画布必须保持连接。`);
}

function bytesToHex(bytes) {
  return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
}

async function readBoundedBytes(response) {
  const declared = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declared) && declared > CODE_MAX_BYTES) throw new Error('固定小程序码超过 64 KiB。');
  if (!response.body?.getReader) {
    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > CODE_MAX_BYTES) throw new Error('固定小程序码字节无效。');
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array) || !value.byteLength) continue;
      length += value.byteLength;
      if (length > CODE_MAX_BYTES) {
        await reader.cancel();
        throw new Error('固定小程序码超过 64 KiB。');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock?.(); }
  if (!length) throw new Error('固定小程序码字节无效。');
  const joined = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  return joined.buffer;
}

async function decodeCode(bytes, isActive, registerCancel) {
  const blob = new Blob([bytes], { type: 'image/png' });
  if (typeof createImageBitmap === 'function') {
    const image = await createImageBitmap(blob);
    if (!isActive()) { image.close?.(); throw new BrowserCodedCardCancelledError(); }
    return image;
  }
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      let settled = false;
      const finish = (value, error) => {
        if (settled) return;
        settled = true; image.onload = null; image.onerror = null; registerCancel(undefined);
        if (error) reject(error); else resolve(value);
      };
      registerCancel(error => finish(undefined, error || new Error('固定小程序码解码失败。')));
      image.onload = () => finish(image);
      image.onerror = () => finish(undefined, new Error('固定小程序码解码失败。'));
      image.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}

async function loadCode(isActive) {
  const controller = new AbortController();
  let expired = false;
  let cancelDecode;
  let rejectTimeout;
  const timeoutError = new Error('固定小程序码读取超时。');
  const timeout = new Promise((_, reject) => { rejectTimeout = reject; });
  const timer = setTimeout(() => {
    expired = true;
    controller.abort(timeoutError);
    cancelDecode?.(timeoutError);
    rejectTimeout(timeoutError);
  }, CODE_TIMEOUT_MS);
  const assertPending = () => {
    if (expired) throw timeoutError;
    assertActive(isActive);
  };
  const loading = (async () => {
    try {
      assertPending();
      const response = await fetch(FIXED_CODE_PATH, { signal: controller.signal, cache: 'no-store', redirect: 'error' });
      assertPending();
      if (!response.ok) throw new Error(`固定小程序码请求失败（HTTP ${response.status}）。`);
      const bytes = await readBoundedBytes(response);
      assertPending();
      const provider = globalThis.crypto?.subtle;
      const digest = typeof provider?.digest === 'function' ? bytesToHex(await provider.digest('SHA-256', bytes)) : sha256Hex(bytes);
      assertPending();
      if (digest !== FIXED_CODE_SHA256) throw new Error('固定小程序码 SHA-256 不匹配。');
      const image = await decodeCode(bytes, isActive, cancel => { cancelDecode = cancel; });
      if (expired) { image.close?.(); throw timeoutError; }
      if (image.width !== CODE_SIZE || image.height !== CODE_SIZE) {
        image.close?.();
        throw new Error('固定小程序码尺寸必须为 280 × 280。');
      }
      assertPending();
      return image;
    } catch (error) {
      if (expired) throw timeoutError;
      throw error;
    }
  })();
  try { return await Promise.race([loading, timeout]); }
  finally { clearTimeout(timer); cancelDecode = undefined; }
}

/**
 * Compose a mounted 1080 × 1440 source into a different mounted 1080 × 1800 canvas.
 * The source dimensions and bitmap are never changed.
 */
export async function renderCodedCard(baseCanvas, outputCanvas, { isActive = () => true } = {}) {
  if (typeof isActive !== 'function') throw new Error('isActive 必须是函数。');
  assertActive(isActive);
  connected(baseCanvas, '原卡片'); connected(outputCanvas, '输出');
  if (baseCanvas === outputCanvas) throw new Error('输出画布必须与原卡片画布分离。');
  if (baseCanvas.width !== CODED_CARD_BASE_WIDTH || baseCanvas.height !== CODED_CARD_BASE_HEIGHT) throw new Error('原卡片画布必须为 1080 × 1440。');
  if (outputCanvas.width !== CODED_CARD_WIDTH || outputCanvas.height !== CODED_CARD_HEIGHT) throw new Error('输出画布必须为 1080 × 1800。');
  const context = outputCanvas.getContext?.('2d');
  if (!context) throw new Error('无法创建带码卡片画布上下文。');
  const code = await loadCode(isActive);
  try {
    assertActive(isActive);
    connected(baseCanvas, '原卡片'); connected(outputCanvas, '输出');
    if (baseCanvas.width !== CODED_CARD_BASE_WIDTH || baseCanvas.height !== CODED_CARD_BASE_HEIGHT) throw new Error('原卡片画布尺寸在合成前已变化。');
    if (outputCanvas.width !== CODED_CARD_WIDTH || outputCanvas.height !== CODED_CARD_HEIGHT) throw new Error('输出画布尺寸在合成前已变化。');
    paintCardCodeFooter(context, baseCanvas, code);
    assertActive(isActive);
    connected(baseCanvas, '原卡片'); connected(outputCanvas, '输出');
    return { canvas: outputCanvas, profile: CODED_CARD_VARIANT, codeSha256: FIXED_CODE_SHA256 };
  } finally { code.close?.(); }
}

/** Convenience wrapper for callers that want the adapter to create the mounted output canvas. */
export async function browserCodedCard(baseCanvas, options = {}) {
  const outputCanvas = options.outputCanvas || document.createElement('canvas');
  if (!options.outputCanvas) {
    outputCanvas.width = CODED_CARD_WIDTH; outputCanvas.height = CODED_CARD_HEIGHT;
    const parent = options.container || baseCanvas?.parentElement;
    if (!parent?.appendChild) throw new Error('未提供可连接输出画布的容器。');
    parent.appendChild(outputCanvas);
  }
  if (outputCanvas.width !== CODED_CARD_WIDTH || outputCanvas.height !== CODED_CARD_HEIGHT) throw new Error('输出画布必须为 1080 × 1800。');
  return renderCodedCard(baseCanvas, outputCanvas, options);
}
