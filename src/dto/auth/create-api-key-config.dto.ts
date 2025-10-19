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

  @IsObject()
  @IsOptional()
  rateLimit?: {
    @Min(1)
    @Max(100000)
    requests: number;

    @Min(60)
    @Max(86400)
    window: number;
  };

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}