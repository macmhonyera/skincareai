/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';

@Injectable()
export class MistralService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getIngredientAdvice(
    skinType: string,
    concerns: string[],
  ): Promise<string> {
    const prompt = `Suggest 5 to 10 skincare ingredients as a raw JSON array (no markdown, no code block, no explanation). Only return: ["ingredient1", "ingredient2", ...]. This is for skin type: ${skinType}, concerns: ${concerns.join(', ')}.`;
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');

    if (!apiKey) {
      throw new InternalServerErrorException('OpenRouter API key not found.');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: 'openai/gpt-4.1',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 512, // Prevent over-quota 402 error
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.data.choices?.[0]?.message?.content ?? 'No AI response.';
    } catch (error) {
      const axiosError = error as AxiosError;
      const responseData = axiosError.response?.data as any;

      const message =
        responseData?.error?.message ??
        axiosError.message ??
        'Unknown error occurred while calling OpenRouter API';

      console.error('❌ OpenRouter API Error:', message);
      throw new InternalServerErrorException(`Mistral API Error: ${message}`);
    }
  }
}
