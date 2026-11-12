export function skeletonColor(base, ink, amount) {
    const channels = (value) => /^#[\da-f]{6}$/i.test(value)
        ? [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16)) : [246, 242, 233];
    const a = channels(base), b = channels(ink);
    return `rgb(${a.map((value, index) => Math.round(value + (b[index] - value) * amount)).join(',')})`;
}
/** Placeholder measurements before a font/Canvas exists; the real layout replaces these when available. */
export const measureSkeletonText = (text, size) => Array.from(text).reduce((width, point) => width + (/\s/.test(point) ? size * .3 : /^[\x00-\x7f]$/.test(point) ? size * .55 : size), 0);
export function skeletonLayout(layout) {
    const paper = layout.template.background, ink = layout.template.muted;
    return { ...layout, template: { ...layout.template, imageFill: skeletonColor(paper, ink, .16) },
        decorations: layout.decorations.map(decoration => decoration.kind === 'rect'
            ? { ...decoration, fill: skeletonColor(decoration.fill, paper, .58), ...(decoration.stroke ? { stroke: skeletonColor(paper, ink, .2) } : {}) }
            : decoration) };
}
/** Native views consume the same image/decorative rectangles and measured text blocks as the painter. */
export function cardSkeleton(layout, measure = measureSkeletonText) {
    const shapes = [], toned = skeletonLayout(layout);
    const paper = layout.template.background, ink = layout.template.muted;
    const percent = (value, total) => `${Number((value / total * 100).toFixed(4))}%`;
    function rect(rectangle, fill, rotation = rectangle.rotation, origin = rectangle.rotationOrigin, stroke, lineWidth = 1) {
        const { x, y, width, height } = rectangle;
        if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0)
            return;
        const radius = rectangle.shape === 'circle' ? '50%' : rectangle.shape === 'arch'
            ? `50% 50% ${percent(rectangle.radius || 0, width)} ${percent(rectangle.radius || 0, width)} / 50% 50% ${percent(rectangle.radius || 0, height)} ${percent(rectangle.radius || 0, height)}`
            : rectangle.radius ? `${percent(rectangle.radius, width)} / ${percent(rectangle.radius, height)}` : '0';
        const style = [`left:${percent(x, layout.width)}`, `top:${percent(y, layout.height)}`, `width:${percent(width, layout.width)}`, `height:${percent(height, layout.height)}`, `background:${fill}`, `border-radius:${radius}`];
        if (rotation) {
            style.push(`transform:rotate(${rotation}deg)`);
            if (origin)
                style.push(`transform-origin:${percent(origin.x - x, width)} ${percent(origin.y - y, height)}`);
        }
        if (stroke)
            style.push(`box-shadow:inset 0 0 0 ${Math.max(.5, lineWidth / 3)}px ${stroke}`);
        shapes.push({ id: String(shapes.length), style: style.join(';') });
    }
    function text(block) {
        if (!block)
            return;
        const size = block.fontSize, color = skeletonColor(paper, ink, size >= 40 ? .32 : .22);
        if (block.direction === 'vertical-rl' && block.columns) {
            for (const column of block.columns)
                for (const glyph of column.glyphs) {
                    if (!glyph.text.trim())
                        continue;
                    rect({ x: glyph.x + size * .33, y: glyph.y + size * .25, width: size * .34, height: size * .76, radius: size * .17 }, color, glyph.rotation, { x: glyph.x + glyph.width / 2, y: glyph.y + glyph.height / 2 });
                }
            return;
        }
        block.lines.forEach((line, index) => {
            if (!line.trim())
                return;
            const width = Math.min(block.width, Math.max(size * .32, measure(line, size, block.fontFamily)));
            const height = Math.max(8, size * .3);
            const x = block.x + (block.align === 'center' ? (block.width - width) / 2 : block.align === 'right' ? block.width - width : 0);
            rect({ x, y: block.y + index * block.lineHeight + size * .25, width, height, radius: height / 2 }, color);
        });
    }
    function decorations(layer) {
        toned.decorations.filter(item => item.layer === layer).forEach(item => {
            if (item.kind === 'text')
                text(item.block);
            else
                rect(item.rect, item.fill, item.rotation, item.rotationOrigin, item.stroke, item.lineWidth);
        });
    }
    decorations('beforeImage');
    rect(toned.template.image, toned.template.imageFill);
    if (layout.template.id === 'light')
        rect({ x: 0, y: 0, width: layout.width, height: layout.height }, 'linear-gradient(180deg,rgba(8,22,18,.52),rgba(8,22,18,.83))');
    decorations('afterImage');
    [layout.body, layout.attribution, layout.date, layout.dateMeta, layout.brand].forEach(text);
    return { background: paper, shapes };
}
