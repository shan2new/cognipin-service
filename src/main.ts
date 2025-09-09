import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './modules/app.module'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as bodyParser from 'body-parser'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const config = app.get(ConfigService)
  const corsOrigins = (config.get<string>('CORS_ORIGINS') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : '*',
    credentials: config.get<string>('CORS_CREDENTIALS') === 'true',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    // Allow CopilotKit runtime client headers and any X-Custom-* auth headers
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CopilotKit-Runtime-Client-Gql-Version',
      'X-CopilotKit-Public-Api-Key',
      'X-Custom-Authorization',
      'X-Custom-Auth',
      'X-Custom-User',
    ],
  })
  app.setGlobalPrefix('api')
  // Increase JSON body limit for network logs from extension
  app.use(bodyParser.json({ limit: '1mb' }))
  app.use(bodyParser.urlencoded({ limit: '1mb', extended: true }))
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  const port = Number(process.env.PORT || 8080)
  await app.listen(port)
  // eslint-disable-next-line no-console
  console.log(`cognipin-service listening on :${port}`)
}

bootstrap()



