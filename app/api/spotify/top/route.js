import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { getTopArtists, getTopTracks } from "@/lib/spotify";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }

    const accessToken = session.accessToken;

    const [artists, tracks] = await Promise.all([
      getTopArtists(accessToken),
      getTopTracks(accessToken)
    ]);

    // 🔥 LIMPIEZA INTELIGENTE (clave para la IA)
    const genres = new Set();
    const artistNames = [];
    const trackNames = [];

    artists.forEach(artist => {
      artist.genres.forEach(g => genres.add(g));
      artistNames.push(artist.name);
    });

    tracks.forEach(track => {
      trackNames.push(track.name);
    });

    // 🧠 Inferencia básica de mood
    const mood = inferMood(genres, trackNames);

    const musicalDNA = {
      topGenres: Array.from(genres).slice(0, 5),
      topArtists: artistNames.slice(0, 5),
      topTracks: trackNames.slice(0, 5),
      mood
    };

    return Response.json(musicalDNA);

  } catch (error) {
    console.error(error);
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}

// 🔥 Esto es importante para IA (simple pero potente)
function inferMood(genres, tracks) {
  const genresStr = Array.from(genres).join(" ").toLowerCase();

  if (genresStr.includes("techno") || genresStr.includes("house")) {
    return "Energetic / Nightlife";
  }

  if (genresStr.includes("indie") || genresStr.includes("alternative")) {
    return "Chill / Introspective";
  }

  if (genresStr.includes("latin") || genresStr.includes("reggaeton")) {
    return "Party / Tropical";
  }

  return "Balanced / Eclectic";
}