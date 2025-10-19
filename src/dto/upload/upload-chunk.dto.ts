import { IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';

export class UploadChunkDto {
  @IsNumber()
  @Min(0)
  chunkIndex: number;

  @IsBoolean()
  @IsOptional()
  isLastChunk?: boolean;
}