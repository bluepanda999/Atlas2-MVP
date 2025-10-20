import { IsString, IsNotEmpty, IsOptional, IsArray, IsObject, IsDateString, Min, Max } from 'class-validator';

export class CreateApiKeyConfigDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsOptional()
  permissions?: string[];

  @IsOptional()
  rateLimit?: {
    requests: number;
    window: number;
  };

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}