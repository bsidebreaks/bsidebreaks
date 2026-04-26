"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const ANON_KEY = "bsidebreaks.analytics.anonymousId";
const SESSION_KEY = "bsidebreaks.analytics.sessionId";
const FLUSH_INTERVAL_MS = 15000;

type AnalyticsEvent = {
  type: string;
  page: string;
  sessionId: string;
  durationMs?: number;
  properties?: Record<string, unknown>;
  locale?: string;
  timezone?: string;
  viewport?: {
    width: number;
    height: number;
  };
};

function getStoredId(key: string, prefix: string) {
  const existing = window.localStorage.getItem(key);

  if (existing) {
    return existing;
  }

  const value = `${prefix}_${crypto.randomUUID()}`;
  window.localStorage.setItem(key, value);
  return value;
}

function getClickTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest("a,button,[role='button']");
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const activeStartedAtRef = useRef(0);
  const lastPageRef = useRef(pathname);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/analisis")) {
      return;
    }

    const anonymousId = getStoredId(ANON_KEY, "anon");
    const sessionId = getStoredId(SESSION_KEY, "session");

    const sendEvent = (event: Omit<AnalyticsEvent, "page" | "sessionId" | "locale" | "timezone" | "viewport">) => {
      const payload = {
        anonymousId,
        event: {
          ...event,
          page: pathname,
          sessionId,
          locale: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        }
      };

      const body = JSON.stringify(payload);

      if (event.type === "screen_time" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/analytics/track", new Blob([body], { type: "application/json" }));
        return;
      }

      void fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true
      }).catch(() => {});
    };

    const flushTime = () => {
      const now = Date.now();
      const durationMs = now - activeStartedAtRef.current;

      if (durationMs < 1000) {
        return;
      }

      activeStartedAtRef.current = now;
      sendEvent({ type: "screen_time", durationMs });
    };

    if (lastPageRef.current !== pathname) {
      flushTime();
      lastPageRef.current = pathname;
    }

    activeStartedAtRef.current = Date.now();
    sendEvent({ type: "page_view", properties: { title: document.title } });

    const onClick = (event: MouseEvent) => {
      const target = getClickTarget(event.target);

      if (!target) {
        return;
      }

      sendEvent({
        type: "click",
        properties: {
          label: (target.textContent || target.getAttribute("aria-label") || "unlabeled").trim().slice(0, 120),
          href: target instanceof HTMLAnchorElement ? target.href : null,
          tag: target.tagName.toLowerCase()
        }
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushTime();
      } else {
        activeStartedAtRef.current = Date.now();
      }
    };

    const interval = window.setInterval(flushTime, FLUSH_INTERVAL_MS);

    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flushTime);

    return () => {
      flushTime();
      window.clearInterval(interval);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flushTime);
    };
  }, [pathname]);

  return null;
}
