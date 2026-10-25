import { Module } from '@nestjs/common';
import { OrdersModule } from '@order/modules/orders/orders.module';
import { DevPaymentController } from './controller/dev-payment.controller';
import { DevPaymentService } from './service/dev-payment.service';

@Module({
  imports: [OrdersModule],
  controllers: [DevPaymentController],
  providers: [DevPaymentService],
})
export class PaymentsModule {}
