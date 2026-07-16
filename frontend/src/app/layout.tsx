import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import { WalletContextProvider } from "@/components/WalletProvider";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EVO — Stateful Capital. SOL that remembers.",
  description: "Every collectible has real value inside it. Trade stories. Keep your floor. The first EVO collection on Solana.",
  openGraph: {
    title: "EVO — Stateful Capital. SOL that remembers.",
    description: "Every collectible has real value inside it. Trade stories. Keep your floor.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <WalletContextProvider>{children}</WalletContextProvider>
      </body>
    </html>
  );
}
