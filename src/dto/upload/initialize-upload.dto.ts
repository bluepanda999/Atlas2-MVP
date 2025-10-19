import { IsString, IsNotEmpty, IsNumber, IsOptional, IsEmail, Max, Min } from 'class-validator';

export class InitializeUploadDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsNumber()
  @Min(1)
  @Max(3221225472) // 3GB
  fileSize: number;

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsString()
  @IsOptional()
  @IsEmail()
  userId?: string;
}