import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const pagesConfigPath = path.join(rootDir, "pages.config.json");

const includeEntries = [
  "index.html",
  "About",
  "18",
  "Contact",
  "common",
  "css",
  "img",
  "js",
  "_"
];

const pagesConfig = readPagesConfig();
const siteUrl = resolveSiteUrl();
const formEndpoint =
  process.env.PAGES_FORM_ENDPOINT ||
  pagesConfig.formEndpoint ||
  "https://formsubmit.co/ajax/hsptool@naver.com";
const formProvider =
  process.env.PAGES_FORM_PROVIDER ||
  pagesConfig.formProvider ||
  inferFormProvider(formEndpoint);
const successMessage =
  process.env.PAGES_FORM_SUCCESS_MESSAGE ||
  pagesConfig.successMessage ||
  "문의가 정상 접수되었습니다. 확인 후 연락드리겠습니다.";
const subjectPrefix =
  process.env.PAGES_FORM_SUBJECT_PREFIX ||
  pagesConfig.subjectPrefix ||
  "[049GAN CONTACT]";
const assetVersion = process.env.GITHUB_SHA || String(Date.now());
const formAccessKey =
  process.env.WEB3FORMS_ACCESS_KEY ||
  process.env.PAGES_FORM_ACCESS_KEY ||
  pagesConfig.accessKey ||
  pagesConfig.web3FormsAccessKey ||
  "";

build();

function build() {
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  for (const entry of includeEntries) {
    const sourcePath = path.join(rootDir, entry);
    const targetPath = path.join(distDir, entry);
    fs.cpSync(sourcePath, targetPath, { recursive: true });
  }

  ensureGithubPagesStylesheetCompatibility();

  processDirectory(distDir);

  fs.writeFileSync(path.join(distDir, ".nojekyll"), "");

  const cnameSourcePath = path.join(rootDir, "CNAME");
  if (fs.existsSync(cnameSourcePath)) {
    fs.copyFileSync(cnameSourcePath, path.join(distDir, "CNAME"));
  }
}

function ensureGithubPagesStylesheetCompatibility() {
  const customCmPath = path.join(distDir, "css", "custom.cm");
  const customCssPath = path.join(distDir, "css", "custom.css");

  if (fs.existsSync(customCmPath)) {
    fs.copyFileSync(customCmPath, customCssPath);
  }
}

function processDirectory(currentDir) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      processDirectory(absolutePath);
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (![".html", ".css", ".cm"].includes(extension)) {
      continue;
    }

    const relativePath = toPosix(path.relative(distDir, absolutePath));
    const relativePrefix = getRelativePrefix(relativePath);
    let content = fs.readFileSync(absolutePath, "utf8");

    if (extension === ".html") {
      content = transformHtml(content, relativePath, relativePrefix);
    } else {
      content = transformStyle(content, relativePrefix);
    }

    fs.writeFileSync(absolutePath, content);
  }
}

function transformHtml(content, relativePath, relativePrefix) {
  content = stripOfficeAssets(content);
  content = stripVerificationMeta(content);
  content = stripAnalyticsAssets(content);
  content = rewriteGithubPagesAssetExtensions(content);
  content = rewriteReferenceDomainUrls(content);
  content = rewriteHtmlAttribute(content, "href", relativePrefix);
  content = rewriteHtmlAttribute(content, "src", relativePrefix);
  content = rewriteHtmlAttribute(content, "action", relativePrefix);
  content = transformStyle(content, relativePrefix);

  if (relativePath === "Contact/index.html") {
    content = injectContactBridge(content, relativePrefix);
  }

  return content;
}

function rewriteGithubPagesAssetExtensions(content) {
  return content.replace(/(href=['"])(\/css\/custom)\.cm(\?[^'"]*)?(['"])/g, "$1$2.css$3$4");
}

function transformStyle(content, relativePrefix) {
  return content.replace(/url\((['"]?)\/(?!\/)([^'")]+)\1\)/g, function (_, quote, target) {
    return "url(" + quote + relativePrefix + target + quote + ")";
  });
}

function rewriteHtmlAttribute(content, attributeName, relativePrefix) {
  const pattern = new RegExp(attributeName + "=(['\"])(\\/[^'\"]*)\\1", "g");
  return content.replace(pattern, function (_, quote, originalUrl) {
    return attributeName + "=" + quote + rewriteLocalUrl(originalUrl, relativePrefix) + quote;
  });
}

function rewriteLocalUrl(url, relativePrefix) {
  if (!url || !url.startsWith("/") || url.startsWith("//")) {
    return url;
  }

  const parts = splitUrl(url);
  const pathname = parts.pathname;
  const suffix = parts.suffix;

  if (pathname === "/" || pathname === "/index") {
    return relativePrefix + suffix;
  }

  if (pathname === "/About") {
    return relativePrefix + "About/" + suffix;
  }

  if (pathname === "/18") {
    return relativePrefix + "18/" + suffix;
  }

  if (pathname === "/Contact") {
    return relativePrefix + "Contact/" + suffix;
  }

  if (pathname === "/login" || pathname === "/logout.cm") {
    return "javascript:void(0)";
  }

  return relativePrefix + pathname.slice(1) + suffix;
}

function rewriteReferenceDomainUrls(content) {
  return content.replace(/https?:\/\/049gan\.kr(\/[A-Za-z0-9\-._~\/?#[\]@!$&'()*+,;=%]*)?/g, function (_, pathname) {
    return absoluteUrlForPath(pathname || "/");
  });
}

function absoluteUrlForPath(rawPathname) {
  const parts = splitUrl(rawPathname || "/");
  let pathname = parts.pathname;
  const suffix = parts.suffix;

  if (pathname === "/index") {
    pathname = "/";
  } else if (pathname === "/About" || pathname === "/18" || pathname === "/Contact") {
    pathname = pathname + "/";
  }

  return new URL(pathname + suffix, siteUrl).toString();
}

function injectContactBridge(content, relativePrefix) {
  const contactFormConfig = {
    endpoint: formEndpoint,
    provider: formProvider,
    successMessage,
    subjectPrefix,
    fromName: process.env.PAGES_FORM_FROM_NAME || pagesConfig.fromName || "049GAN",
    accessKey: formAccessKey,
    requestTimeoutMs: Number(process.env.PAGES_FORM_TIMEOUT_MS || pagesConfig.requestTimeoutMs || 15000),
    fallbackErrorMessage:
      pagesConfig.fallbackErrorMessage ||
      "문의 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    networkErrorMessage:
      pagesConfig.networkErrorMessage ||
      "문의 전송 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    missingConfigMessage:
      pagesConfig.missingConfigMessage ||
      "문의 전송 설정이 아직 완료되지 않았습니다. 관리자에게 문의해 주세요."
  };

  const configScript = [
    "<script>",
    "window.GITHUB_PAGES_CONTACT_FORM = " + JSON.stringify(contactFormConfig, null, 2) + ";",
    "</script>",
    '<script src="' +
      relativePrefix +
      'js/github-pages-contact-form.js?v=' +
      encodeURIComponent(assetVersion) +
      '"></script>'
  ].join("\n");

  return content.replace("</body>", configScript + "\n</body>");
}

function stripOfficeAssets(content) {
  return content
    .replace(/\s*<link[^>]+href=['"]\/_\/oms-customer-front-office\/style\.css['"][^>]*>\s*/g, "\n")
    .replace(/<!-- start oms-customer-front-office -->[\s\S]*?<!-- end oms-customer-front-office -->/g, "");
}

function stripVerificationMeta(content) {
  return content
    .replace(/\s*<meta name="google-site-verification"[^>]*>\s*/g, "\n")
    .replace(/\s*<meta name="naver-site-verification"[^>]*>\s*/g, "\n");
}

function stripAnalyticsAssets(content) {
  return content
    .replace(/\s*<script[^>]+src=['"]\/js\/site_shop\/site_shop_analytics_sdk\.js[^'"]*['"][^>]*><\/script>\s*/g, "\n")
    .replace(/\s*<script[^>]+src=['"]https:\/\/static\.imweb\.me\/analytics-sdk\/a7s\.umd\.js['"][^>]*><\/script>\s*/g, "\n");
}

function splitUrl(url) {
  const match = url.match(/^([^?#]*)(.*)$/);
  return {
    pathname: match ? match[1] : url,
    suffix: match ? match[2] : ""
  };
}

function getRelativePrefix(relativePath) {
  const directory = path.posix.dirname(relativePath);
  if (!directory || directory === ".") {
    return "./";
  }

  const depth = directory.split("/").filter(Boolean).length;
  return "../".repeat(depth);
}

function resolveSiteUrl() {
  const configured = (pagesConfig.siteUrl || process.env.PAGES_SITE_URL || deriveGithubPagesSiteUrl()).trim();
  const candidate = configured || "https://example.com/";
  return candidate.endsWith("/") ? candidate : candidate + "/";
}

function inferFormProvider(endpoint) {
  if (/web3forms\.com/i.test(endpoint || "")) {
    return "web3forms";
  }

  return "formsubmit";
}

function deriveGithubPagesSiteUrl() {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository || !repository.includes("/")) {
    return "";
  }

  const parts = repository.split("/");
  const owner = parts[0];
  const repo = parts[1];
  if (!owner || !repo) {
    return "";
  }

  if (repo.toLowerCase() === owner.toLowerCase() + ".github.io") {
    return "https://" + owner + ".github.io/";
  }

  return "https://" + owner + ".github.io/" + repo + "/";
}

function readPagesConfig() {
  if (!fs.existsSync(pagesConfigPath)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(pagesConfigPath, "utf8"));
}

function toPosix(targetPath) {
  return targetPath.split(path.sep).join("/");
}
