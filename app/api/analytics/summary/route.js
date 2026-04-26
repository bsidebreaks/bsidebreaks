import { generateAnalyticsInsight, getAnalyticsOverview } from "../../../../lib/analytics";

export async function GET() {
  try {
    const overview = await getAnalyticsOverview();
    return Response.json(overview);
  } catch (error) {
    console.error("ANALYTICS_SUMMARY_ERROR:", error);
    return Response.json({ error: "Could not load analytics summary" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await generateAnalyticsInsight();
    return Response.json(result);
  } catch (error) {
    console.error("ANALYTICS_AGENT_ERROR:", error);
    return Response.json({ error: "Could not generate analytics insight" }, { status: 500 });
  }
}
