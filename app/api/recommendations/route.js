import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { getMusicalDNA } from "../../lib/spotify";

// gemini-2.0-flash is EOL for new API keys; use 2.5+ — override via .env
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json({ error: "Not authorized" }, { status: 401 });
    }

    let musicalDNA;
    try {
      musicalDNA = await getMusicalDNA(session.accessToken);
    } catch (e) {
      if (e && typeof e === "object" && "status" in e && e.status === 401) {
        return Response.json(
          { error: "Spotify access expired or was revoked" },
          { status: 401 }
        );
      }
      throw e;
    }

    const prompt = buildPrompt(musicalDNA);

    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.8,
            // Avoid truncated JSON (parse errors mid-string) for 3 items × long fields
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    const raw = await aiResponse.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      return Response.json(
        { error: "Invalid response from AI (check API key, model, network)" },
        { status: 500 }
      );
    }
    if (!aiResponse.ok) {
      const msg = data?.error?.message || data?.error || `AI request failed (${aiResponse.status})`;
      console.error("Gemini error", aiResponse.status, data);
      return Response.json({ error: String(msg) }, { status: 500 });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error("No text from Gemini:", data);
      return Response.json({ error: "AI returned empty response" }, { status: 500 });
    }

    const cleanText = text.replace(/```json|```/g, "").trim();
    if (!cleanText) {
      return Response.json({ error: "AI returned empty JSON" }, { status: 500 });
    }

    let parsed;
    try {
      parsed = JSON.parse(cleanText);
    } catch (e) {
      console.error("Parse error:", cleanText);
      return Response.json({ error: "AI parsing error" }, { status: 500 });
    }

    const defaultImage =
      "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80";
    if (Array.isArray(parsed.recommendations)) {
      for (const r of parsed.recommendations) {
        if (
          !r.image_url ||
          typeof r.image_url !== "string" ||
          !r.image_url.startsWith("https://")
        ) {
          r.image_url = defaultImage;
        }
      }
    }

    return Response.json(parsed);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}

function buildPrompt(dna) {
  const artists = Array.isArray(dna?.topArtists) ? dna.topArtists : [];
  const tracks = Array.isArray(dna?.topTracks) ? dna.topTracks : [];
  const genres = Array.isArray(dna?.topGenres) ? dna.topGenres : [];
  const mood = dna?.mood ?? "unknown";
  return `
User musical profile:
- Top artists: ${artists.join(", ")}
- Top tracks: ${tracks.join(", ")}
- Genres: ${genres.join(", ")}
- Mood: ${mood}

IMPORTANT:
Return ONLY valid JSON.

FORMAT:

{
  "recommendations": [
    {
      "destination": "City, Country",
      "event_name": "Event or scene",
      "category": "Budget Nomad | Maverick | Pure Experience",
      "cost_index": 1-5,
      "spotify_playlist_vibe": "Music vibe",
      "reasoning": "Why it matches",
      "image_url": "https://…"
    }
  ]
}

RULES:
- Exactly 3 recommendations
- Different countries
- image_url: required. A direct https URL to a landscape photo of that destination, suitable for a card hero. Prefer real, stable URLs you know (e.g. images.unsplash.com/photo-… with auto=format&fit=crop&w=1200&q=80). It must be https and publicly loadable in a browser.
- Keep each string value concise (a few words to one short sentence) so the JSON is complete
`;
}
