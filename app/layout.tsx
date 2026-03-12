import type { Metadata } from "next";
import { DM_Mono, Playfair_Display, DM_Sans } from "next/font/google";

const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono" });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700", "900"], style: ["normal", "italic"], variable: "--font-playfair" });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
  title: "CURTIS — Draft Football",
  description: "The fantasy football draft game that rewards every stat.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: "#FAF7F2", color: "#1C1410", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
