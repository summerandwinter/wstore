import { EXPORT_WIDTH, EXPORT_HEIGHT } from './templates.js';
export const FIXED_CODE_PATH = '../../mini-program-code.png';
export const FIXED_CODE_SHA256 = 'fc00d33d660f77050364fb1cd3168dc3baf189f6f378839dbd67ffca42206a01';
export const CODED_CARD_WIDTH = EXPORT_WIDTH;
export const CODED_CARD_HEIGHT = EXPORT_HEIGHT + 360;
export const CODED_CARD_BASE_WIDTH = EXPORT_WIDTH;
export const CODED_CARD_BASE_HEIGHT = EXPORT_HEIGHT;
export const CODE_SIZE = 280;
export const CODED_CARD_VARIANT = `fixed-code-footer-v2-${FIXED_CODE_SHA256}`;
const SYSTEM_FONT = '"PingFang SC", "Microsoft YaHei", sans-serif';
/** Host-neutral coded-card footer. Decode, cancellation and PNG export stay host adapters. */
export function paintCardCodeFooter(context, original, code) {
    if (original.width !== CODED_CARD_BASE_WIDTH || original.height !== CODED_CARD_BASE_HEIGHT)
        throw new Error('原卡片尺寸不匹配，请重新生成。');
    if (code.width !== CODE_SIZE || code.height !== CODE_SIZE)
        throw new Error('固定小程序码尺寸不匹配，请重新编译。');
    context.fillStyle = '#FAFAF7';
    context.fillRect(0, 0, CODED_CARD_WIDTH, CODED_CARD_HEIGHT);
    context.drawImage(original, 0, 0, CODED_CARD_BASE_WIDTH, CODED_CARD_BASE_HEIGHT);
    context.fillStyle = '#E2E6DA';
    context.fillRect(0, CODED_CARD_BASE_HEIGHT, CODED_CARD_WIDTH, 1);
    // Official transparent PNG stays at its original resolution over the footer paper.
    context.drawImage(code, 760, CODED_CARD_BASE_HEIGHT + 40, CODE_SIZE, CODE_SIZE);
    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.fillStyle = '#344630';
    context.font = `52px ${SYSTEM_FONT}`;
    context.fillText('拾光撷语', 40, CODED_CARD_BASE_HEIGHT + 80);
    context.fillStyle = '#697661';
    context.font = `34px ${SYSTEM_FONT}`;
    context.fillText('微信长按识别 · 打开小程序', 40, CODED_CARD_BASE_HEIGHT + 166);
    context.font = `32px ${SYSTEM_FONT}`;
    context.fillText('每天一页，把喜欢留下。', 40, CODED_CARD_BASE_HEIGHT + 228);
}
