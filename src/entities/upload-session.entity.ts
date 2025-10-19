import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('upload_sessions')
export class UploadSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'original_name' })
  originalName: string;

  @Column({ name: 'file_size', type: 'bigint' })
  fileSize: number;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'file_path' })
  filePath: string;

  @Column({ name: 'user_id', nullable: true })
  userId?: string;

  @Column({
    type: 'enum',
    enum: ['initialized', 'uploading', 'paused', 'completed', 'failed', 'cancelled'],
    default: 'initialized',
  })
  status: 'initialized' | 'uploading' | 'paused' | 'completed' | 'failed' | 'cancelled';

  @Column({ name: 'uploaded_bytes', type: 'bigint', default: 0 })
  uploadedBytes: number;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @Column({ name: 'chunk_size', type: 'int', default: 65536 })
  chunkSize: number;

  @Column({ name: 'total_chunks', type: 'int', nullable: true })
  totalChunks?: number;

  @Column({ name: 'completed_chunks', type: 'int', default: 0 })
  completedChunks: number;

  @Column({ name: 'upload_speed', type: 'float', nullable: true })
  uploadSpeed?: number; // bytes per second

  @Column({ name: 'estimated_time_remaining', type: 'float', nullable: true })
  estimatedTimeRemaining?: number; // seconds

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ name: 'last_activity_at', type: 'timestamp', nullable: true })
  lastActivityAt?: Date;
}