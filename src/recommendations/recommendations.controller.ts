import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { RecommendDto } from './dto/create-recommendation.dto';
import { Request, Response } from 'express';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { AuthGuard } from '../auth/auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';

type AuthenticatedRequest = Request & {
  user?: {
    sub: string;
    email: string;
    planTier: 'free' | 'pro';
  };
};

@Controller('recommend')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @UseGuards(OptionalAuthGuard)
  @Post()
  async recommend(
    @Body() recommendDto: RecommendDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.recommendationsService.getRecommendations(recommendDto, {
      userId: req.user?.sub ?? null,
      planTier: req.user?.planTier ?? 'free',
      source: 'form',
    });
  }

  @UseGuards(OptionalAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 4 * 1024 * 1024 },
    }),
  )
  @Post('with-image')
  async recommendWithImage(
    @UploadedFile() image: { buffer: Buffer; mimetype: string },
    @Body() recommendDto: RecommendDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!image) {
      throw new BadRequestException('Image file is required.');
    }

    return this.recommendationsService.getRecommendationsWithImage(
      recommendDto,
      image,
      {
        userId: req.user?.sub ?? null,
        planTier: req.user?.planTier ?? 'free',
      },
    );
  }

  @UseGuards(AuthGuard)
  @Get('history')
  async history(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number(limit);
    const resolvedLimit = Number.isNaN(parsedLimit) ? 20 : parsedLimit;

    return this.recommendationsService.getHistory(req.user!.sub, resolvedLimit);
  }

  @UseGuards(AuthGuard)
  @Get('progress')
  async progress(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number(limit);
    const resolvedLimit = Number.isNaN(parsedLimit) ? 15 : parsedLimit;

    return this.recommendationsService.getPhotoProgress(
      req.user!.sub,
      resolvedLimit,
    );
  }

  @Get('image/:id')
  async progressImage(@Param('id') id: string, @Res() res: Response) {
    const image = await this.recommendationsService.getProgressImage(id);
    if (!image) {
      throw new NotFoundException('Progress image not found.');
    }

    res.setHeader('Content-Type', image.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(image.data);
  }
}
