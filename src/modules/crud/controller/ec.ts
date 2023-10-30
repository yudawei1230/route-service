import { Get, Provide, Inject } from '@midwayjs/decorator';
import { CoolController, BaseController } from '@cool-midway/core';
import { ShortLinkManageEntity } from '../entity/manage';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { makeHttpRequest } from '@midwayjs/core';
import { BaseSysParamService } from '../../base/service/sys/param';
import { DictInfoEntity } from '../../dict/entity/info';
/**
 * 商品
 */

@Provide()
@CoolController('/')
export class AppDemoGoodsController extends BaseController {
  @InjectEntityModel(DictInfoEntity)
  dictInfoEntity: Repository<DictInfoEntity>;

  @Inject()
  baseSysParamService: BaseSysParamService;

  @InjectEntityModel(ShortLinkManageEntity)
  shortLinkManageEntity: Repository<ShortLinkManageEntity>;

  @Get('/getLinks')
  async getLinks() {
    const result = await this.shortLinkManageEntity.find();

    return this.ok(
      (result || [])
        .map(v => {
          const match = v.redirectUrl.match(/\/([0-9A-Z]+)\//);
          const asin = match && match[1];
          if (!asin) return;
          return { id: v.id, asin, keyword: v.keyword };
        })
        .filter(Boolean)
    );
  }

  @Get('/updateRank')
  async updateRank(ctx) {
    if (!ctx.query.id || !ctx.query.url) return this.ok();
    const result = await this.shortLinkManageEntity.findOne({
      where: { id: ctx.query.id },
    });
    if (!result || !result.id) return;
    result.redirectUrl = ctx.query.url;
    if (ctx.query.rank) {
      result.rank = ctx.query.rank;
    }
    this.shortLinkManageEntity.update(result.id, result);
    return this.ok();
  }

  @Get('/updateLinks')
  async updateLinks(ctx) {
    const result = await this.shortLinkManageEntity.find();
    const res = await makeHttpRequest('http://127.0.0.1:8833/updateAsinList', {
      method: 'POST',
      contentType: 'json',
      timeout: 0,
      data: {
        list: (result || [])
          .map(v => {
            const match = v.redirectUrl.match(/\/([0-9A-Z]+)\//);
            const asin = match && match[1];
            if (!asin) return;
            return { id: v.id, asin, keyword: v.keyword };
          })
          .filter(Boolean),
      },
      dataType: 'json', // 返回的数据格式
    });

    return this.ok(res.data);
  }

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
    const dict = await this.dictInfoEntity.findOneBy({
      id: Number(result.keyword),
    });
    result.routeCode =
      result.routeCode ||
      (await this.baseSysParamService.dataByKey('routeCode'));

    return await ctx.render('redirect', {
      data: JSON.stringify({
        ...result,
        keyword: dict ? dict.value : undefined,
      }),
    });
  }
}
