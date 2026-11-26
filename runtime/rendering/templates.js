export const EXPORT_WIDTH = 1080;
export const EXPORT_HEIGHT = 1440;
export const FONT_FAMILIES = {
    serif: '"Songti SC", STSong, "Noto Serif CJK SC", SimSun, serif',
    sans: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
};
export const PROMOTION_PALETTE = {
    paper: '#f7f3e8', panel: '#fffdf7', ink: '#304537', muted: '#647263',
    green: '#365e46', line: '#dce2d4', tint: '#e6eddf', scene: '#dce2d4',
};
export function isPromotionId(id) {
    return ['moon', 'book', 'poster', 'ticket', 'collage', 'excerpt', 'ribbon', 'ledger', 'stamp', 'album', 'season', 'verse'].includes(id);
}
/** Font gates follow the actual credit painter, independently of the geometry collection. */
export function usesSelectedAttributionFont(id) {
    return ['moon', 'book', 'poster', 'ticket', 'collage', 'excerpt'].includes(id);
}
/** Same continuous pressure and panel breakpoint as the approved design renderer. */
export function promotionPressure(textLength, explicitRows = 1, id) {
    const span = id && !usesSelectedAttributionFont(id) ? 200 : 180;
    return Math.min(1, Math.max(0, (textLength - 40) / span, (explicitRows - 4) / 12));
}
export function getPromotionTemplate(id, textLength, explicitRows = 1, pressure = promotionPressure(textLength, explicitRows, id)) {
    const p = pressure;
    const palette = PROMOTION_PALETTE;
    const rect = (x, y, width, height) => ({ x, y, width, height });
    const base = {
        id, background: palette.paper, imageFill: palette.scene, color: palette.ink, muted: palette.muted,
        accent: palette.green, fontFamily: id === 'poster' ? FONT_FAMILIES.sans : FONT_FAMILIES.serif,
        fontSize: 64, lineHeightRatio: 1.55, anchor: 'top', textAlign: 'left', direction: 'horizontal',
        variant: p > 0 ? 'long' : 'short',
    };
    switch (id) {
        case 'ribbon':
        case 'ledger':
        case 'stamp':
        case 'album':
        case 'season':
        case 'verse':
            return getExpandedPromotionTemplate(id, pressure);
        case 'moon': {
            const diameter = Math.round(560 - 340 * p);
            const image = { ...rect((1080 - diameter) / 2, Math.round(182 - 28 * p), diameter, diameter), shape: 'circle' };
            const y = image.y + diameter + Math.round(64 - 16 * p), x = Math.round(128 - 38 * p);
            return { ...base, image, content: rect(x, y, 1080 - x * 2, 1248 - y), textAlign: 'center', anchor: 'center',
                promotion: { pressure: p, heading: rect(128, 82, 420, 40), headingText: '山水 · 月相', dateArea: rect(638, 82, 314, 40) } };
        }
        case 'book': {
            const imageWidth = Math.round(164 - 76 * p);
            const image = { ...rect(972 - imageWidth, 258, imageWidth, Math.round(276 - 120 * p)), radius: 3 };
            return { ...base, image, content: rect(108, 236, image.x - 108 - 42, 1016), fontSize: 56,
                promotion: { pressure: p, heading: rect(108, 96, 410, 56), headingText: '一页山水', headingSize: 36,
                    dateArea: rect(630, 102, 342, 40), rule: rect(108, 184, 864, 2), papers: [{ ...rect(76, 208, 4, 1052), fill: palette.line }] } };
        }
        case 'poster': {
            const bottom = textLength > 70 || explicitRows > 4;
            const panel = bottom ? { ...rect(0, Math.round(730 - 370 * p), 1080, Math.round(710 + 370 * p)), fill: palette.panel }
                : { ...rect(648, 0, 432, 1440), fill: palette.panel };
            const x = bottom ? 100 : 696, width = bottom ? 880 : 336, y = bottom ? panel.y + 112 : 392;
            return { ...base, image: rect(0, 0, 1080, 1440), content: rect(x, y, width, 1280 - y), fontSize: 60, anchor: 'center',
                promotion: { pressure: p, panel, panelMode: bottom ? 'bottom' : 'side',
                    heading: rect(x, bottom ? panel.y + 40 : 106, bottom ? 400 : width, 40), headingText: '山水画报',
                    dateArea: bottom ? rect(628, panel.y + 40, 352, 40) : rect(x, 174, width, 40),
                    dateAlign: bottom ? 'right' : 'left', footerX: x, footerWidth: width } };
        }
        case 'ticket': {
            const image = { ...rect(94, 96, 892, Math.round(484 - 316 * p)), radius: 15 };
            const y = image.y + image.height + 70;
            return { ...base, image, content: rect(132, y, 816, 1168 - y), anchor: 'center',
                promotion: { pressure: p, papers: [{ ...rect(70, 60, 940, 1320), fill: palette.panel, radius: 22 }], perforationY: 1210,
                    heading: rect(132, image.y + image.height + 22, 500, 40), headingText: '此刻，值得留存',
                    dateArea: rect(132, 1250, 420, 104), footerX: 610, footerWidth: 338, footerY: 1294 } };
        }
        case 'collage': {
            const image = rect(114, 122, Math.round(600 - 140 * p), Math.round(430 - 284 * p));
            const paperX = Math.round(226 - 98 * p), paperY = image.y + image.height + 18;
            const paper = { ...rect(paperX, paperY, 1000 - paperX, 1330 - paperY), fill: palette.panel };
            const inset = Math.round(58 - 20 * p), width = paper.width - inset * 2, y = paperY + 102;
            return { ...base, image, content: rect(paperX + inset, y, width, 1280 - y), fontSize: 66,
                promotion: { pressure: p, papers: [{ ...rect(88, 96, image.width + 64, image.height + 88), fill: palette.tint }, paper],
                    heading: rect(paperX + inset, paperY + 36, width, 40), headingText: '折光 · 一页心事',
                    dateArea: rect(720, 80, 282, 40), rule: rect(paperX + inset, paperY + 82, 64, 3) } };
        }
        case 'excerpt': {
            const height = Math.round(224 - 96 * p), width = Math.round(286 - 62 * p);
            const image = { ...rect(972 - width, 1324 - height, width, height), radius: 8 };
            return { ...base, image, content: rect(132, 328, 816, image.y - 44 - 328), fontSize: 60,
                promotion: { pressure: p, attributionAnchor: 'bottom', heading: rect(132, 88, 400, 40), headingText: '阅读 · 摘录',
                    dateArea: rect(640, 88, 308, 40), quoteArea: rect(108, 164, 240, 150), rule: rect(132, image.y + 64, 70, 3) } };
        }
    }
}
/** Approved second collection: this is its only geometry source for all hosts. */
function getExpandedPromotionTemplate(id, p) {
    const rect = (x, y, width, height, extra = {}) => ({ x, y, width, height, ...extra });
    const base = {
        id, background: '#f7f3e9', imageFill: '#d9e0d2', color: '#304638', muted: '#687363', accent: '#7e9273',
        fontFamily: id === 'album' ? FONT_FAMILIES.sans : FONT_FAMILIES.serif,
        anchor: 'center', textAlign: 'left', direction: 'horizontal', fontSize: 62, lineHeightRatio: 1.48,
        variant: p > 0 ? 'long' : 'short',
    };
    const design = { pressure: p, systemAttribution: true, heading: rect(100, 100, 530, 52),
        headingText: '', headingSize: 30, headingInk: true, labelLineHeightRatio: 1.3, dateArea: rect(666, 106, 314, 46),
        footerX: 490, footerY: 1358, footerWidth: 490, footerSize: 25 };
    const shape = (area, fill, fillToken, layer = 'afterImage', rotation) => ({ rect: area, fill, fillToken, layer, ...(rotation === undefined ? {} : { rotation }) });
    switch (id) {
        case 'ribbon': {
            const width = Math.round(230 - 68 * p), textX = Math.round(390 - 86 * p);
            return { ...base, image: rect(82, 252, width, Math.round(908 - 100 * p)), content: rect(textX, 236, 982 - textX, 1064),
                promotion: { ...design, headingText: '阅读手札', shapes: [
                        shape(rect(64, 232, width + 36, 948 - 100 * p), '#e9e1cd', 'paper', 'beforeImage'),
                        shape(rect(134, 176, 66, 158), '#8b543e', 'accent'), shape(rect(134, 316, 33, 28), '#f7f3e9', 'paper', 'afterImage', 45),
                        shape(rect(344 - 68 * p, 248, 2, 1012), '#d4d9cb', 'muted')
                    ],
                    labels: [{ text: 'BOOKMARK', area: rect(82, 1220, width, 36), size: 20, align: 'center' }] } };
        }
        case 'ledger': {
            const image = rect(176, 192, 804, Math.round(244 - 136 * p)), y = image.y + image.height + 76;
            return { ...base, background: '#fbf8ef', image, content: rect(176, y, 804, 1294 - y), anchor: 'top', fontSize: 58, lineHeightRatio: 1.52,
                promotion: { ...design, headingText: '随手记', heading: rect(176, 98, 460, 52), ruled: true,
                    shapes: [shape(rect(132, 190, 2, 1110), '#b3bcaa', 'muted', 'beforeImage')],
                    labels: [{ text: '01', area: rect(62, 196, 52, 44), size: 25 }, { text: '02', area: rect(62, y, 52, 44), size: 25 }] } };
        }
        case 'stamp': {
            const size = Math.round(272 - 120 * p), image = rect(962 - size, 114, size, size), y = Math.round(492 - 140 * p);
            const shapes = [];
            for (let top = 34, index = 0; top < 1370; top += 94, index += 1) {
                const fill = index % 2 ? '#49718a' : '#b87058';
                shapes.push(shape(rect(28, top, 16, 56), fill, 'accent', 'beforeImage'), shape(rect(1036, top, 16, 56), fill, 'accent', 'beforeImage'));
            }
            shapes.push(shape(rect(image.x - 14, image.y - 14, size + 28, size + 28), '#fffef8', 'paper', 'beforeImage'));
            for (let offset = 0; offset < size; offset += 30)
                for (const yEdge of [image.y - 14, image.y + size + 4]) {
                    shapes.push(shape(rect(image.x + offset, yEdge, 12, 10), '#f7f3e9', 'paper'));
                }
            for (let offset = 0; offset < size; offset += 30)
                for (const xEdge of [image.x - 14, image.x + size + 4]) {
                    shapes.push(shape(rect(xEdge, image.y + offset, 10, 12), '#f7f3e9', 'paper'));
                }
            shapes.push(shape(rect(120, 314, 232, 2), '#b87058', 'accent'), shape(rect(120, 328, 170, 2), '#cbbba3', 'muted'));
            return { ...base, image, content: rect(120, y, 840, 1290 - y), promotion: { ...design, headingText: '寄给未来的自己',
                    heading: rect(120, 118, 520, 64), dateArea: rect(120, 234, 390, 44), dateAlign: 'left', footerY: 1350, footerWidth: 470, shapes } };
        }
        case 'album': {
            const image = rect(84, 198, 912, Math.round(522 - 382 * p)), y = image.y + image.height + Math.round(118 - 30 * p);
            return { ...base, background: '#223831', imageFill: '#41584a', color: '#f1ede1', muted: '#c4cbbb', accent: '#c5b28a',
                image, content: rect(128, y, 824, 1310 - y), fontSize: 60,
                promotion: { ...design, headingText: '生活的三个片段', heading: rect(84, 92, 566, 52), dateArea: rect(682, 102, 314, 44),
                    footerX: 510, footerWidth: 486, imageGutterArea: 24 * image.height,
                    shapes: [shape(rect(72, 186, 936, image.height + 24), '#d3c4a8', 'accent', 'beforeImage'),
                        ...[388, 696].map(x => shape(rect(x, 186, 12, image.height + 24), '#223831', 'paper'))],
                    labels: [84, 392, 700].map((x, index) => ({ text: ['I', 'II', 'III'][index], area: rect(x, image.y + image.height + 30, 296, 38), size: 22, align: 'center' })) } };
        }
        case 'season': {
            const size = Math.round(480 - 340 * p), y = Math.round(780 + 410 * p), image = rect(976 - size, y, size, size, { shape: 'circle' });
            return { ...base, background: '#f5eedf', accent: '#95693e', image, content: rect(112, 302, 864, y - 48 - 302), lineHeightRatio: 1.45,
                promotion: { ...design, headingText: '留住时间的纹理', heading: rect(610, 118, 366, 52), calendarDate: true,
                    dateArea: rect(112, 100, 390, 100), footerX: 112, footerY: 1360, footerWidth: 864,
                    shapes: [shape(rect(56, 106, 14, 1208), '#bb8a56', 'accent', 'beforeImage'),
                        shape(rect(image.x - 18, image.y - 18, size + 36, size + 36, { shape: 'circle' }), '#e4d9c4', 'paper', 'beforeImage'),
                        ...Array.from({ length: 12 }, (_, index) => shape(rect(44, 132 + index * 98, index % 3 === 0 ? 40 : 26, 2), '#bb8a56', 'accent'))] } };
        }
        case 'verse': {
            const y = Math.round(1014 + 240 * p);
            return { ...base, background: '#293b49', imageFill: '#607483', color: '#f6f0e4', muted: '#d2caba', accent: '#c8af83',
                image: rect(0, y, 1080, 1352 - y), content: rect(124, 244, 832, y - 62 - 244), textAlign: 'center', fontSize: 68, lineHeightRatio: 1.56,
                promotion: { ...design, headingText: '在字与字之间', heading: rect(124, 98, 506, 52), dateArea: rect(652, 106, 304, 44),
                    footerX: 510, footerY: 1384, footerWidth: 446, shapes: [
                        shape(rect(76, 234, 2, y - 308), '#a99575', 'accent'), shape(rect(1002, 234, 2, y - 308), '#a99575', 'accent'),
                        shape(rect(0, y - 12, 1080, 2), '#c8af83', 'accent'), shape(rect(470, 198, 140, 2), '#c8af83', 'accent')
                    ] } };
        }
    }
}
function contentFrom(y) {
    return { x: 88, y, width: 904, height: 1296 - y };
}
/** 图片面积与起始字号随正文长度调整；最终能否容纳由实际文字测量决定。 */
export function getTemplate(id, textLength) {
    const density = textLength <= 48 ? 0 : textLength <= 120 ? 1 : 2;
    switch (id) {
        case 'moon':
        case 'book':
        case 'poster':
        case 'ticket':
        case 'collage':
        case 'excerpt':
        case 'ribbon':
        case 'ledger':
        case 'stamp':
        case 'album':
        case 'season':
        case 'verse':
            return getPromotionTemplate(id, textLength);
        case 'paper': {
            const imageHeight = textLength > 160 ? 400 : textLength > 80 ? 500 : 620;
            return {
                id,
                background: '#f6f2e9',
                imageFill: '#b7c7ba',
                color: '#293c33',
                muted: '#647369',
                accent: '#84927d',
                fontFamily: FONT_FAMILIES.serif,
                fontSize: [64, 52, 44][density],
                lineHeightRatio: 1.48,
                image: { x: 64, y: 64, width: 952, height: imageHeight },
                content: contentFrom(64 + imageHeight + 56),
                anchor: 'top',
            };
        }
        case 'light':
            return {
                id,
                background: '#253e3a',
                imageFill: '#516e63',
                color: '#fffaf2',
                muted: '#e3e3d7',
                accent: '#e6cfaa',
                fontFamily: FONT_FAMILIES.sans,
                fontSize: [70, 58, 48][density],
                lineHeightRatio: 1.45,
                image: { x: 0, y: 0, width: EXPORT_WIDTH, height: EXPORT_HEIGHT },
                content: contentFrom(336),
                anchor: 'bottom',
            };
        case 'type':
            return {
                id,
                background: '#edece2',
                imageFill: '#a9b8a6',
                color: '#244238',
                muted: '#627269',
                accent: '#758b68',
                fontFamily: FONT_FAMILIES.serif,
                fontSize: [82, 64, 52][density],
                lineHeightRatio: 1.45,
                image: { x: 676, y: 1056, width: 316, height: 224 },
                content: { x: 88, y: 160, width: 904, height: 824 },
                anchor: 'top',
            };
        case 'window': {
            const long = textLength > 42;
            return {
                ...newTemplate(id, long),
                textAlign: 'center',
                fontSize: long ? 54 : 72,
                lineHeightRatio: long ? 1.65 : 1.85,
                image: long
                    ? { x: 280, y: 154, width: 520, height: 278, shape: 'arch', radius: 8 }
                    : { x: 236, y: 174, width: 608, height: 550, shape: 'arch', radius: 8 },
                content: long
                    ? { x: 97, y: 500, width: 886, height: 796 }
                    : { x: 108, y: 804, width: 864, height: 492 },
            };
        }
        case 'letter': {
            const long = textLength > 42;
            return {
                ...newTemplate(id, long),
                fontSize: long ? 56 : 80,
                lineHeightRatio: long ? 1.65 : 1.85,
                image: long
                    ? { x: 730, y: 1180, width: 253, height: 112, radius: 8 }
                    : { x: 625, y: 958, width: 367, height: 280, radius: 8 },
                content: long
                    ? { x: 97, y: 276, width: 886, height: 864 }
                    : { x: 97, y: 330, width: 886, height: 570 },
            };
        }
        case 'vertical': {
            const long = textLength > 42;
            return {
                ...newTemplate(id, long),
                direction: long ? 'horizontal' : 'vertical-rl',
                fontSize: long ? 56 : 80,
                lineHeightRatio: 1.65,
                image: long
                    ? { x: 86, y: 130, width: 908, height: 262 }
                    : { x: 76, y: 158, width: 367, height: 1100, objectPosition: { x: 0.4, y: 0.5 } },
                content: long
                    ? { x: 97, y: 462, width: 886, height: 834 }
                    : { x: 497, y: 173, width: 507, height: 907 },
            };
        }
        case 'split': {
            const long = textLength > 42;
            return {
                ...newTemplate(id, long),
                background: '#fffdf7',
                fontFamily: FONT_FAMILIES.sans,
                fontSize: long ? 52 : 68,
                lineHeightRatio: long ? 1.65 : 1.85,
                anchor: 'center',
                image: { x: 0, y: 0, width: long ? 248 : 432, height: EXPORT_HEIGHT, objectPosition: { x: 0.35, y: 0.5 } },
                content: long
                    ? { x: 335, y: 204, width: 670, height: 1080 }
                    : { x: 518, y: 266, width: 475, height: 952 },
            };
        }
        case 'horizon': {
            const long = textLength > 42;
            return {
                ...newTemplate(id, long),
                fontFamily: FONT_FAMILIES.sans,
                fontSize: long ? 56 : 76,
                lineHeightRatio: long ? 1.65 : 1.75,
                image: long
                    ? { x: 0, y: 1070, width: EXPORT_WIDTH, height: 370 }
                    : { x: 0, y: 748, width: EXPORT_WIDTH, height: 692 },
                content: long
                    ? { x: 97, y: 250, width: 886, height: 760 }
                    : { x: 97, y: 306, width: 886, height: 370 },
            };
        }
        case 'photo': {
            const long = textLength > 42;
            const frame = { x: 140, y: long ? 155 : 201, width: 800, height: long ? (textLength > 160 ? 280 : 360) : 630 };
            const contentY = frame.y + frame.height + (long ? 81 : 112);
            return {
                ...newTemplate(id, long),
                background: '#eee9df',
                fontSize: long ? 54 : 70,
                lineHeightRatio: 1.65,
                textAlign: 'center',
                image: {
                    x: frame.x + 24, y: frame.y + 24, width: frame.width - 48, height: frame.height - 96,
                    rotation: -3, rotationOrigin: { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 },
                },
                content: { x: 97, y: contentY, width: 886, height: 1296 - contentY },
            };
        }
        default:
            throw new Error('暂不支持这个卡片模板，请重新选择。');
    }
}
function newTemplate(id, long) {
    return {
        id,
        background: '#f6f2e9',
        imageFill: '#b7c7ba',
        color: '#293c33',
        muted: '#647369',
        accent: '#cbd0c0',
        fontFamily: FONT_FAMILIES.serif,
        fontSize: 64,
        lineHeightRatio: 1.65,
        anchor: 'top',
        textAlign: 'left',
        direction: 'horizontal',
        variant: long ? 'long' : 'short',
    };
}
