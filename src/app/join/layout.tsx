import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stores",
  description:
    "Apply your store to FINDIT. $99/month for the full store app after a free trial.",
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
