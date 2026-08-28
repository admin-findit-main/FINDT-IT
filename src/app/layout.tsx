import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AuthLinkCatcher } from "@/components/auth/auth-link-catcher";
import { HostSurfaceProvider } from "@/components/host/host-surface";
import { matchProductSurface } from "@/lib/config/product-hosts";
import { RegisterSW } from "@/components/shared/register-sw";
import { LoadProgressHost } from "@/components/shared/load-progress";
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
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const host = (await headers()).get("host") || "";
  const matched = matchProductSurface(host);
  const surface = matched === "apex" ? "www" : matched;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full overflow-x-clip antialiased`}
    >
      <body className="flex min-h-full flex-col overflow-x-clip bg-canvas text-ink">
        <HostSurfaceProvider surface={surface}>{children}</HostSurfaceProvider>
        <AuthLinkCatcher />
        <RegisterSW />
        <LoadProgressHost />
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
              error:
                "!border-[var(--accent)] !bg-[var(--fd-red-50)] !text-[var(--fd-red-700)]",
              success:
                "!border-[var(--stock-border)] !bg-[var(--stock-tint)] !text-[var(--stock-ink)]",
            },
          }}
        />
      </body>
    </html>
  );
}
