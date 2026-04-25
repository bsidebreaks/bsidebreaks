import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { getTopArtists, getTopTracks } from "../../../lib/spotify";

export async function GET() {
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

    const genres = new Set();
    const artistNames = [];
    const trackNames = [];

    artists.forEach(artist => {
      if (artist?.genres && Array.isArray(artist.genres)) {
        artist.genres.forEach(g => genres.add(g));
      }

      if (artist?.name) {
        artistNames.push(artist.name);
      }
    });

    tracks.forEach(track => {
      if (track?.name) {
        trackNames.push(track.name);
      }
    });

    const musicalDNA = {
      topGenres: Array.from(genres).slice(0, 5),
      topArtists: artistNames.slice(0, 5),
      topTracks: trackNames.slice(0, 5),
      mood: "auto-detected"
    };

    return Response.json(musicalDNA);

  } catch (error) {
    console.error(error);
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}