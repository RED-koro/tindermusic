/* Liens "écouter en entier" — l'utilisateur choisit sa plateforme.
   Zicmu ne dépend de Deezer que pour les données (extraits + pochettes) ;
   pour le titre complet, on renvoie vers le service que la personne utilise
   déjà. On n'a que l'id Deezer, donc pour les autres plateformes on ouvre
   une recherche "titre + artiste" (fiable et universel). */

import { Track } from "./catalog";

export interface ListenLink {
  id: string;
  label: string;
  icon: string; // nom d'icône Ionicons
  url: string;
}

export function listenLinks(track: Track): ListenLink[] {
  const query = encodeURIComponent(`${track.artist} ${track.title}`);
  const links: ListenLink[] = [
    {
      id: "spotify",
      label: "Spotify",
      icon: "musical-notes",
      url: `https://open.spotify.com/search/${query}`,
    },
    {
      id: "apple",
      label: "Apple Music",
      icon: "musical-note",
      url: `https://music.apple.com/search?term=${query}`,
    },
    {
      id: "youtube",
      label: "YouTube",
      icon: "logo-youtube",
      url: `https://music.youtube.com/search?q=${query}`,
    },
  ];

  // Deezer : on a l'id exact → lien direct vers le titre
  if (track.deezer) {
    links.push({
      id: "deezer",
      label: "Deezer",
      icon: "disc",
      url: `https://www.deezer.com/track/${track.id.replace(/^dz-/, "")}`,
    });
  }

  return links;
}
