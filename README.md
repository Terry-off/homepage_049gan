# 049gan Mirror

`https://049gan.kr/` 기준으로 메인/서브 페이지를 최대한 동일하게 미러링한 프로젝트입니다.

## Folder Structure

```text
homepage_049gan/
├─ 18/
├─ About/
├─ Contact/
├─ common/
├─ css/
├─ img/
├─ js/
├─ scripts/
├─ _/
├─ .github/workflows/deploy-pages.yml
├─ .env.example
├─ CNAME.example
├─ index.html
├─ package.json
└─ pages.config.json
```

## Local Run

```bash
npm install
npm run mirror
npm start
```

브라우저에서 `http://localhost:3000`으로 열면 됩니다.

## Contact Form On Local Server

로컬 개발 서버에서는 `Contact` 문의 폼이 `/ajax/form_add.cm`으로 전송되고, `scripts/static-server.mjs`가 SMTP로 실제 메일을 발송합니다.

필수 환경 변수 예시는 [`.env.example`](./.env.example)에 있습니다.

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=mailer@example.com
SMTP_PASS=your-password
CONTACT_FORM_TO=owner@example.com
CONTACT_FORM_FROM="049GAN Contact <mailer@example.com>"
```

네이버 메일을 쓰는 경우:

- `SMTP_HOST=smtp.naver.com`
- `SMTP_PORT=587`
- `SMTP_SECURE=false`
- `SMTP_USER=네이버_메일주소`
- `SMTP_PASS=네이버_애플리케이션_비밀번호`
- `CONTACT_FORM_TO=받을_네이버_메일주소`

## GitHub Pages Deployment

GitHub Pages는 정적 호스팅만 가능하므로, GitHub Pages 배포물의 `Contact` 문의 폼은 SMTP 서버 대신 `FormSubmit AJAX` 방식으로 전송되도록 분리했습니다.

- 배포용 빌드: `npm run build:pages`
- 배포 산출물: `dist/`
- 문의폼 전송 대상 설정: [`pages.config.json`](./pages.config.json)
- GitHub Actions 배포: [`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml)

현재 기본 문의폼 엔드포인트는 `hsptool@naver.com`으로 연결된 `FormSubmit` AJAX 주소입니다.

```json
{
  "formProvider": "formsubmit",
  "formEndpoint": "https://formsubmit.co/ajax/hsptool@naver.com",
  "successMessage": "문의가 정상 접수되었습니다. 확인 후 연락드리겠습니다.",
  "subjectPrefix": "[049GAN CONTACT]",
  "requestTimeoutMs": 15000,
  "networkErrorMessage": "문의 전송 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  "fallbackErrorMessage": "문의 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  "siteUrl": "http://049gan.kr"
}
```

FormSubmit 장애가 반복되면 정적 사이트용 메일 provider로 교체할 수 있습니다. 예를 들어 Web3Forms를 사용할 때는 Web3Forms에서 발급받은 access key를 넣고 아래처럼 바꿉니다.

```json
{
  "formProvider": "web3forms",
  "formEndpoint": "https://api.web3forms.com/submit",
  "accessKey": "YOUR_WEB3FORMS_ACCESS_KEY",
  "successMessage": "문의가 정상 접수되었습니다. 확인 후 연락드리겠습니다.",
  "subjectPrefix": "[049GAN CONTACT]",
  "siteUrl": "http://049gan.kr"
}
```

GitHub Pages 배포에서는 저장소 설정값으로도 덮어쓸 수 있습니다.

- Repository variable `PAGES_FORM_PROVIDER`: `web3forms`
- Repository variable `PAGES_FORM_ENDPOINT`: `https://api.web3forms.com/submit`
- Repository secret `WEB3FORMS_ACCESS_KEY`: Web3Forms에서 발급받은 access key

위 값을 설정한 뒤 `Deploy GitHub Pages` workflow를 다시 실행하면 배포 HTML에 새 전송 설정이 주입됩니다.

### Build

```bash
npm install
npm run build:pages
```

빌드가 끝나면 `dist/.nojekyll`이 생성되므로 GitHub Pages에서 `_` 폴더도 정상 서빙됩니다.

### GitHub Repository Settings

1. 이 폴더를 GitHub 저장소에 push합니다.
2. GitHub 저장소의 `Settings > Pages`에서 `Build and deployment` 소스를 `GitHub Actions`로 선택합니다.
3. `main` 브랜치에 push 하면 Actions가 `dist/`를 자동 배포합니다.

### Custom Domain

커스텀 도메인을 연결하려면:

1. 루트에 `CNAME` 파일을 만들고 한 줄로 도메인을 적습니다.
2. [`pages.config.json`](./pages.config.json)의 `siteUrl`도 실제 도메인으로 바꿉니다.
3. DNS에서 GitHub Pages용 레코드를 연결합니다.

예시:

```text
www.example.com
```

```json
{
  "siteUrl": "https://www.example.com"
}
```

## Notes

- GitHub Pages 배포물은 정적 사이트이므로 로컬 SMTP 서버를 사용하지 않습니다.
- GitHub Pages 배포용 빌드는 내부 절대경로(`/js/...`, `/Contact` 등)를 상대경로로 바꿉니다.
- `/_/oms-customer-front-office` 자산, 원본 도메인용 사이트 검증 메타, 원본 분석 스크립트 일부는 GitHub Pages 배포물에서 제거합니다.
- 원본의 문의 UI는 유지하고, 실제 전송 경로만 GitHub Pages에 맞게 교체했습니다.
