// app/layout.tsx
import { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "next-themes";
import IrisPalette from "@/components/IrisPalette";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Mike Veson",
  description: "Personal Portfolio",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
    other: [
      {
        rel: "manifest",
        url: "/site.webmanifest",
      },
    ],
  },
  openGraph: {
    title: "Mike Veson",
    description: "Personal Portfolio showcasing projects and work.",
    url: "https://mikeveson.com",
    siteName: "Mike Veson",
    images: [
      {
        url: "https://mikeveson.com/og-image.png", // Change to your preferred image
        width: 1200,
        height: 630,
        alt: "Mike Veson's Portfolio",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mike Veson",
    description: "Personal Portfolio showcasing projects and work.",
    images: ["https://mikeveson.com/og-image.png"], // Same as Open Graph image
  },
};

// Viewport configuration for mobile browser theme colors
// Moved from metadata as per Next.js 15 requirements
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f172a" }, // slate-900 for light mode
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" }, // slate-900 for dark mode
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark">
          {children}
          <IrisPalette />
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
