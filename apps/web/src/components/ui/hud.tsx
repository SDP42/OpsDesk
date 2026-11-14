import { clsx } from "clsx";

/** Glass panel with four 10px HUD corner brackets and an optional micro-label header. */
export function Hud({
  title,
  action,
  className,
  bodyClassName,
  children,
  as: Tag = "section",
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
  as?: "section" | "div" | "aside";
}) {
  return (
    <Tag className={clsx("hud", className)}>
      <span className="hud-tr" aria-hidden />
      <span className="hud-bl" aria-hidden />
      {(title || action) && (
        <header className="border-line/70 flex items-center justify-between gap-3 border-b px-4 py-2.5">
          <h2 className="micro">{title}</h2>
          {action}
        </header>
      )}
      <div className={clsx("p-4", bodyClassName)}>{children}</div>
    </Tag>
  );
}
