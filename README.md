# Zicmu — le Tinder de la musique 🎧

Swipe des extraits de 30 secondes : à droite pour aimer (le titre rejoint ta
bibliothèque), à gauche pour passer, vers le haut pour "à revoir". L'algo
apprend tes goûts par genre et adapte les propositions. Les artistes peuvent
publier leurs propres titres (fichier audio, pochette, description).

## Structure

| Dossier | Rôle |
|---|---|
| `mobile/` | **L'app réelle** — React Native + Expo, publiable sur iOS et Android |
| `prototype-web/` | Le prototype V1 (HTML/CSS/JS), gardé en référence |

## Lancer l'app mobile

```bash
cd mobile
npm install
npx expo start        # scanne le QR code avec l'app Expo Go (iOS/Android)
npx expo start --web  # ou aperçu dans le navigateur
```

## Lancer le prototype web (référence)

```bash
python3 -m http.server 4173 -d prototype-web
# puis ouvrir http://localhost:4173
```

## Publier sur les stores

Voir `mobile/README.md` (EAS Build : comptes Apple Developer / Google Play requis).
