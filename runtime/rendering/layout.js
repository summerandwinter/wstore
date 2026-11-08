import { EXPORT_HEIGHT, EXPORT_WIDTH, FONT_FAMILIES, getTemplate, getPromotionTemplate, isPromotionId, promotionPressure, PROMOTION_PALETTE } from './templates.js';
export const MAX_TEXT_LENGTH = 240;
export const MAX_ATTRIBUTION_LENGTH = 90;
export const MIN_BODY_FONT_SIZE = 36;
const NO_LINE_START = new Set(Array.from('，。！？；：、,.!?;:%％‰）)]｝}》〉」』】〕］”’…'));
const NO_LINE_END = new Set(Array.from('（([｛{《〈「『【〔［“‘'));
const VERTICAL_ROTATED = new Set(Array.from('（）()［］[]｛｝{}〈〉《》「」『』【】〔〕“”‘’—–…'));
const normalizeNewlines = (text) => text.replace(/\r\n?/g, '\n');
const legacyTemplate = (template) => ['paper', 'light', 'type'].includes(template.id);
const fitError = () => new Error('正文或出处的换行过多，当前模板放不下；请减少文字或换行后重试。');
class TextDoesNotFit extends Error {
}
/** 只在码点之间断行，不裁字；显式换行（包括空行）优先于标点避头尾规则。 */
export function wrapText(text, maxWidth, measure) {
    if (!Number.isFinite(maxWidth) || maxWidth <= 0) {
        throw new Error('文字区域宽度无效，请重新生成。');
    }
    const lines = [];
    for (const paragraph of normalizeNewlines(text).split('\n')) {
        const points = Array.from(paragraph);
        if (points.length === 0)
            lines.push('');
        let start = 0;
        while (start < points.length) {
            let end = start;
            while (end < points.length) {
                const width = measure(points.slice(start, end + 1).join(''));
                if (!Number.isFinite(width) || width < 0) {
                    throw new Error('文字宽度测量失败，请重新生成。');
                }
                if (width > maxWidth)
                    break;
                end += 1;
            }
            if (end === start)
                throw new TextDoesNotFit('当前宽度无法容纳文字，请调整排版。');
            // 往前寻找合法断点；窄到无法遵守时保留完整文字，绝不让标点溢出边界。
            if (end < points.length) {
                let candidate = end;
                while (candidate > start &&
                    (NO_LINE_START.has(points[candidate]) || NO_LINE_END.has(points[candidate - 1]))) {
                    candidate -= 1;
                }
                if (candidate > start)
                    end = candidate;
            }
            lines.push(points.slice(start, end).join(''));
            start = end;
        }
    }
    return lines;
}
function textBlock(value, rect, fontSize, lineHeight, fontFamily, color, align, measure) {
    const lines = wrapText(value, rect.width, part => measure(part, fontSize, fontFamily));
    if (lines.length * lineHeight > rect.height)
        throw fitError();
    return { ...rect, height: lines.length * lineHeight, lines, fontSize, fontFamily, lineHeight, color, align, direction: 'horizontal' };
}
function footerBlocks(card, options, template, measure) {
    if (template.promotion) {
        const design = template.promotion;
        const label = (value, rect, size = 28, ratio = 1.35, align = 'right', family = FONT_FAMILIES.sans, color = template.muted) => textBlock(value, rect, size, Math.ceil(size * ratio), family, color, align, measure);
        let date, dateMeta;
        if (options.showDate && card.date) {
            const match = template.id === 'ticket' && /^(\d{4})[-/.](\d{2})[-/.](\d{2})$/.exec(card.date);
            if (match) {
                date = label(match[3], { x: 132, y: 1244, width: 126, height: 108 }, 72, 1.35, 'left', FONT_FAMILIES.serif, template.accent);
                dateMeta = label(`${match[1]} / ${match[2]}`, { x: 292, y: 1264, width: 260, height: 40 }, 28, 1.35, 'left');
            }
            else
                date = label(normalizeNewlines(card.date), design.dateArea, 28, 1.35, design.dateAlign || 'right');
        }
        const brand = options.showBrand ? label('拾光撷语 · DAYLIGHT', {
            x: design.footerX ?? 128, y: design.footerY ?? 1350, width: design.footerWidth ?? 824, height: 42,
        }, 26) : undefined;
        return { date, ...(dateMeta ? { dateMeta } : {}), brand };
    }
    function footer(value, x, width, align) {
        const lines = wrapText(value, width, part => measure(part, 24, FONT_FAMILIES.sans));
        if (lines.length > 1)
            throw new Error('页脚文字过长，请使用简短日期后重试。');
        return {
            x, y: 1352, width, height: 32, lines, align,
            fontSize: 24, fontFamily: FONT_FAMILIES.sans, lineHeight: 32, color: template.muted,
            direction: 'horizontal',
        };
    }
    const date = options.showDate && card.date ? footer(card.date, 88, 360, 'left') : undefined;
    const brand = options.showBrand ? footer('拾光撷语 · DAYLIGHT', 482, 510, 'right') : undefined;
    if (template.id === 'split') {
        const x = template.content.x;
        if (date)
            Object.assign(date, { x, y: 1320, width: EXPORT_WIDTH - x - 60 });
        if (brand)
            Object.assign(brand, { x, y: 1370, width: EXPORT_WIDTH - x - 60, align: 'left' });
    }
    if (template.id === 'horizon') {
        if (brand)
            Object.assign(brand, { x: 124, y: 1340, width: 430, align: 'left' });
        if (date) {
            const match = /^(\d{4})[-/.](\d{2})[-/.](\d{2})$/.exec(card.date);
            Object.assign(date, match
                ? { x: 849, y: 112, width: 134, height: 100, lines: [match[3]], fontSize: 84, lineHeight: 100, fontFamily: FONT_FAMILIES.serif, align: 'center' }
                : { x: 623, y: 148, width: 360, align: 'right' });
        }
    }
    return { date, brand };
}
function retainParagraphs(block, text, measure) {
    const lines = [], breaks = [];
    for (const [index, paragraph] of text.split('\n').entries()) {
        if (index)
            breaks[breaks.length - 1] = '\n';
        for (const line of wrapText(paragraph, block.width, value => measure(value, block.fontSize, block.fontFamily))) {
            lines.push(line);
            breaks.push('');
        }
    }
    return { ...block, text, lines, breaks };
}
function horizontalLayout(text, attributionText, template, loadedFamily, measure, footer, attributionSystemFallback = false) {
    const { content } = template;
    const fontFamily = loadedFamily ? `"${loadedFamily}", ${template.fontFamily}` : template.fontFamily;
    const attributionSize = 28;
    const attributionLineHeight = template.promotion ? Math.ceil(attributionSize * 1.45) : 40;
    const attributionFamily = template.promotion && !attributionSystemFallback ? fontFamily : FONT_FAMILIES.sans;
    const attributionLines = attributionText
        ? wrapText(attributionText, content.width, value => measure(value, attributionSize, attributionFamily))
        : [];
    const attributionHeight = attributionLines.length * attributionLineHeight;
    const gap = attributionLines.length ? 32 : 0;
    for (let fontSize = template.fontSize; fontSize >= MIN_BODY_FONT_SIZE; fontSize -= 2) {
        let lines;
        try {
            lines = wrapText(text, content.width, value => measure(value, fontSize, fontFamily));
        }
        catch (error) {
            if (error instanceof TextDoesNotFit)
                continue;
            throw error;
        }
        const lineHeight = Math.ceil(fontSize * template.lineHeightRatio);
        const bodyHeight = lines.length * lineHeight;
        const totalHeight = bodyHeight + gap + attributionHeight;
        if (totalHeight > content.height)
            continue;
        const y = template.anchor === 'bottom' ? content.y + content.height - totalHeight
            : template.anchor === 'center' ? content.y + (content.height - totalHeight) / 2 : content.y;
        const align = template.textAlign || 'left';
        const layout = {
            width: EXPORT_WIDTH,
            height: EXPORT_HEIGHT,
            template,
            body: {
                x: content.x, y, width: content.width, height: bodyHeight, lines,
                fontSize, fontFamily, lineHeight, color: template.color, align, direction: 'horizontal',
            },
            attribution: attributionLines.length ? {
                x: content.x, y: template.promotion?.attributionAnchor === 'bottom'
                    ? content.y + content.height - attributionHeight : y + bodyHeight + gap,
                width: content.width, height: attributionHeight,
                lines: attributionLines, fontSize: attributionSize, fontFamily: attributionFamily,
                lineHeight: attributionLineHeight, color: template.muted, align, direction: 'horizontal',
            } : undefined,
            ...footer,
            decorations: [],
        };
        if (template.promotion) {
            layout.body = retainParagraphs(layout.body, text, measure);
            if (layout.attribution)
                layout.attribution = retainParagraphs(layout.attribution, attributionText, measure);
        }
        return layout;
    }
    return undefined;
}
/** 不依赖 Intl.Segmenter（旧基础库缺失）；竖排保持组合音标、变体选择符和 emoji ZWJ 序列为一个字形。 */
function verticalUnits(text) {
    const units = [];
    let regionalCount = 0;
    for (const point of Array.from(text)) {
        const code = point.codePointAt(0);
        const previous = units[units.length - 1];
        const combining = /\p{Mark}/u.test(point) || (code >= 0xfe00 && code <= 0xfe0f) ||
            (code >= 0xe0100 && code <= 0xe01ef) || (code >= 0x1f3fb && code <= 0x1f3ff);
        const regional = code >= 0x1f1e6 && code <= 0x1f1ff;
        if (previous && (combining || point === '\u200d' || previous.endsWith('\u200d') || (regional && regionalCount % 2 === 1))) {
            units[units.length - 1] += point;
        }
        else
            units.push(point);
        regionalCount = regional ? regionalCount + 1 : 0;
    }
    return units;
}
function verticalBlock(text, rect, fontSize, fontFamily, color, measure) {
    if (rect.width <= 0)
        return undefined;
    const lineHeight = Math.ceil(fontSize * 1.14);
    const capacity = Math.floor(rect.height / lineHeight);
    if (capacity < 1)
        return undefined;
    const unitColumns = [];
    for (const paragraph of text.split('\n')) {
        const units = verticalUnits(paragraph);
        if (!units.length)
            unitColumns.push([]);
        for (let start = 0; start < units.length;) {
            let end = Math.min(start + capacity, units.length);
            if (end < units.length) {
                let candidate = end;
                while (candidate > start && (NO_LINE_START.has(units[candidate]) || NO_LINE_END.has(units[candidate - 1])))
                    candidate -= 1;
                if (candidate > start)
                    end = candidate;
            }
            unitColumns.push(units.slice(start, end));
            start = end;
        }
    }
    const measured = unitColumns.map(units => units.map(unit => {
        const width = measure(unit, fontSize, fontFamily);
        if (!Number.isFinite(width) || width < 0)
            throw new Error('文字宽度测量失败，请重新生成。');
        return width;
    }));
    const columnWidth = Math.max(fontSize, ...measured.flat());
    const advance = Math.ceil(columnWidth * 1.65);
    const width = (unitColumns.length - 1) * advance + columnWidth;
    if (width > rect.width)
        return undefined;
    const x = rect.x + rect.width - width;
    const columns = unitColumns.map((units, index) => {
        const columnX = rect.x + rect.width - columnWidth - index * advance;
        const glyphs = units.map((unit, glyphIndex) => {
            const glyphWidth = measured[index][glyphIndex];
            const punctuation = '，。、；：！？,.!?;:'.includes(unit);
            const dx = (columnWidth - glyphWidth) / 2;
            return {
                text: unit,
                x: columnX + (punctuation ? Math.min(columnWidth - glyphWidth, dx + fontSize * 0.18) : dx),
                y: rect.y + glyphIndex * lineHeight + (punctuation ? 0 : (lineHeight - fontSize) / 2),
                width: glyphWidth,
                height: fontSize,
                ...(VERTICAL_ROTATED.has(unit) ? { rotation: 90 } : {}),
            };
        });
        return { x: columnX, y: rect.y, width: columnWidth, height: Math.max(1, units.length) * lineHeight, glyphs };
    });
    return {
        x, y: rect.y, width, height: Math.max(...columns.map(column => column.height)),
        lines: unitColumns.map(units => units.join('')), fontSize, fontFamily, lineHeight, color,
        align: 'left', direction: 'vertical-rl', columns,
    };
}
function verticalLayout(text, attributionText, template, loadedFamily, measure, footer) {
    const fontFamily = loadedFamily ? `"${loadedFamily}", ${template.fontFamily}` : template.fontFamily;
    for (let size = template.fontSize; size >= MIN_BODY_FONT_SIZE; size -= 2) {
        const body = verticalBlock(text, template.content, size, fontFamily, template.color, measure);
        if (!body)
            continue;
        const creditRect = {
            ...template.content, width: body.x - template.content.x - 28,
            height: Math.floor(template.content.height * 0.85),
        };
        const attribution = attributionText
            ? verticalBlock(attributionText, creditRect, 28, FONT_FAMILIES.sans, template.muted, measure) : undefined;
        if (attributionText && !attribution)
            continue;
        return { width: EXPORT_WIDTH, height: EXPORT_HEIGHT, template, body, attribution, ...footer, decorations: [] };
    }
    return undefined;
}
function decorate(layout, card, options, measure) {
    const { template, body, attribution } = layout;
    const decorations = layout.decorations;
    const rectangle = (rect, fill = template.accent, extra = {}) => {
        decorations.push({ kind: 'rect', rect, fill, layer: 'afterImage', ...extra });
    };
    const label = (value, rect, size = 24, lineHeight = 32, align = 'left', color = template.muted, family = FONT_FAMILIES.sans) => {
        decorations.push({ kind: 'text', layer: 'afterImage', block: textBlock(value, rect, size, lineHeight, family, color, align, measure) });
    };
    if (template.promotion) {
        const design = template.promotion;
        for (const paper of design.papers || [])
            rectangle(paper, paper.fill, { layer: 'beforeImage' });
        if (design.panel)
            rectangle(design.panel, design.panel.fill);
        if (design.rule)
            rectangle(design.rule);
        if (design.perforationY) {
            const y = design.perforationY;
            for (let x = 94; x < 986; x += 17)
                rectangle({ x, y, width: Math.min(6, 986 - x), height: 2 }, template.muted);
            for (const x of [70, 1010])
                rectangle({ x: x - 18, y: y - 18, width: 36, height: 36, shape: 'circle' }, PROMOTION_PALETTE.paper);
        }
        const headingSize = design.headingSize || 28;
        label(design.headingText, design.heading, headingSize, Math.ceil(headingSize * 1.35));
        if (design.quoteArea)
            label('“', design.quoteArea, 128, Math.ceil(128 * 1.1), 'left', template.accent, FONT_FAMILIES.serif);
        return layout;
    }
    if (legacyTemplate(template)) {
        if (template.id !== 'light')
            rectangle({ x: body.x, y: body.y - 24, width: 48, height: 3 });
        return layout;
    }
    switch (template.id) {
        case 'window':
            label('山水之间', { x: 108, y: 92, width: 330, height: 32 });
            if (options.showDate && card.date)
                label(card.date, { x: 612, y: 92, width: 360, height: 32 }, 24, 32, 'right');
            break;
        case 'letter':
            label('给今天', { x: 97, y: 112, width: 400, height: 62 }, 46, 62, 'left', template.color, FONT_FAMILIES.serif);
            if (options.showDate && card.date)
                label(card.date, { x: 623, y: 124, width: 360, height: 32 }, 24, 32, 'right');
            rectangle({ x: 97, y: 194, width: 886, height: 2 });
            rectangle({ x: 97, y: 1315, width: 886, height: 2 });
            break;
        case 'vertical':
            if (layout.fallback) {
                label(layout.fallback.message, { x: 97, y: 72, width: 886, height: 32 });
            }
            else {
                rectangle({ x: 897, y: 1204, width: 66, height: 66 }, 'rgba(0, 0, 0, 0)', { stroke: '#a7614e', lineWidth: 2 });
                label('拾', { x: 897, y: 1217, width: 66, height: 46 }, 38, 46, 'center', '#a7614e', FONT_FAMILIES.serif);
            }
            break;
        case 'split':
            rectangle({ x: template.image.width, y: 0, width: 2, height: EXPORT_HEIGHT });
            label('此刻 · 有光', { x: template.content.x, y: body.y - 72, width: template.content.width, height: 32 });
            if (attribution)
                rectangle({ x: attribution.x, y: attribution.y - 18, width: attribution.width, height: 2 });
            break;
        case 'horizon': {
            label('今日晴野', { x: 97, y: 147, width: 400, height: 32 });
            const match = options.showDate && /^(\d{4})[-/.](\d{2})[-/.](\d{2})$/.exec(card.date);
            if (match) {
                const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                const month = months[Number(match[2]) - 1] || match[2];
                rectangle({ x: 805, y: 126, width: 2, height: 110 });
                label(`${month} · ${match[1]}`, { x: 827, y: 214, width: 178, height: 32 }, 22, 32, 'center');
            }
            if (layout.brand)
                rectangle({ x: 97, y: 1322, width: 484, height: 68 }, '#fffdf7');
            break;
        }
        case 'photo': {
            const image = template.image;
            const frame = { x: image.x - 24, y: image.y - 24, width: image.width + 48, height: image.height + 96 };
            const rotation = image.rotation;
            const rotationOrigin = image.rotationOrigin;
            rectangle({ ...frame, x: frame.x + 7, y: frame.y + 12 }, '#dcd7cd', { layer: 'beforeImage', rotation, rotationOrigin });
            rectangle(frame, '#fffdf7', { layer: 'beforeImage', rotation, rotationOrigin });
            rectangle({ x: 404, y: frame.y - 16, width: 272, height: 42 }, 'rgba(246, 242, 233, 0.88)', { rotation: 4 });
            if (options.showDate && card.date)
                label(card.date.replace(/-/g, ' / '), { x: 97, y: 90, width: 800, height: 32 });
            break;
        }
    }
    return layout;
}
/** 无平台、字体环境依赖；测量、字形定位、图片形状和装饰同时供原生预览与两端绘图使用。 */
export function layoutCard(card, options, measure, loadedFamily) {
    const text = normalizeNewlines(card.text);
    const author = normalizeNewlines(card.author);
    const source = normalizeNewlines(card.source);
    const textLength = Array.from(text).length;
    if (!text.trim())
        throw new Error('请先填写卡片正文。');
    if (textLength > MAX_TEXT_LENGTH)
        throw new Error(`正文最多支持${MAX_TEXT_LENGTH}个字符，请精简后再生成。`);
    if (Array.from(author).length + Array.from(source).length > MAX_ATTRIBUTION_LENGTH) {
        throw new Error(`作者与出处合计最多支持${MAX_ATTRIBUTION_LENGTH}个字符，请精简后再生成。`);
    }
    if (isPromotionId(options.template)) {
        const explicitRows = text.split('\n').length;
        const initial = promotionPressure(textLength, explicitRows);
        const pressures = [...new Set([initial, Math.min(1, initial + 0.25), Math.min(1, initial + 0.5), 1])];
        const attributionText = [author, source].filter(part => part.trim()).join(' · ');
        for (const pressure of pressures) {
            const template = getPromotionTemplate(options.template, textLength, explicitRows, pressure);
            const footer = footerBlocks(card, options, template, measure);
            const layout = horizontalLayout(text, attributionText, template, loadedFamily, measure, footer, options.attributionSystemFallback);
            if (layout)
                return decorate(layout, card, options, measure);
        }
        throw fitError();
    }
    let template = getTemplate(options.template, textLength);
    let footer = footerBlocks(card, options, template, measure);
    const attributionText = [author, source].filter(part => part.trim()).join(' · ');
    let fallback;
    let layout;
    if (template.direction === 'vertical-rl') {
        layout = verticalLayout(text, attributionText, template, loadedFamily, measure, footer);
        if (!layout) {
            fallback = { from: 'vertical-rl', reason: 'insufficient-space', message: '竖排空间不足 · 已转横排' };
            template = getTemplate('vertical', 43);
        }
    }
    else if (template.id === 'vertical') {
        fallback = { from: 'vertical-rl', reason: 'long-text', message: '长句 · 已转横排' };
    }
    if (!layout)
        layout = horizontalLayout(text, attributionText, template, loadedFamily, measure, footer, options.attributionSystemFallback);
    // 新版短句遇到大量显式换行或宽字形时让出图片面积；旧三款不改变任何原有几何。
    if (!layout && template.variant === 'short' && !legacyTemplate(template)) {
        template = getTemplate(template.id, Math.max(43, textLength));
        footer = footerBlocks(card, options, template, measure);
        layout = horizontalLayout(text, attributionText, template, loadedFamily, measure, footer, options.attributionSystemFallback);
    }
    if (!layout)
        throw fitError();
    if (fallback)
        layout.fallback = fallback;
    return decorate(layout, card, options, measure);
}
