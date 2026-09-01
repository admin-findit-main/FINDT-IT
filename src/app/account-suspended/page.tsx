import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { SUPPORT_EMAIL } from "@/lib/auth/admin";
import { signOutAction } from "@/lib/services/actions";

export default function AccountSuspendedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-6 py-16">
      <Card className="w-full space-y-4 p-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">This account is suspended</h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          FINDIT has turned off this login. If that is a mistake, email{" "}
          <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
        <form action={signOutAction}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
        <p className="text-xs text-ink-muted">
          <Link href="/" className="underline-offset-2 hover:underline">
            Back to FINDIT
          </Link>
        </p>
      </Card>
    </main>
  );
}
