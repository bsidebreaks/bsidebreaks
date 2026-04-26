import "./globals.css";
import { Providers } from "./providers";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import AppBackground from "@/components/AppBackground";
import AnalyticsTracker from "@/components/analytics/AnalyticsTracker";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable)}>
      <body suppressHydrationWarning>
        <AppBackground />
        <Providers>
          <AnalyticsTracker />
          {children}
        </Providers>
      </body>
    </html>
  );
}
