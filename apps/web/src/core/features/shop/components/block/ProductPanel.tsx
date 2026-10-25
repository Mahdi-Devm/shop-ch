"use client";

import { Button } from "@/core/components/shadcn/ui/button/button";
import { loginPath, useRequireSession } from "@/core/features/auth/hook/useRequireSession";
import { useAuth } from "@/core/features/auth/hook/useAuth";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { FLASH_SALE_PRODUCT_ID } from "../../assets/@types/shop.types";
import { useProductStock } from "../../hook/useProductStock";
import { useQuickBuy } from "../../hook/useQuickBuy";
import { QuickBuyMessage } from "../ui/QuickBuyMessage";
import { ProductPanelSkeleton } from "../ui/skeleton/ProductPanelSkeleton";

function formatCount(value: number): string {
  return value.toLocaleString("fa-IR");
}

export function ProductPanel() {
  const session = useRequireSession();
  const { logout } = useAuth();
  const router = useRouter();
  const token = session?.token ?? null;
  const { state: stockState, refresh } = useProductStock(FLASH_SALE_PRODUCT_ID, token);

  const goToOrder = useCallback(
    (orderId: string) => router.push(`/orders/${orderId}`),
    [router],
  );
  const refreshStock = useCallback(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const { state: buyState, buy, isDisabled } = useQuickBuy({
    productId: FLASH_SALE_PRODUCT_ID,
    token,
    onOrderPlaced: goToOrder,
    onSoldOut: refreshStock,
  });

  const sessionExpired = stockState.kind === "unauthorized" || buyState.kind === "unauthorized";
  useEffect(() => {
    if (sessionExpired) {
      logout();
      router.replace(loginPath("/product"));
    }
  }, [sessionExpired, logout, router]);

  if (!session || stockState.kind === "loading") {
    return <ProductPanelSkeleton />;
  }

  if (stockState.kind === "notFound") {
    return (
      <section className="bg-card rounded-lg p-6 sm:p-10">
        <h1 className="text-2xl font-medium">محصول پیدا نشد</h1>
        <p className="text-muted-foreground mt-2">موجودی این محصول هنوز در دسترس نیست. کمی بعد دوباره سر بزنید.</p>
      </section>
    );
  }

  const product =
    stockState.kind === "ready"
      ? stockState.product
      : stockState.kind === "unavailable"
        ? stockState.lastKnown
        : null;
  const isSoldOut = buyState.kind === "soldOut" || (product !== null && product.stock <= 0);

  return (
    <section
      aria-labelledby="product-title"
      className="bg-card grid gap-8 rounded-lg p-6 sm:grid-cols-[1fr_auto] sm:items-end sm:p-10"
    >
      <div className="space-y-5">
        <h1 id="product-title" className="text-2xl font-medium sm:text-3xl">
          محصول فروش ویژه
        </h1>

        {product ? (
          <dl className="flex flex-wrap gap-x-12 gap-y-4">
            <div>
              <dt className="text-muted-foreground text-sm">موجودی قابل خرید</dt>
              <dd className="text-6xl font-medium tabular-nums sm:text-7xl" aria-live="polite">
                {formatCount(product.stock)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">رزرو شده</dt>
              <dd className="text-6xl font-medium tabular-nums text-muted-foreground sm:text-7xl">
                {formatCount(product.reserved)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-muted-foreground">موجودی فعلاً نامشخص است.</p>
        )}

        {stockState.kind === "unavailable" && (
          <p role="status" className="text-destructive text-sm">
            ارتباط با سرور قطع شد؛ آخرین موجودی شناخته‌شده نمایش داده می‌شود.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:w-64">
        <Button
          size="lg"
          className="h-14 w-full"
          onClick={() => {
            buy().catch(() => undefined);
          }}
          disabled={isDisabled || isSoldOut}
          aria-disabled={isDisabled || isSoldOut}
        >
          {isSoldOut
            ? "تمام شد"
            : buyState.kind === "submitting" || buyState.kind === "redirecting"
              ? "در حال ثبت…"
              : buyState.kind === "networkError"
                ? "تلاش دوباره"
                : "خرید سریع"}
        </Button>
        <QuickBuyMessage state={buyState} />
      </div>
    </section>
  );
}
