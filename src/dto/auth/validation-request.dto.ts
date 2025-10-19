import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class ValidationRequestDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @IsUrl()
  testEndpoint?: string;
}