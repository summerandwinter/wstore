// Shared production TTF resources. Public copies live at runtime/public-resources.js.
import { validateTemplateVisualConfig } from './domain/template-config.js';
import { sha256Hex } from './services/resource-digest.js';
export const publicBase = new URL('../', import.meta.url);
const SHA = /^[a-f0-9]{64}$/;
const ID = /^[a-z][a-z0-9-]{0,39}$/;
const KINDS = ['content', 'fonts', 'imagery'];
const SYSTEM = Object.freeze({ id: 'system', name: '系统字体', role: 'sans', description: '随设备提供，不下载字体' });
// Frozen compatibility identities projected from shared/card-catalog.json; display metadata remains schema5-only.
const BUILTIN_MAPPING = Object.freeze({ wenkai: ['DaylightWenkai', 'serif'], xiaowei: ['DaylightXiaowei', 'serif'], notoserif: ['DaylightNotoSerif', 'serif'], notosans: ['DaylightNotoSans', 'sans'], mashanzheng: ['DaylightMaShanZheng', 'handwriting'], longcang: ['DaylightLongCang', 'handwriting'] });
const RESERVED_IDS = new Set(['system', '__proto__', 'prototype', 'constructor', 'tostring', 'tolocalestring', 'valueof', 'hasownproperty', 'isprototypeof', 'propertyisenumerable', '__definegetter__', '__definesetter__', '__lookupgetter__', '__lookupsetter__']);
const FONT_FAILURES = Object.freeze(Object.fromEntries([
  ['metadata', 'FONT_METADATA_FAILED'], ['ttf', 'FONT_TTF_INVALID'], ['license', 'FONT_LICENSE_INVALID'],
  ['fontface', 'FONT_FACE_LOAD_FAILED'], ['registration', 'FONT_REGISTRATION_FAILED'],
].map(([stage, code]) => [stage, Object.freeze({ stage, code })])));
const FONT_FAILURE_RECORDS = new Set(Object.values(FONT_FAILURES));
const FONT_FAILURE_MESSAGES = Object.freeze({
  metadata: '字体资源清单读取或校验失败',
  ttf: 'TTF 文件读取或完整性校验失败',
  license: '字体许可文件读取或校验失败',
  fontface: '浏览器未能解析或加载 TTF 字体',
  registration: '浏览器字体注册或就绪检查失败',
});
async function fontStage(stage, operation) { try { return await operation(); } catch { throw FONT_FAILURES[stage]; } }
const missingGlyphCount = (result, text) => new Set(Array.from(text).filter(character => !/\s/.test(character) && !result.coverage.has(character))).size;
const safeText = (value, limit, empty = false) => typeof value === 'string' && (empty || value.trim()) && Array.from(value).length <= limit && !/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069<>"'`\\{}]/.test(value) && !Array.from(value).some(char => char.codePointAt(0) >= 0xd800 && char.codePointAt(0) <= 0xdfff);
const fullLicense = value => typeof value === 'string' && /SIL OPEN FONT LICENSE\s+Version 1\.1/.test(value) && ['Copyright', 'PERMISSION & CONDITIONS', 'TERMINATION', 'DISCLAIMER'].every(part => value.includes(part));
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).join(',') === keys;
const familyRoles = new Map();
export const fallbackStackForRole = role => role === 'sans' ? 'system-ui, sans-serif' : '"Songti SC", "STSong", serif';
export function fontStackForFamily(family) { return family ? `"${family}", ${fallbackStackForRole(familyRoles.get(family))}` : undefined; }
export function resolvePublicResource(path, base = publicBase) {
  const root = new URL(base, publicBase);
  if (!root.pathname.endsWith('/') || root.search || root.hash || !['http:', 'https:'].includes(root.protocol)) throw new Error('Invalid resource root');
  if (typeof path !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Invalid resource reference');
  const url = new URL(path, root);
  if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) throw new Error('Resource reference escapes root');
  return url.href;
}
const sha256 = async bytes => {
  const subtle = globalThis.crypto?.subtle;
  if (typeof subtle?.digest === 'function') return Array.from(new Uint8Array(await subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
  // LAN HTTP pages lack WebCrypto; keep the shared byte-integrity check active.
  const buffer = ArrayBuffer.isView(bytes) ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes;
  return sha256Hex(buffer);
};
const identityHash = value => sha256(new TextEncoder().encode(JSON.stringify(value)));
function jsonBytes(bytes) { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
async function fetchBytes(path, base, limit, expected, timeoutMs = 8000) {
  const response = await fetch(resolvePublicResource(path, base), { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store', redirect: 'error' });
  if (!response.ok) throw new Error(`Resource HTTP ${response.status}`);
  const declared = Number(response.headers?.get('content-length'));
  if (declared > limit) throw new Error('Resource exceeds byte budget');
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > limit || expected && (bytes.byteLength !== expected.bytes || await sha256(bytes) !== expected.sha256)) throw new Error('Resource SHA256/bytes mismatch');
  return bytes;
}
async function validateFontManifest(manifest) {
  if (!exactKeys(manifest, 'schemaVersion,profile,version,registry,fonts') || manifest.schemaVersion !== 5 || manifest.profile !== 'broad' || !/^font-v5-[a-f0-9]{64}$/.test(manifest.version || '') || !exactKeys(manifest.registry, 'schemaVersion,fonts') || manifest.registry.schemaVersion !== 1 || !Array.isArray(manifest.registry.fonts) || !Array.isArray(manifest.fonts) || manifest.fonts.length < Object.keys(BUILTIN_MAPPING).length || manifest.fonts.length > 12 || manifest.fonts.length !== manifest.registry.fonts.length) throw new Error('Invalid production TTF manifest');
  const identity = { schemaVersion: 5, profile: 'broad', registry: manifest.registry, fonts: manifest.fonts };
  if (manifest.version !== `font-v5-${await identityHash(identity)}`) throw new Error('Font manifest identity mismatch');
  const ids = new Set(), families = new Set(), paths = new Set(), orders = new Set();
  let total = 0;
  for (const definition of manifest.registry.fonts) {
    const reserved = BUILTIN_MAPPING[definition?.id];
    if (!exactKeys(definition, 'id,name,family,role,description,order') || !ID.test(definition.id || '') || RESERVED_IDS.has(definition.id) || ids.has(definition.id) || !/^Daylight[A-Za-z0-9]{1,72}$/.test(definition.family || '') || /ReadingV3/i.test(definition.family) || families.has(definition.family.toLowerCase()) || !['serif', 'sans', 'handwriting'].includes(definition.role) || !safeText(definition.name, 32) || !safeText(definition.description, 160, true) || !Number.isSafeInteger(definition.order) || definition.order < 0 || definition.order > 99 || orders.has(definition.order) || reserved && (definition.family !== reserved[0] || definition.role !== reserved[1]) || !reserved && Object.values(BUILTIN_MAPPING).some(([family]) => family.toLowerCase() === definition.family.toLowerCase())) throw new Error('Invalid font registry definition');
    const row = manifest.fonts.find(value => value?.id === definition.id);
    if (!exactKeys(row, 'id,family,format,version,resourceName,nativeUrl,nativeBytes,nativeSha256,coverage,license,licenseUrl,licenseSha256') || row.family !== definition.family || row.format !== 'ttf' || !new RegExp(`^${row.id}-v2-[a-f0-9]{24}$`).test(row.resourceName || '') || row.nativeUrl !== `${row.resourceName}.ttf` || row.licenseUrl !== `${row.resourceName}.OFL.txt` || paths.has(row.nativeUrl) || !SHA.test(row.nativeSha256 || '') || !SHA.test(row.licenseSha256 || '') || row.version !== `ttf-v5-${(await sha256(new TextEncoder().encode(`${row.nativeSha256}:${row.licenseSha256}`))).slice(0, 24)}` || !Number.isSafeInteger(row.nativeBytes) || row.nativeBytes < 40 * 1024 || row.nativeBytes > 4 * 1024 * 1024 || !fullLicense(row.license) || new TextEncoder().encode(row.license).byteLength > 32 * 1024 || await sha256(new TextEncoder().encode(row.license)) !== row.licenseSha256 || typeof row.coverage !== 'string' || !row.coverage || row.coverage.length > 32768) throw new Error('Invalid TTF resource identity');
    const chars = Array.from(row.coverage);
    if (new Set(chars).size !== chars.length || chars.some(char => char.codePointAt(0) < 32 || char.codePointAt(0) >= 0xd800 && char.codePointAt(0) <= 0xdfff)) throw new Error('Invalid TTF coverage');
    total += row.nativeBytes; ids.add(definition.id); families.add(definition.family.toLowerCase()); paths.add(row.nativeUrl); orders.add(definition.order);
  }
  if (Object.keys(BUILTIN_MAPPING).some(id => !ids.has(id)) || total > 24 * 1024 * 1024) throw new Error('TTF registry set/total byte budget invalid');
  return manifest;
}
export function createPublicResources({ base = publicBase } = {}) {
  let task;
  const root = new URL(base, publicBase);
  return {
    base: root,
    resolve(path) { return resolvePublicResource(path, root); },
    async catalog() {
      if (!task) {
        const pending = (async () => {
          const index = jsonBytes(await fetchBytes('resources/index-v3.json', root, 32 * 1024));
          if (!exactKeys(index, 'schemaVersion,version,contentVersion,manifests') || index.schemaVersion !== 3 || typeof index.contentVersion !== 'string' || !/^[a-zA-Z0-9._-]{1,80}$/.test(index.contentVersion) || Object.keys(index.manifests || {}).join(',') !== KINDS.join(',') || index.contentVersion !== index.manifests.content.version || index.version !== `resources-v3-${await identityHash({ schemaVersion: 3, contentVersion: index.contentVersion, manifests: index.manifests })}`) throw new Error('Resource index identity mismatch');
          const documents = {};
          for (const kind of KINDS) {
            const row = index.manifests[kind], limit = kind === 'imagery' ? 1024 * 1024 : 512 * 1024;
            if (!exactKeys(row, 'url,sha256,bytes,version') || typeof row.version !== 'string' || !/^[a-zA-Z0-9._-]{1,80}$/.test(row.version) || !SHA.test(row.sha256 || '') || !Number.isSafeInteger(row.bytes) || row.bytes < 1 || row.bytes > limit || row.url !== `${kind}/${kind === 'fonts' ? 'manifest-v5' : 'manifest'}-${row.sha256}.json`) throw new Error('Invalid pinned resource descriptor');
            documents[kind] = jsonBytes(await fetchBytes(row.url, root, limit, row));
            if (documents[kind].version !== row.version) throw new Error('Pinned resource version mismatch');
          }
          await validateFontManifest(documents.fonts);
          const imagery = documents.imagery;
          if (imagery.schemaVersion !== 1 || !Array.isArray(imagery.assets) || imagery.assets.length > 2000 || imagery.version !== (await identityHash(imagery.assets)).slice(0, 12)) throw new Error('Imagery catalog identity mismatch');
          const ids = new Set(), files = new Set();
          for (const asset of imagery.assets) {
            if (!/^[A-Za-z0-9._-]{1,120}$/.test(asset.id || '') || ids.has(asset.id) || !safeText(asset.label, 120) || /https?:\/\/|[A-Za-z]:\/|\.\.\//i.test(asset.label) || !/^[A-Za-z0-9._-]+\.(png|jpe?g|webp)$/i.test(asset.file || '') || files.has(asset.file) || !SHA.test(asset.sha256 || '') || !Number.isSafeInteger(asset.bytes) || asset.bytes < 1 || asset.bytes > 6 * 1024 * 1024 || asset.deliveryUrl !== '' || Object.keys(asset).some(key => !['id', 'label', 'file', 'sha256', 'bytes', 'deliveryUrl'].includes(key))) throw new Error('Invalid public imagery record');
            ids.add(asset.id); files.add(asset.file);
          }
          const templateConfig = documents.content.templateConfig === undefined ? undefined : validateTemplateVisualConfig(documents.content.templateConfig);
          return { index, documents, fonts: [SYSTEM, ...documents.fonts.registry.fonts], imagery: imagery.assets, ...(templateConfig ? { templateConfig } : {}) };
        })();
        task = pending;
        pending.catch(() => { if (task === pending) task = undefined; });
      }
      return task;
    },
    async resolveImage(id) {
      const asset = (await this.catalog()).imagery.find(row => row.id === id);
      if (!asset) throw new Error('Unknown approved imagery ID');
      return this.resolve(`imagery/${asset.file}`);
    },
  };
}
export function createProductionFontLoader({ base = publicBase, catalog, resources = createPublicResources({ base }), fontManifestPath, fontObjectPrefix = 'fonts/' } = {}) {
  const loaded = new Map(), tasks = new Map(), failures = new Map();
  let manifestTask, metadataFailure, definitions = [SYSTEM];
  async function metadata() {
    if (!manifestTask) {
      const pending = fontStage('metadata', async () => {
        const manifest = fontManifestPath ? await validateFontManifest(jsonBytes(await fetchBytes(fontManifestPath, base, 512 * 1024))) : (await resources.catalog()).documents.fonts;
        if (catalog) for (const expected of catalog.filter(row => row.id !== 'system')) {
          const actual = manifest.registry.fonts.find(row => row.id === expected.id);
          if (!actual || actual.family !== expected.family || actual.role !== expected.role) throw new Error('Reserved font registry mapping changed');
        }
        definitions = [SYSTEM, ...manifest.registry.fonts];
        metadataFailure = undefined;
        return manifest;
      });
      manifestTask = pending;
      pending.catch(() => { if (manifestTask === pending) { manifestTask = undefined; metadataFailure = FONT_FAILURES.metadata; } });
    }
    return manifestTask;
  }
  const loader = {
    async catalog() { try { await metadata(); return definitions; } catch { throw new Error(FONT_FAILURE_MESSAGES.metadata); } },
    get fontDefinitions() { return definitions; },
    async ensureFont(id) {
      if (id === 'system') return undefined;
      try {
        const manifest = await metadata(), row = manifest.fonts.find(value => value.id === id);
        if (!row) throw FONT_FAILURES.metadata;
        const key = `${row.family}:${row.version}:${row.nativeSha256}`;
        if (!tasks.has(key)) {
          const pending = (async () => {
            const bytes = await fontStage('ttf', async () => {
              const value = await fetchBytes(`${fontObjectPrefix}${row.nativeUrl}`, base, 4 * 1024 * 1024, { bytes: row.nativeBytes, sha256: row.nativeSha256 }, 30000);
              if (new DataView(value).getUint32(0) !== 0x00010000) throw FONT_FAILURES.ttf;
              return value;
            });
            await fontStage('license', async () => {
              const license = await fetchBytes(`${fontObjectPrefix}${row.licenseUrl}`, base, 32 * 1024, { bytes: new TextEncoder().encode(row.license).byteLength, sha256: row.licenseSha256 });
              if (new TextDecoder('utf-8', { fatal: true }).decode(license) !== row.license) throw FONT_FAILURES.license;
            });
            const face = await fontStage('fontface', async () => {
              const value = new FontFace(row.family, bytes, { weight: '400', style: 'normal' });
              await value.load();
              if (value.status !== 'loaded') throw FONT_FAILURES.fontface;
              return value;
            });
            await fontStage('registration', async () => {
              try {
                document.fonts.add(face);
                await document.fonts.load(`16px "${row.family}"`);
                if (!document.fonts.check(`16px "${row.family}"`)) throw FONT_FAILURES.registration;
              } catch {
                try { document.fonts.delete?.(face); } catch {}
                throw FONT_FAILURES.registration;
              }
            });
            const result = { family: row.family, version: row.version, coverage: new Set(Array.from(row.coverage)) };
            loaded.set(id, result); failures.delete(id); familyRoles.set(row.family, manifest.registry.fonts.find(value => value.id === id).role);
            return result.family;
          })();
          if (tasks.size >= 24) tasks.delete(tasks.keys().next().value);
          tasks.set(key, pending);
          pending.catch(() => { if (tasks.get(key) === pending) tasks.delete(key); });
        }
        return await tasks.get(key);
      } catch (error) { loaded.delete(id); failures.set(id, FONT_FAILURE_RECORDS.has(error) ? error : FONT_FAILURES.metadata); return undefined; }
    },
    async ensure(id) {
      if (id) return loader.ensureFont(id);
      try { await metadata(); } catch { return 0; }
      const results = await Promise.all(definitions.filter(row => row.id !== 'system').map(row => loader.ensureFont(row.id)));
      return results.filter(Boolean).length;
    },
    familyFor(id) { return id === 'system' ? undefined : loaded.get(id)?.family; },
    failureFor(id, text = '') {
      if (id === 'system') return null;
      const result = loaded.get(id);
      if (!result?.family) return failures.get(id) || metadataFailure || null;
      const count = missingGlyphCount(result, text);
      return count ? Object.freeze({ stage: 'coverage', code: 'FONT_GLYPHS_MISSING', count }) : null;
    },
    noticeFor(id, text = '') {
      if (id === 'system') return '系统字体 · 字形随设备变化';
      const font = definitions.find(row => row.id === id), result = loaded.get(id), name = font?.name || '生产字体';
      if (!result?.family) {
        const failure = loader.failureFor(id);
        return `${name}未加载 · 系统字体回退${failure ? `（${FONT_FAILURE_MESSAGES[failure.stage]}）` : ''}`;
      }
      const missing = missingGlyphCount(result, text);
      return `${name} · 正常 TTF 已加载${missing ? ` · ${missing} 个字形使用系统回退` : ' · 当前正文已覆盖'}`;
    },
    stateFor(id, text = '') { return id === 'system' ? 'system' : !loaded.get(id)?.family ? 'fallback' : missingGlyphCount(loaded.get(id), text) ? 'partial' : 'loaded'; },
  };
  return loader;
}
export const publicResources = createPublicResources();
export const productionFonts = createProductionFontLoader({ resources: publicResources });
