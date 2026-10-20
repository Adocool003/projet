// Donne (ou retire) le rôle administrateur à un membre existant.
// Usage : npm run make-admin -- adresse@email.fr [--remove]
import { openDb } from './db.js';

const email = process.argv[2];
if (!email) {
  console.error('Usage : npm run make-admin -- adresse@email.fr [--remove]');
  process.exit(1);
}
const role = process.argv.includes('--remove') ? 'user' : 'admin';
const info = openDb().prepare('UPDATE users SET role = ? WHERE email = ?').run(role, email);
if (!info.changes) {
  console.error(`Aucun compte avec l'adresse ${email}. Inscrivez-vous d'abord sur le site.`);
  process.exit(1);
}
console.log(`${email} est maintenant ${role === 'admin' ? 'administrateur' : 'membre'}.`);
