import { Spinner } from "@/components/ui/Spinner";

/**
 * Shown while an owner screen loads. Admin pages are server components that
 * hit the database, so navigation would otherwise sit on the old screen with
 * no sign anything happened — on a slow connection at a food stall, that
 * reads as a broken tap.
 */
export default function AdminLoading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-3 px-4 py-20">
      <Spinner />
      <p className="text-sm text-muted">Cargando…</p>
    </main>
  );
}
