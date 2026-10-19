import { removePhotoFile } from '../routes/profile.js';

const INACTIVITY_YEARS = 2;

/**
 * Durée de conservation (RGPD, art. 5-1-e) : suppression des comptes inactifs
 * depuis plus de deux ans, comme le recommande la CNIL pour les sites de rencontre.
 */
export function purgeInactiveAccounts(db, now = new Date()) {
  const limit = new Date(now);
  limit.setUTCFullYear(limit.getUTCFullYear() - INACTIVITY_YEARS);
  const users = db.prepare("SELECT id FROM users WHERE last_active < ? AND role != 'admin'").all(limit.toISOString());
  for (const { id } of users) {
    const photos = db.prepare('SELECT filename FROM photos WHERE user_id = ?').all(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    photos.forEach((p) => removePhotoFile(p.filename));
  }
  return users.length;
}
