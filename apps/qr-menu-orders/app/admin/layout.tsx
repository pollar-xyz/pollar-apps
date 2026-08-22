import { currentRestaurant } from "@/lib/admin-auth";
import { AdminNav } from "./AdminNav";

/**
 * Owner-side shell. The nav only appears once this browser holds a valid
 * admin token; the pages themselves re-check, so the nav is presentation,
 * not the guard.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const restaurant = await currentRestaurant();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {restaurant && <AdminNav name={restaurant.name} />}
      {children}
    </div>
  );
}
