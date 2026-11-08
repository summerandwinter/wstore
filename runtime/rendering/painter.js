function rotateAt(context, rotation, origin) {
    context.translate(origin.x, origin.y);
    context.rotate(rotation * Math.PI / 180);
    context.translate(-origin.x, -origin.y);
}
function imagePath(context, rect) {
    const { x, y, width, height } = rect;
    const r = Math.min(rect.radius || 0, width / 2, height / 2);
    context.beginPath();
    if (rect.shape === 'circle') {
        const radius = Math.min(width, height) / 2;
        const cx = x + width / 2, cy = y + height / 2, k = radius * 0.5522847498307936;
        context.moveTo(cx + radius, cy);
        context.bezierCurveTo(cx + radius, cy + k, cx + k, cy + radius, cx, cy + radius);
        context.bezierCurveTo(cx - k, cy + radius, cx - radius, cy + k, cx - radius, cy);
        context.bezierCurveTo(cx - radius, cy - k, cx - k, cy - radius, cx, cy - radius);
        context.bezierCurveTo(cx + k, cy - radius, cx + radius, cy - k, cx + radius, cy);
        context.closePath();
        return;
    }
    if (rect.shape === 'arch') {
        const rx = width / 2;
        const ry = height / 2;
        const k = 0.5522847498307936;
        context.moveTo(x, y + height - r);
        context.lineTo(x, y + ry);
        context.bezierCurveTo(x, y + ry * (1 - k), x + rx * (1 - k), y, x + rx, y);
        context.bezierCurveTo(x + rx * (1 + k), y, x + width, y + ry * (1 - k), x + width, y + ry);
    }
    else {
        context.moveTo(x + r, y);
        context.lineTo(x + width - r, y);
        context.quadraticCurveTo(x + width, y, x + width, y + r);
    }
    context.lineTo(x + width, y + height - r);
    context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    context.lineTo(x + r, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - r);
    if (rect.shape !== 'arch') {
        context.lineTo(x, y + r);
        context.quadraticCurveTo(x, y, x + r, y);
    }
    context.closePath();
}
function paintImage(context, layout, image) {
    const rect = layout.template.image;
    const clipped = rect.shape === 'arch' || rect.shape === 'circle' || Boolean(rect.radius);
    const transformed = Boolean(rect.rotation);
    if (clipped || transformed)
        context.save();
    try {
        if (transformed)
            rotateAt(context, rect.rotation, rect.rotationOrigin || { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
        if (clipped) {
            imagePath(context, rect);
            context.clip();
        }
        const fallback = () => {
            context.fillStyle = layout.template.imageFill;
            context.fillRect(rect.x, rect.y, rect.width, rect.height);
        };
        fallback();
        if (!image || !Number.isFinite(image.width) || !Number.isFinite(image.height) || image.width <= 0 || image.height <= 0)
            return false;
        try {
            const scale = Math.max(rect.width / image.width, rect.height / image.height);
            const sourceWidth = rect.width / scale;
            const sourceHeight = rect.height / scale;
            const position = rect.objectPosition || { x: 0.5, y: 0.5 };
            context.drawImage(image, (image.width - sourceWidth) * position.x, (image.height - sourceHeight) * position.y, sourceWidth, sourceHeight, rect.x, rect.y, rect.width, rect.height);
            return true;
        }
        catch {
            // 部分解码错误只在 drawImage 时抛出；恢复相同裁切/旋转范围，不留下失败图片。
            fallback();
            return false;
        }
    }
    finally {
        if (clipped || transformed)
            context.restore();
    }
}
function paintGlyph(context, glyph) {
    if (glyph.rotation) {
        context.save();
        try {
            rotateAt(context, glyph.rotation, { x: glyph.x + glyph.width / 2, y: glyph.y + glyph.height / 2 });
            context.fillText(glyph.text, glyph.x, glyph.y);
        }
        finally {
            context.restore();
        }
    }
    else
        context.fillText(glyph.text, glyph.x, glyph.y);
}
function paintText(context, block) {
    if (!block)
        return;
    context.font = `${block.fontSize}px ${block.fontFamily}`;
    context.fillStyle = block.color;
    context.textAlign = block.align;
    context.textBaseline = 'top';
    if (block.direction === 'vertical-rl' && block.columns) {
        context.textAlign = 'left';
        block.columns.forEach(column => column.glyphs.forEach(glyph => paintGlyph(context, glyph)));
        return;
    }
    const x = block.align === 'right' ? block.x + block.width : block.align === 'center' ? block.x + block.width / 2 : block.x;
    block.lines.forEach((line, index) => context.fillText(line, x, block.y + index * block.lineHeight));
}
function paintDecoration(context, decoration) {
    if (decoration.kind === 'text')
        return paintText(context, decoration.block);
    const { rect } = decoration;
    const shaped = rect.shape === 'circle' || Boolean(rect.radius);
    if (decoration.rotation || shaped)
        context.save();
    try {
        if (decoration.rotation)
            rotateAt(context, decoration.rotation, decoration.rotationOrigin || center(rect));
        if (shaped) {
            imagePath(context, rect);
            context.clip();
        }
        context.fillStyle = decoration.fill;
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
        if (decoration.stroke) {
            context.strokeStyle = decoration.stroke;
            context.lineWidth = decoration.lineWidth || 1;
            context.strokeRect(rect.x, rect.y, rect.width, rect.height);
        }
    }
    finally {
        if (decoration.rotation || shaped)
            context.restore();
    }
}
function center(rect) {
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}
/** 唯一绘制实现；图片失败仍返回完整可读、同形状的卡片。尺寸由适配器固定为 layout 的物理像素。 */
export function paintCardLayout(context, layout, image) {
    context.fillStyle = layout.template.background;
    context.fillRect(0, 0, layout.width, layout.height);
    layout.decorations.filter(decoration => decoration.layer === 'beforeImage').forEach(decoration => paintDecoration(context, decoration));
    const imageDrawn = paintImage(context, layout, image);
    if (layout.template.id === 'light') {
        context.fillStyle = 'rgba(8, 22, 18, 0.38)';
        context.fillRect(0, 0, layout.width, layout.height);
        const overlay = context.createLinearGradient(0, 240, 0, layout.height);
        overlay.addColorStop(0, 'rgba(8, 22, 18, 0.30)');
        overlay.addColorStop(0.6, 'rgba(8, 22, 18, 0.72)');
        overlay.addColorStop(1, 'rgba(8, 22, 18, 0.88)');
        context.fillStyle = overlay;
        context.fillRect(0, 0, layout.width, layout.height);
    }
    layout.decorations.filter(decoration => decoration.layer === 'afterImage').forEach(decoration => paintDecoration(context, decoration));
    paintText(context, layout.body);
    paintText(context, layout.attribution);
    paintText(context, layout.date);
    paintText(context, layout.dateMeta);
    paintText(context, layout.brand);
    return { imageDrawn };
}
