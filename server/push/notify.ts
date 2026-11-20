import { createRequire } from "node:module";

// web-push est un module CommonJS : on le charge via require pour rester
// compatible avec le bundling de la config Vite et Netlify.
const require = createRequire(import.meta.url);
const webpush = require("web-push") as typeof import("web-push");
import { noterReponses, LIBELLE_STATUT_CONTROLE } from "../notation";
import type { PushConfig } from "./config";
import type { AbonnementPush } from "./store";

const SECTEURS: Record<string, string> = {
  LF: "Ligne F",
  NISSAN: "Atelier de traitement",
  ST: "Stockage",
};

const normaliser = (valeur: unknown) => {
  const texte = String(valeur ?? "").trim().toUpperCase();
  if (texte.startsWith("NON CONF")) return "NON CONFORME";
  if (texte.startsWith("MANQUE")) return "MANQUE";
  if (texte.startsWith("N/A") || texte === "NA") return "N/A";
  if (texte.startsWith("BON")) return "BON";
  return "N/A";
};

const nombre = (valeur: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(valeur);

export interface RapportPush {
  id: string;
  secteur: string;
  unite?: string | null;
  emplacement?: string | null;
  rapporteurs?: { nom?: string; prenom?: string } | { nom?: string; prenom?: string }[] | null;
  [cle: string]: unknown;
}

export function messageRapport(rapport: RapportPush) {
  const secteur = String(rapport.secteur || "").toUpperCase();
  const libelle = SECTEURS[secteur] ?? secteur;
  const relation = Array.isArray(rapport.rapporteurs) ? rapport.rapporteurs[0] : rapport.rapporteurs;
  const rapporteur = [relation?.prenom, relation?.nom].filter(Boolean).join(" ") || "Rapporteur inconnu";

  const reponses = Object.fromEntries(
    Object.entries(rapport).filter(([cle]) =>
      ["pomme", "vanne_1", "palette", "vanne_2", "vasque", "rampe_2_sorties",
       "erogateurs", "tige_commande", "pedale", "flotteur", "ressort", "qualite_eau"].includes(cle),
    ).map(([cle, valeur]) => [cle, normaliser(valeur)]),
  );
  const note = noterReponses(reponses);

  const lieu = [libelle, rapport.unite, rapport.emplacement]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .join(" · ");

  return {
    title: `Nouveau rapport · ${secteur || "terrain"}`,
    body: `${lieu}\n${rapporteur} — ${nombre(note.points)}/${note.maximum} · ${LIBELLE_STATUT_CONTROLE[note.statut]}`,
    tag: `rapport-${rapport.id}`,
    url: "/admin/reports",
    icon: "/icon-192.png",
    score: note,
  };
}

export function configurerWebPush(config: PushConfig) {
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
}

export async function envoyerNotification(
  abonnements: AbonnementPush[],
  payload: Record<string, unknown>,
): Promise<{ envoyes: number; expirees: string[] }> {
  let envoyes = 0;
  const expirees: string[] = [];

  await Promise.all(
    abonnements.map(async (abonnement) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: abonnement.endpoint,
            keys: { p256dh: abonnement.p256dh, auth: abonnement.auth },
          },
          JSON.stringify(payload),
          { TTL: 3600, urgency: "high" },
        );
        envoyes += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          expirees.push(abonnement.endpoint);
          return;
        }
        console.error("[push] envoi impossible", status ?? (error as Error).message);
      }
    }),
  );

  return { envoyes, expirees };
}
