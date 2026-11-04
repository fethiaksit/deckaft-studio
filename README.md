# DeckAft Studio · FAZ 01

React Native + Expo uygulaması: yerel proje yönetimi, gerçek ölçülü teknik alan çizimi ve net deck m² hesabı. FAZ 00 altyapısı korunur; karkas/kesim/PDF motorları bu fazda eklenmedi.

## Kurulum ve çalıştırma

Node 26 ve npm ile doğrulandı. Testlerde `node:sqlite` kullanılır.

```sh
cd /Volumes/KIOXIA/deckaft-studio
npm ci
npm start
npm run ios       # Xcode + iOS Simulator
npm run android   # Android SDK + çalışan emülatör veya bağlı cihaz
```

SDK 58 uyumlu Expo Go veya native geliştirme derlemesi gerekir. Başka Metro çalışıyorsa `npx expo start --port 8082` kullanabilirsiniz. Web desteği bu teslimin kapsamı değildir.

## Kullanım

1. Projeler'den bir proje oluşturun veya mevcut projenin çizimini açın.
2. Çizgi aracında köşelere dokunun. İlk köşeye dönün veya ✓ ile sınırı kapatın. Hassas mm girişini özellik panelinden kullanabilirsiniz.
3. Seç aracıyla bir kenara dokunun. Uzunluğu mm/cm/m cinsinden girin; sabit kalacak başlangıç veya bitiş köşesini açıkça seçip uygulayın. `250 cm`, `3,75 m` ve `1250 mm` desteklenir. Kenarın yönü korunur, diğer ucu gerçekten taşınır. Komşu kenarların yeni ölçüleri yeniden hesaplanır; önceki girilen uzunluklar kalıcı kilit değildir. Çakışma veya dışarı taşma oluşturan işlem bütünüyle reddedilir.
4. Taşı aracıyla köşeyi sürükleyin veya köşeye dokunarak X/Y değerlerini girin. Sürükleme tek geri alma adımıdır; geçersiz sonuçta eski geometri korunur. Yakındaki köşeyle birleştirme paneldedir.
5. Özelliklerden Ev, Balkon, Havuz, Merdiven, Kolon, Kabin veya Özel boşluk oluşturun, adlandırın ve kapatın. Birden fazla boşluk çakışabilir; yalnız birleşim alanları çıkarılır. Dış sınırdan taşan boşluk kabul edilmez.
6. Kaydet ile çizimi SQLite'a yazın. Yeniden açıldığında aynı mm koordinatları, ölçüler, katmanlar ve yakalama ayarları okunur.

Telefon: tam çalışma alanı, yatay kaydırılabilen alt araçlar ve gizlenebilir alt özellik paneli. Kenar seçimi özellik panelini açar. Tablet: solda araçlar, sağda özellikler. Yatay telefonlar tablet sayılmaz. İki parmak yakınlaştırır/kaydırır; Kaydır aracında tek parmakla pan yapılır. Çizimi ortala bütün geometriyi mevcut tuvale sığdırır; kayıt açılışında da başlangıç görünümü ortalanır.

Dış sınır, boşluklar, ölçüler ve ızgara/yardımcılar ayrı katmanlardır. Görünürlük alan hesabını değiştirmez. Gizli geometri seçime ve köşe yakalamaya katılmaz. Izgara görüntüsü okunabilirlik için yakalama aralığının katlarını gösterebilir. Köşe/yatay/dikey/ızgara yakalama toleransı ölçekten bağımsız 12 ekran pikselidir. Elle girilmiş koordinata yakalama uygulanmaz.

Açık veya geçersiz bir dış sınır/boşlukta kesin alan gösterilmez. Brüt/hariç/net m² ve dış çevre metre olarak, sonuçlar iki ondalıkla gösterilir. Dahili geometride erken yuvarlama yapılmaz. Serbest çizgiler alan hesabına katılmaz; alan rolünü panelden değiştirebilirsiniz. Referans ölçü çizgileri bağımsızdır; geometriye bağlı kenar etiketi her zaman gerçek koordinattan hesaplanır.

## Veri ve mimari

- `src/modules/geometry/engine.ts`: poligon doğrulama, shoelace alan/çevre, boşluk birleşimi ve kontrollü kenar değişimi.
- `src/modules/geometry/interaction.ts`: birim ayrıştırma, yakalama, hit mesafesi ve viewport ortalama.
- `src/modules/drawing/model.ts`: sürüm 2 belge; dış alan/boşluk/serbest çizgi, ölçüler, katman/yakalama ayarları.
- `src/modules/drawing/operations.ts`: kapatma, köşe taşıma/birleştirme, kenar düzenleme, seçim/silme; atomik geometri kontrolü.
- `src/modules/drawing/hooks/useDrawingWorkspace.ts`: yükleme/kayıt, seçim, etkileşim, drag oturumu ve undo/redo koordinasyonu.
- `src/modules/drawing/components/`: Skia tuvali, araçlar, alan özeti ve özellikler.
- `src/core/db/`: mevcut SQLite şeması ve repository; `updatedAt` mevcut çizim satırında tutulur.
- Router, Zustand, API istemcisi ve proje CRUD akışları FAZ 00 yapısındadır.

Koordinatlar mm, alan hesabı mm²→m², çevre mm→m'dir. [polygon-clipping](https://github.com/mfogel/polygon-clipping) 0.15.7 yalnız birleşim/fark işlemleri için eklendi. Geçersiz poligonlar kütüphaneye verilmeden doğrulanır; dışarı taşan boşluk sessizce kırpılmaz.

SQLite tabloları değişmediği için `user_version=1` korunur. Eski `version:1` JSON okuyucuda `version:2`'ye dönüştürülür; ilk çizgi dış sınır, ek çizgiler serbest çizgi olarak korunur. Yalnız açıkça tekrarlanan ilk/son nokta varsa kapalı sınır tanınır ve son mükerrer koordinat temsilden kaldırılır. Okuma eski kaydı değiştirmez; kullanıcı kaydettiğinde yeni belge yazılır. Alan geometrisi hatalıysa düzeltilebilmesi için veri taslak olarak okunabilir/saklanabilir; hesap sonucu verilmez. Gelecek Go servisi aynı sürümlü mm JSON sözleşmesini kullanabilir.

## Testler

```sh
npm run check          # TypeScript + tüm domain ve UI testleri
npm run test:unit      # Node test runner + gerçek SQLite + geometri
npm run test:ui        # Jest Expo + React Native Testing Library
npm run format:check
npx expo install --check
npx expo-doctor
npm run export:native
```

UI testleri gerçek editör hook'u ve gerçek SQLite repository'siyle çalışır. GPU/Skia olay sınırı ve Router ortamı testte uyarlanır; bunlar fiziksel cihaz/pinch/Pencil testinin yerine geçmez. Sonuç ve cihaz sınırlamaları: [FAZ01-VERIFICATION.md](docs/FAZ01-VERIFICATION.md). Değişen dosyalar: [FAZ01-CHANGES.md](docs/FAZ01-CHANGES.md).

## Sınırlar

JavaScript çift duyarlıklı sayılar kullanılır; koordinat sınırı eksen başına ±100 km'dir. Çok yakın kollinear geometriler sonlu sayı duyarlılığına tabidir. Ölçü kilidi/kısıt çözücü, otomatik karkas, fire optimizasyonu, parsel API ve PDF bu fazda yoktur. Fiziksel Pencil basıncı/eğimi ve serbest el mürekkebi eklenmedi; köşe girişi/taşıma temelidir. Otomatik kayıt yoktur; kaydedilmemiş değişikliklerle çıkışta onay istenir. Uygulama zorla kapatılırsa kaydedilmemiş düzenlemeler kaybolabilir.

Harici diskin `._*` AppleDouble dosyaları Metro ve Git tarafından dışlanır. Jest için aynı dışlama ve Lucide'ın CJS test eşlemesi bulunur.
