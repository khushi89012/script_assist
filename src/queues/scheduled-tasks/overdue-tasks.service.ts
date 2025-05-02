import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Task } from '../../modules/tasks/entities/task.entity';
import { TaskStatus } from '../../modules/tasks/enums/task-status.enum';

@Injectable()
export class OverdueTasksService {
  private readonly logger = new Logger(OverdueTasksService.name);

  constructor(
    @InjectQueue('task-processing')
    private readonly taskQueue: Queue,

    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
  ) {}

  // Run every hour to check and enqueue overdue tasks
  @Cron(CronExpression.EVERY_HOUR)
  async checkOverdueTasks() {
    this.logger.debug('Initiating hourly overdue task check');

    try {
      const now = new Date();

      const overdueTasks = await this.tasksRepository.find({
        where: {
          dueDate: LessThan(now),
          status: TaskStatus.PENDING,
        },
      });

      this.logger.log(`Found ${overdueTasks.length} overdue tasks`);

      for (const task of overdueTasks) {
        await this.taskQueue.add('overdue-task-handler', {
          taskId: task.id,
          dueDate: task.dueDate,
        });

        this.logger.verbose(`Queued overdue task: ${task.id}`);
      }

      this.logger.debug('Overdue task check completed successfully');
    } catch (error) {
      this.logger.error('Error while checking overdue tasks', error);
    }
  }
}