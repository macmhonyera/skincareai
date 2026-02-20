import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { TypeOrmModule } from 'src/database/typeorm-ex.module';
import { ProductRepository } from './products.repository';

@Module({
  imports: [TypeOrmModule.forCustomRepository([ProductRepository])],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
