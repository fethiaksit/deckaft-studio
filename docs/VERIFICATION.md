# FAZ 00 doğrulama raporu

Tarih: 5 Kasım 2026 (Europe/Istanbul). Ortam: macOS, Node 26.10.0, npm 11.19.1. Expo SDK 58.0.23, React Native 0.88.1, React 19.3.0.

## Otomatik kontroller

| Kontrol | Sonuç |
|---|---|
| `npm run typecheck` | Başarılı; strict + noUncheckedIndexedAccess |
| `npm test` | 12 test geçti, 0 başarısız |
| `npm run format:check` | Başarılı |
| `npx expo install --check` | Bağımlılıklar uyumlu |
| `npx expo-doctor` | 20/20 kontrol başarılı |
| `npx expo export --platform ios --platform android --output-dir dist` | İki platform için Hermes paketleri üretildi |
| `git diff --check` | Başarılı |

Native export, APK/IPA derlemesi veya mağaza yayını değildir. Üretilmiş paketler `dist/` içindedir ve Git dışında tutulur.

Testler: SQLite CRUD; kapatıp açınca proje/çizim kalıcılığı; cascade silme; SQL özel karakterleri; geçersiz proje ve silinmiş proje düzenleme; koordinat dönüşümü; zoom odak koruması ve sınırı; undo/redo; undo sonrası aynı çizgiye devam etme; açık yeni çizgi; çizim JSON doğrulama; ölçü uzunluğu; responsive telefon/tablet ayrımı; gerçek yerel HTTP sunucusunda JSON/204/hata ve Headers başlıkları; yapılandırılmamış API.

## Native ortamda gözlenenler

- iPhone 17 Pro, iOS 26.5 simülatörüne SDK 58 uyumlu Expo Go 58.0.7 kuruldu. Ana ekran ve alt sekmeler görüntülendi.
- `expo-sqlite` veritabanı cihaz konteynerinde oluşturuldu; boş proje listesi yüklendi.
- Native Skia çizim ekranı Router deep link ile açıldı. SQLite dosyasına test aracıyla eklenmiş açıkça etiketli geçici QA projesi/çizimi uygulamanın repository katmanından okunarak ızgara, çizgi ve 5.000 mm ölçü etiketiyle görüntülendi. Bu kontrol, UI üzerinden proje oluşturma/kaydetme testi olarak sayılmadı.
- [iPhone çizim ekranı](screenshots/iphone-drawing.png) gerçek simülatör görüntüsüdür. Görüntüdeki QA projesi kontrol sonunda silindi; kalan QA kaydı 0 olarak doğrulandı. Ürünle birlikte demo veri dağıtılmaz.
- İlk bundle denemesi macOS AppleDouble metadata dosyalarını rota sandığı için başarısızdı. Metro blockList eklendikten sonra iki platformun son export işlemi başarılı oldu.
- İlk native açılışta geliştirme sunucusuna bağlantı hatası oluştu. Aynı yerel ağ adresiyle yeniden açılışta uygulama ve Skia ekranı görüntülendi. Son dosyalar için yeniden export yapıldı.
- iPad Pro 11 inç simülatörü açılıp Expo Go kuruldu. Açılış sistemin “Expo Go ile açılsın mı?” onay ekranında kaldı. CUA aracı uygulamaya bağlanırken zaman aşımına uğradığı için onay tıklanamadı. Tablet UI runtime doğrulaması tamamlanmadı.
- `adb devices` çıktısında bağlı Android cihaz yok; kullanılabilir emulator komutu/SDK emulator ortamı bulunamadı. Android runtime testi yapılamadı.

## Kabul kriterleri

| Kriter | Durum |
|---|---|
| Expo uygulaması başlatılabiliyor | iPhone simülatöründe doğrulandı |
| iOS/Android navigasyonu | Rotalar ve iki platform bundle hazır; iOS ana/çizim açılışı gözlendi; tam iki platform etkileşim testi açık |
| Responsive ana ekran | Telefon/tablet yerleşim kodu ve boyut karar testi hazır; tüm boyutlarda native görsel kontrol açık |
| Yeni proje oluşturma | Gerçek repository testi geçti; dokunarak form gönderimi cihazda test edilmedi |
| SQLite kaydetme ve tekrar açma | Gerçek SQLite dosyasıyla otomatik test geçti; native bağlayıcı okuması gözlendi; UI CRUD kabul testi açık |
| Skia çizim yüzeyi | iPhone native ekranında doğrulandı |
| Ayrı telefon/tablet yerleşimleri | Kod ve responsive test geçti; tablet runtime kontrolü açık |
| TypeScript ve testler | Başarılı; 12/12 |

FAZ 00 kod kapsamı uygulandı; yukarıdaki native kabul adımları tamamlanmadan fazın bütün cihaz kabul kriterleri karşılandı denmez. FAZ 01'e geçilmedi.

## Açık doğrulamalar ve sınırlar

- `MANUAL_QA.md` içindeki UI oluştur/düzenle/sil/kaydet akışları, çoklu dokunma, Android sistem geri hareketi, klavye ve gerçek kalem doğrulanmalı.
- Fiziksel Apple Pencil basınç/eğim/hover ve serbest el mürekkep sistemi bu fazda uygulanmadı; köşe noktası ekleme temeli vardır.
- Otomatik kayıt, bulut senkronizasyonu, PDF ve hesaplama motorları bu fazın kapsamı dışında. Hazırlık ekranları hesaplanmış sonuç üretmez.
- `npm audit` kurulmuş Expo araç zincirinde glob/minimatch üzerinden 5 moderate kayıt bildirdi. Önerilen force fix Expo'yu eski bir ana sürüme düşürüyor; uyumluluğu bozacak şekilde uygulanmadı.
- Geliştirme sunucusu kesinti sonrasında çalışmıyor olabilir; tekrar açmak için `npm start` kullanın.

## İnceleme

Bağımsız salt okunur kod incelemesi 1 önemli hata buldu: undo/redo aktif çizgi kimliğini değiştiriyordu. Editör reducer'ı aktif çizgiyi koruyacak şekilde ayrıldı; devam etme ve ayrı çizgi regresyon testleri eklendi. Kritik veya ertelenmiş küçük bulgu raporlanmadı. Native hareket/kalem ve cihaz yerleşimi statik incelemenin dışında bırakıldı; bu konular yukarıda açık doğrulama olarak tutuldu.
