import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * A diner scanning a QR that no longer resolves — an old sign, a deleted
 * table, a smudged code. Next's default 404 is a developer page in English;
 * this one talks to the person holding the phone.
 */
export default function TableNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-5 py-12">
      <EmptyState
        title="Este QR ya no anda"
        description="Puede que la mesa haya cambiado de código o que el cartel sea viejo. Pedile al mozo el QR actualizado y volvé a escanear."
      />
      <Link
        href="/"
        className="text-center text-sm text-muted underline transition-colors hover:text-foreground"
      >
        Ir al inicio
      </Link>
    </main>
  );
}
