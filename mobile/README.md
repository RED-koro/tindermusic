# Tune (app mobile)

App React Native + Expo (SDK 54) — publiable sur iOS et Android.

> **Pourquoi SDK 54 ?** L'app Expo Go distribuée sur l'App Store / Play Store est
> gelée au SDK 54 (Expo ne la met plus à jour pour les SDK plus récents). Rester
> en SDK 54 permet de tester directement sur téléphone avec Expo Go. Le jour où
> on passe aux development builds (EAS), on pourra remonter de SDK.
> **Voir AGENTS.md avant toute modification structurelle.**

## Développement

```bash
npm install
npx expo start          # QR code à scanner avec Expo Go (App Store / Play Store)
npx expo start --web    # aperçu navigateur
npx tsc --noEmit        # vérification TypeScript
```

## Vraie musique (Deezer)

Le deck Découvrir et la recherche sont branchés sur l'**API publique Deezer**
(gratuite, sans clé) : extraits officiels de 30 s, vraies pochettes, charts par
genre. `src/lib/deezer.ts` :

- le flux Découvrir mélange les tendances globales et les charts des genres
  préférés de l'utilisateur (l'algo pilote ce qu'on va chercher) ;
- la recherche interroge tout le catalogue Deezer (debounce 450 ms) ;
- les URLs d'extraits expirent : elles sont rafraîchies au moment de la lecture ;
- les métadonnées des titres classés sont persistées (`savedDeezer`) pour que la
  bibliothèque survive au redémarrage ;
- sans réseau, l'app retombe sur le catalogue local embarqué.

Sur web, l'API Deezer n'envoie pas de CORS → JSONP (téléphone : fetch direct).

## Architecture

- `src/app/` — écrans (expo-router) : `(tabs)/` Découvrir, Bibliothèque, Rechercher, Profil + `artist.tsx` (Espace artiste)
- `src/lib/` — `catalog.ts` (titres de démo), `store.tsx` (état + algo v1, persisté en AsyncStorage), `audio.ts` (lecture des extraits, expo-audio), `covers.tsx` (pochettes SVG générées), `moderation.ts` (filtres de publication), `previews.ts` (mapping des extraits embarqués)
- `src/components/` — `TrackRow`, `MiniPlayer`
- `assets/previews/` — extraits 30 s du catalogue (M4A), régénérables : `bash scripts/build-previews.sh`
- Les fichiers importés par les artistes sont copiés dans le dossier documents de l'app (`uploads/`)

## Modération des publications (v1)

Trois lignes de défense dans `src/lib/moderation.ts` :

1. **Validation automatique à la publication** : textes filtrés (mots interdits
   FR/EN avec normalisation anti-contournement accents/leetspeak), format et
   durée réelle du fichier audio vérifiés (15 s – 15 min), dimensions de la
   pochette contrôlées. Refus bloquant avec motifs affichés à l'artiste.
2. **Charte artiste obligatoire** (droits sur le contenu, règles de contenu) —
   case à cocher avant publication.
3. **Signalement auditeur** (bouton au dos de la carte) : le titre signalé est
   masqué du deck et de la bibliothèque (statut `rejected`).

Chaque titre a un statut `pending | approved | rejected` : la V2 (backend)
branchera la revue humaine/IA (dont détection NSFW des pochettes et analyse du
contenu audio — transcription des paroles, empreinte acoustique anti-piratage —
impossibles à faire sérieusement côté client) en passant les publications par
`pending`.

## Publication sur les stores (EAS Build)

Prérequis : compte [Apple Developer](https://developer.apple.com) (99 $/an) pour iOS,
compte [Google Play Console](https://play.google.com/console) (25 $ une fois) pour Android,
et un compte gratuit [expo.dev](https://expo.dev).

```bash
npm install -g eas-cli
eas login
eas build:configure

# Builds de production
eas build --platform ios
eas build --platform android

# Soumission aux stores
eas submit --platform ios
eas submit --platform android
```

Avant la soumission :
1. Remplacer les icônes (`assets/images/icon.png`, icônes Android) et le splash screen par le branding Tune
2. Vérifier `bundleIdentifier` / `package` dans `app.json` (`com.andytaieb.tune`)
3. Préparer captures d'écran + fiche store (App Store Connect / Play Console)

## Étape suivante (V2)

Backend (ex. Supabase/Firebase) pour que les titres publiés par un artiste
soient visibles par **tous** les utilisateurs : upload des fichiers dans un
storage, catalogue en base, comptes artiste/auditeur, et modération centralisée.
