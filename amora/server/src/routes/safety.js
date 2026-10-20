import { Router } from 'express';
import { z } from 'zod';
import { orderedPair } from '../services/matching.js';
import { HttpError } from '../services/util.js';
import { validate } from '../services/validate.js';

export const REPORT_REASONS = ['fake_profile', 'inappropriate_content', 'harassment', 'scam', 'underage', 'other'];

export function safetyRoutes({ db, realtime }) {
  const router = Router();

  function block(blockerId, blockedId) {
    db.prepare('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)').run(blockerId, blockedId);
    const [a, b] = orderedPair(blockerId, blockedId);
    const match = db.prepare('SELECT id FROM matches WHERE user_a = ? AND user_b = ?').get(a, b);
    if (match) {
      db.prepare('DELETE FROM matches WHERE id = ?').run(match.id);
      realtime.emit(blockedId, 'match:removed', { matchId: match.id });
    }
  }

  function targetFrom(body, userId) {
    const { userId: targetId } = validate(z.object({ userId: z.number().int().positive() }).passthrough(), body);
    if (targetId === userId) throw new HttpError(400, 'invalid_target');
    if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(targetId)) throw new HttpError(404, 'not_found');
    return targetId;
  }

  router.get('/blocks', (req, res) => {
    const rows = db.prepare(`
      SELECT u.id, u.name, b.created_at FROM blocks b JOIN users u ON u.id = b.blocked_id
      WHERE b.blocker_id = ? ORDER BY b.created_at DESC
    `).all(req.user.id);
    res.json({ blocks: rows.map((r) => ({ userId: r.id, name: r.name, createdAt: r.created_at })) });
  });

  router.post('/blocks', (req, res) => {
    block(req.user.id, targetFrom(req.body, req.user.id));
    res.status(201).json({ ok: true });
  });

  router.delete('/blocks/:userId', (req, res) => {
    db.prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?').run(req.user.id, Number(req.params.userId));
    res.json({ ok: true });
  });

  // Un signalement bloque aussi automatiquement le profil signalé.
  router.post('/reports', (req, res) => {
    const targetId = targetFrom(req.body, req.user.id);
    const { reason, details } = validate(z.object({
      reason: z.enum(REPORT_REASONS),
      details: z.string().trim().max(1000).default(''),
    }).passthrough(), req.body);
    db.prepare('INSERT INTO reports (reporter_id, reported_id, reason, details) VALUES (?, ?, ?, ?)')
      .run(req.user.id, targetId, reason, details);
    block(req.user.id, targetId);
    res.status(201).json({ ok: true });
  });

  return router;
}
