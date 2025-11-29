// app/layout.tsx
import { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { GoogleAnalytics } from "@next/third-parties/google";
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

// Viewport configuration for mobile browser theme colors and zoom prevention
// Moved from metadata as per Next.js 15 requirements
// Professional comment: width=device-width ensures proper mobile rendering
// initial-scale=1 prevents automatic zoom on page load
// maximum-scale=5 allows user zooming for accessibility while preventing excessive zoom
// user-scalable=yes maintains accessibility (users can still zoom if needed)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9fafb" }, // Matches light mode background
    { media: "(prefers-color-scheme: dark)", color: "#111827" }, // Matches dark mode background (gray-900)
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Professional comment: GoogleAnalytics component from @next/third-parties/google
  // handles script deduplication automatically, but we ensure it only renders when
  // the measurement ID is configured to prevent unnecessary renders
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark">
          {children}
          <IrisPalette />
        </ThemeProvider>
        <Analytics />
        {/* Professional comment: GoogleAnalytics component handles script loading and deduplication.
            The @next/third-parties/google package ensures the script only loads once even in React StrictMode */}
        {gaMeasurementId && (
          <GoogleAnalytics gaId={gaMeasurementId} />
        )}
      </body>
    </html>
  );
}
