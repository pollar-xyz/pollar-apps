import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PollarAppProvider } from "@/lib/pollar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "QR Menu Orders",
  description:
    "Scan the table QR, order from your phone and pay in USDC. The order lands paid on the owner's board.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PollarAppProvider>{children}</PollarAppProvider>
      </body>
    </html>
  );
}
