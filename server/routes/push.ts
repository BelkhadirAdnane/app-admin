import { RequestHandler } from "express";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { pushConfig, vapidConfigure } from "../push/config";
import { enregistrerAbonnement, listerAbonnements, supprimerAbonnement } from "../push/store";
import { configurerWebPush, envoyerNotification } from "../push/notify";
import { scannerNouveauxRapports } from "../push/scan";

const abonnementSchema = z.object({
  endpoint: z.string().url().max(2000).startsWith("https://"),
  keys: z.object({
    p256dh: z.string().min(20).max(500),
    auth: z.string().min(8).max(200),
  }),
});

export const handlePushStatus: RequestHandler = async (_request, response) => {
  const abonnes = await listerAbonnements().catch(() => []);
  response.status(200).json({
    configured: vapidConfigure(),
    publicKey: process.env.VAPID_PUBLIC_KEY ?? null,
    storage: pushConfig() ? "supabase" : "memoire",
    abonnes: abonnes.length,
    scanSecret: Boolean(process.env.PUSH_SCAN_SECRET),
  });
};

export const handlePushSubscribe: RequestHandler = async (request, response) => {
  const resultat = abonnementSchema.safeParse(request.body);
  if (!resultat.success) {
    response.status(400).json({ error: "Abonnement push invalide." });
    return;
  }
  try {
    await enregistrerAbonnement({
      endpoint: resultat.data.endpoint,
      p256dh: resultat.data.keys.p256dh,
      auth: resultat.data.keys.auth,
      user_agent: request.get("user-agent") ?? null,
    });
    response.status(201).json({ ok: true });
  } catch (error) {
    console.error("[push] abonnement", error);
    response.status(503).json({ error: "L'abonnement n'a pas pu être enregistré." });
  }
};

export const handlePushUnsubscribe: RequestHandler = async (request, response) => {
  const endpoint = typeof request.body?.endpoint === "string" ? request.body.endpoint : "";
  if (!endpoint) {
    response.status(400).json({ error: "Endpoint manquant." });
    return;
  }
  try {
    await supprimerAbonnement(endpoint);
    response.status(204).end();
  } catch (error) {
    console.error("[push] désabonnement", error);
    response.status(503).json({ error: "Le désabonnement a échoué." });
  }
};

export const handlePushTest: RequestHandler = async (_request, response) => {
  if (!vapidConfigure()) {
    response.status(503).json({ error: "Clés VAPID non configurées sur le serveur." });
    return;
  }
  const config = pushConfig();
  configurerWebPush({
    url: config?.url ?? "",
    serviceKey: config?.serviceKey ?? "",
    subject: process.env.PUSH_VAPID_SUBJECT || "mailto:supervision@hsely.ma",
    publicKey: process.env.VAPID_PUBLIC_KEY ?? "",
    privateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  });
  const abonnements = await listerAbonnements();
  if (!abonnements.length) {
    response.status(409).json({ error: "Aucun appareil abonné aux notifications." });
    return;
  }
  const resultat = await envoyerNotification(abonnements, {
    title: "Supervision · HSELY",
    body: "Les notifications sont actives sur cet appareil.",
    tag: "test-supervision",
    url: "/admin/reports",
    icon: "/icon-192.png",
  });
  response.status(200).json({ envoyes: resultat.envoyes, abonnes: abonnements.length });
};

function secretValide(recu: string | undefined, attendu: string | undefined) {
  if (!recu || !attendu || recu.length !== attendu.length) return false;
  return timingSafeEqual(Buffer.from(recu), Buffer.from(attendu));
}

/** Déclenché par un planificateur externe (cron). Protégé par PUSH_SCAN_SECRET. */
export const handlePushScan: RequestHandler = async (request, response) => {
  if (!secretValide(request.get("x-push-secret") ?? undefined, process.env.PUSH_SCAN_SECRET)) {
    response.status(401).json({ error: "Secret de scan invalide." });
    return;
  }
  try {
    const resultat = await scannerNouveauxRapports();
    response.status(200).json(resultat);
  } catch (error) {
    console.error("[push] scan", error);
    response.status(500).json({ error: "Le scan des rapports a échoué." });
  }
};
