import { Get, Inject, Provide, Query } from '@midwayjs/decorator';
import { CoolController, BaseController } from '@cool-midway/core';
import { BaseSysParamEntity } from '../../../entity/sys/param';
import { BaseSysParamService } from '../../../service/sys/param';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Context } from '@midwayjs/koa';
import { Repository } from 'typeorm';

/**
 * 参数配置
 */
@Provide()
@CoolController({
  api: ['add', 'delete', 'update', 'info', 'page'],
  entity: BaseSysParamEntity,
  service: BaseSysParamService,
  pageQueryOp: {
    keyWordLikeFields: ['name', 'keyName'],
    fieldEq: ['dataType'],
  },
})
export class BaseSysParamController extends BaseController {
  @Inject()
  baseSysParamService: BaseSysParamService;

  @InjectEntityModel(BaseSysParamEntity)
  baseSysParamEntity: Repository<BaseSysParamEntity>;

  @Inject()
  ctx: Context;

  @Get('/findParam', { summary: '获得网页内容的参数值' })
  async findParam(@Query('key') key: string) {
    this.ctx.body = this.baseSysParamEntity.findOneBy({ keyName: key });
  }

  /**
   * 根据配置参数key获得网页内容(富文本)
   */
  @Get('/html', { summary: '获得网页内容的参数值' })
  async htmlByKey(@Query('key') key: string) {
    this.ctx.body = await this.baseSysParamService.htmlByKey(key);
  }
}
