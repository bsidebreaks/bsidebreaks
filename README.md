# B-Side Breaks

B-Side Breaks is a marketing product that connects Spotify listening behavior with live-event discovery and travel intent. The app behaves like a fusion of Spotify, Skyscanner, and Ticketmaster:

- Spotify provides the user taste signal.
- Ticketmaster provides real live events that match the inferred music scene.
- Skyscanner receives high-intent travel traffic through generated flight-search links.
- MongoDB stores behavioral analytics, recommendation history, artist exposure, and AI-generated marketing insights.

The product is designed as a consumer-facing recommendation experience plus an internal analytics dashboard for partner marketing teams.

## Core Idea

The user logs in with Spotify. The app reads their top artists, tracks, genres, and profile metadata. An AI agent turns that musical DNA into music scenes and event-search instructions. Ticketmaster is queried for live events in relevant markets. The app returns up to three travel/event recommendations and links the user to:

- the live event on Ticketmaster
- a flight search on Skyscanner
- sharing actions that amplify the trip recommendation

Behind the scenes, the app tracks behavior such as page views, clicks, screen time, generated recommendations, shown artists, and AI insights. This creates a marketing intelligence layer for the three partners.

## Partner Value

### Spotify

Spotify benefits because listening history becomes an actionable discovery signal. The app demonstrates how Spotify taste data can power lifestyle and travel recommendations.

Main marketing signals:

- top artists
- top genres
- taste profile
- inferred music scenes
- user engagement after music-based personalization

### Ticketmaster

Ticketmaster benefits because the app sends motivated users to specific live events. The recommendations are not generic: they are matched to the user's music profile and presented as part of a destination plan.

Main marketing signals:

- event click intent
- recommended event impressions
- artist impressions
- category performance
- city/event combinations

### Skyscanner

Skyscanner benefits because each recommendation turns a concert into a possible city break. The product generates flight-search links for the destination city, creating qualified travel intent.

Main marketing signals:

- destination interest
- flight-search clicks
- city demand by music segment
- comparison between event intent and travel intent

## Tech Stack

- Next.js App Router
- React 19
- NextAuth with Spotify OAuth
- Spotify Web API
- Ticketmaster Discovery API
- Google GenAI / Gemini-compatible model
- MongoDB Atlas or local MongoDB
- Tailwind CSS and shadcn-style UI primitives
- lucide-react icons

## Main Routes

| Route | Type | Purpose |
| --- | --- | --- |
| `/` | Page | Landing/login screen with Spotify authentication. |
| `/generate` | Page | Main recommendation experience. Fetches Spotify DNA, calls recommendation API, displays trips. |
| `/analisis` | Page | Internal marketing dashboard. Not linked from navigation. Accessed directly by URL. |
| `/canvas` | Page | Legacy/local visual card view for stored recommendations. |
| `/api/auth/[...nextauth]` | API | NextAuth Spotify OAuth handler. |
| `/api/spotify/top` | API | Returns user's musical DNA from Spotify. |
| `/api/recommendations` | API | AI + Ticketmaster recommendation engine. |
| `/api/analytics/track` | API | Stores behavior events in MongoDB. |
| `/api/analytics/summary` | API | Returns dashboard data and generates AI insights. |

## Complete Flow

1. User opens `/`.
2. User logs in with Spotify through NextAuth.
3. After authentication, the app redirects to `/generate`.
4. `/generate` calls `/api/spotify/top`.
5. `/api/spotify/top` reads:
   - Spotify profile
   - top artists
   - top tracks
   - top genres
6. `/generate` sends the musical DNA to `/api/recommendations`.
7. `/api/recommendations` asks the AI agent to infer:
   - core genres
   - adjacent genres
   - music scenes
   - target countries/cities
   - Ticketmaster keywords
8. The API queries Ticketmaster events for those scenes.
9. Events are scored against the Spotify profile and AI taste profile.
10. The app returns up to three trip recommendations:
    - destination
    - event
    - venue
    - date
    - artist
    - Ticketmaster URL
    - Skyscanner flight URL
    - reasoning
11. The frontend displays the cards in a carousel.
12. Behavior is tracked automatically:
    - page views
    - clicks
    - screen time
13. Recommendation snapshots are stored:
    - musical DNA
    - taste profile
    - recommendations
    - shown artists
14. `/analisis` reads MongoDB aggregations and displays:
    - users
    - sessions
    - clicks
    - page views
    - total product time
    - top pages
    - highest-intent clicks
    - partner intent split
    - recommended destinations
    - most recommended artists
    - recent recommendation log
15. The dashboard can generate an AI marketing insight using `POST /api/analytics/summary`.

Important: `/analisis` is excluded from analytics tracking so dashboard usage does not contaminate product behavior metrics.

## Environment Variables

```bash
SPOTIFY_CLIENT_ID="..."
SPOTIFY_CLIENT_SECRET="..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"

TICKETMASTER_API_KEY="..."

GEMINI_API_KEY="..."
GEMINI_MODEL="gemma-4-31b-it"

MONGODB_URI="mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/bsidebreaks?retryWrites=true&w=majority"
MONGODB_DB="bsidebreaks"
```

## Local Commands

```bash
npm install
npm run dev
npm run build
npm run lint
npm run mongo:indexes
```

## Function-Level Breakdown

### Authentication

File: `app/lib/auth.js`

`authOptions`

Configures NextAuth with Spotify. It requests scopes for email/private profile, top listening data, and playlist modification.

Main responsibility:

- set Spotify OAuth provider
- attach `accessToken` to session
- refresh expired Spotify tokens
- expose session errors through `session.error`

`refreshAccessToken(token)`

Refreshes Spotify access tokens using the stored refresh token.

Flow:

1. Sends a `POST` request to `https://accounts.spotify.com/api/token`.
2. Uses Basic auth with Spotify client id/secret.
3. Returns a new token object with:
   - `accessToken`
   - `accessTokenExpires`
   - `refreshToken`
4. If refresh fails, marks the token with `RefreshAccessTokenError`.

### Spotify Data

File: `app/lib/spotify.js`

`getTopArtists(accessToken)`

Calls Spotify `/me/top/artists` and returns the user's top artists.

Key params:

- `limit: 10`
- `time_range: medium_term`

`getTopTracks(accessToken)`

Calls Spotify `/me/top/tracks` and returns the user's top tracks.

`getUserProfile(accessToken)`

Calls Spotify `/me` and returns the user profile.

`getMusicalDNA(accessToken)`

Builds the normalized Spotify profile used by the recommendation system.

Output fields:

- `user`
- `topGenres`
- `topArtists`
- `topTracks`
- `mood`

This function combines profile, artists, and tracks in parallel, then extracts a compact taste profile for the AI agent.

### Ticketmaster Search

File: `app/lib/spotify.js`

`searchTicketmasterEventsForScenes(scenes)`

Searches Ticketmaster events based on AI-generated scenes.

Main steps:

1. Reads `TICKETMASTER_API_KEY`.
2. Converts music scenes into keyword/country searches.
3. Calls Ticketmaster Discovery API.
4. Normalizes events.
5. Deduplicates by event id.

`buildTicketmasterSceneSearches(scenes)`

Turns scenes into individual searches. For example, one scene can become several searches by combining:

- Ticketmaster keywords
- country codes
- fallback null country search

`normalizeTicketmasterEvent(event, search)`

Converts raw Ticketmaster events into the app's internal event shape.

Normalized fields:

- `id`
- `name`
- `url`
- `image`
- `date`
- `time`
- `scene`
- `matchedKeyword`
- `artists`
- `venue`

`getTicketmasterAttractionsForArtists(artists)`

Legacy/helper function that searches Ticketmaster attractions directly from artist names and optionally fetches events for the matched attraction.

### Spotify Top API

File: `app/api/spotify/top/route.js`

`GET()`

Server endpoint that returns `musicalDNA`.

Flow:

1. Reads server session.
2. Rejects if unauthenticated or Spotify token refresh failed.
3. Calls `getMusicalDNA(session.accessToken)`.
4. Returns `{ musicalDNA }`.

### Recommendation API

File: `app/api/recommendations/route.js`

`POST(req)`

Main recommendation endpoint.

Input:

- `musicalDNA`
- `excludedEventIds`

Flow:

1. Validates session.
2. Validates musical DNA.
3. Builds or retrieves AI taste profile.
4. Searches Ticketmaster events.
5. Applies fallback searches if not enough events exist.
6. Filters already-seen events when possible.
7. Scores events and builds recommendations.
8. Stores recommendation analytics asynchronously.
9. Returns recommendation cards.

`generateTasteProfile(musicalDNA, options)`

Builds a taste profile using the AI agent. Falls back to local heuristics when:

- AI is skipped
- Gemini key is missing
- AI times out
- AI returns an invalid response

`buildTasteProfilePrompt(dna)`

Creates the prompt used by the AI agent. It asks for compact JSON containing:

- `coreGenres`
- `adjacentGenres`
- `musicScenes`
- `fallbackMusicScenes`

`generateJson(prompt, maxOutputTokens)`

Calls Google GenAI and expects JSON output. Includes retry behavior for transient AI errors.

`normalizeTasteProfile(profile)`

Normalizes different possible AI response key names into a stable internal format.

`buildLocalTasteProfile(dna)`

Creates a non-AI fallback profile from Spotify artists and genres.

`buildFallbackTasteProfile(dna, tasteProfile)`

Creates broader backup scenes when the primary AI profile does not produce enough valid events.

`buildLocalFallbackScenes(keywords, markets)`

Builds simple backup Ticketmaster search scenes from known keywords and markets.

`getRelatedDiscoveryKeywords(genreText)`

Maps genre/artist text into related discovery keywords. Examples:

- Punjabi/Bollywood terms -> `punjabi`, `bhangra`, `bollywood`, `desi`
- Latin terms -> `latin`, `reggaeton`, `urbano`
- Electronic terms -> `electronic`, `techno`, `house`
- Hip-hop terms -> `hip hop`, `rap`, `r&b`, `soul`
- Rock terms -> `indie`, `alternative`, `rock`, `punk`

`buildMainRecommendations(dna, tasteProfile, events)`

Creates the final recommendation objects shown to the user.

Each recommendation includes:

- `category`
- `event_id`
- `city`
- `country`
- `event_name`
- `event_url`
- `event_date`
- `venue`
- `discovery_artist`
- `spotify_playlist_vibe`
- `reasoning`
- `flightURL`
- `image`

`selectBestProfileMatches(dna, tasteProfile, events)`

Filters and sorts events by score.

`scoreEventForProfile(event, dna, tasteProfile)`

Scores each Ticketmaster event using:

- top artist text matches
- top genre matches
- AI core genre matches
- AI scene keyword matches
- event metadata availability

`buildFlightURL(originIata, destinationIata)`

Builds a Skyscanner URL from origin and destination IATA codes.

`getIataForCity(city)`

Maps selected city names to IATA codes used for Skyscanner search links.

### Frontend Recommendation Experience

File: `app/generate/page.tsx`

`GeneratePage()`

Main authenticated experience.

Responsibilities:

- guard unauthenticated users
- fetch Spotify DNA
- request recommendations
- show loading progress
- store seen event ids in `sessionStorage`
- display trip cards
- allow retry/regeneration

`generateTrips()`

Client-side orchestration function.

Flow:

1. Calls `/api/spotify/top`.
2. Calls `/api/recommendations`.
3. Preloads hero images.
4. Stores seen event ids.
5. Updates recommendation state.

`TripGenerationStepBars()`

Shows staged progress:

- Taste Discovery
- Genre Matching
- Finding Events
- Tailoring matches

`TripCard()`

Displays each recommendation card with:

- image
- category
- destination
- event name
- reasoning
- date
- venue
- artist
- Ticketmaster button
- Skyscanner button
- share action

`TripDetailsDialog()`

Modal for expanded trip details.

`ShareSheet()`

Bottom sheet for sharing through:

- native share
- copy link
- X
- WhatsApp

### Analytics Tracking

File: `components/analytics/AnalyticsTracker.tsx`

`AnalyticsTracker()`

Global client-side tracker mounted in the root layout.

Tracks:

- `page_view`
- `click`
- `screen_time`

Important behavior:

- stores anonymous id in `localStorage`
- stores session id in `localStorage`
- uses `sendBeacon` for screen time
- uses `fetch(..., keepalive: true)` for normal events
- ignores `/analisis` so dashboard activity does not contaminate product metrics

`getStoredId(key, prefix)`

Returns an existing browser id or creates a new UUID-based id.

`getClickTarget(target)`

Finds nearest clickable element:

- `a`
- `button`
- `[role='button']`

### MongoDB Connection

File: `lib/mongodb.js`

`getMongoClient()`

Creates and reuses a MongoDB client connection. If the connection promise fails, it resets the promise so later requests can retry.

`getDb()`

Returns the configured database.

`isMongoConfigured()`

Checks whether `MONGODB_URI` exists.

### Analytics Storage and Insights

File: `lib/analytics.js`

`ensureAnalyticsIndexes()`

Creates indexes for analytics collections.

Collections:

- `analytics_events`
- `user_sessions`
- `users`
- `ai_insights`
- `recommendation_snapshots`
- `recommendation_artist_stats`

`buildUserIdentity(session, anonymousId)`

Builds the user identity used in analytics.

If Spotify email exists:

```txt
spotify:user@email.com
```

Otherwise:

```txt
anonymous:<anonymousId>
```

`trackAnalyticsEvent({ session, anonymousId, event, request })`

Stores raw and summarized behavior data.

Writes to:

- `analytics_events`
- `user_sessions`
- `users`

Uses:

- `insertOne` for raw events
- `updateOne` with `$inc`, `$set`, `$setOnInsert`, `$addToSet` for session/user summaries

`recordRecommendationSnapshot({ session, musicalDNA, tasteProfile, recommendations })`

Stores the result of every recommendation generation.

Writes to:

- `recommendation_snapshots`
- `recommendation_artist_stats`
- `users`

This is the marketing layer that captures which artists, cities, events, and categories were shown to users.

`buildRecommendationArtistStatUpdates(identity, recommendations, now)`

Builds MongoDB upsert operations that aggregate shown artists per user.

Tracked fields:

- `artist`
- `impressions`
- `eventIds`
- `cities`
- `countries`
- `categories`
- `recentEvents`
- `lastEvent`
- `firstShownAt`
- `lastShownAt`

`getAnalyticsOverview()`

Builds dashboard data from MongoDB.

It aggregates:

- total events
- users
- sessions
- clicks
- page views
- screen time
- top pages
- event type mix
- top clicks
- latest product sessions
- recommended destinations
- most recommended artists
- recent recommendation log
- latest AI insight

It excludes `/analisis` from product metrics.

`generateAnalyticsInsight()`

Calls the AI agent to summarize marketing behavior.

Returns JSON with:

- `summary`
- `opportunities`
- `risks`
- `partnerNotes.spotify`
- `partnerNotes.skyscanner`
- `partnerNotes.ticketmaster`

Stores the result in `ai_insights`.

`describeMongoError(error)`

Converts MongoDB/network/SSL errors into user-friendly dashboard messages.

`isMongoConnectionError(error)`

Detects connection errors so tracking can degrade gracefully with HTTP `202` instead of breaking product usage.

### Analytics API

File: `app/api/analytics/track/route.js`

`POST(req)`

Accepts tracking events from the browser.

Returns:

- `200` when stored
- `202` when MongoDB has a connection issue
- `400` when payload is invalid

File: `app/api/analytics/summary/route.js`

`GET()`

Returns dashboard overview data.

`POST()`

Generates and stores a fresh AI insight.

### Analytics Dashboard

File: `app/analisis/page.tsx`

`AnalisisPage()`

Internal dashboard for partner marketing teams.

Sections:

- headline metrics
- AI agent insight
- partner notes
- highest-intent clicks
- partner intent split
- top pages
- recommended destinations
- most recommended artists
- latest product sessions
- recent recommendation log

`GenerateInsightButton()`

Client component that calls `POST /api/analytics/summary` and refreshes the dashboard.

`BarRow()`

Horizontal CSS bar visualization for click/page metrics.

`VerticalBars()`

Vertical CSS bar visualization for event type mix.

`ResponsiveTable()`

Scrollable table wrapper for smaller screens.

## MongoDB Collections

### `analytics_events`

Append-only event stream.

Stores:

- page views
- clicks
- screen time
- page
- session id
- user key
- viewport
- user agent
- referrer
- created timestamp

### `user_sessions`

Incremental session summary.

Stores:

- session id
- user key
- started time
- last seen time
- pages
- event count
- click count
- page view count
- total duration

### `users`

User-level behavior summary.

Stores:

- Spotify/anonymous user key
- profile fields
- first seen
- last seen
- total events
- total duration
- recommendation runs

### `recommendation_snapshots`

Stores each recommendation run.

Stores:

- user key
- musical DNA
- taste profile
- recommendations
- created timestamp

### `recommendation_artist_stats`

Aggregated artist exposure.

Stores:

- user key
- artist
- impressions
- event ids
- cities
- countries
- categories
- recent events
- last event

### `ai_insights`

AI-generated marketing summaries.

Stores:

- summary
- opportunities
- risks
- partner notes
- created timestamp

## Marketing KPIs

The app can support these KPI views:

- Spotify-to-trip conversion
- top recommended artists
- destination demand by music taste
- Ticketmaster event click-through
- Skyscanner flight-search click-through
- partner intent split
- top product pages
- session duration
- recommendation freshness
- AI-generated strategic opportunities

## Diagrams

### System Context

![System Context](/diagrams/System-Context.png)

### Complete Recommendation Flow

![Complete Recommendation Flow](/diagrams/Complete-Recommendation-Flow.png)

### Analytics and Insight Flow

![Analytics Flow](/diagrams/Analytics-Flow.png)

### MongoDB Data Model

![MongoDB Data Model](/diagrams/mongoDB-Data-Model.png)

## Notes

- The dashboard route is intentionally not linked from the public UI.
- Analytics tracking is designed to degrade gracefully if MongoDB is temporarily unavailable.
- Recommendation generation still works even if analytics storage fails.
- AI generation has local fallbacks where possible.
- The product is mobile-first for the consumer trip flow and desktop-friendly for the internal analytics dashboard.
