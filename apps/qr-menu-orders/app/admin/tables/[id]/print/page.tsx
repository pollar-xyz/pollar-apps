import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db, dbReady } from "@/db/client";
import { diningTable } from "@/db/schema";
import { currentRestaurant } from "@/lib/admin-auth";
import { appOrigin, menuUrl } from "@/lib/origin";
import { qrSvg } from "@/lib/qr";
import { PrintButton } from "./PrintButton";

/**
 * The sign that gets taped to a table. It's the only physical part of this
 * app and often the first thing a diner ever sees of it, so it has to answer
 * three questions before anyone decides to scan: what is this, what do I do,
 * and what happens after. Ink on paper via the paper/ink tokens, never the
 * app theme — a QR only scans reliably as dark-on-light.
 */
const STEPS = [
  { n: "1", label: "Escaneá", detail: "con la cámara" },
  { n: "2", label: "Elegí", detail: "del menú de hoy" },
  { n: "3", label: "Pagá", detail: "desde tu celular" },
];

export default async function PrintTablePage({
  params,
}: PageProps<"/admin/tables/[id]/print">) {
  const restaurant = await currentRestaurant();
  if (!restaurant) redirect("/admin");

  const { id } = await params;
  await dbReady();
  const [table] = await db
    .select()
    .from(diningTable)
    .where(and(eq(diningTable.id, id), eq(diningTable.restaurantId, restaurant.id)))
    .limit(1);
  if (!table) notFound();

  const origin = await appOrigin();
  const url = menuUrl(origin, table.code);
  const svg = await qrSvg(url, 640);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-6 px-6 py-10 print:max-w-none print:py-0">
      <PrintButton />

      <section className="flex w-full flex-col items-center gap-6 rounded-3xl border border-border bg-paper px-8 py-10 text-center text-ink print:rounded-none print:border-0 print:px-0 print:py-0">
        <header className="flex flex-col items-center gap-2">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-ink-soft">
            {restaurant.name}
          </p>
          <p className="text-5xl font-black leading-none tracking-tight">
            {table.label}
          </p>
        </header>

        <div className="flex flex-col items-center gap-1">
          <p className="text-2xl font-extrabold leading-tight">
            Pedí y pagá desde tu celular
          </p>
          <p className="text-base text-ink-soft">
            Sin esperar al mozo, sin buscar cambio.
          </p>
        </div>

        <div
          className="w-full max-w-[19rem] [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />

        <ol className="flex w-full items-start justify-between gap-2 border-t-2 border-ink/15 pt-5">
          {STEPS.map((step) => (
            <li key={step.n} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-lg font-bold text-paper">
                {step.n}
              </span>
              <span className="text-base font-bold leading-none">{step.label}</span>
              <span className="text-xs text-ink-soft">{step.detail}</span>
            </li>
          ))}
        </ol>

        <p className="break-all font-mono text-[10px] leading-tight text-ink-soft">
          {url}
        </p>
      </section>
    </main>
  );
}
