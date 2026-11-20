import dotenv from "dotenv";
import express from "express";

// .env.local (secrets locaux) puis .env ; les variables déjà définies gagnent.
dotenv.config({ path: ".env.local" });
dotenv.config();
import cors from "cors";
import { handleDemo } from "./routes/demo";
import {
  handleAdminConfig,
  handleAdminExport,
  handleAdminExportFile,
  handleAdminLogin,
  handleAdminLogout,
  handleAdminReports,
  handleAdminSession,
  requireAdmin,
} from "./routes/admin";
import {
  handlePushScan,
  handlePushStatus,
  handlePushSubscribe,
  handlePushTest,
  handlePushUnsubscribe,
} from "./routes/push";
import { demarrerScanPeriodique } from "./push/scan";

export function createServer() {
  const app = express();

  // Derrière Netlify / reverse proxy : request.ip doit refléter le client.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use((_request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "same-origin");
    response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    response.setHeader("Cache-Control", "no-store");
    next();
  });

  // CORS fermé par défaut : uniquement les origines explicitement autorisées.
  const originesAutorisees = (process.env.ADMIN_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origine) => origine.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: originesAutorisees.length ? originesAutorisees : false,
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
    }),
  );

  app.use(express.json({ limit: "200kb" }));
  app.use(express.urlencoded({ extended: true, limit: "200kb" }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  app.post("/api/admin/login", handleAdminLogin);
  app.get("/api/admin/session", handleAdminSession);
  app.post("/api/admin/logout", handleAdminLogout);
  app.get("/api/admin/config", requireAdmin, handleAdminConfig);
  app.get("/api/admin/reports", requireAdmin, handleAdminReports);
  app.post("/api/admin/export", requireAdmin, handleAdminExport);
  app.get("/api/admin/export/file/:token", requireAdmin, handleAdminExportFile);

  // Notifications push (PWA) — abonnement réservé à l'administrateur connecté.
  app.get("/api/admin/push/status", requireAdmin, handlePushStatus);
  app.post("/api/admin/push/subscribe", requireAdmin, handlePushSubscribe);
  app.post("/api/admin/push/unsubscribe", requireAdmin, handlePushUnsubscribe);
  app.post("/api/admin/push/test", requireAdmin, handlePushTest);
  // Déclenchement par un cron externe (secret dédié, pas de session).
  app.post("/api/admin/push/scan", handlePushScan);

  // En local / VPS : scan chaque minute. Ignoré sur Netlify (process éphémère).
  if (!process.env.NETLIFY && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    demarrerScanPeriodique();
  }

  return app;
}
