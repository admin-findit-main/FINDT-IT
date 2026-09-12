import type { Metadata } from "next";
import { AuthBrandLink } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#ffffff_0%,#f7f7f8_100%)]">
      <header className="sticky top-0 z-50 border-b border-hairline-strong bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center px-5 py-3.5 sm:px-6">
          <AuthBrandLink />
        </div>
      </header>
      <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-md flex-col px-5 py-8 sm:px-6 sm:py-10">
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
