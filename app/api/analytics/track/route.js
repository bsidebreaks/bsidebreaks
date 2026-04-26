import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import {
  describeMongoError,
  isMongoConnectionError,
  trackAnalyticsEvent
} from "../../../../lib/analytics";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();

    await trackAnalyticsEvent({
      session,
      anonymousId: body?.anonymousId,
      event: body?.event,
      request: req
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (isMongoConnectionError(error)) {
      console.warn("ANALYTICS_TRACK_MONGO_ERROR:", describeMongoError(error));
      return Response.json(
        {
          ok: false,
          stored: false,
          reason: describeMongoError(error)
        },
        { status: 202 }
      );
    }

    console.error("ANALYTICS_TRACK_ERROR:", error);
    return Response.json({ error: "Could not track analytics event" }, { status: 400 });
  }
}
