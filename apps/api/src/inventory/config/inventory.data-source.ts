import { loadEnvironment } from '@common/config/load-environment';
import { DataSource } from 'typeorm';
import {
  createInventoryDataSourceOptions,
  inventoryDatabaseSettings,
} from './inventory-database.config';
import { InventoryEnvironment } from './inventory-environment';

export default new DataSource(
  createInventoryDataSourceOptions(
    inventoryDatabaseSettings(loadEnvironment(InventoryEnvironment)),
  ),
);
