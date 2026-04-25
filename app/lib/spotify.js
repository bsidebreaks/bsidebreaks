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

export async function getTicketmasterAttractionsForArtists(artists) {
  const apiKey = process.env.TICKETMASTER_API_KEY;

  if (!apiKey) {
    return {
      configured: false,
      error: "Missing TICKETMASTER_API_KEY in .env.local",
      artists: []
    };
  }

  const artistNames = artists
    .map((artist) => artist?.name)
    .filter(Boolean);

  const results = await Promise.all(
    artistNames.map(async (artistName) => {
      try {
        const res = await axios.get(`${TICKETMASTER_BASE_URL}/attractions.json`, {
          params: {
            apikey: apiKey,
            keyword: artistName,
            size: 5
          }
        });

        const attractions = res.data?._embedded?.attractions || [];
        const attraction = attractions[0];
        const eventData = attraction
          ? await getTicketmasterEventsForAttraction(attraction.id, apiKey)
          : null;

        return {
          artistName,
          found: attractions.length > 0,
          attraction: attraction
            ? {
                id: attraction.id,
                name: attraction.name,
                url: attraction.url,
                genre: attraction.classifications?.[0]?.genre?.name || "N/A",
                subGenre: attraction.classifications?.[0]?.subGenre?.name || "N/A",
                upcomingEvents: eventData?.upcomingEvents || null,
                events: eventData?.events || []
              }
            : null
        };
      } catch (error) {
        return {
          artistName,
          found: false,
          error: error.response?.data || error.message,
          attractions: []
        };
      }
    })
  );

  return {
    configured: true,
    artists: results
  };
}

export async function searchTicketmasterEventsForScenes(scenes) {
  const apiKey = process.env.TICKETMASTER_API_KEY;

  if (!apiKey) {
    return {
      configured: false,
      error: "Missing TICKETMASTER_API_KEY in .env.local",
      searches: [],
      events: []
    };
  }

  const searches = buildTicketmasterSceneSearches(scenes).slice(0, 8);
  const eventsById = new Map();
  const searchResults = [];

  for (const search of searches) {
    try {
      const res = await axios.get(`${TICKETMASTER_BASE_URL}/events.json`, {
        params: {
          apikey: apiKey,
          keyword: search.keyword,
          countryCode: search.countryCode,
          classificationName: "music",
          size: 5,
          sort: "date,asc"
        }
      });

      const events = res.data?._embedded?.events || [];
      const normalizedEvents = events.map((event) =>
        normalizeTicketmasterEvent(event, search)
      );

      normalizedEvents.forEach((event) => {
        if (!eventsById.has(event.id)) {
          eventsById.set(event.id, event);
        }
      });

      searchResults.push({
        ...search,
        total: res.data?.page?.total || 0,
        events: normalizedEvents
      });
    } catch (error) {
      searchResults.push({
        ...search,
        total: 0,
        error: error.response?.data || error.message,
        events: []
      });
    }
  }

  return {
    configured: true,
    searches: searchResults,
    events: Array.from(eventsById.values())
  };
}

function buildTicketmasterSceneSearches(scenes) {
  if (!Array.isArray(scenes)) {
    return [];
  }

  return scenes.flatMap((scene) => {
    const keywords = scene.ticketmasterKeywords || scene.keywords || [];
    const countryCodes = scene.countryCodes || [];

    return keywords.slice(0, 2).flatMap((keyword) =>
      countryCodes.slice(0, 2).map((countryCode) => ({
        scene: scene.scene || scene.name || "Unknown scene",
        city: scene.city || null,
        country: scene.country || null,
        countryCode,
        keyword,
        reason: scene.reason || scene.matchReason || null
      }))
    );
  });
}

function normalizeTicketmasterEvent(event, search) {
  const venue = event._embedded?.venues?.[0];
  const attractions = event._embedded?.attractions || [];

  return {
    id: event.id,
    name: event.name,
    url: event.url,
    date: event.dates?.start?.localDate || null,
    time: event.dates?.start?.localTime || null,
    timezone: event.dates?.timezone || null,
    scene: search.scene,
    matchedKeyword: search.keyword,
    searchCountryCode: search.countryCode,
    artists: attractions.map((attraction) => ({
      id: attraction.id,
      name: attraction.name,
      url: attraction.url,
      genre: attraction.classifications?.[0]?.genre?.name || null,
      subGenre: attraction.classifications?.[0]?.subGenre?.name || null
    })),
    venue: venue
      ? {
          name: venue.name,
          city: venue.city?.name || null,
          country: venue.country?.name || null,
          countryCode: venue.country?.countryCode || null,
          address: venue.address?.line1 || null,
          latitude: venue.location?.latitude || null,
          longitude: venue.location?.longitude || null
        }
      : null
  };
}

async function getTicketmasterEventsForAttraction(attractionId, apiKey) {
  const res = await axios.get(`${TICKETMASTER_BASE_URL}/events.json`, {
    params: {
      apikey: apiKey,
      attractionId,
      size: 5,
      sort: "date,asc"
    }
  });

  const events = res.data?._embedded?.events || [];

  return {
    upcomingEvents: {
      total: res.data?.page?.total || 0
    },
    events: events.map((event) => {
      const venue = event._embedded?.venues?.[0];

      return {
        id: event.id,
        name: event.name,
        url: event.url,
        date: event.dates?.start?.localDate || null,
        time: event.dates?.start?.localTime || null,
        timezone: event.dates?.timezone || null,
        venue: venue
          ? {
              name: venue.name,
              city: venue.city?.name || null,
              country: venue.country?.name || null,
              countryCode: venue.country?.countryCode || null,
              address: venue.address?.line1 || null,
              latitude: venue.location?.latitude || null,
              longitude: venue.location?.longitude || null
            }
          : null
      };
    })
  };
}
