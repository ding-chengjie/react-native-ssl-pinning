import type { TurboModule } from "react-native/Libraries/TurboModule/RCTExport";
import { TurboModuleRegistry } from "react-native";

interface Cookies {
  [cookieName: string]: string;
}

interface Header {
  [headerName: string]: string;
}

interface Options {
  body?: string | object,
  responseType?: 'text' | 'base64',
  credentials?: string,
  headers?: string | object,
  method?: 'DELETE' | 'GET' | 'POST' | 'PUT',
  pkPinning?: boolean,
  sslPinning: {
      certs: string[]
  },
  timeoutInterval?: number,
  disableAllSecurity?: boolean,
  caseSensitiveHeaders?: boolean,
}

interface Response {
  bodyString?: string;
  data?: string;
  headers: Header;
  status: number;
  url: string;
  json: () => Promise<{ [key: string]: any}>;
  text: () => Promise<string>;
}


export interface Spec extends TurboModule {
  getCookies(domain: string): Promise<Cookies>;
  fetch(url: string, options: Options, callback:(err: Object, res: Object) => void): Promise<Response>;
  removeCookieByName(cookieName: string): Promise<void>;
}

export default TurboModuleRegistry.get<Spec>("RNSslPinning") as Spec;

