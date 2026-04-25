import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { musicalDNA } = body;

    const prompt = buildPrompt(musicalDNA);

    const aiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
        method: "POST",
        headers: {
        "Content-Type": "application/json"
        },
        body: JSON.stringify({
        contents: [
            {
            parts: [{ text: prompt }]
            }
        ],
        generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 800
        }
        })
    }
    );

    const data = await aiResponse.json();

    console.log("Gemini RAW:", data);

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
    console.error("No text from Gemini:", data);
    return Response.json({ error: "AI returned empty response" }, { status: 500 });
    }

    // limpiar posibles ```json
    const cleanText = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
    parsed = JSON.parse(cleanText);
    } catch (e) {
    console.error("Parse error:", cleanText);
    return Response.json({ error: "AI parsing error" }, { status: 500 });
    }

    return Response.json(parsed);

  } catch (error) {
    console.error(error);
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}

function buildPrompt(dna) {
  return `
User musical profile:
- Top artists: ${dna.topArtists.join(", ")}
- Top tracks: ${dna.topTracks.join(", ")}
- Genres: ${dna.topGenres.join(", ")}
- Mood: ${dna.mood}

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
      "reasoning": "Why it matches"
    }
  ]
}

RULES:
- Exactly 3 recommendations
- Different countries
`;
}