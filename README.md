# 손수오 보이스 컨설팅 예약 시스템

대한민국 No.1 보이스 컨설턴트 손수오 교수의 1:1 맞춤형 보이스 트레이닝 예약 웹사이트.

## 구조

- `/public/index.html` — 랜딩 페이지 (5섹션)
- `/public/admin.html` — 관리자 CMS 대시보드
- `/api/` — Vercel Serverless Functions
- Vercel Postgres (Neon) — 데이터베이스

## 배포 후 설정

1. Vercel Dashboard → Storage → Postgres 연결
2. 브라우저에서 `/api/setup` 호출하여 DB 초기화
3. `/admin` 에서 콘텐츠 관리
