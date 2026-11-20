/** Configuration du service de notifications push (VAPID + Supabase). */

export interface PushConfig {
  url: string;
  serviceKey: string;
  subject: string;
  publicKey: string;
  privateKey: string;
}

export function vapidConfigure(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function pushConfig(): PushConfig | null {
  const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) return null;
  return {
    url,
    serviceKey,
    subject: process.env.PUSH_VAPID_SUBJECT || "mailto:supervision@hsely.ma",
    publicKey: process.env.VAPID_PUBLIC_KEY ?? "",
    privateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  };
}

export function supabaseAdminHeaders(config: { serviceKey: string }) {
  return {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export async function rest<T>(
  config: PushConfig,
  chemin: string,
  init: RequestInit & { prefer?: string } = {},
): Promise<T> {
  const { prefer, ...reste } = init;
  const response = await fetch(`${config.url}/rest/v1/${chemin}`, {
    ...reste,
    headers: {
      ...supabaseAdminHeaders(config),
      ...(prefer ? { Prefer: prefer } : {}),
      ...(reste.headers ?? {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase ${response.status} : ${detail.slice(0, 200)}`);
  }
  if (response.status === 204) return undefined as T;
  const texte = await response.text();
  return (texte ? JSON.parse(texte) : undefined) as T;
}
