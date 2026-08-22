import { notFound } from "next/navigation";
import { getMenu, getTableByCode } from "@/lib/queries";
import { OrderFlow } from "./OrderFlow";

/**
 * What the QR opens: today's live menu for one table. Sold-out dishes never
 * reach the page, so the diner can't order what the kitchen ran out of.
 */
export default async function TableMenuPage({ params }: PageProps<"/m/[code]">) {
  const { code } = await params;
  const spot = await getTableByCode(code);
  if (!spot) notFound();

  const menu = await getMenu(spot.restaurant.id);
  const available = menu
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => item.available),
    }))
    .filter((category) => category.items.length > 0);

  return (
    <OrderFlow
      restaurantName={spot.restaurant.name}
      tableLabel={spot.table.label}
      tableCode={spot.table.code}
      menu={available}
    />
  );
}
