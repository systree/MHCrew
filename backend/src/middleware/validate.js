const { ZodError } = require('zod');

/**
 * Returns an Express middleware that validates req.body against the given Zod schema.
 * Attaches the parsed (and coerced) data back to req.body on success.
 * Responds with 422 and a structured error list on failure.
 *
 * @param {import('zod').ZodTypeAny} schema - A Zod schema to validate against.
 */
function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return res.status(422).json({ error: 'Validation failed', errors });
      }
      next(err);
    }
  };
}

module.exports = validate;
