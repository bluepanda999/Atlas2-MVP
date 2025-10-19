import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ApiClient } from './api-client.entity';

@Entity('api_key_configs')
export class ApiKeyConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id' })
  clientId: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'api_key', type: 'text' })
  apiKey: string;

  @Column({ name: 'key_prefix', length: 10 })
  keyPrefix: string;

  @Column({ type: 'json', nullable: true })
  permissions: string[];

  @Column({ name: 'rate_limit', type: 'json', nullable: true })
  rateLimit: {
    requests: number;
    window: number; // seconds
  };

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt: Date;

  @Column({ name: 'usage_count', type: 'int', default: 0 })
  usageCount: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => ApiClient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: ApiClient;
}