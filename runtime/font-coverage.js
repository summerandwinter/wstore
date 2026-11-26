// Match the text painted with the selected production font by the shared renderer.
import { usesSelectedAttributionFont } from './rendering/templates.js';

export function fontCoverageText(card, options = {}) {
  const text = card.text ?? '';
  if (!usesSelectedAttributionFont(options.template ?? card.template) || options.attributionSystemFallback === true) return text;
  // The renderer drops whitespace-only attribution fields before adding its separator.
  const attribution = [card.author, card.source].map(part => part?.trim() ? part : '').filter(Boolean).join(' · ');
  return text + attribution;
}
