/* Coquille HTML du site (export web statique) : titre, icônes, mode
   « vraie app » sur l'écran d'accueil, et carte d'aperçu quand le lien
   est partagé (WhatsApp, iMessage, Insta…). */

import { ScrollViewStyleReset } from "expo-router/html";
import React, { type PropsWithChildren } from "react";

const TITLE = "Zicmu — swipe la zicmu";
const DESCRIPTION =
  "Des extraits de 30 secondes, ton pouce décide. Zicmu apprend tes goûts, " +
  "et tes coups de cœur filent dans ta playlist. Rien à installer.";
const URL = "https://zicmu.expo.app";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <meta name="theme-color" content="#08080d" />

        {/* Carte d'aperçu au partage du lien */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Zicmu" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={URL} />
        <meta property="og:image" content={`${URL}/icon-512.png`} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESCRIPTION} />
        <meta name="twitter:image" content={`${URL}/icon-512.png`} />

        {/* « Ajouter à l'écran d'accueil » = vraie app plein écran */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Zicmu" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
