import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Resume } from '../../schema/resume.entity'

@Injectable()
export class ResumesService {
  constructor(
    @InjectRepository(Resume)
    private readonly resumeRepository: Repository<Resume>,
  ) {}

  async findAllByUser(userId: string): Promise<Resume[]> {
    return this.resumeRepository.find({
      where: { user_id: userId },
      order: { updated_at: 'DESC' },
    })
  }

  async findOne(id: string, userId: string): Promise<Resume | null> {
    return this.resumeRepository.findOne({
      where: { id, user_id: userId },
    })
  }

  async create(userId: string, data: Partial<Resume>): Promise<Resume> {
    // If this is the first resume, make it default
    const existingCount = await this.resumeRepository.count({ where: { user_id: userId } })
    
    const resume = this.resumeRepository.create({
      ...data,
      user_id: userId,
      is_default: existingCount === 0 ? true : (data.is_default || false),
    })

    // If setting as default, unset others
    if (resume.is_default) {
      await this.resumeRepository.update(
        { user_id: userId, is_default: true },
        { is_default: false }
      )
    }

    return this.resumeRepository.save(resume)
  }

  async update(id: string, userId: string, data: Partial<Resume>): Promise<Resume | null> {
    const resume = await this.findOne(id, userId)
    if (!resume) return null

    // Handle default flag changes
    if (data.is_default === true) {
      await this.resumeRepository.update(
        { user_id: userId, is_default: true },
        { is_default: false }
      )
    }

    Object.assign(resume, data)
    return this.resumeRepository.save(resume)
  }

  async duplicate(id: string, userId: string): Promise<Resume | null> {
    const original = await this.findOne(id, userId)
    if (!original) return null

    const copy = this.resumeRepository.create({
      ...original,
      id: undefined,
      name: `${original.name} (Copy)`,
      is_default: false,
      created_at: undefined,
      updated_at: undefined,
    })

    return this.resumeRepository.save(copy)
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.resumeRepository.delete({ id, user_id: userId })
    return result.affected === 1
  }

  async setDefault(id: string, userId: string): Promise<Resume | null> {
    const resume = await this.findOne(id, userId)
    if (!resume) return null

    // Unset all defaults for this user
    await this.resumeRepository.update(
      { user_id: userId, is_default: true },
      { is_default: false }
    )

    // Set this one as default
    resume.is_default = true
    return this.resumeRepository.save(resume)
  }
}
