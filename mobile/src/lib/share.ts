/* Partage d'un titre — feuille de partage native (iOS/Android),
   presse-papiers en secours sur web. */

import { Platform, Share } from "react-native";
import { Track } from "./catalog";
import { toast } from "./toast";

export async function shareTrack(track: Track) {
  const link = track.deezer
    ? `https://www.deezer.com/track/${track.id.replace(/^dz-/, "")}`
    : null;
  const message = `🎧 J'ai découvert « ${track.title} » de ${track.artist} sur Tune !${
    link ? `\n${link}` : ""
  }`;

  if (Platform.OS === "web") {
    const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
    try {
      if (nav.share) await nav.share({ text: message });
      else {
        await navigator.clipboard.writeText(message);
        toast("Copié — colle-le où tu veux !");
      }
    } catch {
      /* partage annulé */
    }
    return;
  }

  try {
    await Share.share({ message });
  } catch {
    /* partage annulé */
  }
}
