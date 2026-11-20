import { scannerNouveauxRapports } from "../../server/push/scan";

/**
 * Fonction planifiée Netlify : toutes les minutes, elle cherche les nouveaux
 * rapports et envoie une notification push aux appareils abonnés.
 * Aucune exposition HTTP : l'appel vient du planificateur Netlify.
 */
export default async () => {
  try {
    const resultat = await scannerNouveauxRapports();
    console.log("[push-scan]", resultat);
    return new Response(JSON.stringify(resultat), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[push-scan]", error);
    return new Response(JSON.stringify({ error: "scan failed" }), { status: 500 });
  }
};

export const config = { schedule: "* * * * *" };
