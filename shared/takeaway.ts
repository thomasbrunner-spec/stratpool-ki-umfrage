import { mean, widgetKey, type MatrixResult, type SelfVsDepthResult, type SurveyResults } from './aggregate.js';
import type { DeckSlide } from './types.js';

export interface Takeaway {
  /** highlighted core message */
  strong: string;
  /** supporting facts */
  text: string;
}

const r0 = (x: number) => Math.round(x).toLocaleString('de-DE');

/**
 * Data-driven "so what" line for slides that are hard to read at first glance
 * (knowledge × chance matrix, self-assessment by usage depth). Null when nothing can be said.
 */
export function slideTakeaway(slide: DeckSlide, results: SurveyResults): Takeaway | null {
  const parts: string[] = [];
  let strong = '';
  for (const w of slide.widgets) {
    if (w.kind === 'matrix') {
      const m = results.derived[widgetKey(w)] as MatrixResult | undefined;
      if (!m || m.n < 3) continue;
      const mx = mean(m.points.map((p) => p.x))!;
      const my = mean(m.points.map((p) => p.y))!;
      // facts of the matrix come first, they support the core message
      parts.unshift(`${w.yLabel} Ø ${r0(my)} von 100, ${w.xLabel} Ø ${r0(mx)} von 100.`);
      if (my - mx >= 15) strong = 'Die Erwartung ist deutlich größer als das eigene Können: Die Motivation ist da, der Hebel ist Befähigung.';
      else if (mx - my >= 15) strong = 'Das Können ist größer als die gesehene Chance: Der Nutzen muss konkret gezeigt werden.';
      else strong = 'Kenntnisse und Erwartung liegen nah beieinander.';
    }
    if (w.kind === 'self_vs_depth') {
      const d = results.derived[widgetKey(w)] as SelfVsDepthResult | undefined;
      const levels = d?.byLevel.filter((l) => l.n > 0 && l.meanSelf !== null) ?? [];
      if (levels.length < 2) continue;
      const lo = levels[0]!;
      const hi = levels[levels.length - 1]!;
      const diff = hi.meanSelf! - lo.meanSelf!;
      if (diff < 10) parts.push(`Wer KI tiefer nutzt, schätzt sich kaum besser ein (Ø ${r0(lo.meanSelf!)} bei „${lo.title}“, Ø ${r0(hi.meanSelf!)} bei „${hi.title}“).`);
      else parts.push(`Wer KI tiefer nutzt, schätzt sich auch höher ein (Ø ${r0(lo.meanSelf!)} bei „${lo.title}“, Ø ${r0(hi.meanSelf!)} bei „${hi.title}“).`);
    }
  }
  if (!strong && !parts.length) return null;
  return { strong, text: parts.join(' ') };
}
