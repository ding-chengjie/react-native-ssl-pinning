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

import calendarManager from '@ohos.calendarManager';
import { TurboModule, TurboModuleContext } from '@rnoh/react-native-openharmony/ts';

import { TM } from '@rnoh/react-native-openharmony/generated/ts';
import { buffer, util } from '@kit.ArkTS';
import { uri } from '@kit.ArkTS';
import { OkHttpUtils } from './OkHttpUtils';
import { Context } from '@kit.AbilityKit';
import { FetchOptions, FetchResponse, Cookies, Header } from './EventType';
import CookieStore from './CookieStore';
import { http } from '@kit.NetworkKit';
import Logger from './Logger';

export let calendarMgr: calendarManager.CalendarManager | null = null;

const TAG: string = "SslPinningTurboModules --> "

export class SslPinningTurboModule extends TurboModule implements TM.RNSslPinning.Spec {
  hereAbilityContext: Context = this.ctx.uiAbilityContext;
  cookieStore: ESObject = new CookieStore(this.hereAbilityContext.cacheDir);
  static PUBLIC_KEY_HASH : string = "publicKeyHash";
  static CERT_KEY_HASH : string = "certKeyHash";
  static PIN_HEADER : string = "sha256/";

  constructor(ctx: TurboModuleContext) {
    super(ctx);
  }

  async fetch(hostname: string, options: FetchOptions, callback: (err, res) => void): Promise<FetchResponse> {
    let fetchResponse: FetchResponse = {
      headers: undefined,
      status: 0,
      url: hostname,
      json: function (): Promise<{ [key: string]: any; }> {
        throw new Error('Function not implemented.');
      },
      text: function (): Promise<string> {
        throw new Error('Function not implemented.');
      }
    };
    //http请求对象
    let httpRequest = http.createHttp();
    let httpRequestOptions : http.HttpRequestOptions = await OkHttpUtils.constructorHttpRequestOptions(this.ctx, options);
    if (options.disableAllSecurity && Boolean(options.disableAllSecurity)) {
      //client = OkHttpUtils.buildDefaultHttpClient(cookieJar, domainName, options);
    }
    Logger.info("hostname====" + hostname)
    let response: http.HttpResponse;
    try {
      response = await httpRequest.request(hostname, httpRequestOptions);
    } catch (e) {
      callback(null, fetchResponse);
      return new Promise((resolve, reject) => {
        resolve(fetchResponse);
      });
    }

    if (response.responseCode == http.ResponseCode.OK) {
      //handle cookies
      if (response.cookies) {
        const cookiesObj: Cookies = {};
        let cookies: string = response.cookies;
        if (cookies && cookies.length > 0) {
          let cookieArray: string[] = cookies.split("\r\n");
            cookieArray.forEach((cookie: string) => {
              if (cookie && cookie.length > 0) {
                let cookieInfoArray: string[] = cookie.split("\t");
                cookiesObj[cookieInfoArray[cookieInfoArray.length - 2]] = cookieInfoArray[cookieInfoArray.length - 1];
              }
            })
        }
        this.cookieStore.writeCookie(this.getDomainName(hostname), JSON.stringify(cookiesObj))
      }

      Logger.info("HttpResponse:" + JSON.stringify(response.responseCode))
      let bytes: Uint8Array = new Uint8Array(buffer.from(response.result as string, 'utf-8').buffer);
      let decoder = new util.StringDecoder('utf-8');
      let stringResponse: string = decoder.write(bytes);
      //handle response
      let headers: Header = this.buildResponseHeaders(response);
      fetchResponse.headers = headers;
      //handle responseCode
      fetchResponse.status = response.responseCode;
      //handle responseType
      let responseType: string = "";
      if (options.responseType) {
        responseType = options.responseType?.toString();
      }
      switch (responseType) {
        case "base64":
          let base64 = new util.Base64Helper();
          base64.encodeToString(bytes, util.Type.MIME).then((val) => {
            let base64Str = val;
            fetchResponse.data = base64Str
          });
          break;
        default:
          fetchResponse.bodyString = stringResponse
          break;
      }
      callback(null, fetchResponse);
      return new Promise((resolve, reject) => {
        resolve(fetchResponse);
      });
    } else {
      callback(null, fetchResponse);
      return new Promise((resolve, reject) => {
        resolve(fetchResponse);
      });
    }
  }

  private buildResponseHeaders(response: http.HttpResponse): Header {
    let responseHeaders: Object = response.header;
    let headers: Header = {};
    for (var key in responseHeaders) {
      if (responseHeaders.hasOwnProperty(key)) {
        // 逐个解析JSON,直到最后一个
        headers[key] = responseHeaders[key]
      }
    }
    return headers;
  }

  public getDomainName(url: string): string {
    let uriObj = new uri.URI(url);
    let domain = uriObj.host;
    return domain.startsWith("www.") ? domain.substring(4) : domain;
  }

  getCookies(domain: string): Promise<Cookies> {
    Logger.info("getCookies start:" + domain)
    const cookies: Cookies = {};
    try {
      if (this.cookieStore && this.cookieStore.readCookie(domain)) {
        let cookie = this.cookieStore.readCookie(domain);
        let cookieObj = JSON.parse(cookie);
        for (let cookieName in cookieObj) {
          cookies[cookieName] = cookieObj[cookieName]
        }
      }
      Logger.info("getCookies end:" + domain)
      return new Promise((resolve, reject) => {
        resolve(cookies);
      });
    } catch (e) {
      return new Promise((resolve, reject) => {
        resolve(cookies);
      });
    }
  }

  async removeCookieByName(cookieName: String): Promise<void> {
    Logger.info("removeCookieByName start:")
    let allDomainKey: string = "allDomainKey"
    let allDomain: string = await this.cookieStore.readCookie(allDomainKey);
    if (allDomain && allDomain.trim().length > 0) {
      let domainArray: string[] = allDomain.split(";");
      domainArray.forEach((domain: string) => {
        if (domain && domain.length > 0) {
          if (this.cookieStore && this.cookieStore.readCookie(domain)) {
            let cookie = this.cookieStore.readCookie(domain);
            let cookieObj = JSON.parse(cookie);
            const cookiesResult: Cookies = {};
            for (let cookiekey in cookieObj) {
              if (cookiekey != cookieName) {
                cookiesResult[cookiekey] = cookieObj[cookiekey];
              }
            }
            this.cookieStore.writeCookie(domain, JSON.stringify(cookiesResult))
          }
        }
      })
    }
    Logger.info("removeCookieByName end:")
    return new Promise((resolve, reject) => {
      resolve();
    });
  }
}