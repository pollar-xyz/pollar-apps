import { verifyPayment } from "@/lib/horizon";
import { SPIKE_OWNER_ADDRESS } from "@/lib/stellar";

/**
 * Spike endpoint: the client reports "I paid, here's the hash"; the server
 * decides whether that is true by asking the Stellar ledger.
 *
 * The destination is NOT taken from the request body on purpose — the client
 * doesn't get to say where the money was supposed to go. In the real app it
 * comes from the order's restaurant row; here, from a constant.
 */
export async function POST(request: Request) {
  let body: { hash?: string; amount?: string; memoId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { hash, amount, memoId } = body;
  if (!hash || !amount || !memoId) {
    return Response.json(
      { error: "hash, amount and memoId are all required." },
      { status: 400 }
    );
  }

  const result = await verifyPayment({
    hash,
    destination: SPIKE_OWNER_ADDRESS,
    amount,
    memoId,
  });

  return Response.json(result);
}
