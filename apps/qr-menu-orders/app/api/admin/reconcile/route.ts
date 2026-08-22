import { adminRoute } from "@/lib/admin-auth";
import { reconcileRestaurant } from "@/lib/reconcile";

/**
 * Called by the order board on a timer. Cheap when nothing new arrived: one
 * cursored Horizon request that comes back empty.
 */
export const POST = adminRoute(async (restaurant) => {
  const result = await reconcileRestaurant(restaurant.id, restaurant.ownerAddress);
  return Response.json(result);
});
