import type { Reponse } from "./dashboard/build-dashboard";

/**
 * Notation unique d'un contrôle — partagée par le dashboard Excel et les
 * notifications push. Toute évolution doit rester alignée avec
 * `supabase/functions/generate-excel-dashboard/dashboard.ts` (copie déployée).
 *
 *   BON = 1 point · MANQUE = 0,5 · NON CONFORME = 0 · N/A exclu
 *   100 % => CONFORME · >= 50 % => À RÉCUPÉRER · < 50 % => NON CONFORME
 */
export const POINTS: Record<Reponse, number | null> = {
  BON: 1,
  MANQUE: 0.5,
  "NON CONFORME": 0,
  "N/A": null,
};

export type StatutControle = "CONFORME" | "A_RECUPERER" | "NON_CONFORME";

export const LIBELLE_STATUT_CONTROLE: Record<StatutControle, string> = {
  CONFORME: "Conforme",
  A_RECUPERER: "À récupérer",
  NON_CONFORME: "Non conforme",
};

export interface NoteControle {
  points: number;
  maximum: number;
  taux: number;
  statut: StatutControle;
  nonConformes: number;
  manques: number;
}

export function noterReponses(reponses: Record<string, Reponse | string | null | undefined>): NoteControle {
  let points = 0;
  let maximum = 0;
  let nonConformes = 0;
  let manques = 0;
  for (const reponse of Object.values(reponses)) {
    const valeur = POINTS[reponse as Reponse];
    if (reponse === "N/A" || valeur === null || valeur === undefined) continue;
    maximum += 1;
    points += valeur;
    if (reponse === "NON CONFORME") nonConformes += 1;
    if (reponse === "MANQUE") manques += 1;
  }
  const taux = maximum ? points / maximum : 1;
  const statut: StatutControle = taux >= 0.999 ? "CONFORME" : taux >= 0.5 ? "A_RECUPERER" : "NON_CONFORME";
  return { points: Math.round(points * 100) / 100, maximum, taux, statut, nonConformes, manques };
}
