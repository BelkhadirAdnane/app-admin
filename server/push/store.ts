import { pushConfig, rest, type PushConfig } from "./config";

export interface AbonnementPush {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string | null;
}

/** Repli mémoire : développement local sans Supabase service_role. */
const memoire = new Map<string, AbonnementPush>();
const envoyes = new Set<string>();

const CHAMPS = "endpoint,p256dh,auth,user_agent";

export async function listerAbonnements(): Promise<AbonnementPush[]> {
  const config = pushConfig();
  if (!config) return [...memoire.values()];
  try {
    const lignes = await rest<AbonnementPush[]>(config, `push_subscriptions?select=${CHAMPS}`);
    return Array.isArray(lignes) ? lignes : [];
  } catch (error) {
    console.error("[push] lecture abonnements impossible", error);
    return [...memoire.values()];
  }
}

export async function enregistrerAbonnement(abonnement: AbonnementPush): Promise<void> {
  memoire.set(abonnement.endpoint, abonnement);
  const config = pushConfig();
  if (!config) return;
  await rest(config, "push_subscriptions?on_conflict=endpoint", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: JSON.stringify({
      endpoint: abonnement.endpoint,
      p256dh: abonnement.p256dh,
      auth: abonnement.auth,
      user_agent: abonnement.user_agent ?? null,
      created_at: new Date().toISOString(),
    }),
  });
}

export async function supprimerAbonnement(endpoint: string): Promise<void> {
  memoire.delete(endpoint);
  const config = pushConfig();
  if (!config) return;
  await rest(config, `push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
    method: "DELETE",
    prefer: "return=minimal",
  });
}

export async function supprimerAbonnements(endpoints: string[]): Promise<void> {
  for (const endpoint of endpoints) await supprimerAbonnement(endpoint).catch(() => undefined);
}

/**
 * Réserve l'envoi d'une notification pour un rapport.
 * `true` = premier passage (à envoyer), `false` = déjà notifié.
 * Idempotent même si le scan tourne plusieurs fois ou en parallèle.
 */
export async function reserverNotification(rapportId: string, secteur: string): Promise<boolean> {
  const config = pushConfig();
  if (!config) {
    if (envoyes.has(rapportId)) return false;
    envoyes.add(rapportId);
    return true;
  }
  try {
    const lignes = await rest<{ rapport_id: string }[]>(
      config,
      "push_notifications_log?on_conflict=rapport_id&select=rapport_id",
      {
        method: "POST",
        prefer: "resolution=ignore-duplicates,return=representation",
        body: JSON.stringify([{ rapport_id: rapportId, secteur }]),
      },
    );
    return Array.isArray(lignes) && lignes.length > 0;
  } catch (error) {
    // Le journal est indisponible : mieux vaut notifier deux fois que pas du tout.
    console.error("[push] journal de notification indisponible", error);
    return true;
  }
}

export type { PushConfig };
