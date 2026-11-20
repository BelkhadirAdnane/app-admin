export const ZONES = ["LF", "NISSAN", "ST"] as const;
export type Secteur = (typeof ZONES)[number] | string;

export const CRITERES = [
  { cle: "pomme", libelle: "Pomme", court: "Pomme" },
  { cle: "vanne_1", libelle: "Vanne 1", court: "Vanne 1" },
  { cle: "palette", libelle: "Palette", court: "Palette" },
  { cle: "vanne_2", libelle: "Vanne 2", court: "Vanne 2" },
  { cle: "vasque", libelle: "Vasque", court: "Vasque" },
  { cle: "rampe_2_sorties", libelle: "Rampe 2 sorties", court: "Rampe 2 s." },
  { cle: "erogateurs", libelle: "Érogateurs", court: "Érogateurs" },
  { cle: "tige_commande", libelle: "Tige de commande", court: "Tige cmd" },
  { cle: "pedale", libelle: "Pédale", court: "Pédale" },
  { cle: "flotteur", libelle: "Flotteur", court: "Flotteur" },
  { cle: "ressort", libelle: "Ressort", court: "Ressort" },
  { cle: "qualite_eau", libelle: "Qualité d'eau", court: "Qualité eau" },
] as const;

export type CleCritere = (typeof CRITERES)[number]["cle"];
export type Reponse = "BON" | "MANQUE" | "NON CONFORME" | "N/A";

export interface Report {
  id: string;
  sector: Secteur;
  unite: string;
  emplacement: string;
  created_at: string;
  remarques?: string | null;
  rapporteur?: string | null;
  rapporteurs?: { nom?: string; prenom?: string } | { nom?: string; prenom?: string }[] | null;
  photos_urls?: string[] | null;
  photos?: unknown;
  [cle: string]: unknown;
}

export interface ExpectedLocation {
  secteur: Secteur;
  unite: string;
  emplacement: string;
}

export interface ReportResponse {
  reports: Report[];
  expectedLocations: ExpectedLocation[] | null;
  source?: string;
  generatedAt?: string;
  error?: string;
}

export const normaliser = (value: unknown): Reponse => {
  const texte = String(value ?? "").trim().toUpperCase();
  if (texte.startsWith("NON CONF")) return "NON CONFORME";
  if (texte.startsWith("MANQUE")) return "MANQUE";
  if (texte.startsWith("N/A") || texte === "NA") return "N/A";
  if (texte.startsWith("BON")) return "BON";
  return "N/A";
};

/** Clé de comparaison insensible aux accents, à la casse et aux espaces. */
export const cleLieu = (secteur: unknown, unite: unknown, emplacement: unknown) =>
  [secteur, unite, emplacement]
    .map((valeur) =>
      String(valeur ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase(),
    )
    .join("|");

export function reporterName(report: Report) {
  if (report.rapporteur) return report.rapporteur;
  const relation = report.rapporteurs;
  const reporter = Array.isArray(relation) ? relation[0] : relation;
  return [reporter?.prenom, reporter?.nom].filter(Boolean).join(" ");
}

export const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Casablanca",
  }).format(date);
};

export const formatJour = (value: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    timeZone: "Africa/Casablanca",
  }).format(new Date(value));

export function matchesDay(value: string, day: string) {
  if (!day) return true;
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
  return date === day;
}

export function anomaliesDe(report: Report, manqueEstAnomalie = true) {
  const values = CRITERES.map((c) => normaliser(report[c.cle]));
  const nonConformes = values.filter((v) => v === "NON CONFORME").length;
  const manques = values.filter((v) => v === "MANQUE").length;
  return {
    total: nonConformes + (manqueEstAnomalie ? manques : 0),
    nonConformes,
    manques,
  };
}

/* --------------------------------------------------------------- Notation */
/*
 * Un contrôle n'est plus binaire « conforme / non conforme » dès le premier
 * écart. Chaque critère vaut des points, le rapport obtient un score et un
 * statut intermédiaire « À récupérer » qui localise les écarts.
 *
 *   BON            = 1 point
 *   MANQUE         = 0,5 point
 *   NON CONFORME   = 0 point
 *   N/A            = exclu du calcul (ne pénalise pas)
 *
 * Seuils : 100 % => Conforme · >= 50 % => À récupérer · < 50 % => Non conforme
 */
export const POINTS_CRITERE: Record<Reponse, number | null> = {
  BON: 1,
  MANQUE: 0.5,
  "NON CONFORME": 0,
  "N/A": null,
};

export type StatutRapport = "CONFORME" | "A_RECUPERER" | "NON_CONFORME";

export const LIBELLE_STATUT: Record<StatutRapport, string> = {
  CONFORME: "Conforme",
  A_RECUPERER: "À récupérer",
  NON_CONFORME: "Non conforme",
};

export interface CritereEnDefaut {
  cle: CleCritere;
  libelle: string;
  reponse: Reponse;
  points: number;
}

export interface ScoreRapport {
  points: number;
  maximum: number;
  taux: number;
  statut: StatutRapport;
  bons: number;
  manques: number;
  nonConformes: number;
  na: number;
  defauts: CritereEnDefaut[];
}

export const arrondi = (valeur: number) => Math.round(valeur * 100) / 100;

export const formatPoints = (valeur: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(valeur);

export function scorer(report: Report): ScoreRapport {
  let points = 0;
  let maximum = 0;
  let bons = 0;
  let manques = 0;
  let nonConformes = 0;
  let na = 0;
  const defauts: CritereEnDefaut[] = [];

  for (const critere of CRITERES) {
    const reponse = normaliser(report[critere.cle]);
    const valeur = POINTS_CRITERE[reponse];
    if (reponse === "N/A" || valeur === null) {
      na += 1;
      continue;
    }
    maximum += 1;
    points += valeur;
    if (reponse === "BON") bons += 1;
    if (reponse === "MANQUE") {
      manques += 1;
      defauts.push({ ...critere, reponse, points: valeur });
    }
    if (reponse === "NON CONFORME") {
      nonConformes += 1;
      defauts.push({ ...critere, reponse, points: valeur });
    }
  }

  const taux = maximum ? points / maximum : 1;
  const statut: StatutRapport = taux >= 0.999 ? "CONFORME" : taux >= 0.5 ? "A_RECUPERER" : "NON_CONFORME";

  return {
    points: arrondi(points),
    maximum,
    taux,
    statut,
    bons,
    manques,
    nonConformes,
    na,
    defauts,
  };
}

export function estConforme(report: Report, _manqueEstAnomalie = true) {
  return scorer(report).statut === "CONFORME";
}

export interface StatsZone {
  zone: string;
  total: number;
  conformes: number;
  recuperes: number;
  nonConformes: number;
  points: number;
  scoreMoyen: number;
  taux: number;
}

export function statsParZone(reports: Report[], manqueEstAnomalie = true): StatsZone[] {
  const zones = [...new Set([...ZONES, ...reports.map((r) => String(r.sector))])];
  return zones
    .map((zone) => {
      const rows = reports.filter((r) => String(r.sector) === String(zone));
      const scores = rows.map(scorer);
      const conformes = scores.filter((s) => s.statut === "CONFORME").length;
      const recuperes = scores.filter((s) => s.statut === "A_RECUPERER").length;
      const nonConformes = scores.filter((s) => s.statut === "NON_CONFORME").length;
      const totalPoints = scores.reduce((sum, s) => sum + s.points, 0);
      const totalMax = scores.reduce((sum, s) => sum + s.maximum, 0);
      return {
        zone: String(zone),
        total: rows.length,
        conformes,
        recuperes,
        nonConformes,
        points: rows.reduce((sum, r) => sum + anomaliesDe(r, manqueEstAnomalie).total, 0),
        scoreMoyen: totalMax ? totalPoints / totalMax : 0,
        taux: rows.length ? conformes / rows.length : 0,
      };
    })
    .filter((z) => z.total > 0 || ZONES.includes(z.zone as (typeof ZONES)[number]));
}

export function statsParCritere(reports: Report[]) {
  return CRITERES.map((critere) => {
    const values = reports.map((r) => normaliser(r[critere.cle]));
    const nc = values.filter((v) => v === "NON CONFORME").length;
    const manque = values.filter((v) => v === "MANQUE").length;
    const na = values.filter((v) => v === "N/A").length;
    const evalues = values.length - na;
    const ok = Math.max(evalues - nc - manque, 0);
    return {
      ...critere,
      nc,
      manque,
      na,
      anomalies: nc + manque,
      taux: evalues ? ok / evalues : 0,
    };
  });
}

export function tendance(reports: Report[], jours = 14, manqueEstAnomalie = true) {
  const parJour = new Map<
    string,
    { jour: string; label: string; conformes: number; recuperes: number; nonConformes: number }
  >();
  const today = new Date();
  for (let i = jours - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Casablanca",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
    parJour.set(key, { jour: key, label: formatJour(date.toISOString()), conformes: 0, recuperes: 0, nonConformes: 0 });
  }
  for (const report of reports) {
    if (!report.created_at) continue;
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Casablanca",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(report.created_at));
    const entry = parJour.get(key);
    if (!entry) continue;
    const statut = scorer(report).statut;
    if (statut === "CONFORME") entry.conformes += 1;
    else if (statut === "A_RECUPERER") entry.recuperes += 1;
    else entry.nonConformes += 1;
  }
  return [...parJour.values()];
}
