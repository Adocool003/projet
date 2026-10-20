import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../auth.js';
import { effectivePlanId, PLANS } from '../plans.js';
import { HttpError } from '../services/util.js';
import { validate } from '../services/validate.js';

export function adminRoutes({ db, realtime }) {
  const router = Router();
  router.use(requireAdmin);

  router.get('/stats', (_req, res) => {
    const users = db.prepare('SELECT plan, plan_expires_at FROM users WHERE banned = 0').all();
    const byPlan = Object.fromEntries(Object.keys(PLANS).map((p) => [p, 0]));
    for (const u of users) byPlan[effectivePlanId(u)]++;
    const mrrCents = Object.entries(byPlan).reduce((sum, [p, n]) => sum + PLANS[p].priceCents * n, 0);
    const count = (sql) => db.prepare(sql).get().n;
    res.json({
      users: users.length,
      byPlan,
      mrrCents,
      matches: count('SELECT COUNT(*) AS n FROM matches'),
      messages: count('SELECT COUNT(*) AS n FROM messages'),
      openReports: count("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'"),
      signups7d: count("SELECT COUNT(*) AS n FROM users WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-7 days')"),
    });
  });

  router.get('/reports', (req, res) => {
    const status = req.query.status === 'closed' ? 'closed' : 'open';
    const rows = db.prepare(`
      SELECT r.*, ru.name AS reported_name, ru.email AS reported_email, ru.banned AS reported_banned,
             rp.name AS reporter_name,
             (SELECT COUNT(*) FROM reports x WHERE x.reported_id = r.reported_id) AS total_reports
      FROM reports r
      LEFT JOIN users ru ON ru.id = r.reported_id
      LEFT JOIN users rp ON rp.id = r.reporter_id
      WHERE r.status = ? ORDER BY r.id DESC LIMIT 200
    `).all(status);
    res.json({
      reports: rows.map((r) => ({
        id: r.id, reason: r.reason, details: r.details, status: r.status, createdAt: r.created_at,
        reported: { id: r.reported_id, name: r.reported_name, email: r.reported_email, banned: Boolean(r.reported_banned), totalReports: r.total_reports },
        reporter: r.reporter_id ? { id: r.reporter_id, name: r.reporter_name } : null,
      })),
    });
  });

  router.post('/reports/:id/close', (req, res) => {
    const info = db.prepare("UPDATE reports SET status = 'closed' WHERE id = ?").run(Number(req.params.id));
    if (!info.changes) throw new HttpError(404, 'not_found');
    res.json({ ok: true });
  });

  router.post('/users/:id/ban', (req, res) => {
    const { banned } = validate(z.object({ banned: z.boolean() }), req.body);
    const id = Number(req.params.id);
    if (id === req.user.id) throw new HttpError(400, 'invalid_target');
    const info = db.prepare('UPDATE users SET banned = ? WHERE id = ?').run(banned ? 1 : 0, id);
    if (!info.changes) throw new HttpError(404, 'not_found');
    if (banned) {
      db.prepare("UPDATE reports SET status = 'closed' WHERE reported_id = ?").run(id);
      realtime.disconnectUser(id);
    }
    res.json({ ok: true });
  });

  return router;
}
