import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { currentRestaurant } from "@/lib/admin-auth";
import { Money } from "@/components/Money";
import { getMenu, getTables, getTodaySummary } from "@/lib/queries";
import { ClaimRestaurant } from "./ClaimRestaurant";

export default async function AdminHome() {
  const restaurant = await currentRestaurant();

  if (!restaurant) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Tu menú, en un QR
        </h1>
        <ClaimRestaurant />
      </main>
    );
  }

  const [menu, tables, today] = await Promise.all([
    getMenu(restaurant.id),
    getTables(restaurant.id),
    getTodaySummary(restaurant.id),
  ]);
  const dishes = menu.reduce((acc, category) => acc + category.items.length, 0);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Cobrado hoy" money={today.total} />
        <Stat label="Pedidos hoy" value={String(today.count)} />
        <Stat label="Platos en el menú" value={String(dishes)} />
      </div>

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Tu local
        </h2>
        <dl className="mt-3 flex flex-col divide-y divide-border text-sm">
          <Row label="Nombre" value={restaurant.name} />
          {/* The person, not the account. A truncated public key here reads
              as an error message to someone who just wants to sell lunch. */}
          <Row
            label="Cobrás en tu cuenta"
            value={restaurant.ownerEmail ?? "la cuenta con la que entraste"}
          />
          <Row label="Mesas con QR" value={String(tables.length)} />
        </dl>
      </Card>

      {/* Shown until the place is actually set up: someone opening this for
          the first time needs to know what the three steps are, not just
          which buttons exist. */}
      {(dishes === 0 || tables.length === 0) && (
        <Card>
          <h2 className="font-semibold">Cómo empezar a vender</h2>
          <ol className="mt-3 flex flex-col gap-3">
            <Step
              n={1}
              done={dishes > 0}
              title="Cargá tu menú"
              detail="Las categorías y los platos con su precio. Después, cuando algo se acabe, lo apagás en un toque."
              href="/admin/menu"
              cta="Armar el menú"
            />
            <Step
              n={2}
              done={tables.length > 0}
              title="Imprimí el QR de cada mesa"
              detail="Cada mesa tiene el suyo. El cliente lo escanea y se abre tu menú de hoy."
              href="/admin/tables"
              cta="Crear una mesa"
            />
            <Step
              n={3}
              done={false}
              title="Recibí los pedidos"
              detail="Llegan ya pagados a la pantalla de Pedidos, con la mesa y lo que pidieron."
              href="/admin/board"
              cta="Ver pedidos"
            />
          </ol>
        </Card>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  money,
}: {
  label: string;
  value?: string;
  money?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </p>
      {money !== undefined ? (
        <Money amount={money} withCoin className="mt-1 text-xl font-semibold" />
      ) : (
        <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{value}</p>
      )}
    </div>
  );
}

function Step({
  n,
  done,
  title,
  detail,
  href,
  cta,
}: {
  n: number;
  done: boolean;
  title: string;
  detail: string;
  href: string;
  cta: string;
}) {
  return (
    <li className="flex gap-3">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          done
            ? "bg-success-light text-success"
            : "bg-primary text-primary-foreground"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-sm leading-6 text-muted">{detail}</p>
        {!done && (
          <Link
            href={href}
            className="mt-2 inline-block rounded-xl bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            {cta}
          </Link>
        )}
      </div>
    </li>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className={mono ? "font-mono" : "font-medium"}>{value}</dd>
    </div>
  );
}
