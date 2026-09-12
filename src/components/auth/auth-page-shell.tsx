import type { ReactNode } from "react";
import { Card } from "@/components/ui/primitives";
import {
  AuthAudienceSwitch,
  AuthIntentSwitch,
  AuthPageLinks,
  type AuthAudience,
  type AuthIntent,
} from "@/components/auth/auth-audience";

export function AuthPageShell({
  audience,
  intent,
  next,
  shopperHref,
  storeHref,
  title,
  description,
  children,
  footerAudience,
}: {
  audience: AuthAudience;
  intent: AuthIntent;
  next?: string | null;
  shopperHref?: string;
  storeHref?: string;
  title: string;
  description: string;
  children: ReactNode;
  footerAudience?: AuthAudience;
}) {
  return (
    <Card className="border-hairline-strong p-6 shadow-[0_12px_40px_rgba(11,11,12,0.06)] sm:p-8">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          Account type
        </p>
        <div className="mt-2">
          <AuthAudienceSwitch
            audience={audience}
            next={next}
            shopperHref={shopperHref}
            storeHref={storeHref}
          />
        </div>
        <AuthIntentSwitch audience={audience} intent={intent} next={next} />
      </div>

      <h1 className="mt-6 text-[1.75rem] font-bold tracking-tight text-ink">
        {title}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{description}</p>

      {children}

      <AuthPageLinks audience={footerAudience ?? audience} next={next} />
    </Card>
  );
}
