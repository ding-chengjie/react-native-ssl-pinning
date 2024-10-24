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
import Logger from './Logger';


function CookieStore(cacheDir) {
  this.path = cacheDir;
  Logger.info('httpclient- CookieStore path: ' + this.path);
}

CookieStore.prototype.setCacheDir = function setCacheDir(filePath) {
  this.path = filePath;
}
CookieStore.prototype.readCookie = function readCookie(hostname) {
  Logger.info('httpclient- CookieStore readCookie: ' + hostname);
  let storage = dataStorage.getStorageSync(this.path + '/cookieStore');
  let cookieJSON = storage.getSync(hostname, '')
  storage.flushSync();
  Logger.info('httpclient- CookieStore readCookie: ' + cookieJSON);
  return cookieJSON;
}
CookieStore.prototype.writeCookie = async function writeCookie(hostname, cookieJSON) {
  Logger.info('httpclient- CookieStore writeCookie: ' + hostname + ',cookieJSON:' + cookieJSON + ',path:' + this.path);
  let storage = dataStorage.getStorageSync(this.path + '/cookieStore');
  //保存所有的domain
  let allDomainKey: string = "allDomainKey"
  if (storage.hasSync(allDomainKey)) {
    let allDomain : string = JSON.stringify(await storage.get(allDomainKey,""));
    if (allDomain.search(hostname) == -1) {
      allDomain += allDomain.concat(";").concat(hostname)
      storage.putSync(allDomainKey, allDomain)
    }
  } else {
    storage.putSync(allDomainKey, hostname)
  }
  storage.putSync(hostname, cookieJSON)
  storage.flushSync();
}

CookieStore.prototype.getCookieDomain = function getCookieDomain(hostname, cookieJSON) {
  Logger.info('httpclient- CookieStore writeCookie: ' + hostname + ',cookieJSON:' + cookieJSON + ',path:' + this.path);
  let storage = dataStorage.getStorageSync(this.path + '/cookieStore');
  storage.putSync(hostname, cookieJSON)
  storage.flushSync();
}

CookieStore.prototype.deleteCookie = function deleteCookie(hostname) {
  Logger.info('httpclient- CookieStore deleteCookie: ' + hostname + ',path:' + this.path);
  let storage = dataStorage.getStorageSync(this.path + '/cookieStore');
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