// Shared production TTF resources. Public copies live at runtime/public-resources.js.
export const publicBase = new URL('../', import.meta.url);
const SHA = /^[a-f0-9]{64}$/;
const ID = /^[a-z][a-z0-9-]{0,39}$/;
const KINDS = ['content', 'fonts', 'imagery'];
const SYSTEM = Object.freeze({ id: 'system', name: '系统字体', role: 'sans', description: '随设备提供，不下载字体' });
// Frozen compatibility identities projected from shared/card-catalog.json; display metadata remains schema5-only.
const BUILTIN_MAPPING = Object.freeze({ wenkai: ['DaylightWenkai', 'serif'], xiaowei: ['DaylightXiaowei', 'serif'], notoserif: ['DaylightNotoSerif', 'serif'], notosans: ['DaylightNotoSans', 'sans'], mashanzheng: ['DaylightMaShanZheng', 'handwriting'], longcang: ['DaylightLongCang', 'handwriting'] });
const RESERVED_IDS = new Set(['system', '__proto__', 'prototype', 'constructor', 'tostring', 'tolocalestring', 'valueof', 'hasownproperty', 'isprototypeof', 'propertyisenumerable', '__definegetter__', '__definesetter__', '__lookupgetter__', '__lookupsetter__']);
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
const sha256 = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
const identityHash = value => sha256(new TextEncoder().encode(JSON.stringify(value)));
function jsonBytes(bytes) { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
async function fetchBytes(path, base, limit, expected) {
  const response = await fetch(resolvePublicResource(path, base), { signal: AbortSignal.timeout(8000), cache: 'no-store', redirect: 'error' });
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
          return { index, documents, fonts: [SYSTEM, ...documents.fonts.registry.fonts], imagery: imagery.assets };
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
  const loaded = new Map(), tasks = new Map();
  let manifestTask, definitions = [SYSTEM];
  async function metadata() {
    if (!manifestTask) {
      const pending = (async () => {
        const manifest = fontManifestPath ? await validateFontManifest(jsonBytes(await fetchBytes(fontManifestPath, base, 512 * 1024))) : (await resources.catalog()).documents.fonts;
        if (catalog) for (const expected of catalog.filter(row => row.id !== 'system')) {
          const actual = manifest.registry.fonts.find(row => row.id === expected.id);
          if (!actual || actual.family !== expected.family || actual.role !== expected.role) throw new Error('Reserved font registry mapping changed');
        }
        definitions = [SYSTEM, ...manifest.registry.fonts];
        return manifest;
      })();
      manifestTask = pending;
      pending.catch(() => { if (manifestTask === pending) manifestTask = undefined; });
    }
    return manifestTask;
  }
  const loader = {
    async catalog() { await metadata(); return definitions; },
    get fontDefinitions() { return definitions; },
    async ensureFont(id) {
      if (id === 'system') return undefined;
      try {
        const manifest = await metadata(), row = manifest.fonts.find(value => value.id === id);
        if (!row) throw new Error('Unknown production font');
        const key = `${row.family}:${row.version}:${row.nativeSha256}`;
        if (!tasks.has(key)) {
          const pending = (async () => {
            const bytes = await fetchBytes(`${fontObjectPrefix}${row.nativeUrl}`, base, 4 * 1024 * 1024, { bytes: row.nativeBytes, sha256: row.nativeSha256 });
            const license = await fetchBytes(`${fontObjectPrefix}${row.licenseUrl}`, base, 32 * 1024, { bytes: new TextEncoder().encode(row.license).byteLength, sha256: row.licenseSha256 });
            if (new TextDecoder('utf-8', { fatal: true }).decode(license) !== row.license) throw new Error('Font OFL object mismatch');
            const signature = new DataView(bytes).getUint32(0);
            if (signature !== 0x00010000) throw new Error('Resource is not a normal TrueType glyf TTF');
            const face = new FontFace(row.family, bytes, { weight: '400', style: 'normal' });
            await face.load();
            if (face.status !== 'loaded') throw new Error('Browser did not load TTF');
            document.fonts.add(face);
            await document.fonts.load(`16px "${row.family}"`);
            if (!document.fonts.check(`16px "${row.family}"`)) { document.fonts.delete?.(face); throw new Error('Font registration check failed'); }
            const result = { family: row.family, version: row.version, coverage: new Set(Array.from(row.coverage)) };
            loaded.set(id, result); familyRoles.set(row.family, manifest.registry.fonts.find(value => value.id === id).role);
            return result.family;
          })();
          if (tasks.size >= 24) tasks.delete(tasks.keys().next().value);
          tasks.set(key, pending);
          pending.catch(() => { if (tasks.get(key) === pending) tasks.delete(key); });
        }
        return await tasks.get(key);
      } catch (error) { loaded.set(id, { error: error.message }); return undefined; }
    },
    async ensure(id) {
      if (id) return loader.ensureFont(id);
      try { await metadata(); } catch { return 0; }
      const results = await Promise.all(definitions.filter(row => row.id !== 'system').map(row => loader.ensureFont(row.id)));
      return results.filter(Boolean).length;
    },
    familyFor(id) { return id === 'system' ? undefined : loaded.get(id)?.family; },
    noticeFor(id, text = '') {
      if (id === 'system') return '系统字体 · 字形随设备变化';
      const font = definitions.find(row => row.id === id), result = loaded.get(id), name = font?.name || id;
      if (!result?.family) return `${name}未加载 · 系统字体回退${result?.error ? `（${result.error}）` : ''}`;
      const missing = [...new Set(Array.from(text).filter(character => !/\s/.test(character) && !result.coverage.has(character)))].length;
      return `${name} · 正常 TTF 已加载 · ${result.version}${missing ? ` · ${missing} 个字形使用系统回退` : ' · 当前正文已覆盖'}`;
    },
    stateFor(id, text = '') { return id === 'system' ? 'system' : !loaded.get(id)?.family ? 'fallback' : Array.from(text).some(character => !/\s/.test(character) && !loaded.get(id).coverage.has(character)) ? 'partial' : 'loaded'; },
  };
  return loader;
}
export const publicResources = createPublicResources();
export const productionFonts = createProductionFontLoader({ resources: publicResources });
