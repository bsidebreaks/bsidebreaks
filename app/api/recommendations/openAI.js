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

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
        {
            role: "system",
            content: "You are an API. You ONLY return valid JSON. No explanations, no text."
        },
        {
            role: "user",
            content: prompt
        }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" } // 🔥 CLAVE
    })
    });

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