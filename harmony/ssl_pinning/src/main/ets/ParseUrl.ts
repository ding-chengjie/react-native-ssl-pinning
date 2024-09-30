/**
 * MIT License
 *
 * Copyright (C) 2024 Huawei Device Co., Ltd.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { dataSharePredicates } from '@kit.ArkData';
import { photoAccessHelper } from '@kit.MediaLibraryKit';
import { TurboModuleContext } from '@rnoh/react-native-openharmony/ts';
import { util } from '@kit.ArkTS';

class MediaDataHandler implements photoAccessHelper.MediaAssetDataHandler<ArrayBuffer> {
  onDataPrepared(data: ArrayBuffer) {
    if (data === undefined) {
      console.error('Error occurred when preparing data');
      return;
    }
    console.info('on image data prepared');

    let base64 = new util.Base64Helper();
    let base64Str = base64.encodeToStringSync(new Uint8Array(data));
    return base64Str;
  }
}

export class ParseUrl {
  async example(ctx: TurboModuleContext, uri: string): Promise<string> {
    let phAccessHelper = photoAccessHelper.getPhotoAccessHelper(ctx.uiAbilityContext);
    let predicates: dataSharePredicates.DataSharePredicates = new dataSharePredicates.DataSharePredicates();
    predicates.equalTo(photoAccessHelper.PhotoKeys.URI, uri.toString());
    let fetchOptions: photoAccessHelper.FetchOptions = {
      fetchColumns: [photoAccessHelper.PhotoKeys.TITLE],
      predicates: predicates
    };

    try {
      let fetchResult: photoAccessHelper.FetchResult<photoAccessHelper.PhotoAsset> =
        await phAccessHelper.getAssets(fetchOptions);
      let photoAsset: photoAccessHelper.PhotoAsset = await fetchResult.getFirstObject();
      console.info('getAssets photoAsset.uri : ' + photoAsset.uri);
      //获取属性值，以标题为例；对于非默认查询的属性，get前需要在fetchColumns中添加对应列名
      console.info('title : ' + photoAsset.get(photoAccessHelper.PhotoKeys.TITLE));
      //请求图片资源数据
      let requestOptions: photoAccessHelper.RequestOptions = {
        deliveryMode: photoAccessHelper.DeliveryMode.HIGH_QUALITY_MODE,
      }
      let result: string =
        await photoAccessHelper.MediaAssetManager.requestImageData(ctx.uiAbilityContext, photoAsset, requestOptions,
          new MediaDataHandler());
      console.info('requestImageData successfully==' + result);
      fetchResult.close();
      return result;
    } catch (err) {
      console.error('getAssets failed with err: ' + err);
    }
  }
}
