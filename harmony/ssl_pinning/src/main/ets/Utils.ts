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

import { BusinessError } from '@ohos/httpclient/src/main/ets/http';
import { Context } from '@kit.AbilityKit';

export class Utils {
  constructor() {
  }

  async getCA(ca: string, context: Context): Promise<string> {
    if (!ca) {
      return "ca is error";
    }
    const value = await new Promise<Uint8Array>(resolve => {
      context.resourceManager.getRawFileContent(
        ca,
        (err: BusinessError, value) => {
          if (err) {
            throw new Error(JSON.stringify(err));
          }
          resolve(value);
        });
    })

    const rawFile: Uint8Array = value;
    return this.parsingRawFile(rawFile);
  }

  private parsingRawFile(rawFile: Uint8Array): string {
    let fileContent: string = "";
    for (let index = 0, len = rawFile.length; index < len; index++) {
      const todo = rawFile[index];
      const item = String.fromCharCode(todo);
      fileContent += item + "";
    }
    return fileContent;
  }
}