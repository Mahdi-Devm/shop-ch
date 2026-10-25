import { CurrentUser } from '@common/auth/auth.decorators';
import type { AuthenticatedUser } from '@common/auth/authenticated-user';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  SimulatedPaymentResponse,
  SimulatePaymentDto,
} from '../dto/simulate-payment.dto';
import { DevPaymentService } from '../service/dev-payment.service';

@Controller('api/dev/orders')
export class DevPaymentController {
  constructor(private readonly devPaymentService: DevPaymentService) {}

  @Post(':id/payment')
  @HttpCode(HttpStatus.ACCEPTED)
  simulatePayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body() request: SimulatePaymentDto,
  ): Promise<SimulatedPaymentResponse> {
    return this.devPaymentService.simulate(
      orderId,
      user.userId,
      request.outcome,
    );
  }
}
