import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Role } from '../../schema/role.entity'
import { RoleGroup } from '../../schema/role-group.entity'
import { UserProfile } from '../../schema/user-profile.entity'
import { RolesService } from './roles.service'
import { RolesController } from './roles.controller'
import { ElasticsearchService } from '../../lib/elasticsearch.service'

@Module({
  imports: [TypeOrmModule.forFeature([Role, RoleGroup, UserProfile])],
  providers: [RolesService, ElasticsearchService],
  controllers: [RolesController],
  exports: [RolesService],
})
export class RolesModule {}
