import { Bell, Search } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { BrandMark } from "./design-system";

type TopBarProps = {
  eyebrow: string;
  title: string;
};

export function TopBar({ eyebrow, title }: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-black/72 px-5 pb-3 pt-5 backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark size={38} />
          <div className="min-w-0">
            <p className="text-[12px] font-bold uppercase text-white/42">{eyebrow}</p>
            <h1 className="truncate text-[28px] font-black leading-tight text-white">
              {title}
            </h1>
          </div>
        </div>
        <div className="flex gap-2">
          <IconButton label="Buscar">
            <Search size={19} strokeWidth={2.4} />
          </IconButton>
          <IconButton label="Notificações">
            <Bell size={19} strokeWidth={2.4} />
          </IconButton>
        </div>
      </div>
    </header>
  );
}
