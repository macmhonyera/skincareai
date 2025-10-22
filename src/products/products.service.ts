import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductRepository } from './products.repository';
import { ILike } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductRepository)
    private readonly productRepository: ProductRepository,
  ) {}

  findAll(): Promise<Product[]> {
    return this.productRepository.find();
  }

  findByIngredients(ingredients: string[]): Promise<Product[]> {
    return this.productRepository.find({
      where: ingredients.map((ingredient) => ({
        ingredients: ILike(`%${ingredient}%`),
      })),
    });
  }

  create(dto: CreateProductDto): Promise<Product> {
    const newProduct = this.productRepository.create(dto);
    return this.productRepository.save(newProduct);
  }
}
