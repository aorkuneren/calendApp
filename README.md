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
- `bungalows` ve `reservations` tablolarını oluşturur
- Eğer `bungalows` boşsa başlangıç bungalov verisini seed eder

## Deploy (Vercel)

1. Projeyi Vercel'e bağlayın.
2. Vercel Project Settings > Environment Variables altında şunları ekleyin:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
3. Deploy edin.

## API Uçları

- `GET /api/bungalows`
- `POST /api/bungalows`
- `PUT /api/bungalows/:id`
- `DELETE /api/bungalows/:id` (rezervasyon varsa 409 döner)
- `GET /api/reservations`
- `POST /api/reservations`
- `PUT /api/reservations/:id`

## Notlar

- Rezervasyon çakışma kontrolü API seviyesinde yapılır.
- Aynı bungalovda kesişen tarih aralığına izin verilmez.
