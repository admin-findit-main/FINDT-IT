import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AuthLinkCatcher } from "@/components/auth/auth-link-catcher";
import { RegisterSW } from "@/components/shared/register-sw";
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
  title: {
    default: "FINDIT — Find it locally.",
    template: "%s · FINDIT",
  },
  description:
    "Tell FINDIT what you're looking for and nearby stores can tell you if they have it.",
  applicationName: "FINDIT",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/findit-icon.png", sizes: "1024x1024", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FINDIT",
  },
  openGraph: {
    title: "FINDIT — Find it locally.",
    description: "Ask once. Nearby stores tell you if they have it.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#F2F2F7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas text-ink">
        {children}
        <AuthLinkCatcher />
        <RegisterSW />
        <Toaster
          position="top-center"
          closeButton
          toastOptions={{
            classNames: {
              toast:
                "glass-strong !rounded-glass-xl !border-hairline-strong !text-ink",
              description: "!text-ink-muted",
              actionButton: "!bg-accent !text-ink-inverse",
              cancelButton: "!bg-glass-2 !text-ink-muted",
              error: "!text-accent-ink",
              success: "!text-stock-ink",
            },
          }}
        />
      </body>
    </html>
  );
}
