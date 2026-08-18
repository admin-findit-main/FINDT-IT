import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Buttons. `default` is brand red — the single primary action on a screen.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold glass-press transition-[background-color,box-shadow,color,transform] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-ink-inverse shadow-accent hover:bg-accent-hover",
        accent: "bg-accent text-ink-inverse shadow-accent hover:bg-accent-hover",
        ink: "bg-[var(--fd-black)] text-ink-inverse hover:bg-[var(--fd-ink-700)]",
        secondary: "glass text-ink hover:bg-glass-3",
        outline:
          "border border-hairline-strong bg-white text-ink hover:bg-[var(--solid-3)]",
        ghost: "text-ink-muted hover:bg-glass-2 hover:text-ink",
        success: "bg-stock text-ink-inverse hover:brightness-95",
        warning: "bg-order text-ink-inverse hover:brightness-95",
        danger: "bg-accent text-ink-inverse shadow-accent hover:bg-accent-hover",
        softSuccess:
          "border border-[var(--stock-border)] bg-stock-tint text-stock-ink hover:bg-[rgba(14,159,110,0.22)]",
        softWarning:
          "border border-[var(--order-border)] bg-order-tint text-order-ink hover:bg-[rgba(199,119,0,0.22)]",
        softDanger:
          "border border-[var(--accent-ring)] bg-accent-soft text-accent-ink hover:bg-[rgba(229,35,27,0.18)]",
        softMuted:
          "border border-[var(--oos-border)] bg-oos-tint text-oos-ink hover:bg-[rgba(110,110,120,0.2)]",
      },
      size: {
        default: "h-11 rounded-glass-lg px-5 text-sm",
        sm: "h-9 rounded-glass-md px-3.5 text-xs",
        lg: "h-12 rounded-glass-lg px-6 text-base",
        xl: "h-14 rounded-glass-xl px-8 text-base",
        icon: "h-11 w-11 rounded-glass-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
