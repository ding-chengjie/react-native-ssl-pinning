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

import Logger from './Logger';
import calendarManager from '@ohos.calendarManager';
import { TurboModule, TurboModuleContext } from '@rnoh/react-native-openharmony/ts';

import { TM } from '@rnoh/react-native-openharmony/generated/ts';
import { buffer, util } from '@kit.ArkTS';
import { uri } from '@kit.ArkTS';
import httpclient, {
  CertificatePinner,
  CertificatePinnerBuilder,
  HttpCall,
  HttpClient,
  Request,
  Response,
  TimeUnit
} from '@ohos/httpclient';
import { OkHttpUtils } from './OkHttpUtils';
import { Context } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { FetchOptions, FetchResponse, Cookies, CookiesItem, Header } from './EventType';
import { CustomInterceptor } from './CustomInterceptor';
import CookieJar from './cookies/CookieJar';
import CookieManager from './cookies/CookieManager';
import CookieStore from './cookies/CookieStore';

export let calendarMgr: calendarManager.CalendarManager | null = null;

const TAG: string = "SslPinningTurboModules --> "

export class SslPinningTurboModule extends TurboModule implements TM.RNSslPinning.Spec {
  hereAbilityContext: Context = this.ctx.uiAbilityContext;
  cookieJar = new CookieJar();
  cookieManager = new CookieManager();
  cookieStore: ESObject = new CookieStore(this.hereAbilityContext.cacheDir);
  client: HttpClient;
  fetchResponse: FetchResponse = {
    headers: undefined,
    status: 0,
    url: 'https://',
    json: function (): Promise<{ [key: string]: any; }> {
      throw new Error('Function not implemented.');
    },
    text: function (): Promise<string> {
      throw new Error('Function not implemented.');
    }
  };

  constructor(ctx: TurboModuleContext) {
    super(ctx);
  }

  async fetch(hostname: string, options: FetchOptions, callback: (err, res) => void): Promise<FetchResponse> {
    let domainName: string;
    try {
      domainName = this.getDomainName(hostname);
    } catch (e) {
      domainName = hostname;
    }
    this.cookieManager.setCookiePolicy(httpclient.CookiePolicy.ACCEPT_ALL); // 设置缓存策略
    this.cookieJar.setCookieStore(this.cookieStore);

    let request: Request =
      await OkHttpUtils.buildRequest(this.ctx, this.cookieJar, this.cookieManager, options, hostname);
    if (options.timeoutInterval) {
      let timeout = options.timeoutInterval / 1000;
      //原单位为MILLISECONDS
      this.client = new HttpClient.Builder()
        .setReadTimeout(timeout, TimeUnit.SECONDS)
        .setWriteTimeout(timeout, TimeUnit.SECONDS)
        .setConnectTimeout(timeout, TimeUnit.SECONDS)
        .addInterceptor(new CustomInterceptor())
        .build();
    }
    let certificatePinner: CertificatePinner = new CertificatePinner([]);
    //判断是否带证书
    if (options.sslPinning) {
      if (options.sslPinning.certs) {
        if (options.pkPinning && Boolean(options.pkPinning)) {
          //公钥
          let certificatePinnerBuilder = new CertificatePinnerBuilder();
          options.sslPinning.certs.forEach((pin) => {
            certificatePinnerBuilder.add(domainName, pin);
          })
          certificatePinner = certificatePinnerBuilder.build();
        }
      } else {
        hilog.info(0x0001, TAG, "key certs was not found");
      }
    } else {
      //无证书
      hilog.info(0x0001, TAG + "sslPinning key was not added-->", "null");
      callback(null, this.fetchResponse);
      return new Promise((resolve, reject) => {
        resolve(null);
      });
    }

    try {
      let httpCall: HttpCall = this.client.newCall(request);
      if (options.pkPinning && Boolean(options.pkPinning)) { //public Key Pinning
        httpCall.setCertificatePinner(certificatePinner)
      }
      httpCall.enqueue((response: Response) => {
        let bytes: Uint8Array = new Uint8Array(buffer.from(response.getBody() as string, 'utf-8').buffer);
        ;
        let decoder = new util.StringDecoder('utf-8');
        let stringResponse: string = decoder.write(bytes);
        let responseType: string = "";
        //处理返回的response
        let headers: Header = this.buildResponseHeaders(response);
        this.fetchResponse.headers = headers;
        //设置返回responsecode
        this.fetchResponse.status = response.responseCode;
        if (options.responseType) {
          responseType = options.responseType?.toString();
        }
        switch (responseType) {
          case "base64":
            let base64 = new util.Base64Helper();
            base64.encodeToString(bytes, util.Type.MIME).then((val) => {
              let base64Str = val;
              this.fetchResponse.data = base64Str
            });
            break;
          default:
            this.fetchResponse.bodyString = stringResponse
            break;
        }
        if (response.isSuccessful()) {
          callback(null, this.fetchResponse);
          return new Promise((resolve, reject) => {
            resolve(this.fetchResponse);
          });
        } else {
          callback(response, null);
          return new Promise((resolve, reject) => {
            resolve(null);
          });
        }
      }, (error: BusinessError) => {
        hilog.info(0x0001, "onError -> Error", error.message);
        callback(null, this.fetchResponse);
        return new Promise((resolve, reject) => {
          resolve(null);
        });
      });
    } catch (e) {
      hilog.info(0x0001, TAG, "fetch error");
    }

  }

  private buildResponseHeaders(response: Response): Header {
    let responseHeaders: string = response.getHeader();
    var obj: Object = JSON.parse(responseHeaders);
    let headers: Header = {};
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        // 逐个解析JSON,直到最后一个
        headers[key] = obj[key]
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
    const cookies: Cookies = {};
    try {
      if (this.cookieStore && this.cookieStore.readCookie(domain)) {
        let cookieJSON = this.cookieStore.readCookie(domain);
        let json = JSON.parse(cookieJSON);
        for (let cookieName in json) {
          for (var key in json[cookieName]) {
            let cookiejson = json[cookieName][key];
            cookies[cookieName] = JSON.stringify(cookiejson)
          }
        }
      }
      return new Promise((resolve, reject) => {
        resolve(cookies);
      });
    } catch (e) {
      return new Promise((resolve, reject) => {
        resolve(e);
      });
    }
  }

  removeCookieByName(cookieName: String): Promise<void> {
    let deleteResult: boolean = this.cookieStore.deleteCookie(cookieName)
    return new Promise((resolve, reject) => {
      resolve();
    });
  }
}