import { Injectable } from '@nestjs/common';
const cluster = require('cluster');
import * as process from 'node:process';

const numCPUs = parseInt(process.argv[2] || '1');
@Injectable()
export class ClusterService {
  clusterize(bootstrap: () => Promise<void>) {
    if (cluster.isPrimary) {
      console.log(`MASTER SERVER (${process.pid}) IS RUNNING `);
      // Foconst element of cluster.cpus()
      for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
      }

      // Listen for worker deaths.
      cluster.on('exit', (worker) => {
        console.log('Worker died:', worker.process.pid);

        // Fork a new worker to replace the dead worker.
        cluster.fork();
      });
    } else {
      // Start the NestJS application.
      bootstrap();
    }
  }
}
