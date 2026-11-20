import { pushConfig, vapidConfigure } from "./config";
import { listerAbonnements, reserverNotification, supprimerAbonnements } from "./store";
import { configurerWebPush, envoyerNotification, messageRapport, type RapportPush } from "./notify";
import { rest } from "./config";

const TABLES: [string, string][] = [
  ["LF", "rapports_lf"],
  ["NISSAN", "rapports_nissan"],
  ["ST", "rapports_st"],
];

/** Fenêtre de rattrapage : un rapport plus ancien n'est plus notifié. */
const FENETRE_MINUTES = 120;

let scanEnCours = false;

export async function scannerNouveauxRapports(): Promise<{
  nouveaux: number;
  envoyes: number;
  abonnes: number;
  desactive?: string;
}> {
  if (scanEnCours) return { nouveaux: 0, envoyes: 0, abonnes: 0, desactive: "scan déjà en cours" };
  const config = pushConfig();
  if (!config) return { nouveaux: 0, envoyes: 0, abonnes: 0, desactive: "Supabase service_role absent" };
  if (!vapidConfigure()) return { nouveaux: 0, envoyes: 0, abonnes: 0, desactive: "clés VAPID absentes" };

  configurerWebPush(config);
  const abonnements = await listerAbonnements();
  if (!abonnements.length) return { nouveaux: 0, envoyes: 0, abonnes: 0, desactive: "aucun abonné" };

  scanEnCours = true;
  const depuis = new Date(Date.now() - FENETRE_MINUTES * 60 * 1000).toISOString();
  let nouveaux = 0;
  let envoyes = 0;

  try {
    for (const [secteur, table] of TABLES) {
      const requete = `${table}?select=*,rapporteurs(nom,prenom)&created_at=gte.${depuis}&order=created_at.asc&limit=100`;
      let lignes: RapportPush[];
      try {
        lignes = await rest<RapportPush[]>(config, requete);
      } catch (error) {
        console.error(`[push] lecture ${table} impossible`, error);
        continue;
      }
      if (!Array.isArray(lignes)) continue;

      for (const ligne of lignes) {
        const id = String(ligne.id ?? "");
        if (!id) continue;
        const premier = await reserverNotification(id, secteur);
        if (!premier) continue;

        nouveaux += 1;
        const message = messageRapport({ ...ligne, secteur });
        const resultat = await envoyerNotification(abonnements, message);
        envoyes += resultat.envoyes;
        if (resultat.expirees.length) await supprimerAbonnements(resultat.expirees);
      }
    }
  } finally {
    scanEnCours = false;
  }

  return { nouveaux, envoyes, abonnes: abonnements.length };
}

/** Boucle locale (serveur Express persistant). Sans effet sur Netlify. */
export function demarrerScanPeriodique(intervalMs = 60_000) {
  if (!pushConfig() || !vapidConfigure()) return () => undefined;
  const minuteur = setInterval(() => {
    scannerNouveauxRapports().catch((error) => console.error("[push] scan", error));
  }, intervalMs);
  minuteur.unref?.();
  return () => clearInterval(minuteur);
}
