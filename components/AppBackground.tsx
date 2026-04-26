"use client";

import { usePathname } from "next/navigation";
import BackgroundSlideshow from "@/components/BackgroundSlideshow";

export default function AppBackground() {
  const pathname = usePathname();

  if (pathname?.startsWith("/analisis")) {
    return null;
  }

  return <BackgroundSlideshow />;
}
