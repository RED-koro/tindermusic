# Règles du projet Zicmu (mobile) — À LIRE AVANT DE CODER

## ⚠️ SDK Expo 54 — NE PAS METTRE À JOUR

Ce projet est **volontairement** en Expo SDK 54 (react-native 0.81, expo-router 6,
expo-audio 1.x). L'app Expo Go distribuée sur l'App Store / Play Store est gelée
au SDK 54 : tout passage au SDK 55+ rend l'app **intestable sur téléphone**.
Ne monte pas de version d'expo ni de react-native sans demande explicite d'Andy.

Docs versionnées : https://docs.expo.dev/versions/v54.0.0/

## Architecture — NE PAS RESTRUCTURER

- Navigation : **expo-router** (`src/app/` = routes ; `main: "expo-router/entry"`).
  Pas de React Navigation manuel, pas de `App.tsx` racine.
- Audio : **expo-audio** (pas expo-av, déprécié).
- État : `src/lib/store.tsx` (Context + AsyncStorage).
- Musique : 100 % Deezer (charts + artistes maison `featured.ts` + recherche). Pas d'upload d'artiste (retiré le 11/07/2026) ; les nouveaux artistes viendront plus tard via une API d'ingestion côté serveur.
- Extraits du catalogue : assets M4A pré-générés (`scripts/build-previews.sh`).

## Voix éditoriale — NE PAS ASEPTISER

Tous les textes UI passent par la voix de Zicmu (`src/lib/voice.ts`) :
tutoiement, chaleureux, un peu cash, références culture musique, formulations
**variées** (jamais deux fois la même phrase — c'est voulu, c'est humain).
Interdit : les textes génériques type « Ajouté avec succès », « Bienvenue dans
l'application », les emojis en rafale, le ton corporate. En cas de doute,
écris comme un pote qui te fait découvrir un disque.

## Divers

- npm : `.npmrc` du projet impose `legacy-peer-deps` et un cache local (permissions).
- Installer un paquet Expo : `npx expo install <pkg>` (jamais de version à la main).
