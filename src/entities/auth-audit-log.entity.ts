import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('auth_audit_log')
export class AuthAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'config_id' })
  @Index()
  configId: string;

  @Column({
    name: 'config_type',
    type: 'enum',
    enum: ['api_key', 'basic_auth', 'bearer_token'],
  })
  @Index()
  configType: 'api_key' | 'basic_auth' | 'bearer_token';

  @Column()
  @Index()
  action: string;

  @Column({ name: 'user_id', nullable: true })
  userId?: string;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @Column({ type: 'json', nullable: true })
  details?: any;

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt: Date;
}