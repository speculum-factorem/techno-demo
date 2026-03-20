import { Field, CreateFieldDto } from '../entities/Field'

export interface IFieldRepository {
  getAll(): Promise<Field[]>
  getById(id: string): Promise<Field>
  create(dto: CreateFieldDto): Promise<Field>
  update(id: string, dto: Partial<CreateFieldDto>): Promise<Field>
  delete(id: string): Promise<void>
}
