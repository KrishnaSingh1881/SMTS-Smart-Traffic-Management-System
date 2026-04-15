import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AnimatePresence } from "framer-motion";
import LenisProvider from "@/components/layout/LenisProvider";
import "@/styles/globals.css";
import "@/styles/themes.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Smart Traffic Management System",
  description:
    "Real-time traffic monitoring, signal management, and route recommendations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <LenisProvider>
          <AnimatePresence mode="wait">{children}</AnimatePresence>
        </LenisProvider>
      </body>
    </html>
  );
}
