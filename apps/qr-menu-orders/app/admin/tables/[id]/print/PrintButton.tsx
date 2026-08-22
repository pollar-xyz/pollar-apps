"use client";

import { Button } from "@/components/ui/Button";

/** Hidden on paper by `print:hidden`, along with the admin nav. */
export function PrintButton() {
  return (
    <div className="flex w-full justify-center print:hidden">
      <Button onClick={() => window.print()}>Imprimir este cartel</Button>
    </div>
  );
}
