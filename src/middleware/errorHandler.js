// Catches errors passed via next(err) and any thrown errors from async route handlers
// (when wrapped with asyncHandler) and returns a consistent JSON shape.

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(err);

  // Postgres unique_violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'A record with these details already exists.' });
  }
  // Postgres foreign_key_violation
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced record does not exist.' });
  }
  // Postgres check_violation
  if (err.code === '23514') {
    return res.status(400).json({ error: 'Invalid value for one or more fields.' });
  }

  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
}

// Wraps an async route handler so rejected promises reach errorHandler
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { errorHandler, asyncHandler };
