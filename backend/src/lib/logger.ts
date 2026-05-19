import { pino, type LoggerOptions } from "pino";
import { env } from "../config/env.js";

// PII-Scrubbing: niemals Auth-Tokens, Cookies oder Passwort-Felder loggen.
// Greift sowohl im raw-logger als auch in pino-http (siehe index.ts).
const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'req.body.password',
  'req.body.access_token',
  'req.body.refresh_token',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
];

const base: LoggerOptions = {
  level: env.LOG_LEVEL,
  redact: { paths: redactPaths, censor: "[Redacted]" },
};

function buildTransport() {
  // Development: lesbar pretty-print auf stdout
  if (env.NODE_ENV === "development") {
    return {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
      },
    };
  }

  // Production mit LOG_FILE_PATH: parallel auf stdout + rotierende Datei.
  // pino-roll erstellt täglich neue Files und behält 14 Tage.
  if (env.LOG_FILE_PATH) {
    return {
      targets: [
        { target: "pino/file", options: { destination: 1 }, level: env.LOG_LEVEL },
        {
          target: "pino-roll",
          options: {
            file: env.LOG_FILE_PATH,
            frequency: "daily",
            mkdir: true,
            limit: { count: 14 },
          },
          level: env.LOG_LEVEL,
        },
      ],
    };
  }

  // Production ohne Datei: nur stdout (Docker fängt es im Container-Log).
  return undefined;
}

const transport = buildTransport();

export const logger = transport ? pino({ ...base, transport }) : pino(base);
