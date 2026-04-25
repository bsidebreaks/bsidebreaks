import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { getTopArtists, getTopTracks, getUserProfile } from "../../../lib/spotify";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }

    const accessToken = session.accessToken;

    const [artists, tracks, user] = await Promise.all([
      getTopArtists(accessToken),
      getTopTracks(accessToken),
      getUserProfile(accessToken)
    ]);

    // 👤 USER
    const userProfile = {
      name: user.display_name,
      followers: user.followers?.total || 0,
      image: user.images?.[0]?.url || null,
      profileUrl: user.external_urls?.spotify,
      country: user.country,
      product: user.product
    };

    // 🧠 DATA
    const genres = new Set();
    const trackNames = [];
    const artistData = [];

    // 🎤 ARTISTS
    artists.forEach(artist => {
      if (!artist) return;

      // géneros
      if (artist.genres && Array.isArray(artist.genres)) {
        artist.genres.forEach(g => genres.add(g));
      }

      // artista completo (con link incluido)
      artistData.push({
        name: artist.name,
        url: artist.external_urls?.spotify,
        image: artist.images?.[0]?.url || null,
        followers: artist.followers?.total,
        popularity: artist.popularity
      });
    });

    // 🎧 TRACKS
    tracks.forEach(track => {
      if (track?.name) {
        trackNames.push(track.name);
      }
    });

    // 🧬 FINAL JSON
    const musicalDNA = {
      user: userProfile,
      topGenres: Array.from(genres).slice(0, 5),
      topArtists: artistData.slice(0, 5),   // ✅ AQUÍ el fix clave
      topTracks: trackNames.slice(0, 5),
      mood: "auto-detected"
    };

    return Response.json(musicalDNA);

  } catch (error) {
    console.error(error);
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}