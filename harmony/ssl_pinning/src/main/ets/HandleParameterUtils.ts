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

import {JSON, util } from '@kit.ArkTS';
import hilog from '@ohos.hilog';
import fs from '@ohos.file.fs';
import { FetchOptions } from './EventType';
import { http } from '@kit.NetworkKit';
import { cert } from '@kit.DeviceCertificateKit';
import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { Context } from '@kit.AbilityKit';
import Logger from './Logger';

const TAG: string = "HandleParameterUtils --> "

export class HandleParameterUtils {
  static SHA_256: string = "sha256/"
  public static requestMethod(method: string): http.RequestMethod{
    switch (method.toUpperCase().trim()) {
      case http.RequestMethod.OPTIONS.valueOf():
        return http.RequestMethod.OPTIONS;
      case http.RequestMethod.GET.valueOf():
        return http.RequestMethod.GET;
      case http.RequestMethod.HEAD.valueOf():
        return http.RequestMethod.HEAD;
      case http.RequestMethod.POST.valueOf():
        return http.RequestMethod.POST;
      case http.RequestMethod.PUT.valueOf():
        return http.RequestMethod.PUT;
      case http.RequestMethod.DELETE.valueOf():
        return http.RequestMethod.DELETE;
      case http.RequestMethod.TRACE.valueOf():
        return http.RequestMethod.TRACE;
      case http.RequestMethod.CONNECT.valueOf():
        return http.RequestMethod.CONNECT;
      default :
        return http.RequestMethod.POST;
    }
  }

  public static handlePkPinning(options: FetchOptions): string {
    if (options.sslPinning) {
      if (options.sslPinning.certs) {
        if (options.pkPinning && Boolean(options.pkPinning)) {
          //公钥
          return "publicKeyHash";
        } else {
          return "certKeyHash";
        }
      } else {
        let message: string = "key certs was not found";
        hilog.info(0x0001, TAG, message);
        return message;
      }
    } else {
      //无证书
      let message: string = "sslPinning key was not exist";
      hilog.info(0x0001, TAG, message);
     return message;
    }
  }

  //Obtain the SHA256 summary of the public key corresponding to the certificate file
  static async getPubKeyHashFromCert(filePath: string, context: Context): Promise<string[]>{
    let result: string[] = [];
    let certUnit8Array: Uint8Array = await this.getCAContent(filePath, context);
    let certStr: string = this.uint8ArrayToString(certUnit8Array);
    if (certStr) {
      if (certStr.search(this.SHA_256) >= 0) {
        let pubKeyHash: string[] = certStr.split(this.SHA_256);
        pubKeyHash.forEach((pin: string) => {
          if (pin.trim().length > 0) {
            result.push(pin.trim());
          }
        })
        return result;
      } else {
        return await this.getPubKeyHash(certUnit8Array, filePath, context);
      }
    }
  }

  //Get the file contents
  static async getCAContent(ca: string, context: Context): Promise<Uint8Array> {
    if (!ca) {
      return new Uint8Array();
    }
    const value: Uint8Array = await new Promise<Uint8Array>(resolve => {
      context.resourceManager.getRawFileContent(
        ca,
        (err: BusinessError, value) => {
          if (err) {
            throw new Error(JSON.stringify(err));
          }
          resolve(value);
        });
    })
    return value;
  }

  // Bytes are rounded into understandable strings
  static uint8ArrayToString(array: Uint8Array) {
    // Convert UTF-8 encoding to Unicode encoding
    let out: string = '';
    let index: number = 0;
    let len: number = array.length;
    while (index < len) {
      let character = array[index++];
      switch (character >> 4) {
        case 0:
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
        case 6:
        case 7:
          out += String.fromCharCode(character);
          break;
        case 12:
        case 13:
          out += String.fromCharCode(((character & 0x1F) << 6) | (array[index++] & 0x3F));
          break;
        case 14:
          out += String.fromCharCode(((character & 0x0F) << 12) | ((array[index++] & 0x3F) << 6) |
            ((array[index++] & 0x3F) << 0));
          break;
        default:
          break;
      }
    }
    Logger.info('字节流转成字符串:' + out);
    return out;
  }

  //Obtain the SHA256 summary of the public key corresponding to the Uint8Array
  static async getPubKeyHash(certUint8Array: Uint8Array, filePath: string, context: Context): Promise<string[]> {
    let result: string[] = [];
    if (filePath != "") {
      let fixedCert: cert.X509Cert | undefined = await this.getCertFromFile(certUint8Array)
      if (fixedCert) {
        try {
          //获取公钥
          let pubKey = fixedCert.getItem(cert.CertItemType.CERT_ITEM_TYPE_PUBLIC_KEY);
          let mdSHA256 = cryptoFramework.createMd("SHA256")
          mdSHA256.updateSync({ data: pubKey.data });
          //公钥摘要计算结果
          let mdResult = mdSHA256.digestSync();
          let tool = new util.Base64Helper()
          //公钥摘要转换为base64编码字符串
          result.push(tool.encodeToStringSync(mdResult.data))
          Logger.info("getPubKeyHash:" + result)
        } catch (e) {
          Logger.info('获取公钥摘要失败 ' + e.message);
        }
      }
    }
    return result
  }

  //从文件获取X509证书
  static async getCertFromFile(certData: Uint8Array): Promise<cert.X509Cert | undefined> {
    let newCert: cert.X509Cert | undefined = undefined
    // let certData: Uint8Array = await this.getCAContent(filePath, context);
    if (certData) {
      let encodingBlob: cert.EncodingBlob = {
        data: certData,
        encodingFormat: cert.EncodingFormat.FORMAT_PEM
      };
      await cert.createX509Cert(encodingBlob)
        .then((x509Cert: cert.X509Cert) => {
          newCert = x509Cert
        })
        .catch((err: BusinessError) => {
          Logger.info(`创建X509证书失败：err code is ${err.code}, err message is ${JSON.stringify(err)}`);
        })
    }
    return newCert
  }

  //加载文件内容
  static getContent(filePath: string): ArrayBuffer | undefined {
    let content: ArrayBuffer | undefined = undefined
    try {
      let buf = new ArrayBuffer(1024 * 64);
      let file = fs.openSync(filePath, fs.OpenMode.READ_ONLY);
      let readLen = fs.readSync(file.fd, buf, { offset: 0 });
      content = buf.slice(0, readLen)
      fs.closeSync(file);
    } catch (e) {
      Logger.info('读取文件内容失败 ' + e.message);
    }
    return content
  }

}

