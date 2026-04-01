import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Use with rounded container + bg-primary for nav chips */
  variant?: "mark" | "full";
};

/** SmartSchool Manager wordmark + icon */
export function BrandLogo({ className, variant = "mark" }: Props) {
  if (variant === "full") {
    return (
      <span className={cn("inline-flex items-center gap-2 font-bold text-foreground", className)}>
        <BrandLogo variant="mark" className="h-9 w-9 shrink-0" />
        <span className="leading-tight">
          SmartSchool
          <span className="text-primary"> Manager</span>
        </span>
      </span>
    );
  }

  return (
    <img
      src="/logo.svg"
      width={48}
      height={48}
      alt=""
      className={cn("h-9 w-9 shrink-0 rounded-xl object-cover", className)}
      decoding="async"
    />
  );
}
