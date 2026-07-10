/* La voix de Tune — chaleureuse, un peu cash, amoureuse de musique.
   Règle d'or : jamais deux fois la même phrase. Un humain, ça varie. */

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/* ---- Toasts de swipe ---- */

export const likeToast = (title: string) =>
  pick([
    `« ${title} », très bon goût.`,
    `Ajouté. Celui-là va tourner en boucle.`,
    `« ${title} » rejoint ta collec'.`,
    `Bien vu. Il est à toi.`,
    `Dans la poche. Tes oreilles te remercient.`,
  ]);

export const nopeToast = (genre: string) =>
  pick([
    `Ok, on lève le pied sur le ${genre}.`,
    `Pas ta came ? C'est noté.`,
    `Suivant. Le ${genre} attendra.`,
    `On efface, on oublie.`,
  ]);

export const laterToast = (title: string) =>
  pick([
    `« ${title} » mis de côté, au chaud.`,
    `On le garde sous le coude.`,
    `À réécouter à tête reposée.`,
  ]);

export const undoToast = () =>
  pick([`On remonte le temps.`, `Comme si de rien n'était.`, `Seconde chance accordée.`]);

/* ---- Découvrir ---- */

export const deckHint = () =>
  pick([
    `Swipe à droite si ça te parle.`,
    `Tes oreilles décident, pas l'algo.`,
    `30 secondes pour te faire un avis.`,
    `Fais confiance au premier frisson.`,
  ]);

export const loadingLine = () =>
  pick([
    `On fouille dans les bacs…`,
    `Ça crépite, deux secondes…`,
    `On dépoussière quelques pépites…`,
  ]);

export const emptyDeckLine = () =>
  pick([
    `Tout écouté. Sérieusement ? Respect.`,
    `Fin de la pile. T'es un monstre.`,
    `Plus rien à te faire écouter… pour l'instant.`,
  ]);

/* ---- Recherche ---- */

export const searchPlaceholder = () =>
  pick([`Un titre, un artiste, une vibe…`, `Qu'est-ce qu'on écoute ?`]);

export const noResultsLine = (q: string) =>
  pick([
    `Rien pour « ${q} ». Et pourtant on a fouillé partout.`,
    `« ${q} » ? Connais pas. Vérifie l'orthographe ?`,
  ]);

/* ---- Profil ---- */

export const profileTagline = (swipes: number) => {
  if (swipes === 0) return `Tes oreilles n'ont encore rien vu venir.`;
  if (swipes < 20) return `${swipes} swipes — ça commence à devenir sérieux.`;
  if (swipes < 100) return `${swipes} swipes. L'algo apprend vite, grâce à toi.`;
  return `${swipes} swipes. À ce stade, c'est de l'expertise.`;
};

/* ---- Espace artiste ---- */

export const publishToast = (title: string) =>
  pick([
    `« ${title} » est en ligne. Que le swipe commence.`,
    `« ${title} » est parti rencontrer son public.`,
  ]);
