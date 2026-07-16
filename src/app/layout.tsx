import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/toaster";
import { SessionProviderWrapper } from "@/components/auth/session-provider";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Glimpse — a random glimpse of someone new",
    template: "%s · Glimpse",
  },
  description:
    "Video, audio and text chat with strangers or friends, plus persistent chatrooms. Discover people who share your interests.",
  applicationName: "Glimpse",
  openGraph: {
    type: "website",
    siteName: "Glimpse",
    title: "Glimpse — a random glimpse of someone new",
    description:
      "Video, audio and text chat with strangers or friends, plus persistent chatrooms. Discover people who share your interests.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary",
    title: "Glimpse — a random glimpse of someone new",
    description:
      "Video, audio and text chat with strangers or friends, plus persistent chatrooms.",
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500&f[]=chillax@500&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col bg-void text-ink">
        <SessionProviderWrapper>
          {children}
          <Toaster />
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
