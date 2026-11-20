# Portail de supervision — Douches de sécurité

Interface de supervision des contrôles de douches de sécurité : connexion
administrateur, rapports reçus, indicateurs de conformité et génération du
dashboard Excel.

## Démarrage

```bash
npm install
cp .env.example .env      # renseigner les variables
node scripts/hash-pin.mjs 123456   # → ADMIN_PIN_HASH
npm run dev
```

## Avant la première utilisation

Exécuter `supabase/SETUP.sql` dans **Supabase → SQL Editor**. Voir
`GUIDE_SUPABASE.md` (fourni à la racine de la livraison).

## Scripts

- `npm run dev` — portail + API en développement
- `npm run build` — build client + serveur
- `npm start` — serveur de production
- `npm run import:excel -- "fichier.xlsx"` — import de la feuille Détail (simulation)
- `npm run import:excel -- "fichier.xlsx" --apply` — écriture dans Supabase

## Sécurité

- La clé `SUPABASE_SERVICE_ROLE_KEY` reste **exclusivement côté serveur**.
- Toutes les routes `/api/admin/*` exigent une session, sauf `/login` et le
  déclencheur de scan push (secret dédié).
- CORS fermé par défaut : renseigner `ADMIN_ALLOWED_ORIGINS` (liste séparée par
  des virgules) uniquement si une autre origine doit appeler l'API.
- Comparaisons de secrets à temps constant, 5 tentatives de connexion / 15 min,
  cookie `HttpOnly` + `Secure` + `SameSite`, session HMAC 8 h.
- `.env` et `.env.local` ne doivent jamais être commités.

## Notifications push (PWA)

Le portail s'installe comme application (manifest + service worker) et peut
recevoir une notification à chaque nouveau rapport :

```
Nouveau rapport · LF
Ligne F · CAP X-Y · RDC
Mohamed Safi — 10,5/12 · À récupérer
```

### 1. Base de données

Coller `supabase/PUSH.sql` dans **Supabase → SQL Editor → Run**. Le script crée
`push_subscriptions` et `push_notifications_log`, accessibles uniquement avec la
clé `service_role` (RLS sans politique).

### 2. Clés VAPID

```bash
npm run push:keys
```

Recopier `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et `VAPID_SUBJECT` dans les
variables d'environnement de l'hébergement. **Ne jamais commiter la clé privée.**

### 3. Envoi des notifications

- **Netlify (recommandé)** : la fonction planifiée `netlify/functions/push-scan.ts`
  tourne chaque minute et envoie les alertes.
- **Serveur persistant / VPS** : la boucle `demarrerScanPeriodique()` démarre
  automatiquement avec le serveur Express.
- **Cron externe** : appeler `POST /api/admin/push/scan` avec l'en-tête
  `x-push-secret: $PUSH_SCAN_SECRET`.

### 4. Côté téléphone

Ouvrir le portail en HTTPS, se connecter, puis « Ajouter à l'écran d'accueil »
(iOS) ou « Installer l'application » (Android), puis **Activer les alertes**.

Limites : iOS exige iOS 16.4+ et l'installation sur l'écran d'accueil ;
l'autorisation peut être refusée ; une notification n'est envoyée qu'aux
appareils abonnés.
