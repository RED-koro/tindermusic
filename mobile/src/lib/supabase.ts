/* Client Supabase — backend de Tune (catalogue partagé, V2).
   La clé "anon" est publique par nature : elle est faite pour être embarquée
   dans l'app. Toute la sécurité est assurée côté serveur par les règles RLS
   (voir scripts/supabase-schema.sql). Ne JAMAIS mettre la clé "service_role" ici.

   Identité : chaque appareil obtient une session anonyme (pas de compte à
   créer) — ça suffit pour publier et gérer ses propres titres. */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

// Identifiants publics du projet Supabase (safe à embarquer, protégés par RLS)
//    (Supabase → Project Settings → API)
const SUPABASE_URL = "https://ivswzeggkrrifdkxlvid.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2c3d6ZWdna3JyaWZka3hsdmlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NzY3ODAsImV4cCI6MjA5OTM1Mjc4MH0.I_xvtKpuoujQs_gB-goXOIECY7u7Dey0WvMcCSlrfzg";

/** true seulement quand les identifiants sont renseignés — sinon l'app
    fonctionne normalement en local + Deezer, sans backend. */
export const supabaseReady = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

/* Stockage résistant au rendu statique : pendant le prerender web (Node),
   `window` n'existe pas et AsyncStorage plante. On no-op dans ce cas ;
   sur appareil et dans le navigateur, on passe par AsyncStorage normalement. */
const ssrSafeStorage = {
  getItem: async (key: string) => {
    if (typeof window === "undefined") return null;
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    if (typeof window === "undefined") return;
    try {
      await AsyncStorage.setItem(key, value);
    } catch {}
  },
  removeItem: async (key: string) => {
    if (typeof window === "undefined") return;
    try {
      await AsyncStorage.removeItem(key);
    } catch {}
  },
};

export const supabase: SupabaseClient | null = supabaseReady
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: ssrSafeStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

/** Garantit une session (anonyme) : appelée avant toute publication.
    Renvoie l'id utilisateur, ou null si le backend n'est pas configuré. */
export async function ensureSession(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: signIn, error } = await supabase.auth.signInAnonymously();
  if (error) return null;
  return signIn.user?.id ?? null;
}
