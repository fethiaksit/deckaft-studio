# FAZ 03 — Doğrulama raporu

Son doğrulama: 9 Kasım 2026. Dal: `feat/faz03-cutting-optimization`. İnceleme başlangıcı: `2f53d2a`; uzak `main` ilk dilimi içeren `e9bf6e2` merge commit'indeydi. FAZ 00–02 testleri de bütün test koşusuna dahil edildi.

| Kontrol | Sonuç |
| --- | --- |
| `npm run check` | TypeScript başarılı, 78 birim ve 17 arayüz testi geçti |
| `npm run format:check` | Başarılı |
| `npx expo-doctor` | 20/20 kontrol başarılı |
| `npx expo install --check` | Expo bağımlılıkları uyumlu |
| `npm run export:native` | iOS ve Android Hermes paketleri üretildi |
| iPhone 17 Pro, iOS 26.5, Expo Go 58 | Test projesi ve çizim oluşturuldu; karkas kaydedildi; kesim üretildi ve kaydedildi. Karkasa manuel profil eklenince eski kesim planının gizlendiği ve yeniden hesapta stok/artan boyun gösterildiği doğrulandı. |
| iPad Pro 11 inç (M5), iPadOS 26.5, Expo Go 58 | iPhone QA projesinin SQLite test kaydı açıldı. Stok çubuğu ve kaynak konumu yan yana görüldü. `M-001` seçimiyle karkasa ve aynı parçaya geri geçiş doğrulandı. |

İlk eşzamanlı paketleme/test koşusunda iki yeni arayüz testi zaman aşımına uğradı. Arayüz paketi tek başına geçti; arayüz entegrasyon senaryosunun bekleme payı artırıldı ve tam kontrol seri olarak tekrar geçti. Fiziksel cihaz, Android emülatörü, imzalı dağıtım ve saha makinesi testi yapılmadı. Expo export iki platform için JavaScript/Hermes paketlemesini doğrular.

## Hesap örnekleri

- `3000 + 3000 mm`, `6000 mm` stok, `3 mm` kerf: **2 stok**; toplam testere kaybı `6 mm`.
- `2450 + 1800 + 1700 mm`, üç `3 mm` kesim: **1 stok**, `41 mm` artık. Varsayılan `500 mm` eşikte toplam fire `50 mm`; eşik `10 mm` olursa `41 mm` kullanılabilir artık ve `9 mm` fire.
- `3600, 3000, 1800, 1200, 1200, 1200 mm`, kerf `0`: BFD üç stok verir; kesin arama iki stok bulur. Bağımsız exhaustive oracle ile 80 küçük veri kümesi karşılaştırıldı. Bütçe sıfır olduğunda sonuç sezgisel olarak etiketlenir.
- SQLite dosya yeniden açılışı, geçmiş şema korunumu, aynı zaman damgalı karkas değişimi, çizim değişimi ve kayıt sırasında kaynak yarışı test edildi. Ondalık ayarların kararlı yuvarlanması ve sahte optimum/alt sınır kayıtları için regresyon testleri eklendi.

## Başlıca dosyalar

- `src/modules/cutting/{engine,solver,model,persistence}.ts`: kesim kuralları, optimizasyon, artık modeli ve kayıt doğrulama.
- `src/core/db/{schema,repository}.ts`: v3 migration, kaynak revizyonu kontrolü ve artık sorgusu.
- `app/cutting/[id].tsx`, `src/screens/CuttingScreen.tsx`, `src/modules/cutting/{components,hooks}/`: telefon/tablet kesim ekranı, çubuklar ve kaynak önizleme.
- `src/screens/FramingScreen.tsx`, `src/modules/framing/hooks/useFramingWorkspace.ts`: çift yönlü profil seçimi. Ana sayfa, proje detayı ve modül listesinden girişler eklendi.
- `tests/cutting*.ts`, `tests/cutting-workspace.ui.test.tsx`, `tests/framing-repository.test.ts`: hesap, gerçek SQLite, arayüz ve migration regresyonları.
