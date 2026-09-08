export function hasVerifiedEmailIdentity(user: {
  email_confirmed_at?: string | null;
} | null | undefined): boolean {
  return Boolean(user?.email_confirmed_at);
}

export function isWaitingHubRequest(input: {
  respondedAt?: string | null;
  deliveryStatus: string;
  relevant?: boolean | null;
  requestStatus: string;
  expiresAt: string;
  nowMs: number;
}): boolean {
  return (
    !input.respondedAt &&
    input.deliveryStatus === "sent" &&
    input.relevant !== false &&
    (input.requestStatus === "active" ||
      input.requestStatus === "partially_answered") &&
    new Date(input.expiresAt).getTime() > input.nowMs
  );
}
