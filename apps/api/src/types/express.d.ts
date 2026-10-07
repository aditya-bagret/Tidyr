// Request properties set by our middleware.
export {};

declare global {
  namespace Express {
    interface Request {
      /** Set by `requestId`; echoed in the `X-Request-Id` header. */
      requestId: string;
      /** Parsed output of the `validate()` schemas. Express 5's `req.query` is read-only. */
      validated: { body?: unknown; params?: unknown; query?: unknown };
      /** Set by `authenticate` on protected routes. */
      user?: { id: string; sessionId: string };
    }
  }
}
