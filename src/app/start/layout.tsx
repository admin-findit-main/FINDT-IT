import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get started",
};

export default function StartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
