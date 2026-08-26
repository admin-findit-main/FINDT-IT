"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/**
 * The scrim behind modals. Blurring it (rather than just darkening) is what makes
 * the sheet above read as a pane of glass sitting over the page.
 */
const overlayClass =
  "fixed inset-0 z-[80] bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0";

const closeButtonClass =
  "absolute right-4 top-4 rounded-full border border-hairline-strong bg-glass-2 p-2 text-ink-muted transition-colors hover:bg-glass-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ring";

export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlayClass} />
      <DialogPrimitive.Content
        className={cn(
          "glass-strong fixed left-1/2 top-1/2 z-[80] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-glass-2xl p-6 focus:outline-none",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className={closeButtonClass}>
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-lg font-semibold tracking-tight text-ink", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("mt-1 text-sm leading-relaxed text-ink-muted", className)}
      {...props}
    />
  );
}

/**
 * Frosted sheet: bottom-anchored on phones with a grab handle, centred modal from
 * `sm` up. This is the primary modal surface in the product.
 */
export function GlassSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClass} />
        <DialogPrimitive.Content
          onCloseAutoFocus={(event) => event.preventDefault()}
          className={cn(
            "glass-strong fixed inset-x-0 bottom-0 z-[80] max-h-[92vh] overflow-y-auto rounded-t-glass-2xl px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 focus:outline-none",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-glass-2xl sm:pt-6 sm:pb-6",
            className
          )}
        >
          <div
            aria-hidden
            className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-hairline-strong sm:hidden"
          />
          <DialogPrimitive.Title className="text-xl font-bold tracking-tight text-ink">
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-1.5 text-sm leading-relaxed text-ink-muted">
              {description}
            </DialogPrimitive.Description>
          ) : null}
          <DialogPrimitive.Close className={closeButtonClass}>
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
          <div className="mt-5">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}

/** Previous name for {@link GlassSheet}; kept so existing screens keep working. */
export const BottomSheet = GlassSheet;
