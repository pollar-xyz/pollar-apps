"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/components/Money";
import type { CategoryWithItems, MenuItemRow } from "@/lib/queries";

/**
 * Menu editor. Every change is a request to the API and then a
 * `router.refresh()`, so the server stays the single source of truth — no
 * local copy of the menu that can drift from the database.
 */
export function MenuEditor({ initialMenu }: { initialMenu: CategoryWithItems[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");

  async function call(url: string, init: RequestInit) {
    setError(null);
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo.");
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  async function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    if (await call("/api/admin/categories", { method: "POST", body: JSON.stringify({ name }) })) {
      setNewCategory("");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="rounded-xl border border-error-border bg-error-light px-4 py-3 text-sm text-error">
          {error}
        </p>
      )}

      {initialMenu.length === 0 && (
        <EmptyState
          title="Todavía no hay categorías"
          description="Empezá con algo como Almuerzos, Bebidas o Extras, y después cargá los platos adentro."
        />
      )}

      {initialMenu.map((category) => (
        <CategoryCard
          key={category.id}
          category={category}
          call={call}
          busy={pending}
        />
      ))}

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Nueva categoría"
              placeholder="Almuerzos"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void addCategory();
              }}
            />
          </div>
          <Button
            onClick={() => void addCategory()}
            disabled={!newCategory.trim() || pending}
            className="sm:mb-0.5"
          >
            Agregar categoría
          </Button>
        </div>
      </Card>
    </div>
  );
}

type Call = (url: string, init: RequestInit) => Promise<boolean>;

function CategoryCard({
  category,
  call,
  busy,
}: {
  category: CategoryWithItems;
  call: Call;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [adding, setAdding] = useState(false);

  async function addItem() {
    if (!name.trim() || !price.trim()) return;
    const ok = await call("/api/admin/items", {
      method: "POST",
      body: JSON.stringify({
        categoryId: category.id,
        name,
        price,
        description,
        photoUrl,
      }),
    });
    if (ok) {
      setName("");
      setPrice("");
      setDescription("");
      setPhotoUrl("");
      setAdding(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{category.name}</h2>
        <button
          onClick={() =>
            void call(`/api/admin/categories/${category.id}`, { method: "DELETE" })
          }
          disabled={busy}
          className="text-sm text-muted transition-colors hover:text-error"
        >
          Eliminar
        </button>
      </div>

      <div className="mt-2 flex flex-col divide-y divide-border">
        {category.items.map((item) => (
          <ItemRow key={item.id} item={item} call={call} busy={busy} />
        ))}
      </div>

      {adding ? (
        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-border bg-surface p-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <Input
                label="Plato"
                placeholder="Silpancho"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="sm:w-32">
              <Input
                label="Precio"
                placeholder="3.50"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>
          <Input
            label="Descripción (opcional)"
            placeholder="Con arroz, papa y huevo"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Input
            label="URL de la foto (opcional)"
            placeholder="https://…"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            className="font-mono text-sm"
          />
          <div className="flex gap-2">
            <Button onClick={() => void addItem()} disabled={busy}>
              Guardar
            </Button>
            <Button variant="secondary" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          onClick={() => setAdding(true)}
          className="mt-3 px-3 py-1.5 text-sm"
        >
          + Agregar plato
        </Button>
      )}
    </Card>
  );
}

function ItemRow({
  item,
  call,
  busy,
}: {
  item: MenuItemRow;
  call: Call;
  busy: boolean;
}) {
  const [draft, setDraft] = useState({
    name: item.name,
    price: item.price,
    description: item.description ?? "",
    photoUrl: item.photoUrl ?? "",
  });
  const [editing, setEditing] = useState(false);

  async function save() {
    if (await call(`/api/admin/items/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify(draft),
    })) {
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-3 py-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <Input
              label="Plato"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="sm:w-28">
            <Input
              label="Precio"
              inputMode="decimal"
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              className="font-mono"
            />
          </div>
        </div>
        <Input
          label="Descripción"
          placeholder="Con arroz, papa y huevo"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
        <Input
          label="URL de la foto"
          placeholder="https://…"
          value={draft.photoUrl}
          onChange={(e) => setDraft({ ...draft, photoUrl: e.target.value })}
          className="font-mono text-sm"
        />
        <div className="flex gap-2">
          <Button onClick={() => void save()} disabled={busy}>
            Guardar
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setDraft({
                name: item.name,
                price: item.price,
                description: item.description ?? "",
                photoUrl: item.photoUrl ?? "",
              });
              setEditing(false);
            }}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-3">
      {item.photoUrl && (
        /* A plain img, not next/image: the URL is whatever the owner pasted,
           and optimizing arbitrary remote hosts would mean allowlisting every
           possible one. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.photoUrl}
          alt=""
          className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className={`truncate font-medium ${item.available ? "" : "text-muted line-through"}`}>
          {item.name}
        </p>
        {item.description && (
          <p className="truncate text-sm text-muted">{item.description}</p>
        )}
        <button
          onClick={() => setEditing(true)}
          className="font-mono text-sm text-muted transition-colors hover:text-foreground"
        >
          {formatMoney(item.price)} · editar
        </button>
      </div>

      {/* The "se acabó" toggle: one tap, no confirmation, no menu surgery. */}
      <button
        role="switch"
        aria-checked={item.available}
        aria-label={item.available ? "Marcar como agotado" : "Marcar como disponible"}
        disabled={busy}
        onClick={() =>
          void call(`/api/admin/items/${item.id}`, {
            method: "PATCH",
            body: JSON.stringify({ available: !item.available }),
          })
        }
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          item.available ? "bg-success" : "bg-border"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-background transition-all ${
            item.available ? "left-6" : "left-1"
          }`}
        />
      </button>

      <button
        onClick={() => void call(`/api/admin/items/${item.id}`, { method: "DELETE" })}
        disabled={busy}
        className="shrink-0 text-sm text-muted transition-colors hover:text-error"
      >
        ✕
      </button>
    </div>
  );
}
