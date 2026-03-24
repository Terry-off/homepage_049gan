import crypto from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import nodemailer from "nodemailer";

const ROOT = process.cwd();
loadEnvFile(path.join(ROOT, ".env"));

const PORT = Number(process.env.PORT || 3000);

const CONTACT_FORM_PATH = "/ajax/form_add.cm";
const MAKE_TOKEN_PATH = "/ajax/make_token.cm";
const CONTACT_WIDGET_CODE = "w202208048cd9c0bc005d8";
const CONTACT_FIELD_KEYS = {
  name: "input_d01d9d5fd9b47",
  phone1: "phonenumber1_b00ce8eec8415",
  phone2: "phonenumber2_b00ce8eec8415",
  phone3: "phonenumber3_b00ce8eec8415",
  major: "input_9afa498c8b991",
};
const MAX_BODY_SIZE = 1024 * 1024;

const MIME_TYPES = {
  ".cm": "text/css; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".otf": "font/otf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

const EMPTY_ROUTES = new Set([
  "/ajax/add_deploy_strategy_logs.cm",
  "/ajax/oms/OMS_auth.cm",
  "/backpg/add_visit_log.cm",
  "/shop/load_change_password.cm",
]);

const FIXTURE_ROUTES = {
  "/ajax/calendar_check_write_permission.cm": {
    file: path.join(ROOT, "fixtures", "calendar", "contact-permission.json"),
    contentType: "application/json; charset=utf-8",
  },
  "/ajax/calendar_data.cm": {
    file: path.join(ROOT, "fixtures", "calendar", "contact-events.json"),
    contentType: "application/json; charset=utf-8",
  },
  "/ajax/calendar_classify_default_color.cm": {
    file: path.join(ROOT, "fixtures", "calendar", "contact-default-color.json"),
    contentType: "application/json; charset=utf-8",
  },
  "/ajax/calendar_classify_background_color.cm": {
    file: path.join(ROOT, "fixtures", "calendar", "contact-background-color.json"),
    contentType: "application/json; charset=utf-8",
  },
  "/ajax/calendar_classify_body_color.cm": {
    file: path.join(ROOT, "fixtures", "calendar", "contact-body-color.json"),
    contentType: "application/json; charset=utf-8",
  },
};

let cachedTransport;
let cachedTransportSignature = "";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value.replace(/\\n/g, "\n");
  }
}

function readBoolean(value, fallback = false) {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "y", "on"].includes(String(value).trim().toLowerCase());
}

function buildTokenPayload() {
  return {
    msg: "SUCCESS",
    token: crypto.randomBytes(24).toString("base64url"),
    token_key: crypto.randomBytes(12).toString("hex"),
  };
}

function getFilePath(urlString) {
  const url = new URL(urlString, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === "/" || pathname === "" || pathname === "/index" || pathname === "/index/") {
    return path.join(ROOT, "index.html");
  }

  if (!path.extname(pathname)) {
    return path.join(ROOT, pathname.replace(/^\/+/, ""), "index.html");
  }

  return path.join(ROOT, pathname.replace(/^\/+/, ""));
}

function writeJson(response, payload, status = 200) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-cache",
  });
  response.end(JSON.stringify(payload));
}

async function readRequestBody(request) {
  const chunks = [];
  let totalLength = 0;

  for await (const chunk of request) {
    totalLength += chunk.length;
    if (totalLength > MAX_BODY_SIZE) {
      throw new Error("REQUEST_TOO_LARGE");
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function parseFormBody(body) {
  const params = new URLSearchParams(body);
  const values = {};
  for (const [key, value] of params.entries()) {
    values[key] = value;
  }
  return values;
}

function cleanField(value) {
  return String(value || "").trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getTimestampLabel() {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Seoul",
  }).format(new Date());
}

function buildContactPayload(formValues) {
  const phoneParts = [
    cleanField(formValues[CONTACT_FIELD_KEYS.phone1]),
    cleanField(formValues[CONTACT_FIELD_KEYS.phone2]),
    cleanField(formValues[CONTACT_FIELD_KEYS.phone3]),
  ];

  return {
    widgetCode: cleanField(formValues.widget_code),
    boardName: cleanField(formValues.board_name),
    name: cleanField(formValues[CONTACT_FIELD_KEYS.name]),
    phoneParts,
    phone: phoneParts.filter(Boolean).join("-"),
    major: cleanField(formValues[CONTACT_FIELD_KEYS.major]),
    privacyAgree: cleanField(formValues.privacy_agree),
    submittedAt: getTimestampLabel(),
    raw: formValues,
  };
}

function validateContactPayload(payload) {
  if (payload.widgetCode && payload.widgetCode !== CONTACT_WIDGET_CODE) {
    return "지원되지 않는 문의 폼입니다.";
  }

  if (!payload.name) {
    return "성함을 입력해 주세요.";
  }

  if (!payload.major) {
    return "전공과목을 입력해 주세요.";
  }

  if (payload.phoneParts.some((part) => !part)) {
    return "연락처를 모두 입력해 주세요.";
  }

  if (payload.phoneParts.some((part) => !/^\d{2,4}$/u.test(part))) {
    return "연락처는 숫자만 입력해 주세요.";
  }

  if (payload.privacyAgree && payload.privacyAgree !== "Y") {
    return "개인정보 수집 및 이용 동의 상태를 확인해 주세요.";
  }

  return null;
}

function getMailConfig() {
  const host = cleanField(process.env.SMTP_HOST);
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = readBoolean(process.env.SMTP_SECURE, port === 465);
  const user = cleanField(process.env.SMTP_USER);
  const pass = cleanField(process.env.SMTP_PASS);
  const to = cleanField(process.env.CONTACT_FORM_TO || process.env.SMTP_USER);
  const from = cleanField(process.env.CONTACT_FORM_FROM || process.env.SMTP_FROM || process.env.SMTP_USER);

  return {
    host,
    port,
    secure,
    user,
    pass,
    to,
    from,
    subjectPrefix: cleanField(process.env.CONTACT_FORM_SUBJECT_PREFIX || "[049GAN CONTACT]"),
    successMessage:
      cleanField(process.env.CONTACT_FORM_SUCCESS_MESSAGE) ||
      "문의가 정상 접수되었습니다. 확인 후 연락드리겠습니다.",
  };
}

function getTransport(config) {
  const signature = JSON.stringify({
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    from: config.from,
    to: config.to,
  });

  if (cachedTransport && cachedTransportSignature === signature) {
    return cachedTransport;
  }

  cachedTransportSignature = signature;
  cachedTransport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user || config.pass ? { user: config.user, pass: config.pass } : undefined,
  });

  return cachedTransport;
}

async function sendContactMail(payload) {
  const config = getMailConfig();

  if (!config.host || !config.port || !config.to || !config.from) {
    throw new Error("MAIL_CONFIG_MISSING");
  }

  if (!config.user || !config.pass) {
    throw new Error("MAIL_AUTH_MISSING");
  }

  const transport = getTransport(config);
  const subject = `${config.subjectPrefix} ${payload.name} / ${payload.phone}`;
  const escapedBoardName = escapeHtml(payload.boardName || "개원문의폼");
  const escapedName = escapeHtml(payload.name);
  const escapedPhone = escapeHtml(payload.phone);
  const escapedMajor = escapeHtml(payload.major);
  const escapedSubmittedAt = escapeHtml(payload.submittedAt);

  const text = [
    `${payload.boardName || "개원문의폼"} 문의가 접수되었습니다.`,
    "",
    `성함: ${payload.name}`,
    `연락처: ${payload.phone}`,
    `전공과목: ${payload.major}`,
    `접수시각: ${payload.submittedAt}`,
  ].join("\n");

  const html = [
    "<div style=\"font-family:Arial,'Pretendard Variable','Pretendard',sans-serif;line-height:1.7;color:#1f2937;\">",
    `<h2 style="margin:0 0 16px;font-size:20px;">${escapedBoardName} 문의가 접수되었습니다.</h2>`,
    "<table style=\"border-collapse:collapse;width:100%;max-width:720px;\">",
    `<tr><th align="left" style="padding:10px 12px;border:1px solid #e5e7eb;background:#f9fafb;width:140px;">성함</th><td style="padding:10px 12px;border:1px solid #e5e7eb;">${escapedName}</td></tr>`,
    `<tr><th align="left" style="padding:10px 12px;border:1px solid #e5e7eb;background:#f9fafb;">연락처</th><td style="padding:10px 12px;border:1px solid #e5e7eb;">${escapedPhone}</td></tr>`,
    `<tr><th align="left" style="padding:10px 12px;border:1px solid #e5e7eb;background:#f9fafb;">전공과목</th><td style="padding:10px 12px;border:1px solid #e5e7eb;">${escapedMajor}</td></tr>`,
    `<tr><th align="left" style="padding:10px 12px;border:1px solid #e5e7eb;background:#f9fafb;">접수시각</th><td style="padding:10px 12px;border:1px solid #e5e7eb;">${escapedSubmittedAt}</td></tr>`,
    "</table>",
    "</div>",
  ].join("");

  await transport.sendMail({
    from: config.from,
    to: config.to,
    subject,
    text,
    html,
  });

  return config.successMessage;
}

async function handleTokenRequest(response) {
  writeJson(response, buildTokenPayload());
}

async function handleContactFormRequest(request, response) {
  try {
    const body = await readRequestBody(request);
    const formValues = parseFormBody(body);
    const payload = buildContactPayload(formValues);
    const validationError = validateContactPayload(payload);

    if (validationError) {
      writeJson(response, { msg: validationError });
      return;
    }

    const successMessage = await sendContactMail(payload);
    writeJson(response, {
      msg: "SUCCESS",
      form_add_end_msg: successMessage,
      form_url_data: {
        form_url: "",
        new_window: "N",
      },
    });
  } catch (error) {
    if (error.message === "REQUEST_TOO_LARGE") {
      writeJson(response, { msg: "전송 가능한 용량을 초과했습니다." });
      return;
    }

    if (error.message === "MAIL_CONFIG_MISSING") {
      writeJson(response, {
        msg: "메일 전송 설정이 아직 완료되지 않았습니다. SMTP 환경변수를 확인해 주세요.",
      });
      return;
    }

    if (error.message === "MAIL_AUTH_MISSING") {
      writeJson(response, {
        msg: "SMTP 로그인 정보가 아직 설정되지 않았습니다. 네이버 애플리케이션 비밀번호를 입력해 주세요.",
      });
      return;
    }

    console.error("Contact form mail send failed:", error);
    writeJson(response, {
      msg: "문의 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    });
  }
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://localhost:${PORT}`);

  if (requestUrl.pathname === MAKE_TOKEN_PATH) {
    await handleTokenRequest(response);
    return;
  }

  if (requestUrl.pathname === CONTACT_FORM_PATH && request.method === "POST") {
    await handleContactFormRequest(request, response);
    return;
  }

  const fixture = FIXTURE_ROUTES[requestUrl.pathname];
  if (fixture) {
    try {
      const body = await readFile(fixture.file, "utf8");
      response.writeHead(200, {
        "Content-Type": fixture.contentType,
        "Cache-Control": "no-cache",
      });
      response.end(body);
      return;
    } catch {
      response.writeHead(200, {
        "Content-Type": fixture.contentType,
        "Cache-Control": "no-cache",
      });
      if (requestUrl.pathname.endsWith("calendar_data.cm")) {
        response.end("[]");
        return;
      }
      response.end("{\"msg\":\"SUCCESS\"}");
      return;
    }
  }

  if (EMPTY_ROUTES.has(requestUrl.pathname)) {
    response.writeHead(204);
    response.end();
    return;
  }

  const filePath = getFilePath(request.url || "/");

  try {
    await access(filePath);
    const info = await stat(filePath);

    if (info.isDirectory()) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`Static mirror available at http://localhost:${PORT}`);
});
