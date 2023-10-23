import { Get, Provide } from '@midwayjs/decorator';
import { CoolController, BaseController } from '@cool-midway/core';
import { ShortLinkManageEntity } from '../entity/manage';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
/**
 * 商品
 */
@Provide()
@CoolController('/')
export class AppDemoGoodsController extends BaseController {
  @InjectEntityModel(ShortLinkManageEntity)
  shortLinkManageEntity: Repository<ShortLinkManageEntity>;

  /**
   * 其他接口
   */
  @Get('/*')
  async other(ctx) {
    const result = await this.shortLinkManageEntity.findOne({
      where: { shortLinkId: ctx.path.slice(1) },
    });
    if (!result || !result.id) return;
    result.jumpCount = Number(result.jumpCount || 0) + 1;
    this.shortLinkManageEntity.update(result.id, result);

    return await ctx.render('redirect', {
      data: encodeURIComponent(JSON.stringify(result)),
    });
  }
}
