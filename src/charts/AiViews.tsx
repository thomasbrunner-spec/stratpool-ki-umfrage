import type { ClusterSummary, StoredSummary, SynthesisSummary } from '../../shared/ai-types';

export function ClusterView({
  s,
  names,
  showNames,
  maxThemes,
  compact,
}: {
  s: ClusterSummary;
  names?: Record<string, string>;
  showNames?: boolean;
  maxThemes?: number;
  compact?: boolean;
}) {
  if (!s.themes.length) return <p className="empty">Keine Freitext-Antworten.</p>;
  const themes = s.themes.slice(0, maxThemes ?? s.themes.length);
  return (
    <div style={{ display: 'grid', gap: 8, gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(260px, 1fr))' }}>
      {themes.map((t, i) => (
        <div className="cluster" key={i}>
          <div className="h">
            <span className="cnt">{t.count}</span>
            <span className="t">{t.title}</span>
          </div>
          {!compact && <p>{t.description}</p>}
          {t.quotes.slice(0, compact ? 1 : 2).map((q, k) => (
            <q key={k}>
              {q.text}
              {showNames && q.pid && names?.[q.pid] ? ` – ${names[q.pid]}` : ''}
            </q>
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

export function SummaryView({
  stored,
  names,
  showNames,
  compact,
  maxThemes,
}: {
  stored: StoredSummary | undefined;
  names?: Record<string, string>;
  showNames?: boolean;
  compact?: boolean;
  maxThemes?: number;
}) {
  if (!stored) return <p className="empty">Noch keine KI-Zusammenfassung erstellt.</p>;
  return stored.content.mode === 'clusters' ? (
    <ClusterView s={stored.content} names={names} showNames={showNames} compact={compact} maxThemes={maxThemes} />
  ) : (
    <SynthesisView s={stored.content} />
  );
}
