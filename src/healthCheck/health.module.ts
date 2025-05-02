// src/health/health.module.ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { TypeOrmHealthIndicator } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TerminusModule, TypeOrmModule],
  controllers: [HealthController],
})
export class HealthModule {}
