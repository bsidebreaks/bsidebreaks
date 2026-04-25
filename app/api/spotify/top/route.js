import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { getMusicalDNA } from "../../../lib/spotify";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }

    const musicalDNA = await getMusicalDNA(session.accessToken);

    return Response.json(musicalDNA);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}
