/* Service worker du portail de supervision : réception des notifications
   push et ouverture du rapport au clic. Aucune mise en cache des données. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Nouveau rapport", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Nouveau rapport";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag || "rapport",
    renotify: true,
    data: { url: payload.url || "/admin/reports" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const cible = new URL(event.notification.data?.url || "/admin/reports", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const fenetres = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of fenetres) {
        if (client.url.startsWith(self.location.origin)) {
          await client.focus();
          if ("navigate" in client) await client.navigate(cible);
          return;
        }
      }
      await self.clients.openWindow(cible);
    })(),
  );
});
