import { templateDefinitions } from '../../runtime/card-catalog.js';
import { layoutCard, MAX_TEXT_LENGTH, MIN_BODY_FONT_SIZE } from '../../runtime/rendering/layout.js';
import { paintCardLayout } from '../../runtime/rendering/painter.js';

// A presentation collection only: all identity, geometry and painting are production-owned.
export const designTemplates = templateDefinitions.filter(row => row.collection === 'new');
export const MAX_STUDY_TEXT_LENGTH = MAX_TEXT_LENGTH;
export const MIN_STUDY_FONT_SIZE = MIN_BODY_FONT_SIZE;

export function layoutStudy(card, options = {}, measure, loadedFamily) {
  const definition = designTemplates.find(row => row.id === options.template);
  if (!definition) throw new Error('未知的新增版式。');
  if (typeof measure !== 'function') throw new Error('缺少文字测量方法。');
  const payload = { text: String(card.text ?? ''), author: String(card.author ?? ''), source: String(card.source ?? ''), date: String(card.date ?? '') };
  const layout = layoutCard({ ...card, ...payload }, options, measure, loadedFamily);
  return { ...layout, template: { ...definition, ...layout.template }, payload,
    pressure: layout.template.promotion?.pressure || 0,
    imageVisibleArea: layout.template.image.width * layout.template.image.height - (layout.template.promotion?.imageGutterArea || 0) };
}

export function paintStudy(context, layout, image) {
  context.save();
  try { return paintCardLayout(context, layout, image); }
  finally { context.restore(); }
}
