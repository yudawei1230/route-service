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

  @Column({ comment: '短链名', length: 50 })
  shortLinkName: string;

  @Index()
  @Column({ comment: '短链id', length: 50 })
  shortLinkId: string;

  @Column({ comment: '跳转链接', length: 255 })
  redirectUrl: string;

  @Column({ comment: '品牌', length: 500 })
  brand: string;

  @Column({ comment: '关键词', length: 50 })
  keyword: string;

  @Column({ comment: '排名', length: 50 })
  rank: string;

  @Column({ type: 'longtext', comment: '路由代码', nullable: true })
  routeCode: string;

  @Column({ comment: '跳转次数', type: 'bigint', nullable: true, default: 0 })
  jumpCount: number;
}
