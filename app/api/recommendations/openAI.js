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

    if (!musicalDNA || !musicalDNA.topArtists?.length) {
      return Response.json({ error: "Invalid musical DNA" }, { status: 400 });
    }

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 8000);

    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 800
          }
        })
      }
    );

    const data = await aiResponse.json();

    // 🔥 IMPORTANTÍSIMO: parsear output
    let parsed;
    try {
      parsed = JSON.parse(data.choices[0].message.content);
    } catch (e) {
      console.error("Error parsing AI response", data);
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

Return a JSON object with this exact structure:

{
  "recommendations": [
    {
      "destination": "City, Country",
      "event_name": "Event or music scene",
      "category": "Budget Nomad | Maverick | Pure Experience",
      "cost_index": 1-5,
      "spotify_playlist_vibe": "Music vibe",
      "reasoning": "Why it matches"
    }
  ]
}

Rules:
- Exactly 3 recommendations
- Each in a different country
- No extra text
`;
}