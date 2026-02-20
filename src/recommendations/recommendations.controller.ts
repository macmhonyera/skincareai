import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { RecommendDto } from './dto/create-recommendation.dto';
import { Request } from 'express';
import { OptionalAuthGuard } from 'src/auth/optional-auth.guard';
import { AuthGuard } from 'src/auth/auth.guard';
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
      limits: { fileSize: 6 * 1024 * 1024 },
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
}
