import type { QuickBuyState } from "../../hook/useQuickBuy";

function messageFor(state: QuickBuyState): { text: string; isError: boolean } | null {
  switch (state.kind) {
    case "submitting":
      return { text: "در حال ثبت سفارش…", isError: false };
    case "redirecting":
      return {
        text: state.alreadyPlaced
          ? "این سفارش قبلاً ثبت شده است؛ در حال انتقال به صفحه‌ی سفارش…"
          : "سفارش ثبت شد؛ در حال انتقال به صفحه‌ی سفارش…",
        isError: false,
      };
    case "soldOut":
      return { text: "موجودی تمام شد.", isError: true };
    case "rateLimited":
      return {
        text: `درخواست‌ها زیاد است. ${state.retryAfterSeconds.toLocaleString("fa-IR")} ثانیه‌ی دیگر دوباره تلاش کنید.`,
        isError: true,
      };
    case "networkError":
      return {
        text: "اتصال برقرار نشد. دوباره تلاش کنید؛ همین سفارش دوباره ارسال می‌شود و تکراری ثبت نمی‌شود.",
        isError: true,
      };
    case "invalid":
      return { text: "درخواست نامعتبر بود. صفحه را تازه کنید و دوباره تلاش کنید.", isError: true };
    case "unauthorized":
      return { text: "نشست شما منقضی شده است. دوباره وارد شوید.", isError: true };
    case "idle":
      return null;
  }
}

export function QuickBuyMessage({ state }: { state: QuickBuyState }) {
  const message = messageFor(state);
  return (
    <p
      role="status"
      aria-live="polite"
      className={`min-h-6 text-sm ${message?.isError ? "text-destructive" : "text-muted-foreground"}`}
    >
      {message?.text}
    </p>
  );
}
