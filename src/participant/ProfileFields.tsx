export const fmtDate = (d: string | null) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

/** Ja/Nein as a required select, so it looks like the other profile fields. */
function YesNo({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select className="input" required value={value === null ? '' : value ? 'ja' : 'nein'} onChange={(e) => onChange(e.target.value === 'ja')}>
        <option value="">Bitte wählen</option>
        <option value="ja">Ja</option>
        <option value="nein">Nein</option>
      </select>
    </label>
  );
}

export interface RoleValues {
  leader: boolean | null;
  workshop: boolean | null;
}

/** Leadership role and workshop attendance; both feed the evaluation (leadership vs. team, workshop wording). */
export function RoleFields({
  value,
  workshopDate,
  onChange,
}: {
  value: RoleValues;
  workshopDate: string | null;
  onChange: (v: RoleValues) => void;
}) {
  return (
    <>
      <YesNo
        label="Haben Sie Führungsverantwortung (z. B. Abteilungs- oder Teamleitung)?"
        value={value.leader}
        onChange={(leader) => onChange({ ...value, leader })}
      />
      <YesNo
        label={workshopDate ? `Nehmen Sie am Workshop am ${fmtDate(workshopDate)} teil?` : 'Nehmen Sie am Workshop teil?'}
        value={value.workshop}
        onChange={(workshop) => onChange({ ...value, workshop })}
      />
    </>
  );
}
