"use client";

/** shadcn-style primitives on Radix UI (MIT), restyled for the Daylight Tower system. */
import NumberFlow, { type Format } from "@number-flow/react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/* Sign: airport wayfinding chip ---------------------------------------- */
const signVariants = cva("sign", {
  variants: {
    tone: {
      yellow: "",
      dark: "sign-dark",
      beacon: "!bg-beacon !text-white",
      signal: "!bg-signal !text-white",
      alarm: "!bg-alarm !text-white",
      ice: "!bg-ice !text-white",
      outline: "!bg-transparent !text-text border border-line",
    },
  },
  defaultVariants: { tone: "yellow" },
});

export function Sign({ tone, className, ...rest }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof signVariants>) {
  return <span className={cn(signVariants({ tone }), className)} {...rest} />;
}

/* Animated numbers ------------------------------------------------------ */
export function Num({ value, className, format }: { value: number; className?: string; format?: Format }) {
  return <NumberFlow value={value} className={cn("tabular", className)} format={format} />;
}

/* Tooltip --------------------------------------------------------------- */
export function Tip({ label, children, side = "top" }: { label: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            className="z-[90] max-w-xs rounded-lg bg-night px-2.5 py-1.5 font-mono text-[11px] text-white shadow-lg data-[state=delayed-open]:animate-in"
          >
            {label}
            <TooltipPrimitive.Arrow className="fill-night" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

/* Switch ---------------------------------------------------------------- */
export function Toggle({ checked, onCheckedChange, label, id }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string; id: string }) {
  return (
    <SwitchPrimitive.Root
      id={id}
      aria-label={label}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="relative h-6 w-11 shrink-0 rounded-full bg-ink-700 transition-colors data-[state=checked]:bg-night"
    >
      <SwitchPrimitive.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px] data-[state=checked]:bg-taxi" />
    </SwitchPrimitive.Root>
  );
}

/* Dialog ---------------------------------------------------------------- */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  hideClose,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  hideClose?: boolean;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-night/40 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className={cn(
            "hud fixed top-1/2 left-1/2 z-[81] max-h-[90dvh] w-[min(640px,calc(100vw-2rem))] -translate-1/2 overflow-y-auto p-7 !shadow-[var(--shadow-lift)] outline-none",
            className,
          )}
        >
          <span className="hud-tr" aria-hidden />
          <span className="hud-bl" aria-hidden />
          <DialogPrimitive.Title className="display text-4xl">{title}</DialogPrimitive.Title>
          {description && <DialogPrimitive.Description className="mt-2 text-sm text-text-dim">{description}</DialogPrimitive.Description>}
          <div className="mt-5">{children}</div>
          {!hideClose && (
            <DialogPrimitive.Close className="absolute top-5 right-5 rounded-full p-1.5 text-text-dim hover:bg-ink-700 hover:text-text" aria-label="Close">
              <X size={16} />
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
