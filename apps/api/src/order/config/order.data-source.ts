import { loadEnvironment } from '@common/config/load-environment';
import { DataSource } from 'typeorm';
import {
  createOrderDataSourceOptions,
  orderDatabaseSettings,
} from './order-database.config';
import { OrderEnvironment } from './order-environment';

export default new DataSource(
  createOrderDataSourceOptions(
    orderDatabaseSettings(loadEnvironment(OrderEnvironment)),
  ),
);
