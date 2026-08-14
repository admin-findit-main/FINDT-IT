import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-canvas min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        <Link
          href="/"
          className="mb-10 flex items-center gap-1.5 self-start text-2xl font-bold tracking-tight text-ink"
        >
          FINDIT
          <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
        </Link>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
