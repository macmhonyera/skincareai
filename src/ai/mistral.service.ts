/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';

type RecommendationProfile = {
  skinType: string;
  concerns: string[];
  sensitivities?: string[];
  routineGoal?: string;
  budgetLevel?: string;
};

@Injectable()
export class MistralService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getIngredientAdvice(profile: RecommendationProfile): Promise<string> {
    const prompt = [
      'You are a cosmetic formulation assistant.',
      'Return 6-10 skincare ingredients as a raw JSON string array only.',
      'No markdown, no explanation, no extra keys.',
      `Skin type: ${profile.skinType}.`,
      `Concerns: ${profile.concerns.join(', ')}.`,
      `Sensitivities: ${(profile.sensitivities ?? []).join(', ') || 'none'}.`,
      `Goal: ${profile.routineGoal ?? 'general skin health'}.`,
      `Budget level: ${profile.budgetLevel ?? 'not specified'}.`,
      'Avoid ingredients that conflict with listed sensitivities.',
      'Respond exactly like ["ingredient 1", "ingredient 2"].',
    ].join(' ');

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
