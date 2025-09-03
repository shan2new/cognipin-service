import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AutofillController } from './autofill.controller'
import { AutofillService } from './autofill.service'
import { AutofillAiService } from './autofill.ai.service'
import { UserAutofillState } from '../../schema/autofill-state.entity'

@Module({
  imports: [TypeOrmModule.forFeature([UserAutofillState])],
  controllers: [AutofillController],
  providers: [AutofillService, AutofillAiService],
})
export class AutofillModule {}


