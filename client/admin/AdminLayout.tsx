import { ReactNode, useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, FileSpreadsheet, LayoutGrid, LogOut, ShieldCheck, Waves } from "lucide-react";
import PushToggle from "./PushToggle";

type AdminLayoutProps = { children: ReactNode };

const NAV = [
  { to: "/admin/reports", label: "Rapports reçus", index: "01", icon: LayoutGrid },
  { to: "/admin/export", label: "Dashboard Excel", index: "02", icon: FileSpreadsheet },
];

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-md border border-sand bg-white">
        <img src="/logo-hsely.png" alt="HSELY — HSE Audit" className="h-full w-full object-contain" width={44} height={44} />
      </div>
      <div className="leading-tight">
        <div className="font-mono-label text-[9px] text-steel">Contrôles terrain</div>
        <div className="font-display text-[14px] tracking-tight text-pine">Douches de sécurité</div>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<"checking" | "ready" | "unauthorized">("checking");
  const [signingOut, setSigningOut] = useState(false);
  const [supabase, setSupabase] = useState<{
    supabase: boolean;
    bucket: string | null;
    serviceRoleConfigured: boolean;
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/session", { credentials: "same-origin" })
      .then((response) => {
        if (!active) return;
        if (response.ok) {
          setStatus("ready");
          fetch("/api/admin/config", { credentials: "same-origin" })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => active && data && setSupabase(data))
            .catch(() => undefined);
        } else {
          setStatus("unauthorized");
          navigate("/admin/login", { replace: true });
        }
      })
      .catch(() => {
        if (active) {
          setStatus("unauthorized");
          navigate("/admin/login", { replace: true });
        }
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  async function logout() {
    setSigningOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      navigate("/admin/login", { replace: true });
    }
  }

  if (status !== "ready") {
    return (
      <div className="admin-screen grain relative flex min-h-screen items-center justify-center overflow-hidden bg-paper text-sm text-steel">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 animate-pulse bg-pine" />
          {status === "checking" ? "Vérification de la session…" : "Redirection vers la connexion…"}
        </div>
      </div>
    );
  }

  const courant = NAV.find((item) => location.pathname.startsWith(item.to))?.label ?? "Supervision";
  const aujourdhui = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Casablanca",
  }).format(new Date());

  return (
    <div className="admin-screen min-h-screen bg-paper text-ink lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="sticky top-0 z-30 hidden h-screen flex-col overflow-hidden border-r border-sand bg-white px-6 py-7 text-ink lg:flex">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-lime-deep" aria-hidden="true" />

        <div className="relative">
          <Brand />
        </div>

        <nav aria-label="Navigation de supervision" className="relative mt-12 space-y-1.5">
          <p className="mb-4 font-mono-label text-[9px] text-steel/70">Supervision</p>
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `group relative flex h-12 items-center gap-3 border-l-2 pl-3 pr-2 text-sm transition-colors ${
                    isActive
                      ? "border-lime-deep bg-lime-soft/45 text-pine"
                      : "border-transparent text-steel hover:border-sand hover:text-pine"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`font-mono-label text-[9px] ${isActive ? "text-lime-deep" : "text-steel/50 group-hover:text-steel"}`}
                    >
                      {item.index}
                    </span>
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.6} />
                    <span className="flex-1 text-[13px] font-medium">{item.label}</span>
                    <ArrowUpRight
                      className={`h-3.5 w-3.5 transition ${
                        isActive ? "text-lime-deep opacity-100" : "opacity-0 group-hover:opacity-60"
                      }`}
                      strokeWidth={1.8}
                    />
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="relative mt-10 rounded-md border border-sand bg-pine/[0.02] p-4">
          <div className="flex items-center gap-2">
            <Waves className="h-3.5 w-3.5 text-lime-deep" strokeWidth={1.8} />
            <span className="font-mono-label text-[8px] text-steel">Source de données</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 ${supabase?.serviceRoleConfigured ? "live-dot bg-lime-deep" : "bg-amber"}`}
              aria-hidden="true"
            />
            <span className="text-[12px] font-medium">
              {supabase === null
                ? "Vérification…"
                : supabase.serviceRoleConfigured
                  ? "Accès serveur configuré"
                  : supabase.supabase
                    ? "Accès rapports limité"
                    : "Supabase à configurer"}
            </span>
          </div>
          <p className="mt-2 text-[10px] leading-4 text-steel">
            {supabase?.serviceRoleConfigured
              ? `Lecture des rapports · bucket ${supabase.bucket ?? "dashboards"}`
              : supabase?.supabase
                ? "La clé anon est détectée, mais RLS bloque les rapports. Configurez SUPABASE_SERVICE_ROLE_KEY côté serveur."
                : "Configurez SUPABASE_URL et SUPABASE_ANON_KEY côté serveur."}
          </p>
        </div>

        <div className="relative mt-auto pt-6">
          <div className="mb-4 flex items-center justify-between border-t border-sand pt-5">
            <span className="flex items-center gap-2 text-[10px] text-steel">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.7} />
              Session sécurisée · 8 h
            </span>
            <span className="font-mono-label text-[8px] text-steel/50">v2.0</span>
          </div>
          <button
            className="flex w-full items-center gap-3 rounded-md px-1 py-2 text-left text-[11px] text-steel transition hover:text-clay disabled:opacity-50"
            disabled={signingOut}
            onClick={logout}
            type="button"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.7} />
            {signingOut ? "Déconnexion…" : "Se déconnecter"}
          </button>
        </div>
      </aside>

      <div className="relative min-w-0">
        <header className="sticky top-0 z-20 border-b border-sand/80 bg-paper/90 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between gap-4 px-5 sm:px-8 xl:px-12">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-md border border-sand bg-white lg:hidden">
                <img src="/logo-hsely.png" alt="HSELY" className="h-full w-full object-contain" width={36} height={36} />
              </div>
              <div className="flex items-center gap-2 text-[11px] text-steel">
                <span className="font-mono-label text-[9px] text-steel/80">Supervision</span>
                <span className="text-sand">/</span>
                <span className="font-medium text-pine">{courant}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <PushToggle />
              <span className="hidden font-mono-label text-[9px] text-steel sm:block">{aujourdhui}</span>
              <span className="hidden h-4 w-px bg-sand sm:block" />
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center bg-pine text-[10px] font-semibold text-lime">A</span>
                <span className="hidden text-[11px] font-medium text-pine sm:block">Administration</span>
              </div>
              <button
                className="grid h-8 w-8 place-items-center border border-sand text-steel transition hover:border-clay/40 hover:text-clay lg:hidden"
                onClick={logout}
                aria-label="Se déconnecter"
                type="button"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.7} />
              </button>
            </div>
          </div>

          <nav aria-label="Navigation mobile" className="flex border-t border-sand/70 px-5 lg:hidden">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-[11px] ${
                    isActive ? "border-pine font-semibold text-pine" : "border-transparent text-steel"
                  }`
                }
              >
                <item.icon className="h-3.5 w-3.5" strokeWidth={1.7} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-[1480px] px-5 pb-16 pt-8 sm:px-8 sm:pt-10 xl:px-12">{children}</main>

        <footer className="mx-auto w-full max-w-[1480px] px-5 pb-8 sm:px-8 xl:px-12">
          <div className="tick-rule h-px w-full opacity-70" />
          <p className="mt-4 text-[10px] text-steel/70">
            Portail de supervision · les rapports transmis sont immuables · heure du site : Africa/Casablanca
          </p>
        </footer>
      </div>
    </div>
  );
}
