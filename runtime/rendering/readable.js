import { layoutCard } from './layout.js';
import { measureSkeletonText } from './skeleton.js';
/** No downloadable family is allowed in the first readable view. */
export const READABLE_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
const number = (value) => Number(value.toFixed(4));
/** Native views and the public prototype consume the painter's ordered geometry, never a template map. */
export function cardReadable(layout) {
    const layers = [];
    function rectangle(id, kind, rect, fill, rotation = rect.rotation, origin = rect.rotationOrigin, stroke, lineWidth = 1) {
        const radius = rect.shape === 'circle' ? '50%' : rect.shape === 'arch'
            ? `50% 50% ${rect.radius || 0}px ${rect.radius || 0}px / 50% 50% ${rect.radius || 0}px ${rect.radius || 0}px`
            : `${rect.radius || 0}px`;
        const style = [`left:${number(rect.x)}px`, `top:${number(rect.y)}px`, `width:${number(rect.width)}px`,
            `height:${number(rect.height)}px`, `border-radius:${radius}`];
        if (fill)
            style.push(`background:${fill}`);
        if (rotation) {
            style.push(`transform:rotate(${rotation}deg)`);
            if (origin)
                style.push(`transform-origin:${number(origin.x - rect.x)}px ${number(origin.y - rect.y)}px`);
        }
        if (stroke)
            style.push(`box-shadow:inset 0 0 0 ${lineWidth}px ${stroke}`);
        const layer = { id, kind, style: style.join(';') };
        layers.push(layer);
        return layer;
    }
    function text(id, block) {
        if (!block)
            return;
        const font = `font-family:${READABLE_FONT_FAMILY};font-size:${block.fontSize}px;line-height:${block.fontSize}px;color:${block.color};font-weight:400;letter-spacing:0;white-space:pre`;
        if (block.direction === 'vertical-rl' && block.columns) {
            block.columns.forEach((column, columnIndex) => column.glyphs.forEach((glyph, glyphIndex) => {
                const layer = rectangle(`${id}-${columnIndex}-${glyphIndex}`, 'text', glyph);
                layer.text = glyph.text;
                layer.style += `;${font};text-align:left`;
            }));
        }
        else
            block.lines.forEach((line, index) => {
                const layer = rectangle(`${id}-${index}`, 'text', { x: block.x, y: block.y + index * block.lineHeight,
                    width: block.width, height: block.lineHeight });
                layer.text = line;
                layer.style += `;${font};text-align:${block.align}`;
            });
    }
    function decorations(order) {
        layout.decorations.forEach((decoration, index) => {
            if (decoration.layer !== order)
                return;
            if (decoration.kind === 'text')
                text(`decoration-${index}`, decoration.block);
            else
                rectangle(`decoration-${index}`, 'rect', decoration.rect, decoration.fill, decoration.rotation, decoration.rotationOrigin, decoration.stroke, decoration.lineWidth);
        });
    }
    decorations('beforeImage');
    const image = rectangle('image', 'image', layout.template.image, layout.template.imageFill);
    const position = layout.template.image.objectPosition || { x: .5, y: .5 };
    image.imageStyle = `object-fit:cover;object-position:${position.x * 100}% ${position.y * 100}%`;
    image.imageRect = { ...layout.template.image };
    if (layout.template.id === 'light')
        rectangle('shade', 'rect', { x: 0, y: 0, width: layout.width, height: layout.height }, 'linear-gradient(180deg,rgba(8,22,18,.57),rgba(8,22,18,.83) 67%,rgba(8,22,18,.93))');
    decorations('afterImage');
    text('body', layout.body);
    text('attribution', layout.attribution);
    text('date', layout.date);
    text('date-meta', layout.dateMeta);
    text('brand', layout.brand);
    return { width: layout.width, height: layout.height, background: layout.template.background, fontFamily: READABLE_FONT_FAMILY, layers };
}
/** Synchronous only: no Canvas, font registration, image request or render queue. */
export function readableCard(card, options) {
    return cardReadable(layoutCard(card, { ...options, fontId: 'system' }, measureSkeletonText));
}
/** Match the painter's cover crop after the already mounted native image supplies its decoded size. */
export function readableImageStyle(rect, width, height) {
    if (![width, height].every(value => Number.isFinite(value) && value > 0))
        return 'width:100%;height:100%;left:0;top:0';
    const scale = Math.max(rect.width / width, rect.height / height);
    const position = rect.objectPosition || { x: .5, y: .5 };
    return `width:${number(width * scale)}px;height:${number(height * scale)}px;left:${number((rect.width - width * scale) * position.x)}px;top:${number((rect.height - height * scale) * position.y)}px`;
}
