import { SessionBar } from "@/core/features/auth/components/block/SessionBar";
import { OrderTracker } from "@/core/features/orders/components/block/OrderTracker";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="pages-container">
      <SessionBar />
      <main>
        <OrderTracker key={id} orderId={id} />
      </main>
    </div>
  );
}
