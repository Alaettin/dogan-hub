export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errors = {
  badRequest: (message: string, details?: unknown) =>
    new AppError(400, "bad_request", message, details),
  unauthorized: (message = "Unauthorized") => new AppError(401, "unauthorized", message),
  forbidden: (message = "Forbidden") => new AppError(403, "forbidden", message),
  notFound: (message = "Not found") => new AppError(404, "not_found", message),
  conflict: (message: string) => new AppError(409, "conflict", message),
  rateLimited: (message = "Too many requests") =>
    new AppError(429, "rate_limited", message),
  internal: (message = "Internal server error") =>
    new AppError(500, "internal_error", message),
};
