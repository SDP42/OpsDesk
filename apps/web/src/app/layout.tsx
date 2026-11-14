import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});
const sans = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "OpsDesk Control Tower", template: "%s · OpsDesk" },
  description:
    "Every ticket is a flight. OpsDesk is the control tower for TBO's agency operations: linked cases, explainable routing, travel-aware SLAs.",
  applicationName: "OpsDesk Control Tower",
};

export const viewport: Viewport = { themeColor: "#F4F1EA", colorScheme: "light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body className="night-ops-backdrop">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
