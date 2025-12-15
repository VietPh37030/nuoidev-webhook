# NuoiDev Webhook (Vercel)

API endpoints cho SePay webhook và thanh toán tự động.

## Endpoints

- `POST /api/sepay-webhook` - Nhận webhook từ SePay
- `GET /api/check-payment?code=XXX` - Kiểm tra trạng thái thanh toán
- `POST /api/create-transaction` - Tạo pending transaction

## Deploy

1. Cài Vercel CLI:
```bash
npm i -g vercel
```

2. Login:
```bash
vercel login
```

3. Deploy:
```bash
cd nuoidev-webhook
vercel --prod
```

4. Set biến môi trường trong Vercel Dashboard:
   - `FIREBASE_SERVICE_ACCOUNT` = nội dung file service account JSON

## Cấu hình SePay Webhook

URL: `https://your-app.vercel.app/api/sepay-webhook`
