# DeckAft Studio · FAZ 03

React Native + Expo uygulaması: yerel proje yönetimi, gerçek ölçülü teknik alan çizimi ve net deck m² hesabı. FAZ 00–02 korunur; iki katmanlı karkas üzerinden profil kesim planı, stok optimizasyonu ve artık takibi eklenmiştir.

## Kurulum ve çalıştırma

Node 26 ve npm ile doğrulandı. Testlerde `node:sqlite` kullanılır.

```sh
git clone https://github.com/fethiaksit/deckaft-studio.git
cd deckaft-studio
npm ci
npm start
npm run ios       # Xcode + iOS Simulator
npm run android   # Android SDK + çalışan emülatör veya bağlı cihaz
```

SDK 58 uyumlu Expo Go veya native geliştirme derlemesi gerekir. Başka Metro çalışıyorsa `npx expo start --port 8082` kullanabilirsiniz. Web desteği bu teslimin kapsamı değildir.

## FAZ 03 — Profil kesim planı

1. Karkası oluşturup kaydedin. Karkas ekranındaki **Profil kesim planını aç** düğmesini kullanın veya ana sayfadan **Malzeme ve Kesim Listesi**'nde proje seçin.
2. **Kesim ayarları** ile stok boyunu, testere payını, başlangıç/son uç düzeltmelerini ve minimum artık boyunu girin. Başlangıç değerleri 6000 mm stok, 3 mm testere, 0 mm uç düzeltme ve 500 mm minimum artıktır. Stok ve testere başlangıç değerleri kayıtlı karkas ayarlarından gelir.
3. **Kesim planını oluştur** ile stok adetlerini, satın alma tahminini, fireyi, kullanılabilir artıkları ve hariç profilleri görün. Çubukları yatay kaydırın; bir parçaya dokunarak stok kodunu, karkas katmanını ve gerçek konumunu açın. **Karkasta vurgula** seçili profili karkas tuvalinde gösterir.
4. **Kesim planını kaydet** ile sonucu SQLite'a yazın. Kaynak alan veya karkas değiştiğinde eski plan ve artık envanteri geçersiz sayılır; güncel karkası kaydedip hesabı yenileyin.

Her parçaya, son parça dahil, bir ayırma kesimi ayrılır. Sıfırdan büyük her uç düzeltmesi kendi talaş kaybını ve bir testere payını ekler. Bu modelde 3000 + 3000 mm tek stoktan çıkmaz; 2450 + 1800 + 1700 mm, üç 3 mm kesimden sonra 41 mm bırakır. Aynı malzeme, kesit ve et kalınlığındaki parçalar birlikte hesaplanır. Ek tasarımı gereken veya kaynak geometrisi doğrulanmayan profiller satın alma hesabına katılmaz.

Sonuç, dahil edilen profiller için kanıtlanmış minimum stok adedi veya optimalitesi kanıtlanmamış geçerli bir çözüm olarak gösterilir. Fire miktarı, kısa artık + uç düzeltme + testere kaybıdır. Optimum stok adedi, optimum artık dağılımı, statik yeterlilik ve imalat onayı ayrı kavramlardır. Projeler arası otomatik artık tüketimi yoktur.

[FAZ 03 doğrulama raporu](docs/FAZ03-VERIFICATION.md) · [Teknik ayrıntılar ve sınırlar](docs/FAZ03-STATUS.md)

## FAZ 02 — Karkas planı

Ana sayfadaki Karkas Planı'ndan proje seçin veya kayıtlı çizim/proje detayından Karkas planını aç kullanın. Çizimin kapalı ve geçerli olması gerekir. Karkas Oluştur, ayrı kotlarda üst/alt profil nesneleri üretir; kesişimler hatları kesmez.

- Yatay deck → dikey üst / yatay alt; dikey deck yönünde eksenler değişir.
- Deck boyu 3000 mm, stok 6000 mm, üst maksimum aks 300 mm, kerf 3 mm. Kesit başlangıcı 40×60×2 mm yalnız örnektir; güvenli kesit önerisi değildir.
- Alt karkas ve ayak/mesnet aralığı başlangıçta boştur; güvenli bir değer tahmin edilmez. Tahta genişliği, sıra derzi, kenar boşluğu, boy ek derzi ve minimum profil montaj boşluğu girilmeden gerçek sıra/birleşim hesabı sunulmaz. Eksikler açık uyarıdır.
- Her geometrik deck sırası kendi başlangıcından parçalara ayrılır; derz hesaba katılır. Çift desteğin yüzleri ilgili iki deck ucuna karşılık gelir. Profil yüzeyleri arasındaki deck derzi, istenen montaj boşluğunu karşılamıyorsa birleşim doğrulanmaz.
- Üst/alt/çevre katmanlarını açıp kapatın. Kırmızı üst, mavi alt, sarı çevre, turuncu ek destekleri, gri hariç alanlardır. Kalem veya dokunmayla profil seçin; kodu, gerçek boyu, kesiti, kotu ve bağlantıları özelliklerde görün.
- Ekle aracı iki tuval noktasından manuel profil oluşturur. Taşı aracı sürükler; özelliklerde başlangıca taşıma, iki uç koordinatı, sabit uçla boy ve katman düzenleme de vardır. Silme, geri/ileri ve otomatik plana dönüş çalışır. Manuel işlemler sonrasında metraj/uyarılar yeniden hesaplanır; silinen profiller ve mesnetler sessizce geri eklenmez.
- Profil özelliklerindeki ayak/mesnet alanından konum/tip ekleyin veya mevcut kimlikle düzenleyip silin. Seçili alt profile bağlanabilir; yanlış temas ayrıca uyarılır. Bu geometrik kontrol zemin veya taşıma kapasitesi onayı değildir.
- Ayarlar panelindeki uygulanmamış metin girişleri panel gizlense de oturum içinde korunur. Oluştur ile uygulanır; uygulanmamış ayar varken plan kaydı engellenir. Kaydet planı SQLite'a bağlar.
- Kaynak alan değişirse eski plan uyarılır; düzenleme/kayıt öncesi yeniden oluşturmak gerekir. Görünürlük, ad veya bağımsız ölçü değişimi alan geometrisini değiştirmediği için planı gereksiz yere geçersiz kılmaz.

Durum daima **Ön Yerleşim — Teknik Onay Gerekli**. Bütün fiziksel hatların `productionReady` değeri false'tur. Stok aşımı ek gereksinimi olarak işaretlenir; otomatik kesme, stok dağıtma veya minimum fire hesabı yapılmaz. Yük, açıklık ve bağlantı verileri saklanabilir fakat bu sürüm statik hesap yapmaz. FAZ 03, karkasın kaynak geometrisini değiştirmeden geometrik kesim hesabı yapar.

Düzensiz sınırlarda tam tahta genişliğini kanıtlayan dikdörtgen sıra aralıkları kullanılır; sınır kamaları/kalan dar şeritler için özel döşeme uyarısı vardır. Gerçek profil genişliği, merkez hattı alan içinde olsa da delik/sınır dışına taşabiliyorsa uyarılır. Aynı kotta çakışan kesitler ve doğrulanamayan deck uçları teknik inceleme gerektirir; montaja hazır gösterilmez. Çok yoğun aday/kesişim sayıları açık kaynak sınırı hatasıyla durdurulur.

Model/algoritma: `src/modules/framing/{model,config,geometry,engine,validation,operations,persistence}.ts`. Skia/etkileşim ayrı bileşen ve hook'lardadır. Proje başına bir güncel plan, profil/bağlantı/mesnet/parça/ayar/manuel değişiklik/teknik durum/tarih verileriyle saklanır. Şema 1→2 migration yalnız `framing_plans` tablosu ekler; projeler ve çizimler korunur. Kaynak geometri imzası kayıt anında atomik olarak denetlenir.

[FAZ 02 test ve cihaz raporu](docs/FAZ02-VERIFICATION.md) · [Değişen dosyalar](docs/FAZ02-CHANGES.md)

## Alan çizimi kullanımı

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

FAZ 01 çizim tabloları korunur; FAZ 02 migration ile `user_version=2` ve ayrı `framing_plans` tablosu eklenir. Eski `version:1` JSON okuyucuda `version:2`'ye dönüştürülür; ilk çizgi dış sınır, ek çizgiler serbest çizgi olarak korunur. Yalnız açıkça tekrarlanan ilk/son nokta varsa kapalı sınır tanınır ve son mükerrer koordinat temsilden kaldırılır. Okuma eski kaydı değiştirmez; kullanıcı kaydettiğinde yeni belge yazılır. Alan geometrisi hatalıysa düzeltilebilmesi için veri taslak olarak okunabilir/saklanabilir; hesap sonucu verilmez. Gelecek Go servisi aynı sürümlü mm JSON sözleşmesini kullanabilir.

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

JavaScript çift duyarlıklı sayılar kullanılır; koordinat sınırı eksen başına ±100 km'dir. Çok yakın kollinear geometriler sonlu sayı duyarlılığına tabidir. Ölçü kilidi/kısıt çözücü, fire optimizasyonu, parsel API ve PDF bu fazda yoktur. Fiziksel Pencil basıncı/eğimi ve serbest el mürekkebi eklenmedi; köşe girişi/taşıma temelidir. Otomatik kayıt yoktur; kaydedilmemiş değişikliklerle çıkışta onay istenir. Uygulama zorla kapatılırsa kaydedilmemiş düzenlemeler kaybolabilir.

Harici diskin `._*` AppleDouble dosyaları Metro ve Git tarafından dışlanır. Jest için aynı dışlama ve Lucide'ın CJS test eşlemesi bulunur.
