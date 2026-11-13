import type { ClusterSummary, StoredSummary, SynthesisSummary, TermsSummary } from '../../shared/ai-types';

// Quotes are always shown without names (decision Thomas, 2026-10-22).
/**
 * compact: narrow column (one quote, no description).
 * slide: full-width presentation grid – at most 6 cards in 3 columns, one quote, no "neu" badge
 * (the offer hypotheses are internal), further themes as one line underneath.
 */
export function ClusterView({ s, maxThemes, compact, slide }: { s: ClusterSummary; maxThemes?: number; compact?: boolean; slide?: boolean }) {
  if (!s.themes.length) return <p className="empty">Keine Freitext-Antworten.</p>;
  const limit = slide ? Math.min(maxThemes ?? 6, 6) : (maxThemes ?? s.themes.length);
  const themes = s.themes.slice(0, limit);
  const rest = s.themes.slice(limit);
  const quotes = compact || slide ? 1 : 2;
  return (
    <div className={slide ? 'clusters-slide' : undefined}>
      <div
        className="clusters-grid"
        style={{
          display: 'grid',
          gap: slide ? 12 : 8,
          gridTemplateColumns: compact ? '1fr' : slide ? `repeat(${themes.length <= 4 ? 2 : 3}, 1fr)` : 'repeat(auto-fit, minmax(260px, 1fr))',
        }}
      >
        {themes.map((t, i) => (
          <div className="cluster" key={i}>
            <div className="h">
              <span className="cnt">{t.count}</span>
              <span className="t">{t.title}</span>
              {t.novel && !slide && <span className="novel" title="Thema liegt außerhalb der Ausgangshypothesen aus dem Angebot">neu</span>}
            </div>
            {!compact && <p className={slide ? 'clamp' : undefined}>{t.description}</p>}
            {t.quotes.slice(0, quotes).map((q, k) => (
              <q key={k} className={slide ? 'clamp' : undefined}>
                {q.text}
              </q>
            ))}
          </div>
        ))}
      </div>
      {rest.length > 0 && (
        <p className="small muted" style={{ margin: '10px 0 0' }}>
          Außerdem genannt: {rest.map((t) => `${t.title} (${t.count})`).join(' · ')}
        </p>
      )}
    </div>
  );
}

function Items({ items, accent }: { items: { title: string; text: string }[]; accent?: boolean }) {
  return (
    <div className="synth-grid">
      {items.map((f, i) => (
        <div className="synth-card" key={i}>
          <div className={`synth-t${accent ? ' orange' : ''}`}>{f.title}</div>
          <div className="synth-x">{f.text}</div>
        </div>
      ))}
    </div>
  );
}

/** part: only findings (with headline) or only implications (with open questions) – one presentation slide each. */
export function SynthesisView({ s, part }: { s: SynthesisSummary; part?: 'findings' | 'implications' }) {
  if (part === 'findings') {
    return (
      <div className="stack synth">
        <p className="synth-head">{s.headline}</p>
        <Items items={s.findings} />
      </div>
    );
  }
  if (part === 'implications') {
    return (
      <div className="stack synth">
        <Items items={s.implications} accent />
        {s.openQuestions.length > 0 && (
          <div>
            <div className="synth-label">Im Workshop klären</div>
            <div className="synth-q">
              {s.openQuestions.map((q, i) => (
                <span key={i}>{q}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="stack">
      <p className="head" style={{ fontSize: 22, color: 'var(--orange)', lineHeight: 1.3 }}>
        {s.headline}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div className="synth-label">Befunde</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {s.findings.map((f, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                <b>{f.title}:</b> <span style={{ color: 'var(--ink-2)' }}>{f.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="synth-label">Implikationen für heute</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {s.implications.map((f, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                <b className="orange">{f.title}:</b> <span style={{ color: 'var(--ink-2)' }}>{f.text}</span>
              </li>
            ))}
          </ul>
          {s.openQuestions.length > 0 && (
            <>
              <div className="synth-label" style={{ marginTop: 12 }}>
                Offene Fragen
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {s.openQuestions.map((q, i) => (
                  <li key={i} style={{ marginBottom: 6, color: 'var(--ink-2)' }}>
                    {q}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function TermsView({ s }: { s: TermsSummary }) {
  if (!s.terms.length) return <p className="empty">Keine Antworten.</p>;
  return (
    <div className="terms">
      {s.terms.map((t) => (
        <span key={t.text}>
          {t.text} <b>{t.count}</b>
        </span>
      ))}
    </div>
  );
}

export function SummaryView({
  stored,
  compact,
  maxThemes,
  slide,
  part,
}: {
  stored: StoredSummary | undefined;
  compact?: boolean;
  maxThemes?: number;
  slide?: boolean;
  part?: 'findings' | 'implications';
}) {
  if (!stored) return <p className="empty">Noch keine KI-Zusammenfassung erstellt.</p>;
  const c = stored.content;
  if (c.mode === 'clusters') return <ClusterView s={c} compact={compact} maxThemes={maxThemes} slide={slide} />;
  if (c.mode === 'terms') return <TermsView s={c} />;
  return <SynthesisView s={c} part={part} />;
}
