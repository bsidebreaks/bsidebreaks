import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { getMusicalDNA } from "../../../lib/spotify";

export async function GET() {
    var msg = "session"
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.error === "RefreshAccessTokenError") {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }

    const musicalDNA = await getMusicalDNA(session.accessToken);
      msg = "musicalDNA"

    return Response.json({ musicalDNA });
  } catch (error) {
    console.error(error);

    if (error.response?.status === 401) {
      return Response.json(
        { error: "Spotify session expired. Please log in again." },
        { status: 401 }
      );
    }

    return Response.json({ error: msg + " failed" }, { status: 500 });
  }
}
