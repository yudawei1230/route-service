import { Provide } from '@midwayjs/decorator';
import { CoolController, BaseController } from '@cool-midway/core';
import { ShortLinkManageEntity } from '../entity/manage';

/**
 * CRUD - 管理
 */
@Provide()
@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: ShortLinkManageEntity,
})
export class AdminCrudManageController extends BaseController {}
