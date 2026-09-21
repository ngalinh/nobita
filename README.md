# Nobita — Tạo đơn mua hàng website

UI admin mua hàng (Basso-like) + Partner API + tab Gửi đơn (Sheet) / Đang mua (tạo đơn Admin) + Telegram alert + SSO kiểu Deki/Doraemon.

## Cài đặt nhanh

```bash
git clone https://github.com/ngalinh/nobita.git
cd nobita
npm install
cp server/.env.example server/.env
cp data/config.example.json data/config.json
# Điền BASSO_API_KEY trong server/.env
npm start
```

Mở: `http://localhost:3847` (hoặc PORT platform gán)

## Biến môi trường (bắt buộc trên wizard)

Chỉ các key trong `server/.env.example` là bắt buộc:

| Biến | Mục đích |
|------|----------|
| `BASSO_BASE_URL` | `https://basso.vn` |
| `BASSO_API_KEY` | Partner app key (giống Doraemon) |
| `BASSO_AUTH_URL` | SSO session (đã có mặc định) |
| `NOBITA_DEV_MODE` | `0` trên production |

**Không cần** `BASSO_EMAIL` / `BASSO_PASS` trên wizard.

- **Ai là user (Vinh…):** cookie SSO `ai.basso.vn` → `/api/me`
- **Token gọi Partner API:** lấy từ phiên đăng nhập platform (`localStorage ai_chat_user.token`), gửi kèm `Authorization: Bearer …`

Local (không qua platform): có thể đặt `BASSO_EMAIL`/`BASSO_PASS` trong `.env` hoặc `data/config.json` làm service login — không đưa vào git.

Tuỳ chọn khác (thêm tay): `TELEGRAM_*`, `GOOGLE_*`, `BRIGHTDATA_*`, `PROXY_URL`, `BASSO_ADMIN_BASE_URL`.

## Deploy lên ai.basso.vn

1. Update bot từ GitHub → wizard chỉ điền **BASSO_API_KEY**.
2. Đăng nhập ai.basso.vn (platform lưu Partner token trong phiên).
3. Mở Nobita — SSO nhận tên user; API đơn dùng token phiên đó.
4. `NOBITA_DEV_MODE=0`.

## Không đưa lên git

- `.env`, `credentials.json`, `data/config.json`
- Overlay/runtime: buy-list, telegram-notify-state, partner dumps, overlays

## API nội bộ hữu ích

- `GET /api/me` — user SSO
- `POST /api/basso-login` — proxy Partner login (platform chat-login)
- `GET /api/telegram/status`
- `POST /api/telegram/test`
- `POST /api/telegram/run-check?refresh=1`
