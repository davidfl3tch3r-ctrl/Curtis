import type { Metadata, Viewport } from "next";
import { DM_Mono, Playfair_Display, DM_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme-context";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { InstallPrompt } from "@/components/InstallPrompt";

const dmMono   = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono" });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700", "900"], style: ["normal", "italic"], variable: "--font-playfair" });
const dmSans   = DM_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
  title: "CURTIS — Draft Football",
  description: "The fantasy football draft game that rewards every stat.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "CURTIS",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/api/pwa-icon/180",
    icon:  [
      { url: "/api/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { url: "/api/pwa-icon/512", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#FF5A1F",
  width:        "device-width",
  initialScale: 1,
  viewportFit:  "cover", // lets content extend behind iPhone notch/home bar
};

// Prevent flash of wrong theme — runs synchronously before first paint
const FOUC_SCRIPT = `(function(){try{var t=localStorage.getItem('curtis-theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: FOUC_SCRIPT }} />
      </head>
      <body
        className={`${dmMono.variable} ${playfair.variable} ${dmSans.variable}`}
        style={{ margin: 0, fontFamily: "var(--font-dm-sans, 'DM Sans', sans-serif)" }}
      >
        <ThemeProvider>
          {children}
          <InstallPrompt />
        </ThemeProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
