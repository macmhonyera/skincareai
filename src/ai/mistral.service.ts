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

type ImageAnalysisResult = {
  suggestedSkinType: string | null;
  detectedConcerns: string[];
  observations: string[];
  confidence: number;
  concernScores: {
    acne: number;
    pigmentation: number;
    redness: number;
    texture: number;
    dehydration: number;
    oiliness: number;
  };
  overallSkinScore: number;
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

  async analyzeSkinImage(params: {
    imageBase64: string;
    mimeType: string;
    notes?: string;
    skinTypeHint?: string;
    concernsHint?: string[];
  }): Promise<ImageAnalysisResult> {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('OpenRouter API key not found.');
    }

    const prompt = [
      'You are a dermatology-aware skincare assistant.',
      'Analyze this face photo for skincare planning only.',
      'Return JSON object only with keys:',
      '{"suggestedSkinType":string|null,"detectedConcerns":string[],"observations":string[],"confidence":number,"concernScores":{"acne":number,"pigmentation":number,"redness":number,"texture":number,"dehydration":number,"oiliness":number},"overallSkinScore":number}.',
      'concernScores must be severity from 0-100 where higher means worse.',
      'overallSkinScore must be 0-100 where higher means healthier overall skin appearance.',
      'Do not diagnose diseases. Keep concerns cosmetic and practical.',
      `Notes from user: ${params.notes ?? 'none'}.`,
      `Skin type hint: ${params.skinTypeHint ?? 'none'}.`,
      `Concern hint: ${(params.concernsHint ?? []).join(', ') || 'none'}.`,
    ].join(' ');

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: 'openai/gpt-4.1-mini',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${params.mimeType};base64,${params.imageBase64}`,
                    },
                  },
                ],
              },
            ],
            max_tokens: 700,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const raw = response.data.choices?.[0]?.message?.content ?? '';
      const parsed = this.parseImageAnalysis(raw);
      return parsed;
    } catch (error) {
      const axiosError = error as AxiosError;
      const responseData = axiosError.response?.data as any;
      const message =
        responseData?.error?.message ??
        axiosError.message ??
        'Unknown error occurred while calling OpenRouter API';

      console.error('❌ OpenRouter image analysis error:', message);
      throw new InternalServerErrorException(`Image analysis error: ${message}`);
    }
  }

  private parseImageAnalysis(raw: string): ImageAnalysisResult {
    const parsed = this.parseJsonFromText(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {
        suggestedSkinType: null,
        detectedConcerns: [],
        observations: [],
        confidence: 0.4,
        concernScores: {
          acne: 50,
          pigmentation: 50,
          redness: 50,
          texture: 50,
          dehydration: 50,
          oiliness: 50,
        },
        overallSkinScore: 50,
      };
    }

    const object = parsed as {
      suggestedSkinType?: unknown;
      detectedConcerns?: unknown;
      observations?: unknown;
      confidence?: unknown;
      concernScores?: unknown;
      overallSkinScore?: unknown;
    };

    const suggestedSkinType =
      typeof object.suggestedSkinType === 'string'
        ? object.suggestedSkinType.trim().toLowerCase()
        : null;
    const detectedConcerns = Array.isArray(object.detectedConcerns)
      ? object.detectedConcerns
          .filter((item) => typeof item === 'string')
          .map((item) => item.trim().toLowerCase())
      : [];
    const observations = Array.isArray(object.observations)
      ? object.observations
          .filter((item) => typeof item === 'string')
          .map((item) => item.trim())
      : [];
    const confidence =
      typeof object.confidence === 'number'
        ? Math.max(0, Math.min(1, object.confidence))
        : 0.5;
    const concernScores = this.parseConcernScores(object.concernScores);
    const overallSkinScore = this.normalizeScore(object.overallSkinScore, 50);

    return {
      suggestedSkinType,
      detectedConcerns: Array.from(new Set(detectedConcerns)),
      observations: Array.from(new Set(observations)),
      confidence,
      concernScores,
      overallSkinScore,
    };
  }

  private parseConcernScores(raw: unknown) {
    const source =
      raw && typeof raw === 'object'
        ? (raw as Record<string, unknown>)
        : ({} as Record<string, unknown>);

    return {
      acne: this.normalizeScore(source.acne, 50),
      pigmentation: this.normalizeScore(source.pigmentation, 50),
      redness: this.normalizeScore(source.redness, 50),
      texture: this.normalizeScore(source.texture, 50),
      dehydration: this.normalizeScore(source.dehydration, 50),
      oiliness: this.normalizeScore(source.oiliness, 50),
    };
  }

  private normalizeScore(value: unknown, fallback: number) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return fallback;
    }

    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private parseJsonFromText(raw: string): unknown {
    const cleaned = (raw ?? '')
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const candidates = [cleaned];
    const startIndex = cleaned.indexOf('{');
    const endIndex = cleaned.lastIndexOf('}');

    if (startIndex !== -1 && endIndex > startIndex) {
      candidates.push(cleaned.slice(startIndex, endIndex + 1));
    }

    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate) as unknown;
      } catch {
        continue;
      }
    }

    return null;
  }
}
