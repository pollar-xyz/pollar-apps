import Link from "next/link";
import { PollarLogo } from "@/components/ui/PollarLogo";

/**
 * Landing. There are only two ways into this app: the owner goes to /admin,
 * and the diner arrives by scanning a table's QR — never by typing a URL,
 * and never by copying a G… address.
 */
function Benefit({ title, detail }: { title: string; detail: string }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="mt-0.5 text-success">✓</span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-sm leading-6 text-muted">{detail}</span>
      </span>
    </li>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-8 px-5 py-12">
      <div className="flex flex-col items-center gap-5 text-center">
        <PollarLogo size={88} />
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Tu carta en un QR,
          <span className="block text-primary">y el pedido ya pagado</span>
        </h1>
        <p className="max-w-sm text-lg leading-8 text-muted">
          Tus clientes escanean, piden y pagan desde su celular. A vos te llega
          el pedido escrito, con la mesa y el dinero ya cobrado.
        </p>
      </div>

      <Link
        href="/admin"
        className="flex h-14 items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover active:scale-[0.98]"
      >
        Tengo un local — empezar
      </Link>

      <ul className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
        <Benefit
          title="Sin esperar al mozo"
          detail="El cliente pide cuando quiere, desde la mesa."
        />
        <Benefit
          title="Sin buscar cambio"
          detail="Cada pedido entra ya pagado. La plata va directo a tu cuenta."
        />
        <Benefit
          title="Sin carta desactualizada"
          detail="¿Se acabó el silpancho? Lo apagás y desaparece del menú al instante."
        />
      </ul>

      <div className="rounded-2xl border border-border p-5">
        <h2 className="font-semibold">¿Estás sentado en una mesa?</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          No entres por acá: escaneá el QR que está en tu mesa con la cámara del
          celular y se abre la carta del local.
        </p>
      </div>

      <p className="text-center text-xs leading-5 text-muted-light">
        Versión de prueba: los pagos son reales y verificables, pero el dinero
        no lo es.
      </p>
    </main>
  );
}
