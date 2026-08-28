import type { Metadata } from "next";
import { AuthBrandLink } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-canvas min-h-screen">
      <header className="glass-chrome sticky top-0 z-50 border-b border-hairline-strong">
        <div className="mx-auto flex max-w-md items-center px-6 py-4">
          <AuthBrandLink />
        </div>
      </header>
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md flex-col px-6 py-10">
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
