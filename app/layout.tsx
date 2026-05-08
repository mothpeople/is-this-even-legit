import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// This metadata object controls what shows up in Google Search, browser tabs, 
// and link previews on WhatsApp, iMessage, Twitter, LinkedIn, etc.
export const metadata: Metadata = {
  title: "Is This Even Legit? | AI Scam Detector",
  description: "The Zero-Trust AI Scam Detector for Job Seekers. Paste job descriptions, emails, or screenshots to instantly check for red flags.",
  
  // Open Graph is used by Facebook, LinkedIn, WhatsApp, etc.
  openGraph: {
    title: "Is This Even Legit? 🤔",
    description: "Scan job postings and recruiter emails instantly for scams using AI.",
    url: "https://isthisevenlegit.com", // You can update this to your actual domain later
    siteName: "Is This Even Legit?",
    images: [
      {
        url: "/icon-512x512.png", // Uses the large PWA icon you uploaded earlier
        width: 512,
        height: 512,
        alt: "Is This Even Legit Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  
  // Twitter card specific metadata
  twitter: {
    card: "summary",
    title: "Is This Even Legit? 🤔",
    description: "The Zero-Trust AI Scam Detector for Job Seekers.",
    images: ["/icon-512x512.png"],
  },

  // PWA (Progressive Web App) metadata for when users save to home screen
  manifest: '/manifest.json',
  themeColor: '#fbf9ff',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'LegitScan',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}