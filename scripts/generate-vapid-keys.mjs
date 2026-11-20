#!/usr/bin/env node
/** Génère une paire de clés VAPID pour les notifications push. */
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log("Ajoutez ces variables dans l'environnement du serveur (Netlify) :\n");
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("VAPID_SUBJECT=mailto:supervision@hsely.ma");
console.log("\nNe commitez jamais la clé privée.");
