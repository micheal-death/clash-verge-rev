<h1 align="center">
  <img src="../src-tauri/icons/icon.png" alt="Clash" width="128" />
  <br>
  Continuation of <a href="https://github.com/zzzgydi/clash-verge">Clash Verge</a>
  <br>
</h1>

<h3 align="center">
  یک رابط کاربری گرافیکی Clash Meta که با <a href="https://github.com/tauri-apps/tauri">Tauri</a> ساخته شده است.
</h3>

<p align="center">
  زبان‌ها:
  <a href="../README.md">简体中文</a> ·
  <a href="./README_en.md">English</a> ·
  <a href="./README_es.md">Español</a> ·
  <a href="./README_ru.md">Русский</a> ·
  <a href="./README_ja.md">日本語</a> ·
  <a href="./README_ko.md">한국어</a> ·
  <a href="./README_fa.md">فارسی</a>
</p>

## پیش‌نمایش

| تاریک                               | روشن                                  |
| ----------------------------------- | ------------------------------------- |
| ![Dark Preview](./preview_dark.png) | ![Light Preview](./preview_light.png) |

## نصب

برای دانلود نسخه شخصی این fork، به [Custom AutoBuild](https://github.com/micheal-death/clash-verge-rev/releases/tag/custom-autobuild) مراجعه کنید.<br>
در حال حاضر فقط نصب‌کننده‌های Windows x64 و macOS Apple Silicon منتشر می‌شوند.

#### انتخاب کانال انتشار

| Channel          | توضیحات                                      | Link                                                                                                |
| :--------------- | :------------------------------------------ | :-------------------------------------------------------------------------------------------------- |
| Custom AutoBuild | نسخه شخصی و پیوسته با تغییرات مخصوص این fork. | [Custom AutoBuild](https://github.com/micheal-death/clash-verge-rev/releases/tag/custom-autobuild) |

#### راهنماهای نصب و سوالات متداول

برای مراحل نصب، عیب‌یابی و سوالات متداول، [README](https://github.com/micheal-death/clash-verge-rev#readme) همین مخزن را مطالعه کنید.


---

## ویژگی‌ها

- ساخته شده بر اساس Rust با کارایی بالا و فریم‌ورک Tauri 2
- با هسته جاسازی‌شده [Clash.Meta (mihomo)](https://github.com/MetaCubeX/mihomo) ارائه می‌شود و از تغییر به کانال «آلفا» پشتیبانی می‌کند.
- رابط کاربری تمیز و مرتب با کنترل‌های رنگ تم، آیکون‌های گروه/سینی پروکسی و `تزریق CSS`
- مدیریت پروفایل پیشرفته (ادغام و کمک‌کننده‌های اسکریپت) با نکات مربوط به سینتکس پیکربندی
- کنترل‌های پروکسی سیستم، حالت محافظت و پشتیبانی از `TUN` (آداپتور شبکه مجازی)
- ویرایشگرهای بصری برای گره‌ها و قوانین
- پشتیبان‌گیری و همگام‌سازی مبتنی بر WebDAV برای تنظیمات

### سوالات متداول

برای راهنمایی‌های بیشتر، [README](https://github.com/micheal-death/clash-verge-rev#readme) همین مخزن را مطالعه کنید.


## توسعه

برای دستورالعمل‌های دقیق مشارکت، به [CONTRIBUTING.md](../CONTRIBUTING.md) مراجعه کنید.

پس از نصب تمام پیش‌نیازهای **Tauri**، پوسته توسعه را با دستور زیر اجرا کنید:

```shell
pnpm i
pnpm run prebuild
pnpm dev
```

## مشارکت‌ها

مشکلات و درخواست‌های pull مورد استقبال قرار می‌گیرند!

## تقدیر و تشکر

Clash Verge Rev بر اساس این پروژه‌ها ساخته شده یا از آنها الهام گرفته است:

- [zzzgydi/clash-verge](https://github.com/zzzgydi/clash-verge): یک رابط کاربری گرافیکی Clash مبتنی بر Tauri برای ویندوز، macOS و لینوکس..
- [tauri-apps/tauri](https://github.com/tauri-apps/tauri): ساخت برنامه‌های دسکتاپ کوچک‌تر، سریع‌تر و امن‌تر با رابط کاربری وب.
- [Dreamacro/clash](https://github.com/Dreamacro/clash): یک تونل مبتنی بر قانون که با زبان Go نوشته شده است.
- [MetaCubeX/mihomo](https://github.com/MetaCubeX/mihomo): یک تونل مبتنی بر قانون که با زبان Go نوشته شده است.
- [Fndroid/clash_for_windows_pkg](https://github.com/Fndroid/clash_for_windows_pkg): رابط کاربری گرافیکی Clash برای ویندوز و macOS.
- [vitejs/vite](https://github.com/vitejs/vite): ابزارهای فرانت‌اند نسل بعدی با DX فوق‌العاده سریع.

## مجوز

مجوز GPL-3.0. برای جزئیات بیشتر به [فایل مجوز](../LICENSE) مراجعه کنید.
