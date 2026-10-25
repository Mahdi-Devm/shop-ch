"use client";

import { Button } from "@/core/components/shadcn/ui/button/button";
import { useAuth } from "@/core/features/auth/hook/useAuth";
import { loginPath, useRequireSession } from "@/core/features/auth/hook/useRequireSession";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { StreamConnection } from "../../hook/useOrderStatus";
import { useOrderStatus } from "../../hook/useOrderStatus";
import { isFailedStatus, ORDER_STATUS_LABELS } from "../../utils/order-status";
import { DevPaymentControls } from "../ui/DevPaymentControls";
import { OrderStatusSteps } from "../ui/OrderStatusSteps";
import { OrderTrackerSkeleton } from "../ui/skeleton/OrderTrackerSkeleton";

const DEV_PAYMENT_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEV_PAYMENT === "true";

const CONNECTION_LABELS: Record<StreamConnection, string> = {
  connecting: "در حال اتصال به به‌روزرسانی زنده…",
  live: "به‌روزرسانی زنده فعال است",
  reconnecting: "اتصال قطع شد؛ در حال اتصال دوباره…",
  closed: "سفارش به مرحله‌ی نهایی رسید",
};

function MessagePanel({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <section className="bg-card space-y-3 rounded-lg p-6 sm:p-10">
      <h1 className="text-2xl font-medium">{title}</h1>
      <p className="text-muted-foreground">{body}</p>
      {action}
    </section>
  );
}

export function OrderTracker({ orderId }: { orderId: string }) {
  const session = useRequireSession();
  const { logout } = useAuth();
  const router = useRouter();
  const token = session?.token ?? null;
  const { state, retry } = useOrderStatus(orderId, token);

  useEffect(() => {
    if (state.kind === "unauthorized") {
      logout();
      router.replace(loginPath(`/orders/${orderId}`));
    }
  }, [state.kind, logout, router, orderId]);

  if (!session || state.kind === "loading" || state.kind === "unauthorized") {
    return <OrderTrackerSkeleton />;
  }

  if (state.kind === "notFound") {
    return (
      <MessagePanel
        title="سفارش پیدا نشد"
        body="این سفارش وجود ندارد یا متعلق به حساب دیگری است."
        action={
          <Link href="/product" className="text-primary underline-offset-4 hover:underline">
            بازگشت به محصول
          </Link>
        }
      />
    );
  }

  if (state.kind === "error") {
    return (
      <MessagePanel
        title="اتصال برقرار نشد"
        body="وضعیت سفارش دریافت نشد. دوباره تلاش کنید."
        action={
          <Button className="h-11" onClick={retry}>
            تلاش دوباره
          </Button>
        }
      />
    );
  }

  const { order, connection } = state;
  const isFailed = isFailedStatus(order.status);

  return (
    <section aria-labelledby="order-title" className="bg-card space-y-8 rounded-lg p-6 sm:p-10">
      <div className="space-y-2">
        <h1 id="order-title" className="text-2xl font-medium sm:text-3xl">
          وضعیت سفارش
        </h1>
        <p
          role="status"
          aria-live="polite"
          className={`text-4xl font-medium sm:text-5xl ${isFailed ? "text-destructive" : ""}`}
        >
          {ORDER_STATUS_LABELS[order.status]}
        </p>
      </div>

      <OrderStatusSteps status={order.status} />

      {DEV_PAYMENT_ENABLED && order.status === "Reserved" && token && (
        <DevPaymentControls key={order.version} orderId={order.orderId} token={token} />
      )}

      <dl className="text-muted-foreground grid gap-x-8 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt>شناسه‌ی سفارش</dt>
        <dd dir="ltr" className="text-foreground text-start break-all">
          {order.orderId}
        </dd>
        <dt>زمان ثبت</dt>
        <dd className="text-foreground">
          {new Date(order.createdAt).toLocaleString("fa-IR")}
        </dd>
        <dt>اتصال</dt>
        <dd className={connection === "reconnecting" ? "text-destructive" : "text-foreground"}>
          {CONNECTION_LABELS[connection]}
        </dd>
      </dl>

      <Link
        href="/product"
        className="text-primary inline-flex min-h-11 items-center underline-offset-4 hover:underline"
      >
        بازگشت به محصول
      </Link>
    </section>
  );
}
