import type { DataSourceOptions, EntitySchema, MixedList } from 'typeorm';

export type PostgresConnectionSettings = {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
};

const CONNECTION_POOL_SIZE = 20;

export function createPostgresOptions(
  settings: PostgresConnectionSettings,
  entities: MixedList<string | (abstract new () => unknown) | EntitySchema>,
  migrationsDirectory: string,
): DataSourceOptions {
  return {
    type: 'postgres',
    ...settings,
    entities,
    migrations: [`${migrationsDirectory}/*.{ts,js}`],
    migrationsTableName: 'migrations',
    synchronize: false,
    migrationsRun: false,
    logging: ['error'],
    extra: { max: CONNECTION_POOL_SIZE },
  };
}
