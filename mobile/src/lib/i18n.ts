/* Langue de l'app : français si le téléphone est en français, anglais pour
   le reste du monde. Détectée une fois au lancement.
   ⚠️ Les clés de l'algo (labels de genres) restent canoniques quelle que soit
   la langue — ne jamais les traduire, sinon les scores se dédoublent. */

import { getLocales } from "expo-localization";

export type Locale = "fr" | "en";

function detect(): Locale {
  try {
    const code = getLocales()[0]?.languageCode?.toLowerCase();
    return code === "fr" ? "fr" : "en";
  } catch {
    return "en";
  }
}

export const LOCALE: Locale = detect();
export const isFr = LOCALE === "fr";
