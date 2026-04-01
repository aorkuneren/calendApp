# CalendApp (React + Turso + Vercel)

Bu proje, React arayüzü + Vercel API Route'ları + Turso (libSQL) veritabanı ile çalışır.

## Kurulum

1. Paketleri yükleyin:

```bash
npm install
```

2. Ortam değişkenlerini oluşturun:

```bash
cp .env.example .env.local
```

`.env.local` içine Turso değerlerini girin:

```env
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
APP_SESSION_SECRET=minimum-32-char-random-secret
APP_PASSWORD_PEPPER=optional-extra-pepper
SEED_ADMIN_EMAIL=admin@adenbungalov.com
SEED_ADMIN_PASSWORD=J9dmzyxe7
```

## Lokal Çalıştırma

- Sadece React arayüzü (Vite):

```bash
npm run dev
```

Not: `npm run dev` ile Vercel API route'ları çalışmaz. Arayüz fallback (lokal demo) veriyle devam eder.

- API route'ları ile birlikte çalıştırmak için:

```bash
npx vercel dev
```

## Veritabanı

Uygulama ilk API çağrısında otomatik olarak:
- `bungalows`, `reservations` ve `users` tablolarını oluşturur
- Eğer `bungalows` boşsa başlangıç bungalov verisini seed eder
- Eğer `users` tablosunda admin yoksa aşağıdaki kullanıcıyı seed eder:
  - `admin@adenbungalov.com`
  - `J9dmzyxe7`
  - (İsterseniz `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` ile değiştirebilirsiniz.)

## Deploy (Vercel)

1. Projeyi Vercel'e bağlayın.
2. Vercel Project Settings > Environment Variables altında şunları ekleyin:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `APP_SESSION_SECRET` (en az 32 karakter)
   - `APP_PASSWORD_PEPPER` (opsiyonel)
3. Deploy edin.

## API Uçları

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/bungalows`
- `POST /api/bungalows`
- `PUT /api/bungalows/:id`
- `DELETE /api/bungalows/:id` (rezervasyon varsa 409 döner)
- `GET /api/reservations`
- `POST /api/reservations`
- `PUT /api/reservations/:id`

## Notlar

- Bungalov ve rezervasyon API uçları oturum gerektirir.
- Rezervasyon çakışma kontrolü API seviyesinde ve transaction içinde yapılır.
- Kural: Aynı bungalov için aynı anda tek rezervasyon olabilir. `check_out` günü yeni `check_in` yapılabilir.
