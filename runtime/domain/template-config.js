import { TEMPLATE_IDS } from '../card-catalog.js';
import { sha256Hex } from '../services/resource-digest.js';
const FIELDS = ['paper', 'ink', 'muted', 'accent', 'fontScale', 'lineHeightScale'];
const validated = new WeakSet();
function invalid() { throw new Error('模板视觉配置无效，请刷新后重试。'); }
function record(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
        return invalid();
    if (Reflect.ownKeys(value).some(key => typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key) || !Object.prototype.hasOwnProperty.call(Object.getOwnPropertyDescriptor(value, key), 'value')))
        return invalid();
    return value;
}
function normalizedTemplates(value) {
    const input = record(value), result = {};
    if (Object.keys(input).length > TEMPLATE_IDS.length)
        return invalid();
    for (const id of Object.keys(input).sort()) {
        if (!TEMPLATE_IDS.includes(id))
            return invalid();
        const row = record(input[id]);
        if (Object.keys(row).some(key => !FIELDS.includes(key)))
            return invalid();
        const tokens = {};
        for (const field of FIELDS) {
            if (!Object.prototype.hasOwnProperty.call(row, field))
                continue;
            const v = row[field];
            if (field === 'fontScale' || field === 'lineHeightScale') {
                const min = field === 'fontScale' ? .8 : .85, max = field === 'fontScale' ? 1.2 : 1.15;
                if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || Math.round(v * 1000) / 1000 !== v)
                    return invalid();
                if (v !== 1)
                    tokens[field] = v;
            }
            else {
                if (typeof v !== 'string' || !/^#[a-f0-9]{6}$/i.test(v))
                    return invalid();
                tokens[field] = v.toLowerCase();
            }
        }
        if (Object.keys(tokens).length)
            result[id] = Object.freeze(tokens);
    }
    return Object.freeze(result);
}
function configHash(templates) {
    // The canonical alphabet is ASCII (catalog IDs, hex colors and finite numbers).
    const text = JSON.stringify({ schemaVersion: 1, templates });
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++)
        bytes[i] = text.charCodeAt(i);
    return sha256Hex(bytes.buffer);
}
export function buildTemplateVisualConfig(templates) {
    const normalized = normalizedTemplates(templates);
    const result = Object.freeze({ schemaVersion: 1, revision: configHash(normalized), templates: normalized });
    validated.add(result);
    return result;
}
export function validateTemplateVisualConfig(value) {
    if (value && typeof value === 'object' && validated.has(value))
        return value;
    const row = record(value);
    if (Object.keys(row).sort().join(',') !== 'revision,schemaVersion,templates' || row.schemaVersion !== 1 || typeof row.revision !== 'string' || !/^[a-f0-9]{64}$/.test(row.revision))
        return invalid();
    const result = buildTemplateVisualConfig(row.templates);
    if (result.revision !== row.revision)
        return invalid();
    return result;
}
export function applyTemplateVisual(template, config) {
    if (config === undefined)
        return template;
    const tokens = validateTemplateVisualConfig(config).templates[template.id];
    if (!tokens)
        return template;
    const next = { ...template,
        background: tokens.paper ?? template.background,
        color: tokens.ink ?? template.color,
        muted: tokens.muted ?? template.muted,
        accent: tokens.accent ?? template.accent,
        fontSize: Math.round(template.fontSize * (tokens.fontScale ?? 1)),
        lineHeightRatio: template.lineHeightRatio * (tokens.lineHeightScale ?? 1),
    };
    if (template.promotion) {
        next.promotion = { ...template.promotion,
            ...(template.promotion.panel ? { panel: { ...template.promotion.panel, fill: tokens.paper ?? template.promotion.panel.fill } } : {}),
            ...(template.promotion.papers ? { papers: template.promotion.papers.map(paper => ({ ...paper, fill: tokens.paper ?? paper.fill })) } : {}),
        };
    }
    return next;
}
