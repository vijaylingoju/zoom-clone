import type { Metadata } from "next";
import { Lato, Nunito } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["800"],
});

export const metadata: Metadata = {
  title: "Zoom Clone",
  description: "Video conferencing platform — Zoom web app clone",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${lato.variable} ${nunito.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
