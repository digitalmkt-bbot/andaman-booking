import { ZodError } from 'zod';

export function notFound(req, res) {
  res.status(404).json({ error: 'NOT_FOUND', path: req.path });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', details: err.issues });
  }
  if (err.status) {
    return res.status(err.status).json({ error: err.code || 'ERROR', message: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
}

export function httpError(status, code, message) {
  const e = new Error(message || code);
  e.status = status;
  e.code = code;
  return e;
}
