import { Activity, Brain, Clock, MousePointerClick, Music2, Plane, Ticket, Users } from "lucide-react";
import { getAnalyticsOverview } from "@/lib/analytics";
import GenerateInsightButton from "@/components/analytics/GenerateInsightButton";

export const dynamic = "force-dynamic";

type AnalyticsOverview = {
  generatedAt: string;
  windowDays: number;
  totals: {
    events: number;
    users: number;
    sessions: number;
    clicks: number;
    pageViews: number;
    totalDurationMs: number;
  };
  eventTypes: Array<{ type: string; count: number }>;
  topPages: Array<{ page: string; views: number; users: number }>;
  topClicks: Array<{ label?: string; href?: string; page?: string; count: number }>;
  recommendations: Array<{ city?: string; country?: string; category?: string; count: number }>;
  topRecommendedArtists: Array<{
    userKey: string;
    artist: string;
    impressions: number;
    lastEvent?: {
      eventName?: string;
      city?: string;
      country?: string;
    };
  }>;
  recentRecommendationLog: Array<{
    userKey: string;
    userName?: string;
    userImage?: string;
    artist?: string;
    eventName?: string;
    reasoning?: string;
    city?: string;
    country?: string;
    createdAt?: string | Date;
  }>;
  sessions: Array<{
    sessionId: string;
    userKey: string;
    lastPage?: string;
    eventCount?: number;
    clickCount?: number;
    totalDurationMs?: number;
  }>;
  aiInsight?: {
    summary?: string;
    opportunities?: string[];
    partnerNotes?: {
      spotify?: string;
      skyscanner?: string;
      ticketmaster?: string;
    };
  } | null;
};

function formatDuration(ms: number) {
  const minutes = Math.round((ms || 0) / 60000);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function pct(value: number, max: number) {
  if (!max) {
    return 0;
  }

  return Math.max(4, Math.round((value / max) * 100));
}

function formatEventType(type: string) {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildPartnerClicks(clicks: AnalyticsOverview["topClicks"]) {
  const partners = [
    { label: "Ticketmaster", matcher: /ticketmaster|view event|tickets/i, count: 0 },
    { label: "Skyscanner", matcher: /skyscanner|find flights|flight/i, count: 0 },
    { label: "Spotify / taste", matcher: /spotify|generate|login|music/i, count: 0 }
  ];

  clicks.forEach((click) => {
    const text = [click.label, click.href, click.page].filter(Boolean).join(" ");
    const partner = partners.find((item) => item.matcher.test(text));

    if (partner) {
      partner.count += click.count;
    }
  });

  return partners;
}

export default async function AnalisisPage() {
  const data = (await getAnalyticsOverview()) as AnalyticsOverview;
  const maxPageViews = Math.max(...data.topPages.map((page) => page.views), 0);
  const maxClickCount = Math.max(...data.topClicks.map((click) => click.count), 0);
  const maxEventTypeCount = Math.max(...data.eventTypes.map((event) => event.count), 0);
  const partnerClicks = buildPartnerClicks(data.topClicks);
  const maxPartnerClicks = Math.max(...partnerClicks.map((partner) => partner.count), 0);
  const insight = data.aiInsight;

  return (
    <main className="min-h-svh bg-white px-3 py-4 text-zinc-950 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 sm:gap-6">
        <header className="flex flex-col gap-3 border-b border-zinc-200 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">B-Side Breaks Marketing Intelligence</p>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">Behavior analytics</h1>
          </div>
          <div className="text-sm text-zinc-500">
            Window: last {data.windowDays} days - {new Date(data.generatedAt).toLocaleString("en-US")}
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric icon={<Users className="size-4" />} label="Users" value={data.totals.users} />
          <Metric icon={<Activity className="size-4" />} label="Sessions" value={data.totals.sessions} />
          <Metric icon={<MousePointerClick className="size-4" />} label="Clicks" value={data.totals.clicks} />
          <Metric icon={<Music2 className="size-4" />} label="Page views" value={data.totals.pageViews} />
          <Metric icon={<Clock className="size-4" />} label="Total time" value={formatDuration(data.totals.totalDurationMs)} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Panel title="AI agent insight" icon={<Brain className="size-5 text-emerald-700" />} action={<GenerateInsightButton />}>
            <p className="text-sm leading-6 text-zinc-600">
              {insight?.summary || "Generate insight :)"}
            </p>
            {!!insight?.opportunities?.length && (
              <div className="mt-5 grid gap-2 md:grid-cols-3">
                {insight.opportunities.slice(0, 3).map((item) => (
                  <div key={item} className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                    {item}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <PartnerNote icon={<Music2 className="size-4" />} label="Spotify" value={insight?.partnerNotes?.spotify || "Music preferences, scenes, and taste profiles."} />
            <PartnerNote icon={<Plane className="size-4" />} label="Skyscanner" value={insight?.partnerNotes?.skyscanner || "Travel intent by destination and flight-search clicks."} />
            <PartnerNote icon={<Ticket className="size-4" />} label="Ticketmaster" value={insight?.partnerNotes?.ticketmaster || "Interest by event, artist, date, and city."} />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr]">
          {/* <Panel title="Event mix">
            {data.eventTypes.length ? (
              <VerticalBars
                bars={data.eventTypes.map((event) => ({
                  label: formatEventType(event.type),
                  value: event.count,
                  height: pct(event.count, maxEventTypeCount)
                }))}
              />
            ) : (
              <EmptyState text="No event mix yet." />
            )}
          </Panel> */}

          <Panel title="Highest-intent clicks">
            <div className="space-y-3">
              {data.topClicks.length ? (
                data.topClicks.map((click) => (
                  <BarRow key={`${click.page}-${click.label}-${click.href}`} label={click.label || click.href || "Unlabeled"} value={`${click.count} clicks`} width={pct(click.count, maxClickCount)} />
                ))
              ) : (
                <EmptyState text="No clicks tracked yet." />
              )}
            </div>
          </Panel>

          <Panel title="Partner intent split">
            <div className="space-y-3">
              {partnerClicks.map((partner) => (
                <BarRow key={partner.label} label={partner.label} value={`${partner.count} clicks`} width={pct(partner.count, maxPartnerClicks)} />
              ))}
            </div>
          </Panel>

          <Panel title="Top pages">
            <div className="space-y-3">
              {data.topPages.length ? (
                data.topPages.map((page) => (
                  <BarRow key={page.page} label={page.page} value={`${page.views} views - ${page.users} users`} width={pct(page.views, maxPageViews)} />
                ))
              ) : (
                <EmptyState text="No page views yet." />
              )}
            </div>
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_2fr]">
          <Panel title="Recommended destinations">
            <div className="space-y-2">
              {data.recommendations.length ? (
                data.recommendations.map((item) => (
                  <ListRow key={`${item.city}-${item.country}-${item.category}`} label={[item.city, item.country].filter(Boolean).join(", ") || "Unknown destination"} value={item.count} />
                ))
              ) : (
                <EmptyState text="No recommendation snapshots yet." />
              )}
            </div>
          </Panel>

          <Panel title="Most recommended artists">
            <div className="space-y-3">
              {data.topRecommendedArtists.length ? (
                data.topRecommendedArtists.map((item) => (
                  <div key={`${item.userKey}-${item.artist}`} className="rounded-md bg-zinc-50 px-3 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium text-zinc-950">{item.artist}</span>
                      <span className="shrink-0 rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-800">{item.impressions} shows</span>
                    </div>
                    <div className="mt-1 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                      <span className="max-w-full truncate">{item.userKey}</span>
                      {item.lastEvent?.eventName && <span className="max-w-full truncate">{item.lastEvent.eventName}</span>}
                      {item.lastEvent?.city && <span>{[item.lastEvent.city, item.lastEvent.country].filter(Boolean).join(", ")}</span>}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState text="No recommended artists saved yet." />
              )}
            </div>
          </Panel>
        </section>

        {/* <section className="grid gap-4 lg:grid-cols-[0.9fr_0.5fr]">


          <Panel title="Event mix">
            {data.eventTypes.length ? (
              <VerticalBars
                bars={data.eventTypes.map((event) => ({
                  label: formatEventType(event.type),
                  value: event.count,
                  height: pct(event.count, maxEventTypeCount)
                }))}
              />
            ) : (
              <EmptyState text="No event mix yet." />
            )}
          </Panel>
        </section> */}



        <section className="grid gap-4 lg:grid-cols">
          <Panel title="Latest product sessions">
            <ResponsiveTable minWidth="560px">
              <thead className="text-xs uppercase text-zinc-500">
                <tr>
                  <th className="pb-3 font-medium">User</th>
                  <th className="pb-3 font-medium">Last page</th>
                  <th className="pb-3 font-medium">Events</th>
                  <th className="pb-3 font-medium">Clicks</th>
                  <th className="pb-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                {data.sessions.map((session) => (
                  <tr key={session.sessionId}>
                    <td className="py-3 pr-4">{session.userKey}</td>
                    <td className="py-3 pr-4">{session.lastPage || "-"}</td>
                    <td className="py-3 pr-4">{session.eventCount || 0}</td>
                    <td className="py-3 pr-4">{session.clickCount || 0}</td>
                    <td className="py-3">{formatDuration(session.totalDurationMs || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </ResponsiveTable>
            {!data.sessions.length && <EmptyState text="No product sessions yet." />}
          </Panel>
          
          <Panel title="Recent recommendation log">
            <ResponsiveTable minWidth="860px">
              <thead className="text-xs uppercase text-zinc-500">
                <tr>
                  <th className="pb-3 font-medium">User</th>
                  <th className="pb-3 font-medium">Artist</th>
                  <th className="pb-3 font-medium">Event</th>
                  <th className="pb-3 font-medium">Reasoning</th>
                  <th className="pb-3 font-medium">Destination</th>
                  <th className="pb-3 font-medium">Logged at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                {data.recentRecommendationLog.map((item) => (
                  <tr key={`${item.userKey}-${item.artist}-${item.eventName}-${String(item.createdAt)}`}>
                    <td className="py-3 pr-4">
                      <div className="flex min-w-0 items-center gap-2">
                        {item.userImage ? (
                          <img src={item.userImage} alt="" className="size-7 shrink-0 rounded-full object-cover" />
                        ) : (
                          <span className="size-7 shrink-0 rounded-full bg-zinc-200" aria-hidden />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-zinc-950">{item.userName || "Unknown user"}</p>
                          <p className="truncate text-xs text-zinc-500">{item.userKey}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 font-medium text-zinc-950">{item.artist || "-"}</td>
                    <td className="py-3 pr-4">{item.eventName || "-"}</td>
                    <td className="max-w-72 py-3 pr-4 text-sm text-zinc-600">{item.reasoning || "-"}</td>
                    <td className="py-3 pr-4">{[item.city, item.country].filter(Boolean).join(", ") || "-"}</td>
                    <td className="py-3">{item.createdAt ? new Date(item.createdAt).toLocaleString("en-US") : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </ResponsiveTable>
            {!data.recentRecommendationLog.length && <EmptyState text="No recent recommendations yet." />}
          </Panel>

        </section>
      </div>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-zinc-500">
        {icon}
        <span className="text-xs font-medium uppercase">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-zinc-950">{value}</div>
    </div>
  );
}

function Panel({
  title,
  children,
  icon,
  action
}: {
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function BarRow({ label, value, width }: { label: string; value: string; width: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="truncate text-zinc-700">{label}</span>
        <span className="shrink-0 text-zinc-500">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-100">
        <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function VerticalBars({ bars }: { bars: Array<{ label: string; value: number; height: number }> }) {
  return (
    <div className="flex h-56 items-end gap-3 overflow-x-auto border-b border-zinc-200 px-1 pb-2">
      {bars.map((bar) => (
        <div key={bar.label} className="flex min-w-20 flex-1 flex-col items-center justify-end gap-2">
          <span className="text-sm font-semibold text-zinc-950">{bar.value}</span>
          <div className="flex h-36 w-full items-end rounded-t-md bg-zinc-100">
            <div
              className="w-full rounded-t-md bg-emerald-600"
              style={{ height: `${bar.height}%` }}
              aria-label={`${bar.label}: ${bar.value}`}
            />
          </div>
          <span className="w-full truncate text-center text-xs text-zinc-500" title={bar.label}>
            {bar.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function ListRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2 text-sm">
      <span className="truncate text-zinc-700">{label}</span>
      <span className="shrink-0 text-zinc-500">{value}</span>
    </div>
  );
}

function PartnerNote({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-emerald-700">
        {icon}
        <span className="text-sm font-semibold text-zinc-950">{label}</span>
      </div>
      <p className="text-sm leading-5 text-zinc-600">{value}</p>
    </div>
  );
}

function ResponsiveTable({ children, minWidth }: { children: React.ReactNode; minWidth: string }) {
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed border-zinc-200 px-3 py-6 text-center text-sm text-zinc-500">{text}</p>;
}
