"use client";

import { NotificationPrompt } from "@/components/customer/notification-prompt";
import { WebPushRegistrar } from "@/components/customer/web-push-registrar";
import { StoreAlertListener } from "@/components/store/alert-listener";

export function StoreNotifyHost({ userId }: { userId: string }) {
  return (
    <>
      <StoreAlertListener userId={userId} />
      <WebPushRegistrar />
      <NotificationPrompt audience="store" compact className="mb-4" />
    </>
  );
}
