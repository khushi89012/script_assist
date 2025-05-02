import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TaskStatus } from './enums/task-status.enum';
import { TaskPriority } from './enums/task-priority.enum';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,

    private readonly dataSource: DataSource,

    @InjectQueue('task-processing')
    private readonly taskQueue: Queue,
  ) {}

  async create(createTaskDto: CreateTaskDto): Promise<Task> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const task = this.tasksRepository.create(createTaskDto);
      const savedTask = await queryRunner.manager.save(task);

      await this.taskQueue.add('task-status-update', {
        taskId: savedTask.id,
        status: savedTask.status,
      });

      await queryRunner.commitTransaction();
      return savedTask;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException('Failed to create task');
    } finally {
      await queryRunner.release();
    }
  }

  async findAllPaginated({
    status,
    priority,
    page = 1,
    limit = 10,
  }: {
    status?: TaskStatus;
    priority?: TaskPriority;
    page?: number;
    limit?: number;
  }): Promise<{ data: Task[]; total: number; page: number; pageSize: number }> {
    const query = this.tasksRepository.createQueryBuilder('task');

    if (status) {
      query.andWhere('task.status = :status', { status });
    }

    if (priority) {
      query.andWhere('task.priority = :priority', { priority });
    }

    query.skip((page - 1) * limit).take(limit);
    query.leftJoinAndSelect('task.user', 'user');

    const [tasks, total] = await query.getManyAndCount();

    return {
      data: tasks,
      total,
      page,
      pageSize: limit,
    };
  }

  async getStats() {
    const taskCounts = await this.tasksRepository
      .createQueryBuilder('task')
      .select('task.status, COUNT(*) as count')
      .groupBy('task.status')
      .getRawMany();

    return taskCounts;
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.tasksRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    const task = await this.findOne(id);
    const originalStatus = task.status;

    Object.assign(task, updateTaskDto);

    const updatedTask = await this.tasksRepository.save(task);

    if (originalStatus !== updatedTask.status) {
      await this.taskQueue.add('task-status-update', {
        taskId: updatedTask.id,
        status: updatedTask.status,
      });
    }

    return updatedTask;
  }

  async remove(id: string): Promise<void> {
    const result = await this.tasksRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
  }

  async batchProcess(tasks: string[], action: 'complete' | 'delete') {
    if (action === 'complete') {
      return this.completeMultiple(tasks);
    } else if (action === 'delete') {
      return this.removeMultiple(tasks);
    }
  }

  private async completeMultiple(taskIds: string[]): Promise<Task[]> {
    return this.dataSource.transaction(async (manager) => {
      const foundTasks = await manager.find(Task, { where: { id: In(taskIds) } });

      const updatedTasks = foundTasks.map((task) => {
        task.status = TaskStatus.COMPLETED;
        return task;
      });

      return manager.save(Task, updatedTasks);
    });
  }

  private async removeMultiple(taskIds: string[]): Promise<void> {
    await this.tasksRepository.delete({ id: In(taskIds) });
  }

  async updateStatus(taskId: string, status: TaskStatus): Promise<Task> {
    const task = await this.findOne(taskId);
    task.status = status;

    const updatedTask = await this.tasksRepository.save(task);

    await this.taskQueue.add('task-status-update', {
      taskId: updatedTask.id,
      status: updatedTask.status,
    });

    return updatedTask;
  }

  async processOverdueTasks(): Promise<void> {
    const overdueTasks = await this.tasksRepository
      .createQueryBuilder('task')
      .where('task.dueDate < NOW()')
      .andWhere('task.status != :completed', { completed: TaskStatus.COMPLETED })
      .getMany();

    for (const task of overdueTasks) {
      task.status = TaskStatus.OVERDUE;
      await this.tasksRepository.save(task);

      await this.taskQueue.add('task-status-update', {
        taskId: task.id,
        status: task.status,
      });
    }
  }
}
