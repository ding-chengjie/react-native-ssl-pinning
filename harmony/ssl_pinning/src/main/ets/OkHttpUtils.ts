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

import { ArrayList, HashMap, JSON, util } from '@kit.ArkTS';
import { TurboModuleContext } from '@rnoh/react-native-openharmony/ts';
import { fileIo as fs } from '@kit.CoreFileKit';
import { FetchOptions, Header } from './EventType';
import { http } from '@kit.NetworkKit';
import { HandleParameterUtils } from './HandleParameterUtils';
import Logger from './Logger';

export class OkHttpUtils {
  private static content_type: string = "application/json; charset=utf-8";

  static base64 = new util.Base64Helper();
  static PUBLIC_KEY_HASH : string = "publicKeyHash";
  static CERT_KEY_HASH : string = "certKeyHash";
  static PIN_HEADER : string = "sha256/";

  public static async constructorHttpRequestOptions(ctx: TurboModuleContext, options: FetchOptions): Promise<http.HttpRequestOptions> {
    //handle header attribute
    let headerStr : object = {"Content-Type": "multipart/form-data"};
    if (options.headers) {
      let map: Header | undefined = options.headers;
      for (let key in map) {
        headerStr = {key : map[key]};
      }
      if (map["content-type"]) {
        this.content_type = map["content-type"];
      }
    }
    //handle method attribute
    let method: http.RequestMethod = http.RequestMethod.POST;
    if (options.method) {
      method = HandleParameterUtils.requestMethod(options.method.toString());
    }
    //handle pkpinning and sslPinning attribute
    let certificatePinningArray : http.CertificatePinning[] = [];
    let pkPinning: string = HandleParameterUtils.handlePkPinning(options);
    if (pkPinning == this.PUBLIC_KEY_HASH) {
      options.sslPinning.certs.forEach((pin: string) => {
        let certPinning: http.CertificatePinning
        if (pin.search(this.PIN_HEADER) >= 0) {
          let pinSuffix : string = pin.substring(this.PIN_HEADER.length, pin.length);
          certPinning = { publicKeyHash: pinSuffix, hashAlgorithm: "SHA-256" }
        } else {
          certPinning = { publicKeyHash:pin, hashAlgorithm: "SHA-256" }
        }
        certificatePinningArray.push(certPinning)
      })
    } else if (pkPinning == this.CERT_KEY_HASH) {//cert
      options.sslPinning.certs.forEach(async (certName: string) => {
        let pubKeyHash: string[] = await HandleParameterUtils.getPubKeyHashFromCert(certName.concat(".cer"), ctx.uiAbilityContext)
        let certPinning: http.CertificatePinning
        if (pubKeyHash && pubKeyHash.length > 0) {
          pubKeyHash.forEach((pin: string) => {
            certPinning = { publicKeyHash : pin, hashAlgorithm : "SHA-256" }
            certificatePinningArray.push(certPinning)
          })
        }
      })
    } else {
      Logger.info("未携带证书")
    }

    //handle timeoutInterval attribute
    let timeout: number = 0;
    if (options.timeoutInterval) {
      //The original unit is MILLISECONDS
      timeout = options.timeoutInterval;
    }
    //handle body
    let multiFormDataList: any[] = await this.handleMultiFormData(ctx, options);
    //assembly properties
    let httpRequestOptions: http.HttpRequestOptions = {
      // header: headerStr
      header: {
        "Content-Type": "multipart/form-data"
      },
      method: method,
      readTimeout: timeout,
      connectTimeout: timeout,
      expectDataType: http.HttpDataType.STRING,
      multiFormDataList: multiFormDataList,
    }
    if (certificatePinningArray && certificatePinningArray.length > 0) {
      httpRequestOptions.certificatePinning = certificatePinningArray;
    }
    Logger.info("httpRequestOptions==" + JSON.stringify(httpRequestOptions))
    return new Promise((resolve, reject) => {
      resolve(httpRequestOptions);
    });
  }

  public static async handleMultiFormData(ctx: TurboModuleContext, options: FetchOptions) : Promise<any[]>{
    let multiFormDataList: any[] = []
    if (options.body) {
        let bodyMap = options.body as Object;
        if (bodyMap["formData"]) {
          let formData = bodyMap["formData"];
          await this.buildFormDataRequestBody(ctx, formData).then((data) => {
            multiFormDataList = data;
          });
        } else if (bodyMap["_parts"]) {
          await this.buildFormDataRequestBody(ctx, bodyMap).then((data) => {
            multiFormDataList = data;
          });
        }
    }
    return multiFormDataList;
  }

  public static async buildFormDataRequestBody(ctx: TurboModuleContext, formData: object): Promise<Array<any>> {
    let multiFormDataList: any[] = []
    if (formData["_parts"]) {
      let partsList: ArrayList<any> = this.parseParts(formData["_parts"])
      for (let i = 0; i < partsList.length; i++) {
        let multiFormData: any;
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
          let type: string = "";
          if (fileData.hasKey("type")) {
            type = fileData.get("type")
          }
          let fileCaPath: string = await this.copyFileToCa(ctx, fileData.get("uri"));
          multiFormData = {
            name: key,
            contentType: "",//type,
            remoteFileName: fileName,
            filePath: fileCaPath
          }
        } else {
          let value: string = part[1];
          multiFormData = {
            name: key,
            contentType: "text/plain",
            data: value
          }
        }
        multiFormDataList.push(multiFormData)
      }
    }
    return multiFormDataList;
  }

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

  public static async copyFileToCa(ctx: TurboModuleContext, uri: string): Promise<string> {
    let caFileSandPath = "";
    try {
      let segments: string[] = uri.split('/');
      let fileName = segments[segments.length-1];
      caFileSandPath = ctx.uiAbilityContext.filesDir + "/" + fileName
      try {
        let file = await fs.open(uri);
        fs.copyFileSync(file.fd, caFileSandPath)
        fs.closeSync(file);
      } catch (err) {
        Logger.info('err.code : ' + err.code + ', err.message : ' + err.message);
      }
    } catch (e) {

    }
    return  new Promise((resolve, reject) => {
      resolve(caFileSandPath);
    });
  }
}

