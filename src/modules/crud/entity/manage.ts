import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * CRUD模块-短链管理
 */
@Entity('short_link_manage')
export class ShortLinkManageEntity extends BaseEntity {
  @Index()
  @Column({ comment: '客户名', length: 50 })
  customerName: string;

  @Index()
  @Column({ comment: '短链名', length: 50 })
  shortLinkName: string;

  @Column({ comment: '跳转链接', length: 255 })
  redirectUrl: string;

  @Column({ comment: '关键词', length: 50 })
  keyword: string;

  @Column({ comment: '排名', type: 'smallint' })
  rank: number;

  @Column({ comment: '路由代码', length: 50, nullable: true })
  routeCode: string;

  @Column({ comment: '跳转次数', type: 'bigint', nullable: true })
  jumpCount: number;
}
