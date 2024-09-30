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

import dataStorage from '@ohos.data.storage'
import featureAbility from '@ohos.ability.featureAbility'
import { CookiePolicy } from './httpcookieutils';
import { Logger } from '../Logger';

function CookieStore(cacheDir) {
  var cookieJSON, path = null;
  this.path = cacheDir;
  console.info('httpclient- CookieStore path: ' + this.path);
}

CookieStore.prototype.setCacheDir = function setCacheDir(filePath) {
  this.path = filePath;
}
CookieStore.prototype.readCookie = function readCookie(hostname) {
  console.info('httpclient- CookieStore readCookie: ' + hostname);
  let storage = dataStorage.getStorageSync(this.path + '/cookiestore');
  let cookieJSON = storage.getSync(hostname, '')
  storage.flushSync();
  return cookieJSON;
}
CookieStore.prototype.writeCookie = function writeCookie(hostname, cookieJSON) {
  console.info('httpclient- CookieStore writeCookie: ' + hostname + ',cookieJSON:' + cookieJSON + ',path:' + this.path);
  let storage = dataStorage.getStorageSync(this.path + '/cookiestore');
  storage.putSync(hostname, cookieJSON)
  storage.flushSync();
}

CookieStore.prototype.deleteCookie = function deleteCookie(hostname) {
  console.info('httpclient- CookieStore deleteCookie: ' + hostname + ',path:' + this.path);
  let storage = dataStorage.getStorageSync(this.path + '/cookiestore');
  storage.has(hostname, function (err, isExist) {
    if (isExist) {
      storage.delete(hostname, function (err) {
        if (err) {
          return false;
        }
        return true;
      })
    } else {
      return false;
    }
  })
}

export default CookieStore;