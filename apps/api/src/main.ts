import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppLogger } from './common/logger/logger.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from './config/config.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { securityHeaders } from './common/middleware/security-headers';

async function bootstrap() {
  // Use transient AppLogger instance for boot logging
  const logger = new AppLogger();
  logger.setContext('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: logger,
    rawBody: true,
  });

  // Get configuration service
  const configService = app.get(ConfigService);
  const port = configService.get('PORT');

  // Enable CORS pinned to the app's own origins (never '*' with credentials)
  const configuredOrigins = (configService.get('CORS_ORIGINS') || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = configuredOrigins.length
    ? configuredOrigins
    : [configService.get('FRONTEND_URL')];
  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Resolve custom logger for exception filters
  const appLogger = await app.resolve(AppLogger);

  // Baseline security headers on every API response (no helmet dependency).
  app.use(securityHeaders);

  // Set global configurations
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter(appLogger));
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Setup OpenAPI 3.1 & Swagger Documentation for Creators and Autonomous Agents
  const swaggerConfig = new DocumentBuilder()
    .setTitle('DMPilot Agent & Creator API')
    .setDescription(
      'Official machine-readable and developer API for DMPilot Instagram automation, campaigns, webhooks, and autonomous agent control.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'dmp_live_... or JWT',
        description: 'Pass Personal Access Token (dmp_live_...) or session JWT token',
      },
      'bearer',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description: 'Pass Personal Access Token (dmp_live_...) in x-api-key header',
      },
      'api-key',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'DMPilot API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Expose raw OpenAPI 3.1 JSON endpoint for AI agent ingestion
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/api/openapi.json', (_req: any, res: any) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(document);
  });

  await app.listen(port);
  logger.log(`🚀 NestJS Backend API listening on http://localhost:${port}`);
  logger.log(`📑 Swagger Documentation available at http://localhost:${port}/api/docs`);
  logger.log(
    `🤖 Machine-readable OpenAPI spec available at http://localhost:${port}/api/openapi.json`,
  );
}

bootstrap();
