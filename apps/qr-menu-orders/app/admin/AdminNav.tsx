"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PollarLogo } from "@/components/ui/PollarLogo";

const LINKS = [
  { href: "/admin", label: "Inicio" },
  { href: "/admin/menu", label: "Menú" },
  { href: "/admin/tables", label: "Mesas" },
  { href: "/admin/board", label: "Pedidos" },
  { href: "/admin/summary", label: "Hoy" },
  { href: "/admin/history", label: "Historial" },
];

export function AdminNav({ name }: { name: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/admin/session", { method: "DELETE" });
    router.replace("/admin");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <PollarLogo size={26} />
          <span className="min-w-0 truncate font-semibold tracking-tight">{name}</span>
        </div>
        <button
          onClick={() => void signOut()}
          className="shrink-0 text-sm text-muted transition-colors hover:text-foreground"
        >
          Salir
        </button>
      </div>
      <nav className="mx-auto flex w-full max-w-3xl gap-1 overflow-x-auto px-4 pb-2">
        {LINKS.map((link) => {
          const active =
            link.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted hover:bg-surface-hover hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
