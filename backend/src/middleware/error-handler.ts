import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    if (err.status >= 500) {
      // Volltext (inkl. interpolierter DB-Messages) nur ins Log, nicht an
      // den Client — der bekommt eine generische Meldung.
      logger.error({ err, path: req.path }, "AppError 5xx");
      res.status(err.status).json({
        error: { code: err.code, message: "Internal server error" },
      });
      return;
    }
    logger.warn({ code: err.code, path: req.path, message: err.message }, "AppError");
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    logger.warn({ issues: err.issues, path: req.path }, "Validation error");
    res.status(400).json({
      error: {
        code: "validation_error",
        message: "Request validation failed",
        details: err.flatten(),
      },
    });
    return;
  }

  logger.error({ err, path: req.path }, "Unhandled error");
  res.status(500).json({
    error: { code: "internal_error", message: "Internal server error" },
  });
};
