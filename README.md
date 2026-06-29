# Deep-Focus 🧠

> تطبيق تدريب التركيز والانتباه من خلال تمارين بصرية هادئة

---

## نظرة عامة

**Deep-Focus** هو تطبيق ويب تقدمي (PWA) مفتوح المصدر يساعدك على تحسين قدرتك على التركيز من خلال ستة أوضاع تدريب بصري مختلفة:

| الوضع | الوصف |
|-------|--------|
| 👁️ تتبع العين | تابع نقطة متحركة ببطء بعينيك |
| 🖱️ تتبع المؤشر | أبقِ المؤشر قريباً من النقطة المتحركة |
| 🌊 المشتتات | ركز على النقطة مع وجود عناصر مشتِّتة |
| 🌬️ التنفس | تزامن تنفسك مع إيقاع النقطة |
| 💭 الذاكرة | تذكر موضع النقطة حين تختفي |
| ⚡ تكيفي | صعوبة تتكيف مع مستوى تركيزك |

---

## هيكل المجلدات

```
Deep-Focus/
├── index.html          ← هيكل HTML فقط
├── manifest.json       ← إعدادات PWA
├── sw.js               ← Service Worker (وضع أوفلاين)
├── browserconfig.xml   ← أيقونات Windows
├── robots.txt
├── sitemap.xml
├── README.md
│
├── css/
│   ├── style.css       ← الأنماط الأساسية
│   └── responsive.css  ← الاستجابة لجميع الشاشات
│
├── js/
│   ├── storage.js      ← IndexedDB + localStorage
│   ├── canvas.js       ← محرك Canvas (HiDPI)
│   ├── game.js         ← منطق الجلسة والأوضاع الستة
│   ├── ui.js           ← إدارة الواجهة والتنقل
│   ├── pwa.js          ← تسجيل SW وزر التثبيت
│   └── app.js          ← المتحكم الرئيسي
│
└── assets/
    └── icons/          ← أيقونات بجميع الأحجام
```

---

## التثبيت المحلي

```bash
# استنسخ المستودع
git clone https://github.com/your-username/Deep-Focus.git
cd Deep-Focus

# شغّل خادم محلي بسيط (Python)
python3 -m http.server 8080

# أو Node.js
npx serve .
```

ثم افتح `http://localhost:8080` في المتصفح.

> ملاحظة: يتطلب Service Worker تشغيل الملفات عبر خادم (localhost أو HTTPS). لا يعمل عبر بروتوكول `file://`.

---

## النشر على GitHub Pages

1. ارفع الملفات إلى مستودع GitHub
2. اذهب إلى **Settings → Pages**
3. اختر فرع `main` والمجلد `/ (root)`
4. اضغط **Save** — سيكون التطبيق متاحاً في دقيقة

لا تحتاج إلى أي إعدادات خادم أو build pipeline.

---

## مميزات PWA

- **وضع أوفلاين كامل** — يعمل بعد الزيارة الأولى حتى بدون إنترنت
- **قابل للتثبيت** — على Android وWindows وiOS (Add to Home Screen)
- **استجابة كاملة** — يعمل على الهاتف والتابلت واللابتوب والشاشات 4K
- **دعم RTL** — واجهة عربية بالكامل
- **دعم Dark Mode** — قابل للتفعيل من الإعدادات
- **HiDPI / Retina** — Canvas حاد على جميع الشاشات

---

## استبدال الأيقونة

1. ضع صورتك الجديدة بتنسيق PNG وحجم ٥١٢×٥١٢ في مجلد `assets/icons/`
2. شغّل السكريبت التالي لتوليد جميع الأحجام:

```python
from PIL import Image

src  = "assets/icons/icon-master.png"
dest = "assets/icons"
sizes = [48, 72, 96, 128, 144, 152, 180, 192, 256, 384, 512]

img = Image.open(src).convert("RGBA")
for s in sizes:
    img.resize((s, s), Image.LANCZOS).save(f"{dest}/icon-{s}x{s}.png")
```

---

## المتطلبات التقنية

- متصفح حديث يدعم ES2020+ (Chrome 90+، Firefox 88+، Safari 14+، Edge 90+)
- لا يوجد اعتماد على أي إطار عمل خارجي
- لا يوجد build step أو bundler

---

## الإصدار

**v1.0.0** — إعادة هيكلة احترافية من ملف HTML واحد إلى تطبيق PWA متعدد الملفات
