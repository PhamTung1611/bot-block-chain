import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// file này thừa
@Module({
  imports: [ConfigModule.forRoot()],
})
export class ConfigsModule {}
