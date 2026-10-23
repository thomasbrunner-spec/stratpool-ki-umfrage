import type { SurveyResults } from '../../shared/aggregate';
import type { StoredSummary } from '../../shared/ai-types';
import type { SurveyDefinition } from '../../shared/types';

export type AccessMode = 'token' | 'password' | 'both';

export interface Project {
  id: string;
  slug: string;
  name: string;
  client: string;
  surveyId: string;
  accessMode: AccessMode;
  hasSharedPassword: boolean;
  companies: string[];
  workshopDate: string | null;
  deadline: string | null;
  closed: boolean;
  showNames: boolean;
  minGroupSize: number;
  createdAt: string;
  locked?: boolean;
}

export interface ProjectListItem extends Project {
  counts: { invited: number; started: number | null; completed: number | null };
}

export interface ParticipantView {
  id: string;
  name: string;
  email: string;
  company: string;
  func: string;
  roleNote: string;
  workshop: boolean;
  leader: boolean;
  token: string;
  selfRegistered: boolean;
  status: 'invited' | 'started' | 'completed';
  completedAt: string | null;
  lastActivity: string | null;
}

export interface ProjectDetail {
  project: Project;
  survey: SurveyDefinition;
  participants: ParticipantView[];
}

export interface SlideSetting {
  hidden: boolean;
  note: string;
  showNames: boolean | null;
}

export interface ResultsResponse {
  project: Project;
  survey: SurveyDefinition;
  results: SurveyResults;
  names: Record<string, string>;
  summaries: Record<string, StoredSummary>;
  slides: Record<string, SlideSetting>;
}

export const STATUS_LABEL: Record<ParticipantView['status'], string> = {
  invited: 'eingeladen',
  started: 'begonnen',
  completed: 'abgeschlossen',
};

export const fmtDateTime = (s: string | null) =>
  s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '–';

export const fmtDate = (s: string | null) => (s ? new Date(`${s}T12:00:00`).toLocaleDateString('de-DE') : '–');
