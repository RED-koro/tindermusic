/* Catalogue partagé (Supabase) — la brique qui rend les titres publiés par un
   artiste visibles par TOUS les utilisateurs, pas juste sur son téléphone.
   Tout est tolérant à la panne : si le backend est injoignable, l'app retombe
   sur le catalogue Deezer + local sans casser. */

import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { hashCode, SCENES, Track } from "./catalog";
import { ensureSession, supabase, supabaseReady } from "./supabase";

export { supabaseReady as cloudReady };

interface CloudRow {
  id: string;
  artist: string;
  title: string;
  genres: string[];
  description: string;
  preview_start: number;
  audio_path: string;
  cover_path: string | null;
  owner: string;
  status: string;
}

/** Lit un fichier local (ou data-URI web) en octets, pour l'upload. */
async function readBytes(uri: string): Promise<Uint8Array> {
  if (uri.startsWith("data:")) {
    return b64ToBytes(uri.split(",")[1] ?? "");
  }
  if (Platform.OS === "web") {
    const r = await fetch(uri);
    return new Uint8Array(await r.arrayBuffer());
  }
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
  return b64ToBytes(b64);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function publicUrl(bucket: string, path: string | null): string | null {
  if (!supabase || !path) return null;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Transforme une ligne de la base en piste jouable dans l'app. */
export function rowToTrack(row: CloudRow): Track {
  const seed = hashCode(row.id);
  return {
    id: `cloud-${row.id}`,
    title: row.title,
    artist: row.artist,
    genres: row.genres.length ? row.genres : ["Indépendant"],
    scene: SCENES[seed % SCENES.length],
    hue: seed % 360,
    hue2: (seed * 7) % 360,
    custom: true, // affiché comme un titre d'artiste (dos de carte, lecture du fichier)
    cloud: true,
    description: row.description,
    previewStart: row.preview_start,
    audioUri: publicUrl("audio", row.audio_path) ?? undefined,
    coverUri: publicUrl("covers", row.cover_path),
    cloudAudioPath: row.audio_path,
    cloudCoverPath: row.cover_path,
    owner: row.owner,
  };
}

const cloudId = (trackId: string) => trackId.replace(/^cloud-/, "");

export interface PublishInput {
  artist: string;
  title: string;
  genres: string[];
  description: string;
  previewStart: number;
  audioUri: string;
  audioName: string;
  coverUri: string | null;
}

/** Publie un titre dans le cloud : upload audio (+ pochette) puis insertion.
    Renvoie la piste créée, ou lève une erreur. */
export async function publishToCloud(input: PublishInput): Promise<Track> {
  if (!supabase) throw new Error("cloud-off");
  const uid = await ensureSession();
  if (!uid) throw new Error("no-session");

  const ext = (input.audioName.split(".").pop() || "mp3").toLowerCase();
  const stamp = Date.now();
  const audioPath = `${uid}/${stamp}.${ext}`;
  const audioBytes = await readBytes(input.audioUri);
  const upA = await supabase.storage
    .from("audio")
    .upload(audioPath, audioBytes, { contentType: `audio/${ext === "m4a" ? "mp4" : ext}` });
  if (upA.error) throw upA.error;

  let coverPath: string | null = null;
  if (input.coverUri) {
    coverPath = `${uid}/${stamp}-cover.jpg`;
    const coverBytes = await readBytes(input.coverUri);
    const upC = await supabase.storage
      .from("covers")
      .upload(coverPath, coverBytes, { contentType: "image/jpeg" });
    if (upC.error) coverPath = null; // pochette optionnelle : on n'échoue pas dessus
  }

  const ins = await supabase
    .from("tracks")
    .insert({
      owner: uid,
      artist: input.artist,
      title: input.title,
      genres: input.genres,
      description: input.description,
      preview_start: input.previewStart,
      audio_path: audioPath,
      cover_path: coverPath,
      status: "approved", // la modération client a déjà validé ; revue serveur en V2.1
    })
    .select()
    .single();
  if (ins.error) throw ins.error;

  return rowToTrack(ins.data as CloudRow);
}

/** Titres validés visibles par tous (flux Découvrir). */
export async function fetchCloudTracks(limit = 60): Promise<Track[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("tracks")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map(r => rowToTrack(r as CloudRow));
}

/** Les titres publiés par l'utilisateur courant (son espace artiste). */
export async function fetchMyCloudTracks(): Promise<Track[]> {
  if (!supabase) return [];
  const uid = await ensureSession();
  if (!uid) return [];
  const { data, error } = await supabase
    .from("tracks")
    .select("*")
    .eq("owner", uid)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(r => rowToTrack(r as CloudRow));
}

export async function reportCloudTrack(trackId: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.rpc("report_track", { track_id: cloudId(trackId) });
  } catch {
    /* réseau : on ignore, le masquage local a déjà eu lieu */
  }
}

export async function deleteCloudTrack(track: Track): Promise<void> {
  if (!supabase) return;
  await supabase.from("tracks").delete().eq("id", cloudId(track.id));
  const paths: string[] = [];
  if (track.cloudAudioPath) paths.push(track.cloudAudioPath);
  await supabase.storage.from("audio").remove(paths).catch(() => {});
  if (track.cloudCoverPath) {
    await supabase.storage.from("covers").remove([track.cloudCoverPath]).catch(() => {});
  }
}
