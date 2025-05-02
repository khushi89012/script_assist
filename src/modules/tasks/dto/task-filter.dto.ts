import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsDateString, IsArray } from 'class-validator';
import { TaskStatus } from '../enums/task-status.enum';
import { TaskPriority } from '../enums/task-priority.enum';

export class TaskFilterDto {
  @ApiProperty({
    description: 'Filter tasks by status',
    enum: TaskStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiProperty({
    description: 'Filter tasks by priority',
    enum: TaskPriority,
    required: false,
  })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiProperty({
    description: 'Filter tasks by user ID',
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({
    description: 'Search query to filter tasks by name or description',
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  searchQuery?: string;

  @ApiProperty({
    description: 'Filter tasks within a specific date range',
    type: String,
    required: false,
    example: '2022-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'Filter tasks within a specific date range',
    type: String,
    required: false,
    example: '2022-12-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
