import { Module } from '@nestjs/common';
import { StockCommandsConsumer } from './controller/stock-commands.consumer';
import { StockRepository } from './repository/stock.repository';
import { StockReservationService } from './service/stock-reservation.service';

@Module({
  providers: [StockRepository, StockReservationService, StockCommandsConsumer],
})
export class StockModule {}
