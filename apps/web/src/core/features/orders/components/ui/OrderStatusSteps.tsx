import type { OrderStatus } from "../../assets/@types/orders.types";
import { isFailedStatus, ORDER_STATUS_LABELS } from "../../utils/order-status";

type Step = {
  key: string;
  title: string;
  isDone: boolean;
  isCurrent: boolean;
  isFailed: boolean;
};

function stepsFor(status: OrderStatus): Step[] {
  const outcome: OrderStatus = status === "Pending" || status === "Reserved" ? "Paid" : status;
  const reachedReservation = status !== "Pending" && status !== "Cancelled";
  const isOutcome = status === "Paid" || isFailedStatus(status);

  return [
    {
      key: "placed",
      title: "ثبت سفارش",
      isDone: status !== "Pending",
      isCurrent: status === "Pending",
      isFailed: false,
    },
    {
      key: "reserved",
      title: "رزرو موجودی",
      isDone: reachedReservation && status !== "Reserved",
      isCurrent: status === "Reserved",
      isFailed: status === "Cancelled" && !reachedReservation,
    },
    {
      key: "outcome",
      title: isOutcome ? ORDER_STATUS_LABELS[outcome] : "پرداخت",
      isDone: status === "Paid",
      isCurrent: isOutcome,
      isFailed: isFailedStatus(status),
    },
  ];
}

function stepTone(step: Step): string {
  if (step.isFailed && step.isCurrent) {
    return "bg-destructive/10 text-destructive";
  }
  if (step.isDone) {
    return "bg-secondary text-secondary-foreground";
  }
  if (step.isCurrent) {
    return "bg-accent text-accent-foreground";
  }
  return "bg-muted text-muted-foreground";
}

export function OrderStatusSteps({ status }: { status: OrderStatus }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-3" aria-label="مراحل سفارش">
      {stepsFor(status).map((step) => (
        <li
          key={step.key}
          aria-current={step.isCurrent ? "step" : undefined}
          className={`flex min-h-16 items-center rounded-md px-4 py-3 text-base font-medium transition-colors duration-300 motion-reduce:transition-none ${stepTone(step)}`}
        >
          {step.title}
        </li>
      ))}
    </ol>
  );
}
