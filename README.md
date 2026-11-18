# NAZZARO — rasmiy sayt

Erkaklar ustki kiyimlari brendi NAZZARO uchun statik sayt. Tashqi kutubxonalarsiz (toza HTML/CSS/JS).

- `index.html` — sahifa tuzilmasi
- `assets/style.css` — dizayn (rem asosida, telefon → 4K ekranlar)
- `assets/data.js` — 3 til (uz/ru/en) matnlari va mahsulotlar ro'yxati
- `assets/app.js` — 3D effektlar, katalog, modal oyna, ariza formasi
- `img/lg`, `img/sm` — WebP rasmlar (katta / kichik)

**Yangi mahsulot qo'shish:** rasmni `img/lg` va `img/sm` ga WebP qilib qo'ying, so'ng `assets/data.js` dagi `PRODUCTS` ro'yxatiga yozuv qo'shing.
Keshni yangilash uchun `index.html` dagi `?v=` raqamini oshiring.

Vercel: framework "Other", build buyrug'i kerak emas.
