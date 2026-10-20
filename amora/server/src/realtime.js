import { Server } from 'socket.io';
import { parse as parseCookie } from 'cookie';
import { config } from './config.js';
import { COOKIE_NAME, verifyToken } from './auth.js';

const room = (userId) => `user:${userId}`;

/** Émetteur sans effet, utilisé quand aucun serveur Socket.IO n'est attaché (tests). */
export function nullRealtime() {
  return { emit() {}, disconnectUser() {} };
}

/**
 * Temps réel : chaque membre connecté rejoint la salle `user:<id>`. Les
 * messages sont envoyés via l'API REST puis poussés ici ; le socket ne sert
 * en entrée qu'à l'indicateur « en train d'écrire ».
 */
export function attachRealtime(httpServer, db) {
  const io = new Server(httpServer, {
    cors: config.isProd ? undefined : { origin: config.clientUrl, credentials: true },
  });

  io.use((socket, next) => {
    const cookies = parseCookie(socket.handshake.headers.cookie || '');
    const userId = verifyToken(cookies[COOKIE_NAME]);
    const user = userId && db.prepare('SELECT id, banned FROM users WHERE id = ?').get(userId);
    if (!user || user.banned) return next(new Error('unauthenticated'));
    socket.data.userId = user.id;
    next();
  });

  const matchOf = db.prepare('SELECT * FROM matches WHERE id = ? AND (user_a = ? OR user_b = ?)');

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    socket.join(room(userId));

    socket.on('typing', (payload) => {
      const match = matchOf.get(Number(payload?.matchId), userId, userId);
      if (!match) return;
      const other = match.user_a === userId ? match.user_b : match.user_a;
      io.to(room(other)).emit('typing', { matchId: match.id, typing: Boolean(payload.typing) });
    });
  });

  return {
    io,
    emit(userId, event, payload) {
      io.to(room(userId)).emit(event, payload);
    },
    disconnectUser(userId) {
      io.in(room(userId)).disconnectSockets(true);
    },
  };
}
