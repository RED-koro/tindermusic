/* Extraits 30s du catalogue, pré-générés par scripts/generate-previews.mjs
   puis convertis en M4A par scripts/build-previews.sh.
   (Metro exige des require() statiques pour embarquer les assets.) */

export const PREVIEWS: Record<string, number> = {
  "lune-rouge": require("../../assets/previews/lune-rouge.m4a"),
  "avant-laube": require("../../assets/previews/avant-laube.m4a"),
  "oceans": require("../../assets/previews/oceans.m4a"),
  "echoes": require("../../assets/previews/echoes.m4a"),
  "falling": require("../../assets/previews/falling.m4a"),
  "dans-le-noir": require("../../assets/previews/dans-le-noir.m4a"),
  "neon": require("../../assets/previews/neon.m4a"),
  "maree-haute": require("../../assets/previews/maree-haute.m4a"),
  "gravity": require("../../assets/previews/gravity.m4a"),
  "sous-la-pluie": require("../../assets/previews/sous-la-pluie.m4a"),
  "zenith": require("../../assets/previews/zenith.m4a"),
  "ligne-claire": require("../../assets/previews/ligne-claire.m4a"),
  "boreal": require("../../assets/previews/boreal.m4a"),
  "fievre": require("../../assets/previews/fievre.m4a"),
};
