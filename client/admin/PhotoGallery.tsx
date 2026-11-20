import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ExternalLink, ImageOff, X } from "lucide-react";

/**
 * URLs de photos d'un rapport.
 * Le site terrain enregistre `photos_urls` (text[]) ; `photos` (jsonb) reste
 * accepté pour les anciens rapports.
 */
export function photosDuRapport(report: {
  photos_urls?: string[] | null;
  photos?: unknown;
} | null | undefined): string[] {
  if (!report) return [];
  const urls: string[] = [];
  if (Array.isArray(report.photos_urls)) {
    for (const url of report.photos_urls) {
      if (typeof url === "string" && /^https?:\/\//i.test(url)) urls.push(url);
    }
  }
  if (!urls.length && Array.isArray(report.photos)) {
    for (const item of report.photos as unknown[]) {
      if (typeof item === "string" && /^https?:\/\//i.test(item)) urls.push(item);
    }
  }
  return urls;
}

export function PhotoStrip({
  urls,
  libelle = "Photos du contrôle",
}: {
  urls: string[];
  libelle?: string;
}) {
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [cassees, setCassees] = useState<Record<string, boolean>>({});

  const fermer = useCallback(() => setOuvert(null), []);
  const suivant = useCallback(
    () => setOuvert((index) => (index === null ? null : (index + 1) % urls.length)),
    [urls.length],
  );
  const precedent = useCallback(
    () => setOuvert((index) => (index === null ? null : (index - 1 + urls.length) % urls.length)),
    [urls.length],
  );

  useEffect(() => {
    if (ouvert === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") fermer();
      if (event.key === "ArrowRight") suivant();
      if (event.key === "ArrowLeft") precedent();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ouvert, fermer, suivant, precedent]);

  if (!urls.length) {
    return (
      <div className="flex items-center gap-2 border border-dashed border-sand px-3 py-2.5 text-[10px] text-steel/70">
        <ImageOff className="h-3.5 w-3.5" strokeWidth={1.6} />
        Aucune photo jointe à ce rapport.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {urls.map((url, index) => (
          <button
            key={url}
            type="button"
            onClick={() => setOuvert(index)}
            className="group relative h-16 w-16 overflow-hidden rounded-md border border-sand bg-white transition hover:border-pine/50"
            aria-label={`Agrandir la photo ${index + 1} sur ${urls.length}`}
          >
            {cassees[url] ? (
              <span className="grid h-full w-full place-items-center bg-sand/30 text-steel">
                <ImageOff className="h-5 w-5" strokeWidth={1.4} />
              </span>
            ) : (
              <img
                src={url}
                alt=""
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                loading="lazy"
                onError={() => setCassees((etat) => ({ ...etat, [url]: true }))}
              />
            )}
            <span className="absolute bottom-0 right-0 bg-pine/85 px-1 font-mono-label text-[7px] text-white">
              {index + 1}
            </span>
          </button>
        ))}
        <span className="font-mono-label text-[8px] text-steel">
          {urls.length} photo{urls.length > 1 ? "s" : ""}
        </span>
      </div>

      {ouvert !== null &&
        createPortal(
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-pine-deep/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`${libelle} — photo ${ouvert + 1} sur ${urls.length}`}
          onClick={fermer}
        >
          <div className="relative max-h-full w-full max-w-3xl" onClick={(event) => event.stopPropagation()}>
            <img
              src={urls[ouvert]}
              alt={`${libelle} — photo ${ouvert + 1}`}
              className="mx-auto max-h-[78vh] w-auto rounded-md border border-white/20 bg-white object-contain"
            />
            <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
              <span className="font-mono-label text-[9px] text-steel">
                Photo {ouvert + 1} / {urls.length}
              </span>
              <div className="flex items-center gap-1.5">
                {urls.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={precedent}
                      className="grid h-8 w-8 place-items-center rounded border border-sand text-pine transition hover:border-pine/50"
                      aria-label="Photo précédente"
                    >
                      <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                    <button
                      type="button"
                      onClick={suivant}
                      className="grid h-8 w-8 place-items-center rounded border border-sand text-pine transition hover:border-pine/50"
                      aria-label="Photo suivante"
                    >
                      <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                  </>
                )}
                <a
                  href={urls[ouvert]}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex h-8 items-center gap-1.5 rounded border border-sand px-2.5 font-mono-label text-[8px] font-semibold text-pine transition hover:border-pine/50"
                >
                  <ExternalLink className="h-3 w-3" strokeWidth={1.8} />
                  Original
                </a>
                <button
                  type="button"
                  onClick={fermer}
                  className="grid h-8 w-8 place-items-center rounded border border-sand text-pine transition hover:border-clay/50 hover:text-clay"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
