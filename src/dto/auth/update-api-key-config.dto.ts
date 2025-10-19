import { IsString, IsOptional, IsArray, IsObject, IsDateString, Min, Max } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { CreateApiKeyConfigDto } from './create-api-key-config.dto';

export class UpdateApiKeyConfigDto extends PartialType(CreateApiKeyConfigDto) {
  @IsString()
  @IsOptional()
  name?: string;

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

  @IsOptional()
  isActive?: boolean;
}