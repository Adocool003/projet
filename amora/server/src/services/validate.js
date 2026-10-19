import { HttpError } from './util.js';

export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(400, 'invalid_input', {
      fields: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return result.data;
}

/** Enveloppe un handler async pour transmettre les erreurs à Express 4. */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
