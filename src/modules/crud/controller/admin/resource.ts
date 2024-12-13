import { Provide } from '@midwayjs/decorator';
import { CoolController, BaseController } from '@cool-midway/core';
import { PreviewFileManageEntity } from '../../entity/preview';

/**
 * CRUD - 管理
 */
@Provide()
@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: PreviewFileManageEntity,
})
export class AdminCrudManageController extends BaseController {}
