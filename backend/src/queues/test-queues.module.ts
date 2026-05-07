import { Global, Module } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';

const createQueue = (name: string) => ({
  name,
  add: async (jobName: string, data: unknown) => ({
    id: `${name}:${jobName}:${Date.now()}`,
    name: jobName,
    data,
  }),
  getJob: async () => null,
  close: async () => undefined,
});

@Global()
@Module({
  providers: [
    {
      provide: getQueueToken('github-sync'),
      useValue: createQueue('github-sync'),
    },
    {
      provide: getQueueToken('signal-compute'),
      useValue: createQueue('signal-compute'),
    },
    {
      provide: getQueueToken('email'),
      useValue: createQueue('email'),
    },
  ],
  exports: [
    getQueueToken('github-sync'),
    getQueueToken('signal-compute'),
    getQueueToken('email'),
  ],
})
export class TestQueuesModule {}
