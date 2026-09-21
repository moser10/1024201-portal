/** High purity is good: dark green → yellow → red → black (worst). */

const CITY_ABBR = {
  "los angeles": "LA",
  "los ángeles": "LA",
  "洛杉矶": "LA",
  "洛杉磯": "LA",
  "new york": "NYC",
  "new york city": "NYC",
  "纽约": "NYC",
  "紐約": "NYC",
  "san francisco": "SF",
  "旧金山": "SF",
  "三藩市": "SF",
  "san jose": "SJ",
  "圣何塞": "SJ",
  "beijing": "BJ",
  "peking": "BJ",
  "北京": "BJ",
  "shanghai": "SH",
  "上海": "SH",
  "guangzhou": "GZ",
  "广州": "GZ",
  "廣州": "GZ",
  "shenzhen": "SZ",
  "深圳": "SZ",
  "hangzhou": "HZ",
  "杭州": "HZ",
  "chengdu": "CD",
  "成都": "CD",
  "chongqing": "CQ",
  "重庆": "CQ",
  "重慶": "CQ",
  "wuhan": "WH",
  "武汉": "WH",
  "武漢": "WH",
  "nanjing": "NJ",
  "南京": "NJ",
  "tianjin": "TJ",
  "天津": "TJ",
  "xian": "XA",
  "xi'an": "XA",
  "西安": "XA",
  "suzhou": "SUZ",
  "苏州": "SUZ",
  "qingdao": "QD",
  "青岛": "QD",
  "dongguan": "DG",
  "东莞": "DG",
  "hong kong": "HK",
  "hongkong": "HK",
  "香港": "HK",
  "macau": "MO",
  "macao": "MO",
  "澳门": "MO",
  "taipei": "TPE",
  "台北": "TPE",
  "tokyo": "Tokyo",
  "东京": "Tokyo",
  "東京": "Tokyo",
  "osaka": "Osaka",
  "大阪": "Osaka",
  "seoul": "SEL",
  "首尔": "SEL",
  "首爾": "SEL",
  "singapore": "SG",
  "新加坡": "SG",
  "london": "LDN",
  "伦敦": "LDN",
  "paris": "PAR",
  "巴黎": "PAR",
  "seattle": "SEA",
  "芝加哥": "CHI",
  "chicago": "CHI",
  "houston": "HOU",
  "dallas": "DAL",
  "miami": "MIA",
  "washington": "DC",
  "washington dc": "DC",
  "toronto": "TOR",
  "sydney": "SYD",
  "melbourne": "MEL",
  "gothenburg": "GOT",
  "goteborg": "GOT",
  "göteborg": "GOT",
  "哥德堡": "GOT",
  "stockholm": "STO",
  "斯德哥尔摩": "STO",
};

const COUNTRY_ISO = {
  china: "CN",
  "中国": "CN",
  "中國": "CN",
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  "美国": "US",
  "美國": "US",
  japan: "JP",
  "日本": "JP",
  "sweden": "SE",
  "瑞典": "SE",
  "united kingdom": "GB",
  "great britain": "GB",
  "英国": "GB",
  germany: "DE",
  france: "FR",
  "south korea": "KR",
  korea: "KR",
  "韩国": "KR",
  singapore: "SG",
  australia: "AU",
  canada: "CA",
  india: "IN",
  brazil: "BR",
  russia: "RU",
};

export function purityClass(purity) {
  const n = Number(purity);
  if (!Number.isFinite(n)) return "g1";
  if (n >= 86) return "g1";
  if (n >= 72) return "g2";
  if (n >= 58) return "y1";
  if (n >= 44) return "y2";
  if (n >= 30) return "or";
  if (n >= 16) return "rd";
  return "bk";
}

function countryCode(country) {
  const raw = String(country || "").trim();
  if (!raw) return "";
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  return COUNTRY_ISO[raw.toLowerCase()] || "";
}

function compactCity(city) {
  return String(city || "")
    .replace(/\s*(special administrative region|municipality|prefecture|province|city|shi)\s*/gi, " ")
    .replace(/[市省特別行政区自治区县]$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatNetSpeed({ mbps, rttMs } = {}) {
  const down = Number(mbps);
  if (Number.isFinite(down) && down > 0) {
    return down >= 10 ? `${Math.round(down)}M` : `${Math.round(down * 10) / 10}M`;
  }
  const rtt = Number(rttMs);
  if (Number.isFinite(rtt) && rtt > 0) return `${Math.round(rtt)}ms`;
  return "—";
}

export function shortPlace(data = {}) {
  const cc = countryCode(data.country);
  const rawCity = compactCity(data.city);
  const abbr = CITY_ABBR[rawCity.toLowerCase()] || CITY_ABBR[String(data.city || "").trim().toLowerCase()];
  const city = abbr || rawCity;
  if (city && cc) return `${city}, ${cc}`;
  if (city) return city;
  if (cc) return cc;
  return "";
}
