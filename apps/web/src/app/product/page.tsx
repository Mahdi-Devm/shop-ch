import { SessionBar } from "@/core/features/auth/components/block/SessionBar";
import { ProductPanel } from "@/core/features/shop/components/block/ProductPanel";

export default function ProductPage() {
  return (
    <div className="pages-container">
      <SessionBar />
      <main>
        <ProductPanel />
      </main>
    </div>
  );
}
