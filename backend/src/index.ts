import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";

import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { globalLimiter } from "./middleware/rate-limit.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { databasesRouter, databaseTemplatesRouter } from "./routes/databases.js";
import { entriesRouter } from "./routes/entries.js";
import { databaseViewsRouter } from "./routes/database-views.js";
import { foldersRouter } from "./routes/folders.js";
import { filesRouter } from "./routes/files.js";
import { entryFilesRouter } from "./routes/entry-files.js";
import { searchRouter } from "./routes/search.js";
import { adminRouter } from "./routes/admin.js";
import { sharesRouter } from "./routes/shares.js";
import { publicRouter } from "./routes/public.js";
import { calendarRouter } from "./routes/calendar.js";
import { kanbanRouter } from "./routes/kanban.js";
import { notesRouter } from "./routes/notes.js";
import { publicShareLimiter } from "./middleware/rate-limit.js";

const app = express();

app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ALLOWED_ORIGINS,
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(pinoHttp({ logger }));
app.use(globalLimiter);

app.use("/api/health", healthRouter);
app.use("/api", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/databases", databasesRouter);
app.use("/api/database-templates", databaseTemplatesRouter);
app.use("/api", entriesRouter);
app.use("/api", databaseViewsRouter);
app.use("/api/folders", foldersRouter);
app.use("/api/files", filesRouter);
app.use("/api", entryFilesRouter);
app.use("/api/search", searchRouter);
app.use("/api/admin", adminRouter);
app.use("/api/folders", sharesRouter);            // /:folderId/shares + /shares CRUD
app.use("/api/public", publicShareLimiter, publicRouter);  // ohne Auth, strenger Limit
app.use("/api/calendar", calendarRouter);
app.use("/api/kanban", kanbanRouter);
app.use("/api/notes", notesRouter);

app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      cors: env.CORS_ALLOWED_ORIGINS,
      nodeEnv: env.NODE_ENV,
    },
    "[myhub-backend] listening",
  );
});
