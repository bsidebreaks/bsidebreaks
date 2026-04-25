import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getServerSession } from "next-auth";
import { cn } from "@/lib/utils";
import "./globals.css";
import { authOptions } from "./lib/auth";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Spotify travel picks",
  description: "Trip ideas from your Spotify taste",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  return (
    <html
      lang="en"
      className={cn(geistSans.variable, geistMono.variable, "h-full")}
    >
      <body
        className={cn(
          geistSans.className,
          "min-h-full flex flex-col antialiased"
        )}
      >
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
