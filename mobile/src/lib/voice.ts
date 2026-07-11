/* La voix de Tune — chaleureuse, un peu cash, amoureuse de musique.
   Règle d'or : jamais deux fois la même phrase. Un humain, ça varie.
   Bilingue : français si le téléphone est en français, anglais sinon. */

import { isFr } from "./i18n";

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/* ---- Toasts de swipe ---- */

export const likeToast = (title: string) =>
  pick(
    isFr
      ? [
          `« ${title} », très bon goût.`,
          `Ajouté. Celui-là va tourner en boucle.`,
          `« ${title} » rejoint ta collec'.`,
          `Bien vu. Il est à toi.`,
          `Dans la poche. Tes oreilles te remercient.`,
        ]
      : [
          `"${title}" — great taste.`,
          `Added. This one's going on repeat.`,
          `"${title}" just joined your collection.`,
          `Nice catch. It's yours now.`,
          `In the bag. Your ears say thanks.`,
        ]
  );

export const nopeToast = (genre: string) =>
  pick(
    isFr
      ? [
          `Ok, on lève le pied sur le ${genre}.`,
          `Pas ta came ? C'est noté.`,
          `Suivant. Le ${genre} attendra.`,
          `On efface, on oublie.`,
        ]
      : [
          `Okay, easing up on the ${genre}.`,
          `Not your thing? Noted.`,
          `Next. ${genre} can wait.`,
          `Skipped and forgotten.`,
        ]
  );

export const laterToast = (title: string) =>
  pick(
    isFr
      ? [
          `« ${title} » mis de côté, au chaud.`,
          `On le garde sous le coude.`,
          `À réécouter à tête reposée.`,
        ]
      : [
          `"${title}" set aside, staying warm.`,
          `Keeping this one up our sleeve.`,
          `Saved for a proper listen later.`,
        ]
  );

export const undoToast = () =>
  pick(
    isFr
      ? [`On remonte le temps.`, `Comme si de rien n'était.`, `Seconde chance accordée.`]
      : [`Rewinding time.`, `Like it never happened.`, `Second chance granted.`]
  );

/* ---- Découvrir ---- */

export const deckHint = () =>
  pick(
    isFr
      ? [
          `Swipe à droite si ça te parle.`,
          `Tes oreilles décident, pas l'algo.`,
          `30 secondes pour te faire un avis.`,
          `Fais confiance au premier frisson.`,
        ]
      : [
          `Swipe right if it speaks to you.`,
          `Your ears decide, not the algorithm.`,
          `30 seconds to make up your mind.`,
          `Trust the first shiver.`,
        ]
  );

export const loadingLine = () =>
  pick(
    isFr
      ? [
          `On fouille dans les bacs…`,
          `Ça crépite, deux secondes…`,
          `On dépoussière quelques pépites…`,
        ]
      : [
          `Digging through the crates…`,
          `Crackling, two seconds…`,
          `Dusting off a few gems…`,
        ]
  );

export const emptyDeckLine = () =>
  pick(
    isFr
      ? [
          `Tout écouté. Sérieusement ? Respect.`,
          `Fin de la pile. T'es un monstre.`,
          `Plus rien à te faire écouter… pour l'instant.`,
        ]
      : [
          `You heard everything. Seriously? Respect.`,
          `End of the stack. You're a machine.`,
          `Nothing left to play you… for now.`,
        ]
  );

/* ---- Recherche ---- */

export const searchPlaceholder = () =>
  pick(
    isFr
      ? [`Un titre, un artiste, une vibe…`, `Qu'est-ce qu'on écoute ?`]
      : [`A track, an artist, a vibe…`, `What are we listening to?`]
  );

export const noResultsLine = (q: string) =>
  pick(
    isFr
      ? [
          `Rien pour « ${q} ». Et pourtant on a fouillé partout.`,
          `« ${q} » ? Connais pas. Vérifie l'orthographe ?`,
        ]
      : [
          `Nothing for "${q}". And we really dug everywhere.`,
          `"${q}"? Never heard of it. Typo maybe?`,
        ]
  );

/* ---- Profil ---- */

export const profileTagline = (swipes: number) => {
  if (isFr) {
    if (swipes === 0) return `Tes oreilles n'ont encore rien vu venir.`;
    if (swipes < 20) return `${swipes} swipes — ça commence à devenir sérieux.`;
    if (swipes < 100) return `${swipes} swipes. L'algo apprend vite, grâce à toi.`;
    return `${swipes} swipes. À ce stade, c'est de l'expertise.`;
  }
  if (swipes === 0) return `Your ears have no idea what's coming.`;
  if (swipes < 20) return `${swipes} swipes — this is getting serious.`;
  if (swipes < 100) return `${swipes} swipes. The algorithm learns fast, thanks to you.`;
  return `${swipes} swipes. At this point, it's expertise.`;
};
