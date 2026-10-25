import { createEnvironmentValidator } from '@common/config/validate-environment';
import { OrderEnvironment } from '@order/config/order-environment';

const validEnvironment = {
  JWT_SECRET: 'a-sufficiently-long-secret',
  POSTGRES_USER: 'postgres',
  POSTGRES_PASSWORD: 'postgres',
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '15432',
  POSTGRES_DB: 'order_db',
  RABBITMQ_URL: 'amqp://guest:guest@localhost:5672',
};

describe('createEnvironmentValidator', () => {
  const validate = createEnvironmentValidator(OrderEnvironment);

  it('converts numeric strings and applies defaults', () => {
    const environment = validate(validEnvironment);

    expect(environment.POSTGRES_PORT).toBe(15432);
    expect(environment.PORT_ORDER).toBe(3001);
    expect(environment.NODE_ENV).toBe('development');
  });

  it('rejects a short jwt secret without echoing its value', () => {
    expect(() =>
      validate({ ...validEnvironment, JWT_SECRET: 'tiny-secret' }),
    ).toThrow('Invalid environment variables: JWT_SECRET');
  });

  it('rejects a missing database host', () => {
    expect(() =>
      validate({ ...validEnvironment, POSTGRES_HOST: undefined }),
    ).toThrow('POSTGRES_HOST');
  });
});
