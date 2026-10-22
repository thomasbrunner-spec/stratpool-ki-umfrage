import { depthLevels, depthOf } from '../../shared/aggregate';
import type { AnswerMap, MaturityAnswer, SurveyDefinition } from '../../shared/types';
import { Cobweb, CobwebLegend } from '../charts/Viz';

const BLUE = '#6DA7EC';
const ORANGE = '#FD9A00';

/** Shown after submitting: the participant's own answers as a small profile (no group values). */
export function PersonalProfile({ survey, answers }: { survey: SurveyDefinition; answers: AnswerMap }) {
  const dims = survey.questions.filter((q) => q.type === 'maturity');
  const rated = dims.filter((q) => {
    const a = answers[q.id] as MaturityAnswer | undefined;
    return a && typeof a.now === 'number';
  });
  const depthQ = survey.questions.find((q) => q.type === 'multi' && q.groups?.length);
  const depth = depthQ?.type === 'multi' ? depthOf(depthQ, answers[depthQ.id]) : null;
  const depthTitle = depthQ?.type === 'multi' && depth !== null ? depthLevels(depthQ).find((l) => l.value === depth)?.title : null;

  const matrix = survey.deck.flatMap((s) => s.widgets).find((w) => w.kind === 'matrix');
  let quadrant: string | null = null;
  if (matrix?.kind === 'matrix') {
    const x = answers[matrix.x];
    const y = answers[matrix.y];
    if (typeof x === 'number' && typeof y === 'number') quadrant = matrix.quadrants[(x >= 50 ? 2 : 0) + (y >= 50 ? 1 : 0)] ?? null;
  }

  if (rated.length < 3 && !depthTitle && !quadrant) return null;
  const layers = [
    { label: 'heute', color: BLUE, values: dims.map((q) => (answers[q.id] as MaturityAnswer | undefined)?.now ?? null) },
    { label: 'Ziel in drei Jahren', color: ORANGE, values: dims.map((q) => (answers[q.id] as MaturityAnswer | undefined)?.target ?? null) },
  ];
  return (
    <section className="card profile" aria-label="Ihr persönliches KI-Profil">
      <div className="p-eyebrow">Ihr persönliches KI-Profil</div>
      <div className="profile-tags">
        {quadrant && (
          <div>
            <div className="l">Ihr Typ</div>
            <div className="v">{quadrant}</div>
          </div>
        )}
        {depthTitle && (
          <div>
            <div className="l">Ihre Nutzungstiefe</div>
            <div className="v">{depthTitle}</div>
          </div>
        )}
      </div>
      {rated.length >= 3 && (
        <>
          <p className="small muted" style={{ margin: '8px 0 0' }}>
            So schätzen Sie den Reifegrad von HumanTech ein:
          </p>
          <Cobweb labels={dims.map((q) => (q.type === 'maturity' ? q.dimension : q.short))} layers={layers} />
          <CobwebLegend layers={layers} />
        </>
      )}
      <p className="small muted">Wie Ihre Einschätzung im Vergleich zur Gruppe aussieht, zeigen wir im Workshop.</p>
    </section>
  );
}
