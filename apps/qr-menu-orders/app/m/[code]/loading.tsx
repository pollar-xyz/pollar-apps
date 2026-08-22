import { Spinner } from "@/components/ui/Spinner";

/** First thing a diner sees after scanning, before the menu resolves. */
export default function MenuLoading() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-5 py-20">
      <Spinner />
      <p className="text-sm text-muted">Abriendo el menú…</p>
    </main>
  );
}
