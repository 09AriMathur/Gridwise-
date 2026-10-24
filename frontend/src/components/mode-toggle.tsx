// The shadcn ModeToggle (https://ui.shadcn.com/docs/dark-mode/vite), styled as
// a circular toolbar button (Apple HIG).
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { iconBtn } from "./common";
import { useTheme, type Theme } from "./theme-provider";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ModeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(iconBtn, "relative outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40", className)}>
        <Sun className="size-4 scale-100 rotate-0 transition-transform duration-300 ease-ios dark:scale-0 dark:-rotate-90" aria-hidden="true" />
        <Moon className="absolute size-4 scale-0 rotate-90 transition-transform duration-300 ease-ios dark:scale-100 dark:rotate-0" aria-hidden="true" />
        <span className="sr-only">Toggle theme</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-44 rounded-xl p-1 shadow-[0_10px_40px_rgb(0_0_0/0.16)]">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem key={value} onClick={() => setTheme(value)}
            className="gap-2.5 rounded-md px-3 py-2 text-[15px]">
            <Icon aria-hidden="true" /> {label}
            {theme === value && <Check className="ml-auto" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
