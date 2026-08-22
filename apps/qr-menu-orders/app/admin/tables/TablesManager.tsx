"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";

export interface TableWithQr {
  id: string;
  label: string;
  code: string;
  url: string;
  svg: string;
}

export function TablesManager({ tables }: { tables: TableWithQr[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function add() {
    const trimmed = label.trim();
    if (!trimmed) return;
    setError(null);
    const res = await fetch("/api/admin/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: trimmed }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "No se pudo.");
      return;
    }
    setLabel("");
    startTransition(() => router.refresh());
  }

  async function remove(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/tables/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "No se pudo.");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="rounded-xl border border-error-border bg-error-light px-4 py-3 text-sm text-error">
          {error}
        </p>
      )}

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Nueva mesa o mostrador"
              placeholder="Mesa 3"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void add();
              }}
            />
          </div>
          <Button onClick={() => void add()} disabled={!label.trim() || pending}>
            Crear QR
          </Button>
        </div>
      </Card>

      {tables.length === 0 ? (
        <EmptyState
          title="Todavía no hay mesas"
          description="Creá una por cada mesa, o una sola para el mostrador si vendés parado. Cada una lleva su propio QR para imprimir y pegar."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {tables.map((table) => (
            <Card key={table.id}>
              <div className="flex items-start gap-4">
                <div
                  className="h-24 w-24 shrink-0 rounded-xl bg-paper p-1 [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: table.svg }}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="truncate font-semibold">{table.label}</p>
                  <p className="text-xs text-muted">Su QR ya está listo</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link
                      href={`/admin/tables/${table.id}/print`}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-surface-hover"
                    >
                      Imprimir
                    </Link>
                    <button
                      onClick={() => {
                        void navigator.clipboard.writeText(table.url);
                        setCopied(table.id);
                      }}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-surface-hover"
                    >
                      {copied === table.id ? "Copiado ✓" : "Copiar link"}
                    </button>
                    <button
                      onClick={() => void remove(table.id)}
                      disabled={pending}
                      className="rounded-lg px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:text-error"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
