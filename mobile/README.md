# Zicmu (app mobile)

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

## Vraie musique (Deezer) + artistes maison

Toute la musique vient de l'**API publique Deezer** (gratuite, sans clé) :
extraits officiels de 30 s, vraies pochettes, charts par genre. `src/lib/deezer.ts` :

- **Artistes maison** (`src/lib/featured.ts` : Yohann Zveig, NoLaDiK,
  Vincent Bidal, Mélanie Noé) : leurs titres sont chargés en premier et
  boostés dans le deck ;
- le flux Découvrir mélange tendances, charts des genres préférés et
  recommandations « parce que tu as aimé X » (top de l'artiste + artistes
  similaires Deezer) ;
- la recherche interroge tout le catalogue Deezer (debounce 450 ms) ;
- les URLs d'extraits expirent : elles sont rafraîchies au moment de la lecture ;
- les métadonnées des titres classés sont persistées (`savedDeezer`).

Sur web, l'API Deezer n'envoie pas de CORS → JSONP (téléphone : fetch direct).

## Algo v2 (`src/lib/store.tsx`)

- **Deux signaux** : score par genre **et score par artiste** (l'artiste pèse
  1,5× un genre dans l'affinité d'un titre) ;
- **Pondération par temps d'écoute** : like après ≥ 10 s d'écoute = +3 (vs +2) ;
  rejet après ≥ 15 s = −3 (vrai rejet) ; rejet en < 2 s = −1 (jugé sur la
  pochette) ; « à revoir » = +1 ;
- **Oubli progressif** : chaque swipe atténue les scores de 2 % (un goût
  se dissipe en ~35 swipes s'il n'est pas renforcé) ;
- **Exploration** : un genre aléatoire (jamais un genre rejeté < −3) est
  toujours mélangé au flux pour éviter la bulle ;
- l'annulation d'un swipe rend le delta exact qui avait été appliqué.

## Architecture

- `src/app/` — écrans (expo-router) : `(tabs)/` Découvrir, Bibliothèque, Rechercher, Profil + `artist-view.tsx` (page d'un artiste Deezer) + `legal.tsx`
- `src/lib/` — `catalog.ts` (types), `featured.ts` (artistes maison), `deezer.ts` (API musique), `store.tsx` (état + algo v2, persisté en AsyncStorage), `audio.ts` (lecture des extraits, expo-audio), `covers.tsx` (pochettes SVG de secours), `i18n.ts` + `strings.ts` + `voice.ts` (FR/EN)
- `src/components/` — `TrackRow`, `MiniPlayer`

> **Pas d'upload d'artiste.** Le modèle « l'artiste publie son fichier » a été
> retiré (11/07/2026) : trop risqué (c'est ce qui a tué la plupart des apps du
> genre). Les nouveaux artistes seront amenés plus tard via une **API
> d'ingestion côté serveur** (Spotify envisagé), pas par upload utilisateur.

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
1. Remplacer les icônes (`assets/images/icon.png`, icônes Android) et le splash screen par le branding Zicmu
2. Vérifier `bundleIdentifier` / `package` dans `app.json` (`com.andytaieb.zicmu`)
3. Préparer captures d'écran + fiche store (App Store Connect / Play Console)

## Étape suivante (V2)

Ingestion des nouveaux artistes côté serveur (API type Spotify) alimentant un
catalogue partagé, plutôt que par upload utilisateur. Comptes optionnels pour
retrouver sa bibliothèque en changeant d'appareil.
