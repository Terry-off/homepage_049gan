import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT_URL = "https://049gan.kr/";
const ROOT_HOST = new URL(ROOT_URL).host;
const WORKDIR = process.cwd();
const PAGE_PATHS = ["", "About", "18", "Contact"];
const PAGE_URLS = new Set(
  PAGE_PATHS.map((pagePath) => new URL(pagePath || "/", ROOT_URL).toString())
);
const REQUEST_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/css,*/*;q=0.8",
  referer: ROOT_URL,
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

function extractCalendarConfig(html) {
  const initMatch = html.match(/SITE_CALENDAR\.init\((\{[\s\S]*?\})\s*,\s*'[^']*'\s*,\s*'([^']+)'/);
  if (!initMatch) return null;

  const configText = initMatch[1];
  return {
    langCode: initMatch[2],
    idx: configText.match(/"idx":"([^"]+)"/)?.[1] || "",
    boardCode: configText.match(/"code":"([^"]+)"/)?.[1] || "",
    siteCode: configText.match(/"site_code":"([^"]+)"/)?.[1] || "",
    unitCode: configText.match(/"unit_code":"([^"]+)"/)?.[1] || "",
  };
}

async function fetchRemoteText(urlString, options = {}) {
  const response = await fetch(urlString, {
    ...options,
    headers: {
      ...REQUEST_HEADERS,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function writeFixture(relativePath, content) {
  const outputPath = path.join(WORKDIR, relativePath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content, "utf8");
}

function stripContactScheduleSection(html) {
  return html
    .replace(
      /<script\s+src='https:\/\/vendor-cdn\.imweb\.me\/js\/fullcalendar\.min\.js\?[^']*'><\/script>/i,
      ""
    )
    .replace(
      /<script\s+src='\/js\/site_calendar\.js\?[^']*'><\/script>/i,
      ""
    )
    .replace(
      /\$\("#text_w202512037612d7480341c"\)\.find\("\._table_responsive"\)\.addClass\("table"\)\.wrap\(\$\("<div\s*\/>"\)\.addClass\("table-responsive"\)\);\s*/i,
      ""
    )
    .replace(
      /\$\s*\(document\)\.ready\(function\(\)\{\s*SITE_CALENDAR\.init\([\s\S]*?\);\s*\}\);\s*/i,
      ""
    );
}

async function mirrorCalendarFixtures(contactHtml) {
  const config = extractCalendarConfig(contactHtml);
  if (!config?.boardCode) {
    return;
  }

  const formHeaders = {
    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    origin: ROOT_URL.replace(/\/$/, ""),
    referer: new URL("Contact", ROOT_URL).toString(),
    "x-requested-with": "XMLHttpRequest",
  };

  const eventsBody = new URLSearchParams({ board_code: config.boardCode }).toString();
  const permissionBody = new URLSearchParams({
    idx: config.idx,
    board_code: config.boardCode,
    unit_code: config.unitCode,
    site_code: config.siteCode,
  }).toString();
  const unitBody = new URLSearchParams({ unit_code: config.unitCode }).toString();

  const [eventsJson, permissionJson, defaultColorJson, backgroundColorJson, bodyColorJson] =
    await Promise.all([
    fetchRemoteText(new URL("ajax/calendar_data.cm", ROOT_URL).toString(), {
      method: "POST",
      headers: formHeaders,
      body: eventsBody,
    }),
    fetchRemoteText(new URL("ajax/calendar_check_write_permission.cm", ROOT_URL).toString(), {
      method: "POST",
      headers: formHeaders,
      body: permissionBody,
    }),
    fetchRemoteText(new URL("ajax/calendar_classify_default_color.cm", ROOT_URL).toString(), {
      method: "POST",
      headers: formHeaders,
      body: unitBody,
    }),
    fetchRemoteText(new URL("ajax/calendar_classify_background_color.cm", ROOT_URL).toString(), {
      method: "POST",
      headers: formHeaders,
      body: unitBody,
    }),
    fetchRemoteText(new URL("ajax/calendar_classify_body_color.cm", ROOT_URL).toString(), {
      method: "POST",
      headers: formHeaders,
      body: unitBody,
    }),
  ]);

  await writeFixture("fixtures/calendar/contact-events.json", eventsJson);
  await writeFixture("fixtures/calendar/contact-permission.json", permissionJson);
  await writeFixture("fixtures/calendar/contact-default-color.json", defaultColorJson);
  await writeFixture("fixtures/calendar/contact-background-color.json", backgroundColorJson);
  await writeFixture("fixtures/calendar/contact-body-color.json", bodyColorJson);
}

const PARSE_EXTENSIONS = new Set([".css", ".html"]);

const STATIC_FILE_RE =
  /\.(?:avif|bmp|cm|css|eot|gif|ico|jpe?g|js|json|mjs|mp4|otf|pdf|png|svg|ttf|txt|webm|webp|woff2?|xml)(?:$|\?)/i;

const visited = new Set();
const pending = [];

function normalizeQuotedUrl(raw) {
  if (!raw) return "";

  let value = raw.trim();

  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    value = value.slice(1, -1);
  }

  return value
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .replace(/^https?:\/\/049gan\.kr/i, "")
    .trim();
}

function toAbsoluteUrl(raw, baseUrl) {
  const value = normalizeQuotedUrl(raw);

  if (!value || value.startsWith("data:") || value.startsWith("javascript:") || value.startsWith("#")) {
    return null;
  }

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function shouldDownload(urlString) {
  try {
    const url = new URL(urlString);
    if (url.host !== ROOT_HOST) {
      return false;
    }

    if (PAGE_URLS.has(url.toString())) return true;

    if (/\.cm$/i.test(url.pathname)) {
      return url.pathname.startsWith("/css/");
    }

    return STATIC_FILE_RE.test(url.pathname);
  } catch {
    return false;
  }
}

function localPathForUrl(urlString) {
  const url = new URL(urlString);

  if (PAGE_URLS.has(url.toString()) || url.pathname === "/" || url.pathname === "") {
    if (url.pathname === "/" || url.pathname === "") {
      return path.join(WORKDIR, "index.html");
    }

    return path.join(WORKDIR, url.pathname.replace(/^\/+/, ""), "index.html");
  }

  const ext = path.extname(url.pathname);
  if (!ext) {
    // Preserve extensionless same-origin content as directory indexes.
    return path.join(WORKDIR, "index.html");
  }

  return path.join(WORKDIR, url.pathname.replace(/^\/+/, ""));
}

function isTextFile(filePath, contentType) {
  const ext = path.extname(filePath).toLowerCase();
  return (
    PARSE_EXTENSIONS.has(ext) ||
    (ext === ".js" && filePath.includes(`${path.sep}_${path.sep}`)) ||
    (ext === "" && /text\/html/i.test(contentType || ""))
  );
}

function enqueue(urlString) {
  if (!shouldDownload(urlString) || visited.has(urlString)) {
    return;
  }

  visited.add(urlString);
  pending.push(urlString);
}

function extractUrls(text, baseUrl) {
  const found = new Set();
  const patterns = [
    /(?:src|href|action|content|poster)=["']([^"'<>]+)["']/gi,
    /url\(([^)]+)\)/gi,
  ];

  try {
    const parsedBase = new URL(baseUrl);
    if (parsedBase.pathname.startsWith("/_/")) {
      patterns.push(/import\s+(?:[^"'`]+\s+from\s+)?["']([^"'<>]+)["']/gi);
    }
  } catch {
    // Ignore URL parsing failures and fall back to HTML/CSS patterns only.
  }

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const absolute = toAbsoluteUrl(match[1], baseUrl);
      if (absolute && shouldDownload(absolute)) {
        found.add(absolute);
      }
    }
  }

  return [...found];
}

async function save(urlString, buffer) {
  const outputPath = localPathForUrl(urlString);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);
  return outputPath;
}

async function download(urlString) {
  const response = await fetch(urlString, { headers: REQUEST_HEADERS });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get("content-type") || "";
  const outputPath = await save(urlString, buffer);

  if (isTextFile(outputPath, contentType)) {
    const text = buffer.toString("utf8");
    for (const childUrl of extractUrls(text, urlString)) {
      enqueue(childUrl);
    }
  }
}

async function main() {
  console.log("Cleaning previous mirrored folders...");
  for (const dirName of ["18", "About", "Contact", "admin", "common", "css", "fixtures", "js", "_"]) {
    const absolute = path.join(WORKDIR, dirName);
    await rm(absolute, { recursive: true, force: true });
  }
  for (const fileName of ["index.html", "logout.cm"]) {
    await rm(path.join(WORKDIR, fileName), { recursive: true, force: true });
  }

  let contactHtml = "";
  for (const pageUrl of PAGE_URLS) {
    console.log(`Downloading page snapshot ${pageUrl}`);
    const html = await fetch(pageUrl, { headers: REQUEST_HEADERS }).then((response) =>
      response.text()
    );
    await save(pageUrl, Buffer.from(html, "utf8"));
    if (pageUrl.endsWith("/Contact")) {
      contactHtml = html;
    }

    visited.add(pageUrl);
    for (const assetUrl of extractUrls(html, pageUrl)) {
      enqueue(assetUrl);
    }
  }

  if (contactHtml) {
    await mirrorCalendarFixtures(contactHtml);
  }

  while (pending.length > 0) {
    const nextUrl = pending.shift();
    if (!nextUrl) continue;

    try {
      console.log(`Downloading ${nextUrl}`);
      await download(nextUrl);
    } catch (error) {
      console.warn(`Skipping ${nextUrl}: ${error.message}`);
    }
  }

  for (const pagePath of PAGE_PATHS) {
    const htmlPath = pagePath
      ? path.join(WORKDIR, pagePath, "index.html")
      : path.join(WORKDIR, "index.html");
    const finalHtml = await readFile(htmlPath, "utf8");
    let refreshedHtml = finalHtml.replace(
      /<script\s+type="module"\s+defer\s+src='\/js\/init_datadog_rum\.js\?[^']*'><\/script>/i,
      ""
    ).replace(
      /<script\s+src='\/js\/brandscope\.js\?[^']*'><\/script>/i,
      ""
    );
    if (pagePath === "Contact") {
      refreshedHtml = stripContactScheduleSection(refreshedHtml);
    }
    await writeFile(htmlPath, refreshedHtml, "utf8");
  }

  console.log("Mirror complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
