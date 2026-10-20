import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, formatDate, formatPrice } from '../api.js';
import { useI18n } from '../i18n/index.jsx';
import { useApp } from '../state.jsx';
import { Spinner } from '../components/ui.jsx';

export default function Admin() {
  const { t, lang } = useI18n();
  const { user, handleError } = useApp();
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState(null);

  const load = useCallback(() => {
    api.get('/admin/stats').then(setStats).catch(handleError);
    api.get('/admin/reports').then((r) => setReports(r.reports)).catch(handleError);
  }, [handleError]);
  useEffect(() => { if (user.role === 'admin') load(); }, [load, user.role]);

  if (user.role !== 'admin') return <Navigate to="/decouvrir" replace />;
  if (!stats || !reports) return <div className="page"><Spinner /></div>;

  const act = async (fn) => {
    try {
      await fn();
      load();
    } catch (err) {
      handleError(err);
    }
  };

  const tiles = [
    [t('admin.users'), stats.users],
    [t('admin.mrr'), formatPrice(stats.mrrCents, lang)],
    [t('admin.signups'), stats.signups7d],
    [t('admin.matches'), stats.matches],
    [t('admin.messages'), stats.messages],
    [t('admin.reports'), stats.openReports],
  ];
  const total = Object.values(stats.byPlan).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="page admin-page">
      <h1>{t('admin.title')}</h1>
      <div className="stat-grid">
        {tiles.map(([label, value]) => (
          <div key={label} className="stat"><span>{label}</span><strong>{value}</strong></div>
        ))}
      </div>

      <section className="card">
        <h2>{t('admin.byPlan')}</h2>
        {Object.entries(stats.byPlan).map(([plan, n]) => (
          <div key={plan} className="bar-row">
            <span>{t(`plans.${plan}`)}</span>
            <div className="bar"><i className={`plan-bg-${plan}`} style={{ width: `${(n / total) * 100}%` }} /></div>
            <b>{n}</b>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>{t('admin.reports')}</h2>
        {reports.length === 0 && <p className="muted">{t('admin.noReports')}</p>}
        <ul className="reports">
          {reports.map((r) => (
            <li key={r.id} className="report">
              <div>
                <strong>{r.reported.name ?? '—'}</strong> <span className="muted small">{r.reported.email}</span>
                <p><span className="chip">{t(`report.reasons.${r.reason}`)}</span> {r.reporter && <span className="muted small">{t('admin.by', { name: r.reporter.name })}</span>}</p>
                {r.details && <p className="report-details">{r.details}</p>}
                <p className="muted small">{formatDate(r.createdAt, lang, { dateStyle: 'medium', timeStyle: 'short' })} · {t('admin.totalReports', { n: r.reported.totalReports })}</p>
              </div>
              <div className="report-actions">
                <button type="button" className="btn btn-small btn-danger" onClick={() => act(() => api.post(`/admin/users/${r.reported.id}/ban`, { banned: !r.reported.banned }))}>
                  {r.reported.banned ? t('admin.unban') : t('admin.ban')}
                </button>
                <button type="button" className="btn btn-small btn-ghost" onClick={() => act(() => api.post(`/admin/reports/${r.id}/close`))}>{t('admin.close')}</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
