import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Delete,
} from '@nestjs/common'
import { ClerkGuard } from '../auth/clerk.guard'
import { ApplicationsService } from './applications.service'
import { ApplicationStage } from '../../schema/application.entity'
import { CurrentUser, RequestUser } from '../auth/current-user.decorator'

@UseGuards(ClerkGuard)
@Controller('v1/applications')
export class ApplicationsController {
  constructor(private readonly svc: ApplicationsService) {}

  @Get()
  async list(
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
    @Query('stage') stage?: string,
    @Query('milestone') milestone?: string,
    @Query('platform_id') platform_id?: string,
    @Query('source') source?: string,
    @Query('status') status?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
    @Query('ctc_min_lpa') ctc_min_lpa?: string,
    @Query('ctc_max_lpa') ctc_max_lpa?: string,
    @Query('var_pct_lte') var_pct_lte?: string,
    @Query('time_in_stage_gt') time_in_stage_gt?: string,
  ) {
    return this.svc.list(user.userId, {
      search,
      stage,
      milestone,
      platform_id,
      source,
      status,
      date_from,
      date_to,
      ctc_min_lpa,
      ctc_max_lpa,
      var_pct_lte,
      time_in_stage_gt,
    })
  }

  @Post()
  async create(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      company: { website_url?: string; company_id?: string }
      role: string
      job_url: string
      platform_id?: string | null
      source: string
      compensation?: { fixed_min_lpa?: number; fixed_max_lpa?: number; var_min_lpa?: number; var_max_lpa?: number; note?: string }
      qa_snapshot?: {
        current_ctc_text?: string
        expected_ctc_text?: string
        notice_period_text?: string
        reason_leaving_current_text?: string
        past_leaving_reasons_text?: string
      }
    },
  ) {
    return this.svc.create(user.userId, body)
  }

  @Get(':id')
  async getById(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.svc.getById(user.userId, id)
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      company: { website_url?: string; company_id?: string }
      company_id: string
      role: string
      job_url: string | null
      platform_id: string | null
      source: string
      stage: string | null;
      notes: string | null
      resume_variant: string | null
      compensation: { fixed_min_lpa?: number | null; fixed_max_lpa?: number | null; var_min_lpa?: number | null; var_max_lpa?: number | null; note?: string | null }
      qa_snapshot: {
        current_ctc_text?: string | null
        expected_ctc_text?: string | null
        notice_period_text?: string | null
        reason_leaving_current_text?: string | null
        past_leaving_reasons_text?: string | null
      }
    }>,
  ) {
    return this.svc.update(user.userId, id, body)
  }

  @Post(':id/transition')
  async transition(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { to_stage: ApplicationStage; reason?: string; admin_override?: boolean },
  ) {
    return this.svc.transition(user.userId, id, body)
  }

  @Get(':id/stage-history')
  async history(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.svc.getStageHistory(user.userId, id)
  }

  @Delete(':id')
  async delete(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.svc.delete(user.userId, id)
    return { deleted: true, id }
  }

  // Application Notes endpoints
  @Get(':id/notes')
  async getNotes(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.svc.getNotes(user.userId, id)
  }

  @Post(':id/notes')
  async createNote(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    return this.svc.createNote(user.userId, id, body.content)
  }

  @Delete('notes/:noteId')
  async deleteNote(@CurrentUser() user: RequestUser, @Param('noteId') noteId: string) {
    return this.svc.deleteNote(user.userId, noteId)
  }
}


