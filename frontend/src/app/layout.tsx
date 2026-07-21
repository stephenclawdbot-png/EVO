import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import { WalletContextProvider } from "@/components/WalletProvider";
import { ThemeProvider, themeInitScript } from "@/components/ThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meld — Assets that don't stay the same.",
  description: "EVOs hold locked SOL, evolve over time, and can be shattered to recover their value. Not a token. Not an NFT. A new on-chain primitive on Solana.",
  openGraph: {
    title: "Meld — Assets that don't stay the same.",
    description: "EVOs hold locked SOL, evolve over time, and can be shattered to recover their value. A new on-chain primitive on Solana.",
    type: "website",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0a0a0c",
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
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <WalletContextProvider>
            <ErrorBoundary>{children}</ErrorBoundary>
          </WalletContextProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
