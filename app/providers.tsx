"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";

type Props = {
  children: ReactNode;
};

export function Providers({ children }: Props) {
  return (
    <SessionProvider>
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
    </SessionProvider>
  );
}