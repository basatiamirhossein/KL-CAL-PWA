# انتشار اپ اندروید و iOS

اپ با **Capacitor 8** ساخته شده است. همه‌ی فایل‌های اپ (HTML، داده‌ها، فونت‌ها و آیکون‌ها) داخل خود اپ قرار می‌گیرند، بنابراین اپ بعد از نصب **کاملاً آفلاین** کار می‌کند و به اینترنت یا سرور نیازی ندارد.

| مشخصه | مقدار |
|---|---|
| شناسه‌ی اپ (Package / Bundle ID) | `ir.datadevvv.pipe` |
| نام اپ | DataDev Pipe |
| نسخه | 3.0.0 (versionCode 3) |

---

## اندروید

### ۱. دریافت فایل نصب (APK)

هر بار که روی شاخه‌ی `main` تغییری ثبت شود، GitHub Actions اپ را می‌سازد:

1. در گیت‌هاب به تب **Releases** بروید و ریلیز **android-latest** را باز کنید.
2. فایل `DataDev-Pipe-debug.apk` را روی گوشی دانلود کنید.
3. هنگام نصب، اجازه‌ی «نصب از منابع ناشناس» (Install unknown apps) را بدهید.

همین فایل در تب **Actions** هم، داخل هر اجرای «Android build»، در بخش Artifacts هست.

> فایل `debug` با کلید آزمایشی امضا شده و فقط برای نصب مستقیم و تست است. برای Google Play باید نسخه‌ی امضاشده با کلید خودتان را بسازید (مرحله‌ی ۲).

### ۲. ساخت کلید امضا (فقط یک بار)

روی کامپیوتری که Java دارد (یا Android Studio نصب است) این دستور را اجرا کنید:

```bash
keytool -genkeypair -v -keystore datadev-upload.jks -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

این فایل و رمزهایش را **حتماً در جای امن نگه دارید**. بدون آن‌ها نمی‌توانید نسخه‌ی جدید اپ را منتشر کنید.

سپس در گیت‌هاب از مسیر **Settings → Secrets and variables → Actions → New repository secret** این چهار مقدار را اضافه کنید:

| نام Secret | مقدار |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | خروجی `base64 -w0 datadev-upload.jks` (در ویندوز: `certutil -encode`) |
| `ANDROID_KEYSTORE_PASSWORD` | رمز keystore |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | رمز کلید |

از ساخت بعدی، ریلیز `android-latest` دو فایل دیگر هم خواهد داشت:
- `DataDev-Pipe.apk`: نسخه‌ی امضاشده برای نصب مستقیم.
- `DataDev-Pipe.aab`: فایلی که در Google Play آپلود می‌شود.

### ۳. انتشار در Google Play

1. در [Google Play Console](https://play.google.com/console) حساب توسعه‌دهنده بسازید. ثبت‌نام یک بار ۲۵ دلار هزینه دارد. حساب‌های شخصی جدید باید قبل از انتشار عمومی، یک دوره‌ی تست بسته (Closed testing) با چند تستر را بگذرانند.
2. روی **Create app** بزنید. نام اپ را «DataDev Pipe» یا «ماشین حساب وزن لوله» بگذارید، زبان پیش‌فرض را انتخاب کنید و نوع اپ را App و رایگان تعیین کنید.
3. بخش **App content** را کامل کنید:
   - Privacy policy: لینک یک صفحه در datadevvv.ir. اپ هیچ داده‌ای جمع نمی‌کند و این را در متن بنویسید.
   - Data safety: گزینه‌ی «No data collected».
   - Ads: «No ads».
   - Content rating و Target audience.
4. **Store listing** را پر کنید:
   - توضیح کوتاه و کامل.
   - آیکون ۵۱۲×۵۱۲: از فایل `assets/icons/icon-512.png` استفاده کنید.
   - تصویر ویژه (Feature graphic) ۱۰۲۴×۵۰۰.
   - حداقل ۲ اسکرین‌شات از گوشی.
5. از **Release → Testing → Closed/Internal testing** یک ریلیز بسازید و فایل `DataDev-Pipe.aab` را آپلود کنید. گزینه‌ی **Play App Signing** را بپذیرید؛ گوگل کلید نهایی را نگه می‌دارد و کلید شما فقط «کلید آپلود» است.
6. بعد از دوره‌ی تست، از **Production → Create new release** همان فایل را منتشر کنید و برای بررسی بفرستید. بررسی معمولاً چند ساعت تا چند روز طول می‌کشد.

برای هر نسخه‌ی جدید، `versionCode` را در `android/app/build.gradle` یک واحد بالا ببرید و `versionName` را هم به‌روز کنید.

---

## iOS / App Store

ساخت اپ iOS فقط روی **مک با Xcode** ممکن است. اپ iOS از همان کد ساخته می‌شود و Swift جداگانه‌ای لازم نیست؛ پروژه‌ی Xcode (که خودش Swift است) در پوشه‌ی `ios/` آماده است.

### پیش‌نیازها

- یک مک با آخرین نسخه‌ی Xcode از App Store و Node.js نسخه‌ی ۲۲ یا بالاتر.
- عضویت در [Apple Developer Program](https://developer.apple.com/programs/) با هزینه‌ی سالانه ۹۹ دلار.

### ساخت و اجرا

```bash
git clone https://github.com/basatiamirhossein/KL-CAL-PWA.git
cd KL-CAL-PWA
npm ci
npm run ios            # build the web app and copy it into ios/
npx cap open ios       # opens the project in Xcode
```

در Xcode:
1. روی پروژه‌ی **App** کلیک کنید و در تب **Signing & Capabilities**، Team را حساب اپل خودتان انتخاب کنید. Bundle Identifier باید `ir.datadevvv.pipe` باشد.
2. برای تست، آیفون را با کابل وصل کنید و دکمه‌ی ▶ (Run) را بزنید.

### انتشار در App Store

1. در [App Store Connect](https://appstoreconnect.apple.com) به بخش **My Apps** بروید، روی **+** بزنید و **New App** را انتخاب کنید. همان Bundle ID را انتخاب کنید.
2. در Xcode مقصد را **Any iOS Device** بگذارید و از منوی **Product → Archive** آرشیو بسازید.
3. در پنجره‌ی Organizer روی **Distribute App** بزنید، **App Store Connect** و بعد **Upload** را انتخاب کنید.
4. در App Store Connect این موارد را پر کنید:
   - اسکرین‌شات‌ها: آیفون ۶٫۹ اینچ لازم است.
   - توضیحات و کلمات کلیدی.
   - Privacy: گزینه‌ی «Data Not Collected».
   - لینک Privacy Policy.
   - دسته‌بندی: Utilities یا Productivity.
5. بیلد آپلودشده را انتخاب کنید و **Submit for Review** را بزنید. بررسی اپل معمولاً ۱ تا ۳ روز طول می‌کشد.

> نکته‌ی بررسی اپل: اپ‌هایی که فقط یک وب‌سایت را نشان می‌دهند رد می‌شوند. این اپ کاملاً آفلاین است، ابزار محاسباتی واقعی دارد و ۵ زبان را پشتیبانی می‌کند، پس معمولاً مشکلی ندارد.

برای هر نسخه‌ی جدید، در Xcode مقدار **Version** و **Build** را بالا ببرید.

---

## به‌روزرسانی اپ بعد از تغییر کد

```bash
npm run android   # or: npm run ios
```

این دستور فایل‌های وب را در `dist/` می‌سازد و داخل پروژه‌های اندروید و iOS کپی می‌کند. برای اندروید کافی است تغییرات را به `main` بفرستید تا GitHub Actions فایل جدید را بسازد.
