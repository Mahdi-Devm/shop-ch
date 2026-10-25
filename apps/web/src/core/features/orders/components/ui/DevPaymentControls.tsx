"use client";

import { Button } from "@/core/components/shadcn/ui/button/button";
import { useState } from "react";
import type { PaymentOutcome } from "../../assets/@types/orders.types";
import { requestDevPayment } from "../../lib/orders-api";

type DevPaymentControlsProps = {
  orderId: string;
  token: string;
};

export function DevPaymentControls({ orderId, token }: DevPaymentControlsProps) {
  const [pending, setPending] = useState<PaymentOutcome | null>(null);
  const [failed, setFailed] = useState(false);

  async function pay(outcome: PaymentOutcome) {
    setPending(outcome);
    setFailed(false);
    const result = await requestDevPayment(orderId, token, outcome);
    if (!result.ok) {
      setPending(null);
      setFailed(true);
    }
  }

  return (
    <div className="bg-muted space-y-3 rounded-md p-4">
      <p className="text-muted-foreground text-sm">
        سرویس پرداخت در این نسخه پیاده‌سازی نشده است؛ نتیجه‌ی پرداخت را شبیه‌سازی کنید.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          className="h-11"
          disabled={pending !== null}
          onClick={() => {
            pay("succeeded").catch(() => undefined);
          }}
        >
          {pending === "succeeded" ? "در حال ارسال…" : "پرداخت موفق"}
        </Button>
        <Button
          variant="outline"
          className="h-11"
          disabled={pending !== null}
          onClick={() => {
            pay("failed").catch(() => undefined);
          }}
        >
          {pending === "failed" ? "در حال ارسال…" : "پرداخت ناموفق"}
        </Button>
      </div>
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          ارسال نتیجه‌ی پرداخت انجام نشد. دوباره تلاش کنید.
        </p>
      )}
    </div>
  );
}
