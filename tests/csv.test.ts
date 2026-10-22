import { describe, expect, it } from 'vitest';
import { guessFunction, mapCsvRows, parseCsv, toCsv } from '../shared/csv';

const FUNCS = ['Geschäftsführung', 'Clinical Affairs', 'Regulatory Affairs', 'Qualitätsmanagement', 'F&E', 'Produktion', 'Produktmanagement', 'Vertrieb/ID', 'Marketing', 'Finance', 'Legal & HR', 'Projektmanagement', 'Sonstiges'];

describe('parseCsv', () => {
  it('detects ; delimiter, handles quotes, BOM and CRLF', () => {
    const rows = parseCsv('﻿name;note\r\n"Doe; Jane";"sagt ""hi"""\r\n\r\n');
    expect(rows).toEqual([
      ['name', 'note'],
      ['Doe; Jane', 'sagt "hi"'],
    ]);
  });

  it('detects , delimiter', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('guessFunction', () => {
  it.each([
    ['GF DT', 'Geschäftsführung'],
    ['AL CA', 'Clinical Affairs'],
    ['AL RA', 'Regulatory Affairs'],
    ['AL QM', 'Qualitätsmanagement'],
    ['AL F&E', 'F&E'],
    ['AL Finance', 'Finance'],
    ['Legal & HR', 'Legal & HR'],
    ['Projektmanager', 'Projektmanagement'],
    ['Produkt Management', 'Produktmanagement'],
    ['AL ID', 'Vertrieb/ID'],
    ['Leitung Fertigung', 'Produktion'],
    ['DT', ''],
  ])('%s → %s', (role, expected) => {
    expect(guessFunction(role, FUNCS)).toBe(expected);
  });
});

describe('mapCsvRows', () => {
  it('maps the header variants and the workshop flag', () => {
    const rows = parseCsv('nr;name;kuerzel_funktion;gesellschaft;email;workshop\n1;Erika Muster;AL QM;Firma A;e@x.de;ja\n2;Max Muster;F&E;Firma B;m@x.de;nein\n3;;;;;');
    const { participants, errors } = mapCsvRows(rows, FUNCS);
    expect(errors).toEqual(['Zeile 4: kein Name, übersprungen.']);
    expect(participants).toEqual([
      { name: 'Erika Muster', email: 'e@x.de', company: 'Firma A', roleNote: 'AL QM', func: 'Qualitätsmanagement', workshop: true },
      { name: 'Max Muster', email: 'm@x.de', company: 'Firma B', roleNote: 'F&E', func: 'F&E', workshop: false },
    ]);
  });

  it('reports a missing name column', () => {
    expect(mapCsvRows([['email'], ['a@b.de']], FUNCS).errors[0]).toMatch(/name/);
  });
});

describe('toCsv', () => {
  it('escapes delimiters and quotes', () => {
    expect(toCsv([['a;b', 'c"d', 1]])).toBe('﻿"a;b";"c""d";1');
  });
});
