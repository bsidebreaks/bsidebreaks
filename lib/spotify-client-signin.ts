/** Spotify OAuth: CSRF + POST signin, then follow redirect. Run in browser only. */
export async function startSpotifyClientSignIn(): Promise<void> {
  const csrfRes = await fetch("/api/auth/csrf", { cache: "no-store" });
  if (!csrfRes.ok) throw new Error("Could not start sign-in (CSRF).");
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const res = await fetch("/api/auth/signin/spotify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    credentials: "include",
    redirect: "manual",
    body: new URLSearchParams({
      csrfToken,
      callbackUrl: `${window.location.origin}/`,
      json: "true",
    }),
  });

  if ([301, 302, 303, 307, 308].includes(res.status)) {
    const loc = res.headers.get("Location");
    if (!loc) throw new Error("Sign-in returned a redirect with no location.");
    const nextUrl = new URL(loc, window.location.origin).href;
    if (nextUrl.includes("csrf=true") || nextUrl.includes("/api/auth/error")) {
      throw new Error(
        "CSRF or auth config failed. Set NEXTAUTH_SECRET and NEXTAUTH_URL, restart the dev server."
      );
    }
    window.location.assign(nextUrl);
    return;
  }

  if (res.ok) {
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.assign(data.url);
        return;
      }
      if (data.error) throw new Error(data.error);
    }
  } else {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `Sign-in failed (${res.status})`);
  }
  throw new Error(
    "Unexpected sign-in response. Check NEXTAUTH_URL vs the current URL."
  );
}
