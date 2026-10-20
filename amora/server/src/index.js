import http from 'node:http';
import { config } from './config.js';
import { openDb } from './db.js';
import { createApp } from './app.js';
import { attachRealtime } from './realtime.js';
import { purgeInactiveAccounts } from './services/retention.js';

const db = openDb();
const server = http.createServer();
const realtime = attachRealtime(server, db);
const app = createApp({ db, realtime });
server.on('request', app);

server.listen(config.port, () => {
  console.log(`${config.appName} API sur http://localhost:${config.port} (paiements : ${app.locals.payments.mode})`);
});

const DAY_MS = 24 * 3600 * 1000;
const purge = () => {
  const n = purgeInactiveAccounts(db);
  if (n) console.log(`${n} compte(s) inactif(s) supprimé(s)`);
};
purge();
setInterval(purge, DAY_MS).unref();
