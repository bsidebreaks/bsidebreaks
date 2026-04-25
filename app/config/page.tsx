"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Poppins } from "next/font/google";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["100","200","300","400","500","600","700","800","900"],
});

export default function ConfigPage() {
  const router = useRouter();
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!range?.from || !range?.to) return;

    setLoading(true);

    router.push(
      `/generate?from=${range.from?.toISOString()}&to=${range.to?.toISOString()}`
    );
  };

  return (
    <div className="backgroundClass">
      {/* same overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/45 via-black/25 to-black/80"
        aria-hidden
      />

      <div className={cn(poppins.className, "relative z-40")}>
        <div
          className={cn(
            "flex min-h-svh w-full max-w-6xl flex-col px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]",
            "mx-auto",
            "gap-0"
          )}
        >
          {/* 🔥 same hero */}
          <div className="space-y-2">
            <p className="text-balance text-[2rem] font-semibold leading-snug tracking-tight text-white">
              Pick your window
            </p>
            <p className="text-pretty text-[clamp(2.25rem,9vw,5rem)] font-bold leading-snug text-white">
              When do you want to go?
            </p>
          </div>

          {/* 🔥 center content (replaces login) */}
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="flex w-full max-w-[min(100%,22rem)] flex-col items-center gap-6">
              
              {/* Calendar */}
              <div className="rounded-2xl bg-black/40 p-3 backdrop-blur-md">
                <Calendar
                  mode="range"
                  selected={range}
                  onSelect={setRange}
                  captionLayout="dropdown"
                  fromYear={2026}
                  toYear={2035}
                  numberOfMonths={6}
                  showOutsideDays
                  fixedWeeks
                  disabled={{ before: new Date() }}
                  className="text-white"
                />
              </div>

              {/* Selected dates */}
              <p className="text-sm text-white/70">
                {range?.from ? (
                  range.to ? (
                    <>
                      {range.from.toLocaleDateString()} →{" "}
                      {range.to.toLocaleDateString()}
                    </>
                  ) : (
                    <>Start: {range.from.toLocaleDateString()}</>
                  )
                ) : (
                  "Pick a date range"
                )}
              </p>

              {/* Generate button */}
              <Button
                onClick={handleGenerate}
                disabled={!range?.from || !range?.to || loading}
                className={cn(
                  "h-12 w-full rounded-2xl text-[15px] font-semibold",
                  "bg-white text-black hover:bg-white/90",
                  "disabled:opacity-60"
                )}
              >
                {loading ? (
                  <>
                    <Spinner className="!size-5" />
                    Generating…
                  </>
                ) : (
                  "Generate trips"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
