import axios from "axios";

const BASE_URL = "https://api.spotify.com/v1";

export async function getTopArtists(accessToken) {
  const res = await axios.get(`${BASE_URL}/me/top/artists`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    params: {
      limit: 10,
      time_range: "medium_term"
    }
  });

  return res.data.items;
}

export async function getTopTracks(accessToken) {
  const res = await axios.get(`${BASE_URL}/me/top/tracks`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    params: {
      limit: 10,
      time_range: "medium_term"
    }
  });

  return res.data.items;
}

export function buildMusicalDNA(artists, tracks) {
  const genres = new Set();
  const artistNames = [];
  const trackNames = [];
  (artists || []).forEach((artist) => {
    if (artist?.genres && Array.isArray(artist.genres)) {
      artist.genres.forEach((g) => genres.add(g));
    }
    if (artist?.name) artistNames.push(artist.name);
  });
  (tracks || []).forEach((track) => {
    if (track?.name) trackNames.push(track.name);
  });
  return {
    topGenres: Array.from(genres).slice(0, 5),
    topArtists: artistNames.slice(0, 5),
    topTracks: trackNames.slice(0, 5),
    mood: "auto-detected",
  };
}

export async function getMusicalDNA(accessToken) {
  const [artists, tracks] = await Promise.all([
    getTopArtists(accessToken),
    getTopTracks(accessToken),
  ]);
  return buildMusicalDNA(artists, tracks);
}