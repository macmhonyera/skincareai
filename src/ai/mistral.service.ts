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
            max_tokens: 512,
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

      console.error('OpenRouter API Error:', message);
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
      'You are a conservative dermatology-aware cosmetic skin analyst.',
      'You must ONLY describe clearly visible surface-level features.',
      'Do NOT assume conditions that are not visually evident.',
      'If visibility is limited due to lighting, blur, angle, or obstruction, state uncertainty.',
      'Never diagnose diseases.',
      'Only evaluate cosmetic-level features relevant to skincare planning.',

      'Evaluation framework:',
      '- Acne: visible inflamed papules, pustules, comedones.',
      '- Pigmentation: visible dark spots or uneven tone patches.',
      '- Redness: persistent diffuse redness or localized erythema.',
      '- Texture: visible enlarged pores or uneven skin surface.',
      '- Dehydration: dullness, fine surface lines, tight appearance.',
      '- Oiliness: visible shine or sebaceous prominence.',

      'Evidence gating rules:',
      'Only include a concern in detectedConcerns if explicitly supported by a visible observation.',
      'Each detected concern must have at least one matching observation.',
      'If uncertain, DO NOT include it.',

      'Severity scoring rules (0-100):',
      '0-20 = minimal or not visible',
      '21-40 = mild',
      '41-60 = moderate',
      '61-80 = significant',
      '81-100 = severe',

      'If no visible evidence exists for a concern, assign a score between 0 and 15.',
      'Do NOT default to 50.',

      'Relative calibration:',
      'Compare against an average adult with normal healthy skin.',
      'Clearly worse than average → above 60.',
      'Slightly worse than average → 30-50.',
      'Better than average → below 30.',

      'overallSkinScore must be calculated as:',
      '100 minus the average of all concernScores.',
      'Round to nearest integer.',

      'confidence must reflect image clarity only:',
      '0.2-0.4 = poor quality or high uncertainty',
      '0.5-0.7 = moderate clarity',
      '0.8-1.0 = high clarity with strong visual evidence',

      'First evaluate each concern independently, then generate final JSON after reviewing consistency.',

      'Return JSON object only with keys:',
      '{"suggestedSkinType":string|null,"detectedConcerns":string[],"observations":string[],"confidence":number,"concernScores":{"acne":number,"pigmentation":number,"redness":number,"texture":number,"dehydration":number,"oiliness":number},"overallSkinScore":number}.',

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

      console.error('OpenRouter image analysis error:', message);
      throw new InternalServerErrorException(
        `Image analysis error: ${message}`,
      );
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
          acne: 10,
          pigmentation: 10,
          redness: 10,
          texture: 10,
          dehydration: 10,
          oiliness: 10,
        },
        overallSkinScore: 85,
      };
    }

    const object = parsed as any;

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

    const avg =
      (concernScores.acne +
        concernScores.pigmentation +
        concernScores.redness +
        concernScores.texture +
        concernScores.dehydration +
        concernScores.oiliness) /
      6;

    const overallSkinScore = Math.round(100 - avg);

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
      acne: this.normalizeScore(source.acne, 10),
      pigmentation: this.normalizeScore(source.pigmentation, 10),
      redness: this.normalizeScore(source.redness, 10),
      texture: this.normalizeScore(source.texture, 10),
      dehydration: this.normalizeScore(source.dehydration, 10),
      oiliness: this.normalizeScore(source.oiliness, 10),
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
