"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoginButton } from "@/components/LoginButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { usePollarAuth } from "@/hooks/usePollarAuth";


type Mode = "create" | "restore";

/**
 * Onboarding for the owner: create a restaurant, or restore access with the
 * admin key. Payments go to the logged-in Pollar account, so a login is
 * required to create — but the key, not the address, is what authorizes
 * changes afterwards.
 */
export function ClaimRestaurant() {
  const { user } = usePollarAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("create");
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function create() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          ownerAddress: user.address,
          ownerEmail: user.profile?.mail ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear el local.");
      setIssued(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal.");
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Esa clave no funcionó.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal.");
    } finally {
      setBusy(false);
    }
  }

  // The token is shown exactly once. Nothing else can recover it.
  if (issued) {
    return (
      <Card>
        <h2 className="text-lg font-bold">Guardá la llave de tu local</h2>
        <p className="mt-2 text-sm text-muted">
          Es la única vez que se muestra, así que guardala ahora — en tus notas,
          en un mensaje a vos mismo, donde sea. Con ella entrás a administrar tu
          local desde otro celular o si cambiás de navegador. Si la perdés no te
          la podemos reenviar: no guardamos una copia, solo una huella para
          reconocerla.
        </p>
        <p className="mt-4 break-all rounded-xl border border-border bg-surface p-3 font-mono text-sm">
          {issued}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(issued);
              setCopied(true);
            }}
          >
            {copied ? "Copiada ✓" : "Copiar la llave"}
          </Button>
          <Button onClick={() => router.refresh()}>Ya la guardé, seguir</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-xl bg-surface p-1">
        {(["create", "restore"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              mode === m
                ? "bg-background text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            {/* Not "tengo un local": everyone reading this has one, that's the
                whole point. What separates the two groups is the key. */}
            {m === "create" ? "Nuevo local" : "Entrar con mi llave"}
          </button>
        ))}
      </div>

      <Card>
        {mode === "create" ? (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-bold">Abrí tu local</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Tus clientes van a pagar directo a tu cuenta, sin intermediarios
                y sin esperar liquidación. Entrá con la cuenta donde querés
                recibir la plata.
              </p>
            </div>

            {user ? (
              <p className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-success-border bg-success-light px-3 py-2.5 text-sm">
                <span className="text-success">✓ Vas a cobrar en</span>
                <span className="font-medium text-success">
                  {user.profile?.mail ?? "tu cuenta"}
                </span>
              </p>
            ) : (
              <LoginButton />
            )}

            <Input
              label="Nombre del local"
              placeholder="Pensión Doña Mary"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              onClick={() => void create()}
              disabled={!user || !name.trim() || busy}
              loading={busy}
              className="w-full py-3"
            >
              {user ? "Abrir mi local" : "Entrá con tu cuenta primero"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-bold">Entrá con tu llave</h2>
              <p className="mt-1 text-sm text-muted">
                Pegá la llave que guardaste cuando abriste tu local. Es la única
                forma de volver a entrar desde otro celular.
              </p>
            </div>
            <Input
              label="Tu llave"
              placeholder="…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="font-mono"
            />
            <Button
              onClick={() => void restore()}
              disabled={!token.trim() || busy}
              loading={busy}
              className="w-full py-3"
            >
              Entrar
            </Button>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-xl border border-error-border bg-error-light px-3 py-2 text-sm text-error">
            {error}
          </p>
        )}
      </Card>
    </div>
  );
}
