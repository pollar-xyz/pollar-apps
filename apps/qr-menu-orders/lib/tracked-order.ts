/**
 * The diner's last order for a table, kept in the browser.
 *
 * A tiny external store rather than state loaded in an effect: reading
 * localStorage during render is not safe on the server, and setting state
 * from an effect to fix that causes a cascading render. `useSyncExternalStore`
 * is the shape React wants for exactly this, and it also picks up changes
 * from another tab for free.
 */

export interface TrackedOrder {
  id: string;
  number: number;
}

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeTracked(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Returns the raw string so snapshots compare by value, as the hook requires. */
export function readTracked(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Private mode or blocked storage: tracking is a nicety, not a requirement.
    return null;
  }
}

export function writeTracked(key: string, order: TrackedOrder): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(order));
  } catch {
    // ignored
  }
  emit();
}

export function clearTracked(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignored
  }
  emit();
}

export function parseTracked(raw: string | null): TrackedOrder | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TrackedOrder;
    return typeof parsed?.id === "string" ? parsed : null;
  } catch {
    return null;
  }
}
