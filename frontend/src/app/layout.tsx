import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import { WalletContextProvider } from "@/components/WalletProvider";
import { ThemeProvider, themeInitScript } from "@/components/ThemeProvider";

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
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <WalletContextProvider>{children}</WalletContextProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
