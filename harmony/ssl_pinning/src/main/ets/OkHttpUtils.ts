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

import httpclient, { Request, RequestBody, MultiPart, Mime, } from '@ohos/httpclient';
import { ArrayList, HashMap, JSON, List, uri, util } from '@kit.ArkTS';
import { Context } from '@kit.AbilityKit';
import { Utils } from './Utils'
import { TurboModuleContext } from '@rnoh/react-native-openharmony/ts';
import MediaType from '@ohos/httpclient/src/main/ets/cache/MediaType';
import fs from '@ohos.file.fs';
import hilog from '@ohos.hilog';
import { FetchOptions, Header } from './EventType';
import { fileIo } from '@kit.CoreFileKit';

const TAG: string = "OkHttpUtils --> "

export class OkHttpUtils {
  private static content_type: string = "application/json; charset=utf-8";
  public static mediaType: MediaType = MediaType.parse(this.content_type);

  static clientsByDomain: HashMap<String, Request> = new HashMap<String, Request>();
  static defaultRequest: Request;
  static base64 = new util.Base64Helper();

  public static parseParts(objParam): ArrayList<any> {
    let parseBodyList: ArrayList<any> = new ArrayList();
    let obj = JSON.parse(JSON.stringify(objParam))
    for (let key in obj) {
      if (typeof (obj[key]) == "object") {
        let itemList: ArrayList<any> = new ArrayList();
        let itemObject = JSON.parse(JSON.stringify(obj[key]))
        for (let itemKey in itemObject) {
          if (itemObject[itemKey].toString().search("type") > 0 && itemObject[itemKey].toString().search("url") > 0
            || itemObject[itemKey].toString().search("path") > 0) {
            let fileObject = JSON.parse(JSON.stringify(itemObject[itemKey]))
            let fileMap: HashMap<string, string> = new HashMap();
            for (let fileKey in fileObject) {
              fileMap.set(fileKey, fileObject[fileKey]);
            }
            itemList.add(fileMap);
          } else {
            itemList.add(itemObject[itemKey]);
          }
        }
        parseBodyList.add(itemList)
      }
    }
    return parseBodyList
  }

  static async obtainCa(ctx: TurboModuleContext, options: FetchOptions): Promise<string[]> {
    let certs = options.sslPinning.certs;
    if (certs != null && certs.length == 0) {
      hilog.info(0x0001, TAG, "certs array is empty");
    }
    let CAArray: string[] = [];
    if (!(options.pkPinning && Boolean(options.pkPinning))) { //Certificate Pinning
      let context: Context = ctx.uiAbilityContext;
      for (let i = 0; i < certs.length; i++) {
        let filename: string = certs[i].toString();
        let CA: string = await new Utils().getCA(filename.concat('.cer'), context);
        CAArray.push(CA);
      }
    }
    return CAArray;
  }

  static async parseParam(ctx: TurboModuleContext, formData: object): Promise<HashMap<string, any>> {
    let paramMap: HashMap<string, any> = new HashMap();
    if (formData["_parts"]) {
      let partsList: ArrayList<any> = this.parseParts(formData["_parts"])
      for (let i = 0; i < partsList.length; i++) {
        let part: ArrayList<any> = partsList[i];
        let key: string = "";
        if (typeof (part[0]) == "string") {
          key = part[0];
        } else if (typeof (part[0]) == "number") {
          key = part[0].toString();
        }
        if (JSON.stringify(part[1]).search("type") >= 0 && JSON.stringify(part[1]).search("uri") >= 0
          || JSON.stringify(part[1]).search("path") >= 0) {
          let fileBuffer: ArrayBuffer = this.addFormDataPart(ctx, JSON.parse(JSON.stringify(part[1]))["uri"]);
          paramMap.set(key, fileBuffer)
        } else {
          let value: string = part[1];
          paramMap.set(key, value)
        }
      }
    }
    return paramMap;
  }

  static async buildRequest(ctx: TurboModuleContext, cookieJar: any, cookieManager: any, options: FetchOptions,
    hostname: string): Promise<Request> {
    let bodyList: List<RequestBody> = null;
    let method: string = "GET";
    let requestBuilder = new Request.Builder()
      .addHeader("Content-Type", "multipart/form-data")
      .setCookieManager(cookieManager)
      .setCookieJar(cookieJar);
    //证书
    if (options.sslPinning && options.sslPinning.certs) {
      if (!(options.pkPinning && Boolean(options.pkPinning))) { //Certificate Pinning
        requestBuilder.ca(await this.obtainCa(ctx, options));
      }
    }
    //处理头部数据
    if (options.headers) {
      let map: Header | undefined = options.headers;
      for (let key in map) {
        requestBuilder.addHeader(key, map[key]);
      }
      if (map["content-type"]) {
        this.content_type = map["content-type"];
        this.mediaType = MediaType.parse(this.content_type);
      }
    }
    if (options.method) {
      method = options.method.toString();
    }
    let multiPartObj = new MultiPart.Builder().type(httpclient.MultiPart.FORMDATA);

    if (options.body) {
      let bodyType = options.body;
      if (bodyType instanceof String) {
        let body: RequestBody = RequestBody.create(this.mediaType, options.body.toString());
        multiPartObj.addPart(body)
      } else if (bodyType instanceof Object) {
        let paramMap: HashMap<string, any>;
        let bodyMap = options.body as Object;
        if (bodyMap["formData"]) {
          let formData = bodyMap["formData"];
          paramMap = await this.parseParam(ctx, formData);
          bodyList = this.buildFormDataRequestBody(ctx, formData);
        } else if (bodyMap["_parts"]) {
          paramMap = await this.parseParam(ctx, bodyMap);
          bodyList = this.buildFormDataRequestBody(ctx, bodyMap);
        }
        // 给requestBuilder添加参数
        if (paramMap.length > 0) {
          paramMap.forEach((value: any, key: string) => {
            if (key != "file") {
              requestBuilder.params(key, value);
            }
          })
        }
        if (bodyList && bodyList.length > 0) {
          bodyList.forEach((item: RequestBody) => {
            multiPartObj.addPart(item)
          })
        }
      }
      let requestMultiPart: MultiPart = multiPartObj.build();
      let requestBody: RequestBody = requestMultiPart.createRequestBody();
      requestBuilder.post(requestBody)
    }
    return requestBuilder
      .method(method)
      .get(hostname)
      .build();
  }

  public static buildFormDataRequestBody(ctx: TurboModuleContext, formData: object): List<RequestBody> {
    let type: string = "multipart/form-data"
    let bodyList: List<RequestBody> = new List<RequestBody>()
    if (formData["_parts"]) {
      let partsList: ArrayList<any> = this.parseParts(formData["_parts"])
      for (let i = 0; i < partsList.length; i++) {
        let rb: RequestBody = new RequestBody();
        let part: ArrayList<any> = partsList[i];
        let key: string = "";
        if (typeof (part[0]) == "string") {
          key = part[0];
        } else if (typeof (part[0]) == "number") {
          key = part[0].toString();
        }
        if (JSON.stringify(part[1]).search("type") >= 0 && JSON.stringify(part[1]).search("uri") >= 0
          || JSON.stringify(part[1]).search("path") >= 0) {

          let fileData: HashMap<string, string> = new HashMap<string, string>();
          let partObject = JSON.parse(JSON.stringify(part[1]))
          for (let key in partObject) {
            fileData.set(key, partObject[key]);
          }
          let fileName: string = "";
          if (fileData.hasKey("fileName")) {
            fileName = fileData.get("fileName");
          } else if (fileData.hasKey("name")) {
            fileName = fileData.get("name");
          }
          if (fileData.hasKey("type")) {
            type = fileData.get("type")
          }
          let fileBuffer: ArrayBuffer = this.addFormDataPart(ctx, fileData.get("uri"));
          rb = RequestBody.create(fileBuffer,
            new Mime.Builder().contentDisposition("form-data; name=\"" + key + "\";filename=\"" + fileName + "\"")
              .contentType("text/plain", 'charset', 'utf8').build().getMime())
        } else {
          let value: string = part[1];
          rb = RequestBody.create(value,
            new Mime.Builder().contentDisposition("form-data; name=\"" + key + "\"")
              .contentType(type, 'charset', 'utf8').build().getMime())
        }
        bodyList.add(rb);
      }
    }
    return bodyList;
  }

  public static addFormDataPart(ctx: TurboModuleContext, uri: string): ArrayBuffer {
    let file: fs.File = fileIo.openSync(uri, fileIo.OpenMode.READ_ONLY);
    let buffer: ArrayBuffer = new ArrayBuffer(4096);
    fileIo.readSync(file.fd, buffer);
    fileIo.closeSync(file);
    // let base64Str =  this.base64.encodeToStringSync(new Uint8Array(buffer));
    return buffer;
  }

  public static getTempFile(context: TurboModuleContext, uri: string): ArrayBuffer {
    try {
      let file = fs.openSync(uri, fs.OpenMode.READ_WRITE);
      let length = fs.statSync(uri).size
      let buf = new ArrayBuffer(length);
      fs.readSync(file.fd, buf);
      return buf
    } catch (e) {
      hilog.info(0x0001, TAG + " getTempFile ", e);
      return new ArrayBuffer(0);
    }
  }
}

