import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The console's mark: the platform's cyan-and-rose pair on black, the one place the brand
 * colours appear. Everything interactive in the console uses the accent instead.
 */
export function BrandMark({ className, size = "sm" }: { className?: string; size?: "sm" | "lg" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black text-white",
        size === "sm" ? "h-9 w-9" : "h-12 w-12",
        className,
      )}
    >
      <span className="absolute -top-2 -left-2 h-8 w-8 rounded-full bg-[#25f4ee] opacity-70 blur-md" />
      <span className="absolute -right-2 -bottom-2 h-8 w-8 rounded-full bg-[#fe2c55] opacity-70 blur-md" />
      <ShieldCheck className={cn("relative", size === "sm" ? "h-4 w-4" : "h-6 w-6")} />
    </span>
  );
}
