import { BaseEntity } from '@cool-midway/core';
import { Column, Entity } from 'typeorm';

/**
 * CRUD模块-短链管理
 */
@Entity('preview_file_manage')
export class PreviewFileManageEntity extends BaseEntity {

  @Column({ comment: '标题', length: 50 })
  title: string;

  @Column({ comment: '描述', length: 50, nullable: true  })
  desc: string;

  @Column({ comment: '展示菜单', length: 50, nullable: true  })
  menu: string;

  @Column({ comment: '展示类型', length: 50, nullable: true  })
  showType: string;

  @Column({ comment: '展示数据', length: 50, nullable: true  })
  showData: string;

  @Column({ comment: '角色权限', length: 50, nullable: true  })
  previewRoles: string;

  @Column({ comment: '路径', length: 500, nullable: true  })
  redirectUrl: string;

}
