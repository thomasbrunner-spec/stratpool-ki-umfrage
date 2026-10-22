import { match, usePath } from './router';
import { Landing, PasswordEntry, TokenEntry } from './participant/Entry';
import { SurveyFlow } from './participant/SurveyFlow';
import { Privacy } from './participant/Privacy';
import { AdminApp } from './admin/AdminApp';

export function App() {
  const path = usePath();
  let m: Record<string, string> | null;

  if ((m = match('/t/:token', path))) return <TokenEntry token={m.token!} />;
  if ((m = match('/u/:slug', path))) return <PasswordEntry slug={m.slug!} />;
  if (path === '/umfrage') return <SurveyFlow />;
  if (path === '/datenschutz') return <Privacy />;
  if (path === '/admin' || path.startsWith('/admin/')) return <AdminApp path={path} />;
  return <Landing />;
}
