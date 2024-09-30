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

import Cookie from './Cookie'
import { Logger } from '../Logger';
import { CookiePolicy } from './httpcookieutils';

var cookieStrSplitter = /[:](?=\s*[a-zA-Z0-9_\-]+\s*[=])/g;

function CookieJar() {
  var cookiesList, collidableCookie, cookies, cookiemap, cookieStore;
  this.cookieStore = null;
  this.cookies = Object.create(null);
}

CookieJar.prototype.setCookieStore = function setCookieStore(cookieStore) {
  this.cookieStore = cookieStore;
}
CookieJar.prototype.getCookieStore = function getCookieStore() {
  return this.cookieStore;
}


//returns a cookie
CookieJar.prototype.getCookie = function getCookie(cookieName, accessInfo) {
  var cookie, i;
  this.cookiesList = this.cookies[cookieName];
  if (!this.cookiesList) {
    console.info("httpclient- cookiejar getCookie nocookie: " + cookieName + "===" + accessInfo);
    return;
  }
  for (i = 0; i < this.cookiesList.length; i += 1) {
    cookie = this.cookiesList[i];
    if (cookie.expiration_date <= Date.now()) {
      if (this.cookiesList.length === 0) {
        delete this.cookies[cookie.name];
      }
    } else {
      if (accessInfo == undefined) {
        return cookie;
      }
      if (cookie.matches(accessInfo)) {
        console.info("httpclient- cookiejar matched cookie: " + cookie.name);
        return cookie;
      }
      console.info("httpclient- cookiejar NO matched cookie: " + cookieName);
    }
  }
}
//returns a list of cookies
CookieJar.prototype.getCookies = function getCookies(accessInfo) {
  var matches = [];
  var cookieName, cookie;
  console.info("httpclient- cookiejar getCookie checking cookies: " + this.cookies.size);
  console.info("httpclient- cookiejar getCookie checking cookies: " + JSON.stringify(this.cookies));
  for (cookieName in this.cookies) {
    cookie = this.getCookie(cookieName, accessInfo);
    if (cookie) {
      matches.push(cookie);
    }
  }
  return matches;
}
CookieJar.prototype.saveFromResponse = function saveFromResponse(resp, url, cookiemanager) {
  let cookiePolicy = CookiePolicy.ACCEPT_ORIGINAL_SERVER;
  console.info("httpclient- cookiemanager: " + cookiemanager.toString());
  if (cookiemanager) {
    cookiePolicy = cookiemanager.cookiePolicy;
  }
  console.info("httpclient- checking cookie policy: " + cookiePolicy);
  if (cookiePolicy === CookiePolicy.ACCEPT_NONE) {
    return;
  }
  this.loadForRequest(url);
  let header = resp.header;

  console.info("httpclient- header: " + JSON.stringify(header));

  let responseJSON = JSON.parse(JSON.parse(JSON.stringify(header)));
  console.info("httpclient- cookie: " + responseJSON);
  console.info("httpclient- cookie: " + responseJSON["set-cookie"]);
  let setCookieData = responseJSON['set-cookie'];
  if (setCookieData instanceof Array) {
    if (setCookieData.length == 0) {
      return;
    }
    for (let i = 0; i < setCookieData.length; i++) {
      let cookieData = setCookieData[i];
      if (cookiePolicy === CookiePolicy.ACCEPT_ORIGINAL_SERVER) {
        if (!this.domainMatches(cookieData, this.extractHostname(url))) {
          continue;
        }
      }
      this.setCookie(cookieData);
    }
    this.saveCookie(url);
  } else if (setCookieData) {
    if (cookiePolicy === CookiePolicy.ACCEPT_ORIGINAL_SERVER) {
      if (!this.domainMatches(setCookieData, this.extractHostname(url))) {
        console.info("httpclient- cookie: the cookie domain are not matching");
        return;
      }
    }
    this.setCookie(setCookieData);
    this.saveCookie(url);
  }
}
CookieJar.prototype.loadForRequest = function loadForRequest(url) {
  this.cookies = Object.create(null);
  this.loadCookie(url);
  var cookieHeader = '';
  for (let cookieName in this.cookies) {
    var cookie = this.getCookie(cookieName);
    if (cookieHeader.length > 0) {
      cookieHeader = cookieHeader + ';';
    }
    cookieHeader = cookieHeader + cookie.name + "=" + cookie.value;
  }
  console.info("httpclient- cookieHeader: " + cookieHeader);
  return cookieHeader;
}
// jshint maxdepth:5
CookieJar.prototype.loadCookie = function loadCookie(url) {
  url = this.extractHostname(url);
  //URL=jsnjlq.cn
  if (this.cookieStore && this.cookieStore.readCookie(url)) {
    let cookieJSON = this.cookieStore.readCookie(url);
    console.info("httpclient- loadCookie JSON :" + cookieJSON);
    let json = JSON.parse(cookieJSON);
    for (let cookieName in json) {
      for (var key in json[cookieName]) {
        let cookiejson = json[cookieName][key];
        let cookiestr = [cookiejson.name + "=" + cookiejson.value];
        if (cookiejson.expiration_date && (cookiejson.expiration_date !== Infinity)) {
          cookiestr.push(
            "expires=" + new Date(cookiejson.expiration_date).toUTCString()
          );
        }
        if (cookiejson.domain) {
          cookiestr.push("domain=" + cookiejson.domain);
        }

        if (cookiejson.path) {
          cookiestr.push("path=" + cookiejson.path);
        }

        if (cookiejson.secure) {
          cookiestr.push("secure");
        }

        if (cookiejson.noscript) {
          cookiestr.push("httponly");
        }

        console.info("httpclient- cookiestr:" + cookiestr.join("; "));
        this.setCookie(cookiestr.join("; "));
      }
    }
  } else {
    console.info("httpclient- loadCookie : not a persistent cookiestore");
  }
}

CookieJar.prototype.setCookie = function setCookie(cookie, requestDomain, requestPath) {
  var remove, i;
  console.info("httpclient- cookiejar setCookie: " + cookie);
  cookie = /*new */
    Cookie(cookie, requestDomain, requestPath);
  //Delete the cookie if the set is past the current time
  remove = cookie.expirationDate <= Date.now();
  console.info("httpclient- cookiejar expiry: " + remove);
  this.cookiesList = this.cookies[cookie.name] !== undefined ? this.cookies[cookie.name] : [];
  for (i = 0; i < this.cookiesList.length; i += 1) {
    this.collidableCookie = this.cookiesList[i];
    if (this.collidableCookie.collidesWith(cookie)) {
      if (remove) {
        this.cookiesList.splice(i, 1);
        if (this.cookiesList.length === 0) {
          delete this.cookies[cookie.name];
        }
        return false;
      }
      this.cookiesList[i] = cookie;
      return cookie;
    }

    if (remove) {
      return false;
    }
    this.cookiesList.push(cookie);
    return cookie;
  }
  if (remove) {
    return false;
  }
  this.cookies[cookie.name] = [cookie];
  return this.cookies[cookie.name];
};

CookieJar.prototype.saveCookie = function saveCookie(url) {
  url = this.extractHostname(url);
  console.info("httpclient- saveCookie:" + url + "===" + JSON.stringify(this.cookies));
  if (this.cookieStore) {
    this.cookieStore.writeCookie(url, JSON.stringify(this.cookies));
  } else {
    console.info("httpclient- loadCookie : not a persistent cookiestore");
  }
  console.info("httpclient- saveCookie completed:");
}

CookieJar.prototype.extractHostname = function extractHostname(url) {
  var hostname;
  //find & remove protocol (http, ftp, etc.) and get hostname
  if (url.indexOf("//") > -1) {
    hostname = url.split('/')[2];
  } else {
    hostname = url.split('/')[0];
  }
  //find & remove port number
  hostname = hostname.split(':')[0];
  //find & remove "?"
  hostname = hostname.split('?')[0];
  return hostname;
}

//returns list of cookies that were set correctly. Cookies that are expired and removed are not returned.
CookieJar.prototype.setCookies = function setCookies(cookies, requestDomain, requestPath) {
  cookies = Array.isArray(cookies) ?
    cookies :
  cookies.split(cookieStrSplitter);
  var successful = [],
    i,
    cookie;
  cookies = cookies.map(function (item) {
    return /*new */
    Cookie(item, requestDomain, requestPath);
  });
  for (i = 0; i < cookies.length; i += 1) {
    cookie = cookies[i];
    if (this.setCookie(cookie, requestDomain, requestPath)) {
      successful.push(cookie);
    }
  }
  return successful;
};

CookieJar.prototype.domainMatches = function domainMatches(cookies, host) {

  var cookie = /*new */
    Cookie(cookies);
  var domain = cookie.domain;
  if (!domain) {
    console.info("httpclient- cookie: the cookie domain is not present");
    return false;
  }
  //Delete the cookie if the set is past the current time

  if (domain == null || host == null) {
    return false;
  }
  console.info("httpclient- domain:" + domain + "," + "host:" + host);
  // if there's no embedded dot in domain and domain is not .local
  var isLocalDomain = ".local".toLowerCase() === domain.toLowerCase();
  var embeddedDotInDomain = domain.indexOf(".");
  if (embeddedDotInDomain == 0) {
    embeddedDotInDomain = domain.indexOf(".", 1);
  }

  if (
    !isLocalDomain &&
      (embeddedDotInDomain == -1 || embeddedDotInDomain == domain.length - 1)
  ) {
    return false;
  }
  console.info("httpclient- " + isLocalDomain + "," + embeddedDotInDomain);
  // if the host name contains no dot and the domain name
  // is .local or host.local
  var firstDotInHost = host.indexOf(".");
  if (
    firstDotInHost == -1 &&
      (isLocalDomain || domain.toLowerCase() === (host + ".local").toLowerCase())
  ) {
    return true;
  }

  var domainLength = domain.length;
  var lengthDiff = host.length - domainLength;
  if (lengthDiff == 0) {
    // if the host name and the domain name are just string-compare euqal
    return host.toLowerCase() === domain.toLowerCase();
  } else if (lengthDiff > 0) {
    // need to check H & D component
    var H = host.substring(0, lengthDiff);
    var D = host.substring(lengthDiff);
    return H.indexOf(".") == -1 && D.toLowerCase() === domain.toLowerCase();
  } else if (lengthDiff == -1) {
    // if domain is actually .host
    return (
      domain.charAt(0) == "." &&
        host.toLowerCase() === domain.substring(1).toLowerCase()
    );
  }

  return false;
}

export default CookieJar;