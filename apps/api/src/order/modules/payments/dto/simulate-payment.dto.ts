import { IsIn } from 'class-validator';

export const PAYMENT_OUTCOMES = ['succeeded', 'failed'] as const;
export type PaymentOutcome = (typeof PAYMENT_OUTCOMES)[number];

export class SimulatePaymentDto {
  @IsIn(PAYMENT_OUTCOMES)
  outcome: PaymentOutcome;
}

export type SimulatedPaymentResponse = {
  orderId: string;
  outcome: PaymentOutcome;
};
