/* Espace artiste — publier un titre (fichier audio + pochette + description),
   avec modération automatique avant mise en ligne. */

import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
// L'API "nouvelle génération" d'expo-file-system est encore mal typée pour la
// copie de fichiers : on utilise l'API legacy, stable et documentée.
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MiniPlayer } from "../components/MiniPlayer";
import { TrackRow } from "../components/TrackRow";
import { isPlaying, stopPlayback } from "../lib/audio";
import { Track } from "../lib/catalog";
import {
  cloudReady,
  deleteCloudTrack,
  fetchMyCloudTracks,
  publishToCloud,
} from "../lib/cloud";
import {
  checkAudioDuration,
  checkAudioFile,
  checkCover,
  checkText,
  probeAudioDuration,
} from "../lib/moderation";
import { customToTrack, CustomTrackMeta, useStore } from "../lib/store";
import { C } from "../lib/theme";
import { toast } from "../lib/toast";
import { publishToast } from "../lib/voice";

const MAX_AUDIO_BYTES = 150 * 1024 * 1024; // 150 Mo

function fileNameFromUrl(url: string) {
  const cleanUrl = url.split(/[?#]/)[0];
  const lastPart = cleanUrl.split("/").pop();
  return decodeURIComponent(lastPart || "audio.mp3");
}

interface PickedAudio {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string | null;
}

export default function ArtistScreen() {
  const router = useRouter();
  const { state, publish, removeCustom, addCloudTrack, removeCloudTrack } = useStore();

  // « Mes titres publiés » : depuis le cloud si le backend est branché,
  // sinon les titres locaux (mode hors-ligne).
  const [myCloud, setMyCloud] = useState<Track[]>([]);
  const refreshMine = useCallback(() => {
    if (cloudReady) fetchMyCloudTracks().then(setMyCloud).catch(() => {});
  }, []);
  useEffect(() => {
    refreshMine();
  }, [refreshMine]);
  const myTracks: Track[] = cloudReady ? myCloud : state.customs.map(customToTrack);

  const [artist, setArtist] = useState("");
  const [title, setTitle] = useState("");
  const [genres, setGenres] = useState("");
  const [description, setDescription] = useState("");
  const [previewStart, setPreviewStart] = useState("0");
  const [audio, setAudio] = useState<PickedAudio | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [coverDims, setCoverDims] = useState<{ w?: number; h?: number }>({});
  const [charteOk, setCharteOk] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [importingUrl, setImportingUrl] = useState(false);

  const pickAudio = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
        multiple: false,
        base64: Platform.OS === "web",
      });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      if (asset.size && asset.size > MAX_AUDIO_BYTES) {
        toast("Fichier trop lourd (150 Mo max)");
        return;
      }
      // Sur web, asset.base64 est déjà une data-URI complète (readAsDataURL) :
      // ne pas re-préfixer, sinon l'URI est invalide et le son ne se lit pas.
      const base64 = asset.base64;
      const uri =
        Platform.OS === "web" && base64
          ? base64.startsWith("data:")
            ? base64
            : `data:${asset.mimeType ?? "audio/mpeg"};base64,${base64}`
          : asset.uri;
      setAudio({
        uri,
        name: asset.name ?? "audio",
        size: asset.size,
        mimeType: asset.mimeType,
      });
    } catch {
      toast("Place le son dans Fichiers/iCloud Drive puis réessaie");
    }
  };

  /* Import par URL (pratique dans le simulateur iOS : lance
     `python3 -m http.server 8000` dans le dossier du fichier sur le Mac). */
  const importAudioFromUrl = async () => {
    const url = audioUrl.trim();
    if (!url) {
      toast("Colle l'URL locale du fichier audio");
      return;
    }
    if (!FileSystem.cacheDirectory) {
      toast("Import URL indisponible sur cette plateforme");
      return;
    }

    setImportingUrl(true);
    try {
      const dir = FileSystem.cacheDirectory + "audio-imports/";
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(
        () => {}
      );
      const name = fileNameFromUrl(url);
      const targetUri = dir + `${Date.now()}-${name}`;
      const downloaded = await FileSystem.downloadAsync(url, targetUri);
      const info = await FileSystem.getInfoAsync(downloaded.uri);
      if (!info.exists) throw new Error("download-failed");
      if (info.size && info.size > MAX_AUDIO_BYTES) {
        await FileSystem.deleteAsync(downloaded.uri, { idempotent: true });
        toast("Fichier trop lourd (150 Mo max)");
        return;
      }
      setAudio({ uri: downloaded.uri, name, size: info.size });
      toast("Fichier audio importé");
    } catch {
      toast("URL audio inaccessible depuis le simulateur");
    } finally {
      setImportingUrl(false);
    }
  };

  const pickCover = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (res.canceled || !res.assets?.length) return;
    setCoverUri(res.assets[0].uri);
    setCoverDims({ w: res.assets[0].width, h: res.assets[0].height });
  };

  const doPublish = async () => {
    if (!artist.trim() || !title.trim() || !audio) {
      toast("Artiste, titre et fichier audio requis");
      return;
    }
    if (!charteOk) {
      toast("Coche la charte artiste pour publier");
      return;
    }
    setPublishing(true);
    setErrors([]);
    try {
      /* ---- Modération automatique avant toute mise en ligne ---- */
      const start = Math.max(0, Number(previewStart) || 0);
      const reasons: string[] = [
        ...checkText([
          { label: "Nom d'artiste", value: artist },
          { label: "Titre", value: title },
          { label: "Genres", value: genres },
          { label: "Description", value: description },
        ]),
      ];
      const fileIssue = checkAudioFile(audio.name, audio.mimeType);
      if (fileIssue) reasons.push(fileIssue);
      else {
        const duration = await probeAudioDuration(audio.uri);
        reasons.push(...checkAudioDuration(duration, start));
      }
      const coverIssue = coverUri ? checkCover(coverDims.w, coverDims.h) : null;
      if (coverIssue) reasons.push(coverIssue);

      if (reasons.length > 0) {
        setErrors(reasons);
        toast("Publication refusée — voir les motifs");
        return;
      }

      const cleanGenres = genres
        .split(/[,;•]/)
        .map(s => s.trim())
        .filter(Boolean)
        .slice(0, 5);

      /* ---- Publication dans le cloud (visible par tous) ---- */
      if (cloudReady) {
        try {
          const track = await publishToCloud({
            artist: artist.trim(),
            title: title.trim(),
            genres: cleanGenres,
            description: description.trim(),
            previewStart: start,
            audioUri: audio.uri,
            audioName: audio.name,
            coverUri,
          });
          addCloudTrack(track);
          refreshMine();
          toast(publishToast(title.trim()));
          setArtist(""); setTitle(""); setGenres(""); setDescription("");
          setPreviewStart("0"); setAudio(null); setCoverUri(null);
          setCoverDims({}); setCharteOk(false);
        } catch {
          toast("Publication impossible — réessaie dans un instant");
        }
        return;
      }

      /* ---- Mode hors-ligne (pas de backend) : stockage local ---- */
      const id = `custom-${Date.now()}`;
      let audioUri = audio.uri;
      let finalCoverUri = coverUri;

      // Sur mobile, on copie les fichiers dans le dossier de l'app pour
      // qu'ils survivent au nettoyage du cache. (Sur web : URI de session.)
      if (Platform.OS !== "web" && FileSystem.documentDirectory) {
        const dir = FileSystem.documentDirectory + "uploads/";
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(
          () => {}
        );
        const ext = (audio.name.split(".").pop() || "mp3").toLowerCase();
        audioUri = `${dir}${id}.${ext}`;
        await FileSystem.copyAsync({ from: audio.uri, to: audioUri });
        if (coverUri) {
          finalCoverUri = `${dir}${id}-cover.jpg`;
          await FileSystem.copyAsync({ from: coverUri, to: finalCoverUri });
        }
      }

      const meta: CustomTrackMeta = {
        id,
        artist: artist.trim(),
        title: title.trim(),
        genres: cleanGenres,
        description: description.trim(),
        previewStart: start,
        audioUri,
        coverUri: finalCoverUri,
        addedAt: Date.now(),
        // validation automatique passée → en ligne. La V2 (backend) passera
        // par "pending" avec revue humaine/IA avant approbation.
        status: "approved",
        reports: 0,
      };
      publish(meta);

      toast(publishToast(title.trim()));
      setArtist(""); setTitle(""); setGenres(""); setDescription("");
      setPreviewStart("0"); setAudio(null); setCoverUri(null);
      setCoverDims({}); setCharteOk(false);
    } catch {
      toast("Impossible d'enregistrer le titre");
    } finally {
      setPublishing(false);
    }
  };

  const deleteTrack = async (track: Track) => {
    if (isPlaying(track.id)) stopPlayback();

    if (track.cloud) {
      // titre publié dans le cloud : suppression serveur + retrait du deck
      setMyCloud(prev => prev.filter(t => t.id !== track.id));
      removeCloudTrack(track.id);
      await deleteCloudTrack(track).catch(() => {});
      toast(`« ${track.title} » retiré de Tune`);
      return;
    }

    // titre local (mode hors-ligne)
    const meta = state.customs.find(c => c.id === track.id);
    removeCustom(track.id);
    if (Platform.OS !== "web" && meta) {
      FileSystem.deleteAsync(meta.audioUri, { idempotent: true }).catch(() => {});
      if (meta.coverUri)
        FileSystem.deleteAsync(meta.coverUri, { idempotent: true }).catch(() => {});
    }
    toast(`« ${track.title} » retiré de Tune`);
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={C.text} />
        </Pressable>
        <Text style={styles.h1}>Espace artiste</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Balance ton son. S'il passe la vérification, il part direct dans le
            deck des auditeurs — extrait de 30 secondes, comme tout le monde.
          </Text>

          <Field label="Nom d'artiste">
            <TextInput style={styles.input} value={artist} onChangeText={setArtist}
              placeholder="Ex : SOLARIS" placeholderTextColor={C.muted} />
          </Field>

          <Field label="Titre du morceau">
            <TextInput style={styles.input} value={title} onChangeText={setTitle}
              placeholder="Ex : Lune Rouge" placeholderTextColor={C.muted} />
          </Field>

          <Field label="Genres" hint="séparés par des virgules">
            <TextInput style={styles.input} value={genres} onChangeText={setGenres}
              placeholder="Indie, Électro, Français" placeholderTextColor={C.muted} />
          </Field>

          <Field label="Description" hint="optionnelle — s'affiche sur la carte">
            <TextInput
              style={[styles.input, styles.textarea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Ex : Enregistré dans ma chambre un soir d'orage…"
              placeholderTextColor={C.muted}
              multiline
              maxLength={300}
            />
          </Field>

          <Field label="Fichier audio" hint="MP3, WAV, M4A depuis Fichiers/iCloud Drive">
            <Pressable style={styles.picker} onPress={pickAudio}>
              <Ionicons name="musical-note" size={18} color={C.accent} />
              <Text style={styles.pickerText} numberOfLines={1}>
                {audio ? audio.name : "Choisir depuis Fichiers"}
              </Text>
            </Pressable>
          </Field>

          <Field label="Import simulateur" hint="ex : http://localhost:8000/mon-son.m4a">
            <View style={styles.urlImportRow}>
              <TextInput
                style={[styles.input, styles.urlInput]}
                value={audioUrl}
                onChangeText={setAudioUrl}
                placeholder="http://localhost:8000/mon-son.m4a"
                placeholderTextColor={C.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Pressable
                style={[styles.urlImportButton, importingUrl && { opacity: 0.6 }]}
                onPress={importAudioFromUrl}
                disabled={importingUrl}
              >
                <Ionicons name="download-outline" size={18} color="#fff" />
              </Pressable>
            </View>
          </Field>

          <Field label="Pochette" hint="optionnelle — sinon générée automatiquement">
            <Pressable style={styles.picker} onPress={pickCover}>
              <Ionicons name="image-outline" size={18} color={C.accent} />
              <Text style={styles.pickerText} numberOfLines={1}>
                {coverUri ? "Image sélectionnée ✓" : "Choisir une image"}
              </Text>
            </Pressable>
          </Field>

          <Field label="Début de l'extrait" hint="en secondes, ex : 45 pour le refrain">
            <TextInput
              style={styles.input}
              value={previewStart}
              onChangeText={setPreviewStart}
              keyboardType="numeric"
              placeholderTextColor={C.muted}
            />
          </Field>

          <View style={styles.charteBox}>
            <Pressable style={styles.charteRow} onPress={() => setCharteOk(v => !v)}>
              <Ionicons
                name={charteOk ? "checkbox" : "square-outline"}
                size={22}
                color={charteOk ? C.accent : C.muted}
              />
              <Text style={styles.charteTitle}>J'accepte la charte artiste</Text>
            </Pressable>
            <Text style={styles.charteText}>
              • Je détiens tous les droits sur le son et l'image publiés{"\n"}
              • Pas de contenu haineux, sexuel explicite, violent ou illégal{"\n"}
              • Les titres signalés par la communauté sont retirés{"\n"}
              • Chaque publication passe une vérification automatique
            </Text>
          </View>

          <Pressable
            style={[styles.submit, (publishing || !charteOk) && { opacity: 0.5 }]}
            onPress={doPublish}
            disabled={publishing}
          >
            <Text style={styles.submitText}>
              {publishing ? "Vérification…" : "Publier sur Tune"}
            </Text>
          </Pressable>

          {errors.length > 0 && (
            <View style={styles.errorsBox}>
              <Text style={styles.errorsTitle}>Publication refusée :</Text>
              {errors.map((e, i) => (
                <Text key={i} style={styles.errorText}>• {e}</Text>
              ))}
              <Text style={styles.errorsHint}>
                Corrige puis republie. En cas d'abus répétés, le compte artiste
                pourra être suspendu.
              </Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Mes titres publiés</Text>
          {myTracks.length === 0 ? (
            <Text style={styles.empty}>Aucun titre publié pour l'instant.</Text>
          ) : (
            <View style={{ gap: 16 }}>
              {myTracks.map(track => (
                <TrackRow
                  key={track.id}
                  track={track}
                  subtitle={`✓ En ligne • ${track.genres.join(", ")}`}
                  actions={[
                    {
                      icon: "trash-outline",
                      color: C.danger,
                      onPress: () => deleteTrack(track),
                    },
                  ]}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <MiniPlayer queue={myTracks} />
    </SafeAreaView>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.label}>
        {label}
        {hint ? <Text style={styles.hint}>  ({hint})</Text> : null}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  h1: { color: C.text, fontSize: 21, fontWeight: "700" },
  content: { paddingHorizontal: 20, paddingBottom: 110, gap: 15 },
  intro: { color: C.muted, fontSize: 14, lineHeight: 21, marginBottom: 4 },
  label: { color: C.text, fontSize: 14, fontWeight: "600" },
  hint: { color: C.muted, fontWeight: "400", fontSize: 12.5 },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    color: C.text,
    fontSize: 15,
  },
  textarea: { minHeight: 80, textAlignVertical: "top" },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#3a3a4e",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  pickerText: { color: C.muted, fontSize: 13.5, flex: 1 },
  urlImportRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  urlInput: { flex: 1 },
  urlImportButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: C.accent2,
    alignItems: "center",
    justifyContent: "center",
  },
  charteBox: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  charteRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  charteTitle: { color: C.text, fontSize: 14.5, fontWeight: "700" },
  charteText: { color: C.muted, fontSize: 12.5, lineHeight: 19 },
  errorsBox: {
    backgroundColor: "rgba(255,92,122,.08)",
    borderWidth: 1,
    borderColor: "rgba(255,92,122,.4)",
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  errorsTitle: { color: C.danger, fontSize: 14, fontWeight: "700" },
  errorText: { color: C.text, fontSize: 13, lineHeight: 19 },
  errorsHint: { color: C.muted, fontSize: 12, marginTop: 4 },
  submit: {
    marginTop: 6,
    padding: 15,
    borderRadius: 15,
    backgroundColor: C.accent2,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontSize: 15.5, fontWeight: "700" },
  sectionTitle: {
    color: C.muted,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 16,
  },
  empty: { color: C.muted, fontSize: 13.5, textAlign: "center", marginTop: 8 },
});
