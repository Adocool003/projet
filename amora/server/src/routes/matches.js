import { Router } from 'express';
import { z } from 'zod';
import { featuresOf } from '../plans.js';
import { publicProfile } from '../services/profiles.js';
import { HttpError, nowIso } from '../services/util.js';
import { validate } from '../services/validate.js';

const PAGE = 50;

export function otherUserId(match, userId) {
  return match.user_a === userId ? match.user_b : match.user_a;
}

/** Charge un match auquel le membre participe, sinon 404. */
export function loadMatch(db, matchId, userId) {
  const match = db.prepare('SELECT * FROM matches WHERE id = ? AND (user_a = ? OR user_b = ?)').get(matchId, userId, userId);
  if (!match) throw new HttpError(404, 'not_found');
  return match;
}

/**
 * Sérialise un message pour un lecteur donné. L'accusé de lecture n'est
 * révélé qu'à l'expéditeur, et seulement si sa formule l'inclut.
 */
export function serializeMessage(msg, viewer) {
  const mine = msg.sender_id === viewer.id;
  return {
    id: msg.id,
    matchId: msg.match_id,
    senderId: msg.sender_id,
    body: msg.body,
    createdAt: msg.created_at,
    readAt: mine && featuresOf(viewer).readReceipts ? msg.read_at : undefined,
  };
}

export function matchSummary(db, match, viewer) {
  const other = db.prepare('SELECT * FROM users WHERE id = ?').get(otherUserId(match, viewer.id));
  const last = db.prepare('SELECT * FROM messages WHERE match_id = ? ORDER BY id DESC LIMIT 1').get(match.id);
  const unread = db.prepare('SELECT COUNT(*) AS n FROM messages WHERE match_id = ? AND sender_id != ? AND read_at IS NULL')
    .get(match.id, viewer.id).n;
  return {
    id: match.id,
    createdAt: match.created_at,
    user: other ? publicProfile(db, other, viewer) : null,
    lastMessage: last ? serializeMessage(last, viewer) : null,
    unread,
  };
}

export function matchesRoutes({ db, realtime }) {
  const router = Router();

  router.get('/', (req, res) => {
    const rows = db.prepare(`
      SELECT m.*, COALESCE((SELECT MAX(id) FROM messages WHERE match_id = m.id), 0) AS last_id
      FROM matches m WHERE m.user_a = ? OR m.user_b = ?
      ORDER BY last_id DESC, m.id DESC
    `).all(req.user.id, req.user.id);
    res.json({ matches: rows.map((m) => matchSummary(db, m, req.user)) });
  });

  router.get('/:id', (req, res) => {
    const match = loadMatch(db, Number(req.params.id), req.user.id);
    res.json({ match: matchSummary(db, match, req.user) });
  });

  // Rompre le match : la conversation disparaît pour les deux membres.
  router.delete('/:id', (req, res) => {
    const match = loadMatch(db, Number(req.params.id), req.user.id);
    db.prepare('DELETE FROM matches WHERE id = ?').run(match.id);
    realtime.emit(otherUserId(match, req.user.id), 'match:removed', { matchId: match.id });
    res.json({ ok: true });
  });

  router.get('/:id/messages', (req, res) => {
    const match = loadMatch(db, Number(req.params.id), req.user.id);
    const before = Number(req.query.before) || Number.MAX_SAFE_INTEGER;
    const rows = db.prepare('SELECT * FROM messages WHERE match_id = ? AND id < ? ORDER BY id DESC LIMIT ?')
      .all(match.id, before, PAGE);
    res.json({ messages: rows.reverse().map((m) => serializeMessage(m, req.user)), hasMore: rows.length === PAGE });
  });

  router.post('/:id/messages', (req, res) => {
    const match = loadMatch(db, Number(req.params.id), req.user.id);
    const { body } = validate(z.object({ body: z.string().trim().min(1).max(2000) }), req.body);
    const info = db.prepare('INSERT INTO messages (match_id, sender_id, body) VALUES (?, ?, ?)').run(match.id, req.user.id, body);
    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(Number(info.lastInsertRowid));
    const otherId = otherUserId(match, req.user.id);
    const other = db.prepare('SELECT * FROM users WHERE id = ?').get(otherId);
    if (other) realtime.emit(otherId, 'message:new', serializeMessage(msg, other));
    res.status(201).json({ message: serializeMessage(msg, req.user) });
  });

  router.post('/:id/read', (req, res) => {
    const match = loadMatch(db, Number(req.params.id), req.user.id);
    const readAt = nowIso();
    const info = db.prepare('UPDATE messages SET read_at = ? WHERE match_id = ? AND sender_id != ? AND read_at IS NULL')
      .run(readAt, match.id, req.user.id);
    if (info.changes > 0) {
      const otherId = otherUserId(match, req.user.id);
      const other = db.prepare('SELECT * FROM users WHERE id = ?').get(otherId);
      if (other && featuresOf(other).readReceipts) {
        realtime.emit(otherId, 'message:read', { matchId: match.id, readAt });
      }
    }
    res.json({ ok: true });
  });

  return router;
}
