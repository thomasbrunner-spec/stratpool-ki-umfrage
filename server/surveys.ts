import fs from 'node:fs';
import path from 'node:path';
import type { SurveyDefinition } from '../shared/types.js';

const SURVEY_DIR = process.env.SURVEY_DIR ?? path.resolve('survey');

const surveys = new Map<string, SurveyDefinition>();

for (const file of fs.readdirSync(SURVEY_DIR).filter((f) => f.endsWith('.json'))) {
  const def = JSON.parse(fs.readFileSync(path.join(SURVEY_DIR, file), 'utf8')) as SurveyDefinition;
  if (!def.id || !Array.isArray(def.questions)) throw new Error(`Invalid survey definition: ${file}`);
  surveys.set(def.id, def);
}

export const getSurvey = (id: string): SurveyDefinition | undefined => surveys.get(id);

export const listSurveys = () =>
  [...surveys.values()].map((s) => ({ id: s.id, version: s.version, title: s.title, questions: s.questions.length }));
