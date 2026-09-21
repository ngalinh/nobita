# Nobita — Tạo đơn mua hàng website

UI admin mua hàng (Basso-like) + Partner API + tab Gửi đơn (Sheet) / Đang mua (tạo đơn Admin) + Telegram alert + SSO session kiểu Deki.

## Cài đặt nhanh

```bash
git clone https://github.com/ngalinh/nobita.git
cd nobita
npm install
cp server/.env.example server/.env
cp data/config.example.json data/config.json
# Điền BASSO_API_KEY / BASSO_EMAIL / BASSO_PASS trong server/.env
npm start
```

Mở: `http://localhost:3847` (hoặc PORT platform gán)

## Biến môi trường (bắt buộc trên wizard)

Chỉ các key trong `server/.env.example` là bắt buộc:

| Biến | Mục đích |
|------|----------|
| `BASSO_BASE_URL` | `https://basso.vn` |
| `BASSO_API_KEY` / `BASSO_EMAIL` / `BASSO_PASS` | Partner login |
| `BASSO_AUTH_URL` | SSO session (đã có mặc định) |
| `NOBITA_DEV_MODE` | `0` trên production |

Tuỳ chọn (thêm tay vào `.env`, không nằm trong example): `TELEGRAM_*`, `GOOGLE_*`, `BRIGHTDATA_*`, `PROXY_URL`, `BASSO_ADMIN_BASE_URL`.

## Deploy lên ai.basso.vn

1. Clone repo (private) lên máy/server bot.
2. Copy `.env` + `data/config.json` từ secrets nội bộ (không đưa vào git).
3. `NOBITA_DEV_MODE=0` để nhận user từ cookie platform.
4. Chạy dưới reverse proxy cùng domain `ai.basso.vn` để cookie SSO tới `/api/me`.
5. `npm install --omit=dev` rồi `node server.js` (hoặc process manager).

## Không đưa lên git

- `.env`, `credentials.json`, `data/config.json`
- Overlay/runtime: buy-list, telegram-notify-state, partner dumps, overlays

## API nội bộ hữu ích

- `GET /api/me` — user SSO
- `GET /api/telegram/status`
- `POST /api/telegram/test`
- `POST /api/telegram/run-check?refresh=1`
