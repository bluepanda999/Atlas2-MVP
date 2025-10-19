import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { StreamingUploadService } from '../../services/upload/streaming-upload.service';
import { UploadProgress } from '../../interfaces/upload-progress.interface';
import { UploadSession } from '../../entities/upload-session.entity';
import { InitializeUploadDto } from '../../dto/upload/initialize-upload.dto';
import { UploadChunkDto } from '../../dto/upload/upload-chunk.dto';

@ApiTags('Streaming Upload')
@Controller('api/upload/streaming')
export class StreamingUploadController {
  constructor(private readonly streamingUploadService: StreamingUploadService) {}

  @Post('initialize')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initialize a new streaming upload session' })
  @ApiResponse({ status: 201, description: 'Upload session initialized successfully', type: UploadSession })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  async initializeUpload(@Body() initializeDto: InitializeUploadDto): Promise<UploadSession> {
    return await this.streamingUploadService.initializeUpload(
      initializeDto.fileName,
      initializeDto.fileSize,
      initializeDto.mimeType,
      initializeDto.userId,
    );
  }

  @Post(':uploadId/chunk')
  @UseInterceptors(FileInterceptor('chunk'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a chunk of data' })
  @ApiResponse({ status: 200, description: 'Chunk uploaded successfully', type: UploadProgress })
  @ApiResponse({ status: 400, description: 'Invalid chunk data' })
  @ApiResponse({ status: 404, description: 'Upload session not found' })
  @ApiParam({ name: 'uploadId', description: 'Upload session ID' })
  async uploadChunk(
    @Param('uploadId') uploadId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadChunkDto: UploadChunkDto,
  ): Promise<UploadProgress> {
    if (!file) {
      throw new Error('No chunk file provided');
    }

    return await this.streamingUploadService.processChunk(
      uploadId,
      file.buffer,
      uploadChunkDto.chunkIndex,
      uploadChunkDto.isLastChunk || false,
    );
  }

  @Post(':uploadId/chunk/raw')
  @ApiOperation({ summary: 'Upload a chunk of data as raw buffer' })
  @ApiResponse({ status: 200, description: 'Chunk uploaded successfully', type: UploadProgress })
  @ApiResponse({ status: 400, description: 'Invalid chunk data' })
  @ApiResponse({ status: 404, description: 'Upload session not found' })
  @ApiParam({ name: 'uploadId', description: 'Upload session ID' })
  async uploadChunkRaw(
    @Param('uploadId') uploadId: string,
    @Body() uploadChunkDto: { chunkIndex: number; isLastChunk?: boolean; data: string },
  ): Promise<UploadProgress> {
    const chunk = Buffer.from(uploadChunkDto.data, 'base64');
    
    return await this.streamingUploadService.processChunk(
      uploadId,
      chunk,
      uploadChunkDto.chunkIndex,
      uploadChunkDto.isLastChunk || false,
    );
  }

  @Get(':uploadId/progress')
  @ApiOperation({ summary: 'Get upload progress' })
  @ApiResponse({ status: 200, description: 'Upload progress retrieved successfully', type: UploadProgress })
  @ApiResponse({ status: 404, description: 'Upload session not found' })
  @ApiParam({ name: 'uploadId', description: 'Upload session ID' })
  async getProgress(@Param('uploadId') uploadId: string): Promise<UploadProgress> {
    return await this.streamingUploadService.getUploadProgress(uploadId);
  }

  @Put(':uploadId/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause an upload' })
  @ApiResponse({ status: 200, description: 'Upload paused successfully' })
  @ApiResponse({ status: 404, description: 'Upload session not found' })
  @ApiParam({ name: 'uploadId', description: 'Upload session ID' })
  async pauseUpload(@Param('uploadId') uploadId: string): Promise<{ message: string }> {
    await this.streamingUploadService.pauseUpload(uploadId);
    return { message: 'Upload paused successfully' };
  }

  @Put(':uploadId/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume a paused upload' })
  @ApiResponse({ status: 200, description: 'Upload resumed successfully' })
  @ApiResponse({ status: 404, description: 'Upload session not found' })
  @ApiParam({ name: 'uploadId', description: 'Upload session ID' })
  async resumeUpload(@Param('uploadId') uploadId: string): Promise<{ message: string }> {
    await this.streamingUploadService.resumeUpload(uploadId);
    return { message: 'Upload resumed successfully' };
  }

  @Put(':uploadId/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed upload' })
  @ApiResponse({ status: 200, description: 'Upload retry initiated successfully', type: UploadSession })
  @ApiResponse({ status: 404, description: 'Upload session not found' })
  @ApiParam({ name: 'uploadId', description: 'Upload session ID' })
  async retryUpload(@Param('uploadId') uploadId: string): Promise<UploadSession> {
    return await this.streamingUploadService.retryUpload(uploadId);
  }

  @Delete(':uploadId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel an upload' })
  @ApiResponse({ status: 204, description: 'Upload cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Upload session not found' })
  @ApiParam({ name: 'uploadId', description: 'Upload session ID' })
  async cancelUpload(@Param('uploadId') uploadId: string): Promise<void> {
    await this.streamingUploadService.cancelUpload(uploadId);
  }

  @Get()
  @ApiOperation({ summary: 'List upload sessions' })
  @ApiResponse({ status: 200, description: 'Upload sessions retrieved successfully', type: [UploadSession] })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum number of results', type: 'number' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of results to skip', type: 'number' })
  async listUploads(
    @Query('userId') userId?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<UploadSession[]> {
    return await this.streamingUploadService.listUploads(
      userId,
      limit ? parseInt(limit.toString()) : 50,
      offset ? parseInt(offset.toString()) : 0,
    );
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get upload statistics' })
  @ApiResponse({ status: 200, description: 'Upload statistics retrieved successfully' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  async getStats(@Query('userId') userId?: string): Promise<any> {
    return await this.streamingUploadService.getUploadStats(userId);
  }

  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clean up old uploads' })
  @ApiResponse({ status: 200, description: 'Old uploads cleaned up successfully' })
  @ApiQuery({ name: 'olderThanDays', required: false, description: 'Clean up uploads older than this many days', type: 'number' })
  async cleanupOldUploads(@Query('olderThanDays') olderThanDays?: number): Promise<{ deletedCount: number }> {
    const deletedCount = await this.streamingUploadService.cleanupOldUploads(
      olderThanDays ? parseInt(olderThanDays.toString()) : 7,
    );
    return { deletedCount };
  }
}