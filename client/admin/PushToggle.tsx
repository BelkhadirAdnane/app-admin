import { useEffect, useState } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  activerNotifications,
  desactiverNotifications,
  etatNotifications,
  supporteNotifications,
} from "./push";

type Etat = "chargement" | "actif" | "inactif" | "indisponible" | "non-configure";

export default function PushToggle() {
  const [etat, setEtat] = useState<Etat>("chargement");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let actif = true;
    etatNotifications()
      .then((resultat) => {
        if (!actif) return;
        if (!resultat.supporte) setEtat("indisponible");
        else if (!resultat.configure) setEtat("non-configure");
        else setEtat(resultat.abonne ? "actif" : "inactif");
      })
      .catch(() => actif && setEtat("indisponible"));
    return () => {
      actif = false;
    };
  }, []);

  async function basculer() {
    if (busy || etat === "indisponible" || etat === "non-configure") return;
    setBusy(true);
    try {
      if (etat === "actif") {
        await desactiverNotifications();
        setEtat("inactif");
        toast.success("Alertes désactivées sur cet appareil.");
      } else {
        const resultat = await activerNotifications();
        if (resultat === "ok") {
          setEtat("actif");
          toast.success("Alertes activées", {
            description: "Vous recevrez chaque nouveau rapport sur cet appareil.",
          });
        } else if (resultat === "refuse") {
          toast.error("Notifications refusées", {
            description: "Autorisez les notifications dans les réglages du navigateur.",
          });
        } else if (resultat === "non-configure") {
          setEtat("non-configure");
          toast.error("Serveur non configuré", { description: "Clés VAPID absentes côté serveur." });
        } else {
          toast.error("Activation impossible", { description: "Réessayez dans un instant." });
        }
      }
    } finally {
      setBusy(false);
    }
  }

  if (etat === "chargement") {
    return (
      <span className="grid h-8 w-8 place-items-center rounded-md border border-sand text-steel/50">
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} />
      </span>
    );
  }

  if (etat === "indisponible" || etat === "non-configure") {
    const titre =
      etat === "indisponible"
        ? "Notifications non prises en charge par ce navigateur (HTTPS requis)."
        : "Notifications à configurer côté serveur (clés VAPID).";
    return (
      <span
        className="grid h-8 w-8 cursor-help place-items-center rounded-md border border-sand text-steel/50"
        title={titre}
      >
        <Bell className="h-3.5 w-3.5" strokeWidth={1.6} />
      </span>
    );
  }

  const actif = etat === "actif";
  return (
    <button
      type="button"
      onClick={basculer}
      disabled={busy}
      title={actif ? "Désactiver les alertes sur cet appareil" : "Recevoir une alerte à chaque nouveau rapport"}
      aria-pressed={actif}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[10px] font-medium transition disabled:opacity-60 ${
        actif
          ? "border-lime-deep/50 bg-lime-soft text-pine"
          : "border-sand text-steel hover:border-pine/40 hover:text-pine"
      }`}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} />
      ) : actif ? (
        <BellRing className="h-3.5 w-3.5 text-lime-deep" strokeWidth={1.8} />
      ) : (
        <Bell className="h-3.5 w-3.5" strokeWidth={1.8} />
      )}
      <span className="hidden sm:inline">{actif ? "Alertes actives" : "Activer les alertes"}</span>
    </button>
  );
}
