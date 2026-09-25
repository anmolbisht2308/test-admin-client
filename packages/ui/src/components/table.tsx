import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}
export const THead = ({ className, ...props }: ComponentProps<"thead">) => (
  <thead className={cn("[&_tr]:border-b", className)} {...props} />
);
export const TBody = ({ className, ...props }: ComponentProps<"tbody">) => (
  <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
);
export const TR = ({ className, ...props }: ComponentProps<"tr">) => (
  <tr className={cn("border-b transition-colors hover:bg-muted/50", className)} {...props} />
);
export const TH = ({ className, ...props }: ComponentProps<"th">) => (
  <th
    className={cn(
      "h-10 px-3 text-left align-middle font-medium whitespace-nowrap text-muted-foreground",
      className,
    )}
    {...props}
  />
);
export const TD = ({ className, ...props }: ComponentProps<"td">) => (
  <td className={cn("p-3 align-middle", className)} {...props} />
);
