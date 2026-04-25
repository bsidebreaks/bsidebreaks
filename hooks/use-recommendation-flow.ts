"use client";

import type { Recommendation } from "@/lib/trip-recommendation";
import { startSpotifyClientSignIn } from "@/lib/spotify-client-signin";
import { tryShareOrCopyTrip } from "@/lib/share-trip";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export function useRecommendationFlow() {
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken;
  const spotifyReady =
    status === "authenticated" && Boolean(session) && Boolean(accessToken);
  const sessionPending = status === "loading";
  const hasSessionNoSpotify =
    status === "authenticated" && Boolean(session) && !accessToken;

  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const [recSlide, setRecSlide] = useState(0);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [shareHint, setShareHint] = useState<"idle" | "copied" | "shared">(
    "idle"
  );
  const shareHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runRecommendations = useCallback(async () => {
    setError(null);
    setLoading(true);
    setRecommendations([]);
    try {
      const recRes = await fetch("/api/recommendations", {
        method: "POST",
        credentials: "include",
      });
      if (recRes.status === 401) {
        if (!cancelledRef.current) await signOut({ callbackUrl: "/" });
        return;
      }
      const body = await recRes.text();
      let data: {
        recommendations?: Recommendation[];
        error?: string;
        detail?: string;
      } = {};
      if (body) {
        try {
          data = JSON.parse(body) as typeof data;
        } catch {
          // Server returned non-JSON (e.g. proxy 502); still show a useful message
        }
      }
      if (!recRes.ok) {
        const message =
          (typeof data.error === "string" && data.error) ||
          (typeof data.detail === "string" && data.detail) ||
          (body && body.length < 500 ? body : "Generation failed");
        throw new Error(message);
      }
      if (!cancelledRef.current) {
        const recs = data.recommendations;
        setRecommendations(Array.isArray(recs) ? recs : []);
      }
    } catch (e) {
      if (!cancelledRef.current) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useLayoutEffect(() => {
    if (
      status === "authenticated" &&
      accessToken &&
      session &&
      recommendations.length === 0 &&
      !error
    ) {
      setLoading(true);
    }
  }, [status, accessToken, session, recommendations.length, error]);

  useEffect(() => {
    if (status === "unauthenticated") {
      setRecommendations([]);
      setError(null);
      return;
    }
    if (status === "authenticated" && !accessToken) {
      setLoading(false);
      setRecommendations([]);
    }
  }, [status, accessToken]);

  useEffect(() => {
    if (status !== "authenticated" || !session || !accessToken) return;
    cancelledRef.current = false;
    void runRecommendations();
    return () => {
      cancelledRef.current = true;
    };
  }, [status, session, accessToken, runRecommendations]);

  useEffect(() => {
    setRecSlide(0);
    setExpandedIndex((i) => {
      if (i === null) return null;
      if (recommendations.length === 0) return null;
      return i < recommendations.length && i >= 0 ? i : null;
    });
  }, [recommendations]);

  useEffect(() => {
    setShareHint("idle");
  }, [expandedIndex]);

  useEffect(() => {
    if (expandedIndex === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedIndex(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [expandedIndex]);

  useEffect(
    () => () => {
      if (shareHintTimer.current) clearTimeout(shareHintTimer.current);
    },
    []
  );

  function flashShare(h: "copied" | "shared") {
    if (shareHintTimer.current) clearTimeout(shareHintTimer.current);
    setShareHint(h);
    shareHintTimer.current = setTimeout(() => {
      setShareHint("idle");
      shareHintTimer.current = null;
    }, 2000);
  }

  async function loginWithSpotify() {
    setAuthError(null);
    setAuthBusy(true);
    try {
      await startSpotifyClientSignIn();
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function shareTrip(r: Recommendation) {
    const result = await tryShareOrCopyTrip(r);
    if (result === "none") setShareHint("idle");
    else flashShare(result);
  }

  const openTrip =
    expandedIndex !== null ? recommendations[expandedIndex] : undefined;

  return {
    sessionPending,
    spotifyReady,
    hasSessionNoSpotify,
    authBusy,
    authError,
    loading,
    recommendations,
    error,
    recSlide,
    setRecSlide,
    expandedIndex,
    setExpandedIndex,
    shareHint,
    runRecommendations,
    loginWithSpotify,
    shareTrip,
    openTrip,
  };
}
