import axios from "axios";

const BASE_URL = "https://api.spotify.com/v1";
const TICKETMASTER_BASE_URL = "https://app.ticketmaster.com/discovery/v2";

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

export async function getUserProfile(accessToken) {
  const res = await axios.get(`https://api.spotify.com/v1/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  return res.data;
}

export async function getMusicalDNA(accessToken) {
  const [artists, tracks, user] = await Promise.all([
    getTopArtists(accessToken),
    getTopTracks(accessToken),
    getUserProfile(accessToken)
  ]);

  const userProfile = {
    name: user.display_name,
    followers: user.followers?.total || 0,
    image: user.images?.[0]?.url || null,
    profileUrl: user.external_urls?.spotify,
    country: user.country,
    product: user.product
  };

  const genres = new Set();
  const trackNames = [];
  const artistData = [];

  artists.forEach((artist) => {
    if (!artist) return;

    if (Array.isArray(artist.genres)) {
      artist.genres.forEach((genre) => genres.add(genre));
    }

    artistData.push({
      name: artist.name,
      url: artist.external_urls?.spotify,
      image: artist.images?.[0]?.url || null,
      followers: artist.followers?.total,
      popularity: artist.popularity
    });
  });

  tracks.forEach((track) => {
    if (track?.name) {
      trackNames.push(track.name);
    }
  });

  return {
    user: userProfile,
    topGenres: Array.from(genres).slice(0, 5),
    topArtists: artistData.slice(0, 5),
    topTracks: trackNames.slice(0, 5),
    mood: "auto-detected"
  };
}

