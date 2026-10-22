import type { ClusterSummary, StoredSummary, SynthesisSummary } from '../../shared/ai-types';

// Quotes are always shown without names (decision Thomas, 2026-10-22).
export function ClusterView({ s, maxThemes, compact }: { s: ClusterSummary; maxThemes?: number; compact?: boolean }) {
  if (!s.themes.length) return <p className="empty">Keine Freitext-Antworten.</p>;
  const themes = s.themes.slice(0, maxThemes ?? s.themes.length);
  return (
    <div style={{ display: 'grid', gap: 8, gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(260px, 1fr))' }}>
      {themes.map((t, i) => (
        <div className="cluster" key={i}>
          <div className="h">
            <span className="cnt">{t.count}</span>
            <span className="t">{t.title}</span>
            {t.novel && <span className="novel">neu</span>}
          </div>
          {!compact && <p>{t.description}</p>}
          {t.quotes.slice(0, compact ? 1 : 2).map((q, k) => (
            <q key={k}>{q.text}</q>
          ))}
        </div>
      ))}
    </div>
  );
}

export function SynthesisView({ s }: { s: SynthesisSummary }) {
  return (
    <div className="stack">
      <p className="head" style={{ fontSize: 22, color: 'var(--orange)', lineHeight: 1.3 }}>
        {s.headline}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div className="small muted" style={{ letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
            Befunde
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {s.findings.map((f, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                <b>{f.title}:</b> <span style={{ color: 'var(--ink-2)' }}>{f.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="small muted" style={{ letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
            Implikationen für heute
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {s.implications.map((f, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                <b className="orange">{f.title}:</b> <span style={{ color: 'var(--ink-2)' }}>{f.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function SummaryView({ stored, compact, maxThemes }: { stored: StoredSummary | undefined; compact?: boolean; maxThemes?: number }) {
  if (!stored) return <p className="empty">Noch keine KI-Zusammenfassung erstellt.</p>;
  return stored.content.mode === 'clusters' ? (
    <ClusterView s={stored.content} compact={compact} maxThemes={maxThemes} />
  ) : (
    <SynthesisView s={stored.content} />
  );
}
