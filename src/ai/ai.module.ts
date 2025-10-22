import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MistralService } from './mistral.service';

@Module({
  imports: [HttpModule],
  providers: [MistralService],
  exports: [MistralService],
})
export class AiModule {}
