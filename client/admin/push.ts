/**
 * Notifications push du portail de supervision.
 * Le navigateur s'abonne via l'API Push (clé VAPID publique), l'abonnement est
 * enregistré côté serveur, et le serveur envoie les notifications.
 */

export const supporteNotifications = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export async function enregistrerServiceWorker() {
  if (!supporteNotifications()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (error) {
    console.warn("Service worker indisponible", error);
    return null;
  }
}

function cleDepuisBase64(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalise = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(normalise);
  const octets = new Uint8Array(brut.length);
  for (let index = 0; index < brut.length; index += 1) octets[index] = brut.charCodeAt(index);
  return octets;
}

export async function etatNotifications(): Promise<{
  supporte: boolean;
  configure: boolean;
  abonne: boolean;
  permission: NotificationPermission | "inconnu";
}> {
  if (!supporteNotifications()) {
    return { supporte: false, configure: false, abonne: false, permission: "inconnu" };
  }
  const enregistrement = await navigator.serviceWorker.getRegistration("/");
  const abonnement = await enregistrement?.pushManager.getSubscription();
  let configure = false;
  try {
    const reponse = await fetch("/api/admin/push/status", { credentials: "same-origin" });
    if (reponse.ok) configure = Boolean((await reponse.json()).configured);
  } catch {
    configure = false;
  }
  return {
    supporte: true,
    configure,
    abonne: Boolean(abonnement),
    permission: Notification.permission,
  };
}

export async function activerNotifications(): Promise<"ok" | "refuse" | "non-configure" | "erreur"> {
  if (!supporteNotifications()) return "erreur";

  const reponse = await fetch("/api/admin/push/status", { credentials: "same-origin" });
  if (!reponse.ok) return "erreur";
  const etat = (await reponse.json()) as { configured: boolean; publicKey: string | null };
  if (!etat.configured || !etat.publicKey) return "non-configure";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "refuse";

  const enregistrement = (await navigator.serviceWorker.getRegistration("/")) ??
    (await enregistrerServiceWorker());
  if (!enregistrement) return "erreur";
  await navigator.serviceWorker.ready;

  const existant = await enregistrement.pushManager.getSubscription();
  const abonnement =
    existant ??
    (await enregistrement.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: cleDepuisBase64(etat.publicKey),
    }));

  const json = abonnement.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const sauvegarde = await fetch("/api/admin/push/subscribe", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  if (!sauvegarde.ok) {
    await abonnement.unsubscribe().catch(() => undefined);
    return "erreur";
  }
  return "ok";
}

export async function desactiverNotifications(): Promise<void> {
  const enregistrement = await navigator.serviceWorker.getRegistration("/");
  const abonnement = await enregistrement?.pushManager.getSubscription();
  if (!abonnement) return;
  await fetch("/api/admin/push/unsubscribe", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: abonnement.endpoint }),
  }).catch(() => undefined);
  await abonnement.unsubscribe().catch(() => undefined);
}
