import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './modules/app.module'
import { ValidationPipe } from '@nestjs/common'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors({ origin: '*', credentials: false })
  app.setGlobalPrefix('api')
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  const port = Number(process.env.PORT || 8080)
  await app.listen(port)
  // eslint-disable-next-line no-console
  console.log(`cognipin-service listening on :${port}`)
}

bootstrap()



