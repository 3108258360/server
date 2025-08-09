import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Page {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  route: string;

  @Column('longtext')
  data: string; // 存储JSON字符串
} 