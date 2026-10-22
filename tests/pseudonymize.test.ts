import { describe, expect, it } from 'vitest';
import { pseudonymize } from '../shared/pseudonymize';

describe('pseudonymize', () => {
  const names = ['Ömer Beispiel', 'Anna-Lena Muster'];

  it('removes full names and single name parts, including umlauts and hyphens', () => {
    expect(pseudonymize('Wie Ömer Beispiel sagte', names)).toBe('Wie [Name] sagte');
    expect(pseudonymize('Frag mal Herrn Beispiel oder Anna', names)).toBe('Frag mal Herrn [Name] oder [Name]');
    expect(pseudonymize('Anna-Lena hat recht', names)).toBe('[Name] hat recht');
  });

  it('is case-insensitive but keeps unrelated words intact', () => {
    expect(pseudonymize('muster und Mustervorlage', names)).toBe('[Name] und Mustervorlage');
  });
});
