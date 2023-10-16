import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Processor('wallet:optimize', {
  concurrency: 50,
  limiter: {
    max: 50,
    duration: 30000,
  },
})
export class ImageOptimizationProcessor extends WorkerHost {
  private logger = new Logger();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async process(job: Job<any, any, string>, token?: string): Promise<any> {
    switch (job.name) {
      case 'create-wallet':
        const wallet = await this.walletQueue(job.data);
        console.log({ wallet });
        this.logger.log('create wallet completed');
        return wallet;
      case 'mint-token':
        const dataMint = await this.mintQueue(job.data);
        console.log({ dataMint });
        this.logger.log('mint token completed');
        return dataMint;
      case 'burn-token':
        const dataBurn = await this.burnQueue(job.data);
        console.log({ dataBurn });
        this.logger.log('burn token completed');
        return dataBurn;
      case 'transfer-token':
        const datatransfer = await this.transferQueue(job.data);
        console.log({ datatransfer });
        this.logger.log('transfer token completed');
        return datatransfer;
      case 'get-balance':
        const balanceData = await this.balanceQueue(job.data);
        console.log({ balanceData });
        return balanceData;
      default:
        throw new Error('No job name match');
    }
  }
  async walletQueue(wallet: any) {
    this.logger.log('creating wallet account....');
    return Promise.resolve(wallet);
  }
  async mintQueue(dataMint: any) {
    this.logger.log('min token ....');
    return Promise.resolve(dataMint);
  }

  async burnQueue(dataBurn: any) {
    this.logger.log('burn token ....');
    return Promise.resolve(dataBurn);
  }
  async transferQueue(dataBurn: any) {
    this.logger.log('transfer token ....');
    return Promise.resolve(dataBurn);
  }
  async balanceQueue(dataBurn: any) {
    this.logger.log('checking balance ....');
    return Promise.resolve(dataBurn);
  }
  @OnWorkerEvent('active')
  onQueueActive(job: Job) {
    this.logger.log(
      `Processing job ${job.id} of type ${job.name} with data ${job.data}...`,
    );
  }

  @OnWorkerEvent('completed')
  onQueueComplete(job: Job) {
    this.logger.log(`Job has been finished: ${job.id} at ${job.finishedOn}`);
  }

  @OnWorkerEvent('failed')
  onQueueFailed(job: Job, err: any) {
    this.logger.log(`Job has been failed: ${job.id}`);
    this.logger.log({ err });
  }

  @OnWorkerEvent('error')
  onQueueError(err: any) {
    this.logger.log(`Job has got error: `);
    this.logger.log({ err });
  }
}
