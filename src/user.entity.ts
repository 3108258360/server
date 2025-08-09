import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  username: string;

  @Column()
  password: string;

  @Column({ length: 255 })
  email: string;

  @Column()
  salt: string;

  @Column({ length: 255, nullable: true })
  emailSalt: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  registerTime: Date;

  @Column({ type: 'tinyint', default: 1, comment: '编辑权限：0-无权限，1-有权限' })
  editPermission: number;

  @Column({ type: 'datetime', nullable: true })
  lastEditTime: Date;

  @Column({ type: 'int', default: 0 })
  editCount: number;

  @Column({ type: 'int', default: 0, comment: '登录尝试次数（包括成功和失败）' })
  loginCount: number;

  @Column({ type: 'int', default: 0, comment: '密码重置尝试次数（包括成功和失败）' })
  resetPasswordCount: number;
} 