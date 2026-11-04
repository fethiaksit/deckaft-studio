# DeckAft Studio · FAZ 00

Profesyonel deck, teras ve pergola projeleri için iOS / Android uygulama temeli. FAZ 01 hesaplama algoritmaları bu sürüme dahil değildir.

## Kurulum

Node.js 26 ve npm ile doğrulandı. Kilit dosyası depoya dahildir.

```sh
cd /Volumes/KIOXIA/deckaft-studio
npm ci
npm start
```

```sh
npm run ios        # Xcode ve kurulmuş iOS Simulator gerekir
npm run android    # Android SDK + çalışan emulator veya bağlı cihaz gerekir
```

Fiziksel cihaz için SDK 58 ile uyumlu Expo Go kullanın veya geliştirme derlemesi oluşturun. Expo Go eski SDK sürümündeyse güncellenmelidir. Xcode'un yeni sürümlerindeki DeviceHub penceresiyle CLI'nin Simulator adı farklı olabilir; CLI cihazı açsa bile pencere otomatik açılmayabilir. Native proje gerektiğinde `npx expo prebuild` ile üretilir; iOS/Android dizinleri üretilmiş dosyalardır.

Bu faz iOS ve Android hedefler. Web için SQLite WASM ve Skia CanvasKit kurulumu yapılmadı; web desteği tamamlanmış olarak sunulmaz.

## Doğrulama

```sh
npm run typecheck
npm test
npm run format:check
npx expo install --check
npx expo-doctor
npm run export:native
```

Testler Node'un gerçek `node:sqlite` motoruyla repository sorgularını çalıştırır. Geçici dosya kapatılıp yeniden açılır; proje/çizim kalıcılığı, SQL parametreleri, düzenleme, silme ve foreign key cascade denetlenir. Native Expo SQLite bağlayıcısının cihaz doğrulaması ayrı değerlendirilir. API testi geçici bir yerel HTTP sunucusuyla çalışır; dış servise bağlanmaz.

Güncel test kapsamı ve cihazda gözlenen sonuçlar: [docs/VERIFICATION.md](docs/VERIFICATION.md).

## Çalışan akışlar

- Dört sekme: Ana Sayfa, Projeler, Çizim, Ayarlar.
- Proje adı, isteğe bağlı müşteri, il/ilçe, açıklama ve proje türü ile oluşturma; listeleme, arama, düzenleme, onayla silme.
- SQLite'a gerçek kayıt; proje silindiğinde bağlı çizimi de silinir.
- Koyu, açık ve sistem teması; tercih SQLite'ta kalıcıdır.
- Skia çizim alanı: noktalara dokunarak çok parçalı çizgi, ayrı yeni çizgi, iki noktalı ölçü, çizgi/ölçü seçme ve silme, geri/ileri, ızgara aç/kapat, zoom, pan, görünümü sıfırlama ve kaydetme.
- X/Y alanlarıyla milimetre cinsinden hassas nokta girişi; negatif koordinatlar desteklenir. Ondalıklar en yakın mm'ye yuvarlanır. Model sınırı her eksende ±100 km'dir.
- Çizgiye devam etmek için Çizgi aracında dokunun. Ayrı çizgi başlatmak için panelde Yeni çizgi kullanın. Ölçü aracında başlangıç ve bitiş noktalarına dokunun. Alan seçimi aracı çizgi veya ölçü seçer; m² hesabı yapmaz.
- Kaydet düğmesi çizimi projeye bağlar. Kaydedilmemiş değişikliklerle çıkışta onay istenir. Kayıt hatasında çizim ekranda korunur. Otomatik kayıt veya uygulamanın zorla kapatılması sonrası kaydedilmemiş çizim kurtarma bu fazda yoktur.
- Telefonda alt araç çubuğu ve açılır proje/koordinat paneli; tablette eşzamanlı yan panel. Yatay telefon tablet sayılmaz; küçük iPad'ler tablet yerleşimi alır. Dar bölünmüş pencereler kompakt yerleşime geçer.

## Mimari

```text
app/                         Expo Router rotaları ve sekmeler
src/components/              Tema uyumlu ortak UI ve proje kartı
src/core/config.ts           Uygulama ve modül tanımları
src/core/db/                 SQLite şeması, repository, başlangıç/hata yönetimi
src/core/store/              Zustand proje listesi ve görünüm tercihi
src/core/theme/              Açık/koyu palet ve responsive karar
src/core/api/                İleride Go backend için isteğe bağlı HTTP istemcisi
src/modules/projects/       Proje modeli ve girdi doğrulama
src/modules/geometry/       Milimetre koordinat ve poligon sözleşmeleri
src/modules/drawing/        Sürümlü çizim modeli, viewport dönüşümü, editör geçmişi, Skia
src/modules/framing/        Karkas planı veri modelleri
src/modules/cutting/        Kesim planı veri modelleri
src/modules/materials/      Malzeme/profil veri modelleri
src/modules/maps/           Parsel ve coğrafi koordinat veri modelleri
src/modules/exports/        PDF istek/çıktı veri modelleri
src/screens/                Ekranların uygulama akışları
tests/                      SQLite, domain, API, responsive ve editör testleri
```

Tam dosya envanteri: [docs/FILES.md](docs/FILES.md).

Model koordinatları mm'dir; yalnızca `Viewport` ekranın mantıksal piksel koordinatlarını tutar. Zoom/pan modeldeki mm verilerini değiştirmez. Ölçü uzunluğu basit iki nokta mesafesidir; alan, karkas veya fire optimizasyonu değildir. Çizim JSON'u `version: 1, unit: 'mm'` sözleşmesiyle doğrulanır; okunamayan veri boş çizimle sessizce değiştirilmez. Geçmiş son 100 düzenlemeyi oturum içinde tutar.

Şema sürümü 1: `projects`, `drawings`, `settings`. Bağlantıda foreign key ve WAL etkinleştirilir. İleri sürüm veritabanı tespit edilirse açılış reddedilir. Sonraki şema değişiklikleri sürümlü migration gerektirir.

İsteğe bağlı backend adresi `.env.local` içinde `EXPO_PUBLIC_API_URL=https://...` olarak tanımlanabilir. EXPO_PUBLIC değerleri gizli bilgi değildir. Adres yoksa istemci istek göndermez. Kimlik doğrulama, Go servisi ve PostGIS bu fazda uygulanmadı.

Harici diskte macOS'un oluşturduğu AppleDouble (`._*`) dosyaları Git ve Metro tarafından dışlanır. Bu filtre, metadata dosyalarının Expo Router rotası sanılmasını engeller.

## Hazırlık modülleri

Ada/parsel, karkas, malzeme/kesim ve PDF ekranları açıkça hazırlık durumunu gösterir. Hesaplama, sorgu, PDF indirme veya sahte proje sonucu üretmezler. Kullanıcı alanı yerel çalışma alanı ayarlarını açar; hesap sistemi sunmaz. Bildirim simgesi bu sürümün bildirim durumunu gösterir; push bildirim altyapısı yoktur.
