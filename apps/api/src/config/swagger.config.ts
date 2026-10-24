import type { INestApplication } from '@nestjs/common';
import type { SwaggerCustomOptions } from '@nestjs/swagger';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function initSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Secure Multi-Tenant Assessment Dashboard API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const customOptions: SwaggerCustomOptions = {
    customSiteTitle: 'Assessment API',
    customCss: '.swagger-ui .topbar { background-color: #2c3e50; }',
    swaggerOptions: {
      persistAuthorization: true,
      filter: true,
    },
  };
  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('/docs', app, document, customOptions);
}
