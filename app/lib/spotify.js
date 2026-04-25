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

export async function getUserProfile(accessToken) {
  const res = await axios.get(`https://api.spotify.com/v1/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  return res.data;
}