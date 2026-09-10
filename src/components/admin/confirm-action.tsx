"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmTone = "default" | "danger" | "success";

/**
 * Destructive / important admin actions always go through a small confirm popup.
 */
export function ConfirmActionButton({
  label,
  confirmTitle,
  confirmBody,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  variant = "outline",
  size = "sm",
  disabled,
  className,
  onConfirm,
}: {
  label: string;
  confirmTitle: string;
  confirmBody: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "sm" | "default" | "lg";
  disabled?: boolean;
  className?: string;
  onConfirm: () => Promise<{ error?: string; ok?: boolean } | void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      try {
        const result = await onConfirm();
        if (result && "error" in result && result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(
          tone === "danger"
            ? "Done"
            : tone === "success"
              ? "Saved"
              : "Updated"
        );
        setOpen(false);
      } catch {
        toast.error("Something went wrong. Try again.");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        disabled={disabled || pending}
        className={cn(
          tone === "danger" && "border-[#E5231B]/35 text-[#C81109]",
          className
        )}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="z-[1200] max-w-sm rounded-2xl p-5">
          <DialogTitle className="text-lg font-bold tracking-tight">
            {confirmTitle}
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-relaxed text-ink-muted">
            {confirmBody}
          </DialogDescription>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              disabled={pending}
              className={cn(
                tone === "danger" && "bg-[#E5231B] hover:bg-[#C81109]",
                tone === "success" && "bg-[#0B7A3B] hover:bg-[#096533]"
              )}
              onClick={run}
            >
              {pending ? "Working…" : confirmLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
