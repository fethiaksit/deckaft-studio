# FAZ 02 doğrulama

5 Kasım 2026 · macOS · Node 26.10.0 · Expo SDK 58 · `feat/faz02-auto-framing`.

## Son kontroller

| Komut / kontrol | Sonuç |
|---|---|
| FAZ 01 başlangıç testleri | 35/35 başarılı |
| `npm run typecheck` | Strict TypeScript başarılı |
| `npm run test:unit` | 54/54 başarılı |
| `npm run test:ui` | 12/12 başarılı |
| `npm run format:check` | Başarılı |
| `npx expo install --check` | Uyumlu |
| `npx expo-doctor` | 20/20 başarılı |
| iOS + Android Expo export | İki platform için Hermes bundle üretildi |
| `git diff --check` | Başarılı |

Toplam 66 test; native export APK/IPA veya mağaza yayını değildir. Yeni runtime bağımlılığı/servis eklenmedi.

## Algoritma testleri

6×4 m, 10×10 m, L ve U biçimleri; ev/balkon ve birden fazla/çakışan boşluk; gerçek segment kırpma, her profilin uçları ve Öklid uzunluğu; dik/yatay yön dönüşümü; 300 mm aks, farklı kotlar ve kesişimde profilin parçalanmaması; deterministik kod/koordinatlar doğrulandı.

3000/4500/6000/7500 mm sıralar; sıraların kendi başlangıcından bölünmesi; delik sonrası yeniden başlangıç; boy derzleri; çift profilin kendi uç yüzeyi ve minimum montaj açıklığı kontrol edildi. Tahta ayarları eksikse gerçek sıra/ek geometrisi yoktur ve uyarı verilir. Çok büyük tahta genişliğiyle sıfır sıra oluşması açıkça uyarılır. Stok üstü hatlar bölünmeden ek gerektirir olarak kalır.

Manuel ekleme, taşıma, boy ve katman değişimi, silme, undo/redo, metraj yenileme, maksimum aks aralığının bozulması, deck uç desteğinin kaybolması, mesnet temas/aralık kaybı ve silinen otomatik mesnetlerin geri eklenmemesi test edildi. Eğik üst profil, yalnız başlangıç X'i kullanılarak aks veya deck uç desteği kanıtı sayılmaz. Genel üst-alt eğik kesişimleri geometrik temas olarak saklanabilir; bu statik onay değildir.

Yoğun aday/pair/kesişim sayıları kaynak sınırı kontrolüyle durdurulur. Aynı katmanda çakışan kesit veya kanıtlanamayan fiziksel profil genişliği uyarı verir.

## SQLite veri bütünlüğü

Gerçek dosya veritabanında migration 1→2 çalıştırıldı; eski proje ve v1 çizim JSON'u korunup yeni okuyucuda açıldı. Migration tekrar çalıştırılabilir. Plan kaydedilip bağlantı kapatılıp tekrar açıldığında aynı profil koordinatları, boylar, kotlar ve ayarlar okundu. Proje silinince bağlı plan FK cascade ile silinir.

Kaynak çizim değiştiğinde plan STALE_SOURCE olarak işaretlendi; eski kaynakla kayıt reddedildi. Kaydetme SQL'i, okunan kaynak çizimin işlem sırasında değişmediğini atomik koşulla doğrular. Sahte uzunluk, mükerrer kod/kimlik, productionReady=true ve geçersiz zorunlu ayarlar reddedilir. Alan ve plan tabloları ayrı tutulur; FAZ 01 çizim sürümü değiştirilmedi.

## React Native arayüz testleri

Jest Expo + React Native Testing Library üzerinde gerçek framing hook, ekran, butonlar ve SQLite repository kullanıldı. GPU/gesture dispatch ve Router ortamı cihazdan ayrılarak uyarlanır. Bunlar gerçek fiziksel cihaz testi değildir.

- Karkas Oluştur, profil silme, undo/redo, gerçek metraj değişimi, kaydetme ve yeni oturumda okuma.
- Alan değişince eski planın düzenleme/kayıt koşulları ve yeniden üretme.
- Telefon ve yatay tablet yerleşiminde oluştur/kaydet kontrolleri ve zorunlu ön onay metni.
- Tek React batch içindeki drag hareketi, son koordinatın tek geçmiş adımıyla işlenmesi.
- Ayar taslağının panel gizlenip açıldığında korunması.
- FAZ 01'in 6 UI testi de aynen başarılı.

## Native gözlem ve cihaz sınırları

[iPhone ekranı](screenshots/faz02-iphone.png): iPhone 17 Pro / iOS 26.5 / Expo Go 58.0.7 üzerinde yeni `/framing/[id]` rotası ve Skia yüzeyi açıldı. Gerçek motorun oluşturup SQLite'a kaydettiği 41 profil, 146,00 m toplam hat, üst/alt/çevre renkleri, gri hariç alan, ayak/mesnet noktaları ve **Ön Yerleşim — Teknik Onay Gerekli** görüntülendi.

Bu native görüntü açıkça etiketli geçici QA projesiyle alındı. SQLite verisi dışarıdaki test aracıyla gerçek repository/motor üzerinden oluşturuldu; native dokunarak profil düzenleme testi olarak sayılmadı. İşlem sonunda yalnız bu QA projesi kaldırıldı; kalan geçici proje ve plan sayısı 0. Kullanıcı kayıtları korunur; uygulamaya demo sonuç eklenmedi.

Mevcut Metro süreçleri durdurulmadan yeni kod 8083 portunda açıldı. Android cihaz bağlı değildi (`adb devices` boş); Android runtime doğrulaması yapılamadı. iPad, çoklu dokunma, gerçek kalem, klavye ergonomisi ve fiziksel cihazda tam create/edit/save akışı bu fazda yeniden çalıştırılamadı. Tablet ekran ağacı renderer'da test edildi. Bu kontroller tamamlanmadan bütün cihaz kabul kriterleri gözlendi denmez.

## Bağımsız inceleme ve giderilen bulgular

İnceleyici kritik bulgu raporlamadı. Eğik üst profillerin maksimum aks aralığını gizlemesi ve sahte deck-uç kanıtı tutması iki önemli bulguydu; motor regresyon testleriyle düzeltildi. Uygulanmamış ayarın panel değişiminde kaybolması da önce başarısız UI testiyle doğrulanıp workspace taslağına taşındı. Yazar ayrıca sınırdaki otomatik mesnet düzenleme, aynı batch'teki drag son hareketi ve zorunlu kerf null doğrulaması için regresyon testleri ekleyip düzeltti.

## Bilinen teknik sınırlamalar

- Bu bir statik/zemin/bağlantı kapasitesi hesabı değildir. Her üretim parçası `productionReady=false`; bütün planlar teknik onay gerektirir. Yük/açıklık girdileri saklanır ancak güvenlik hesabı yapılmaz.
- Düzensiz sınırlarda tam genişlikli dikdörtgen sıra aralıkları muhafazakâr kullanılır. Eğik sınır kamaları ve dar kalan şeritlerin özel döşemesi çözülmez; uyarılır. Her sınırın bütün deck uçları doğrulandı iddiası yoktur.
- Profil merkez hattının içeride olması fiziksel genişliğinin içeride olduğu anlamına gelmez; genişlik kanıtı eksikse veya aynı kotta kesitler çakışıyorsa uyarı vardır. Uygunsuz çift destekler rastgele kaydırılıp güvenli ilan edilmez.
- Stok boyu aşımı ek tasarımı gerektirir; profil kesilmez, ek konumu tahmin edilmez. 3 mm kerf yalnız saklanır. FAZ 03 optimizasyonu/Python servisi yoktur.
- Double precision mm geometri ve 0,00001 mm karşılaştırma toleransı kullanılır. Olağan deck boyutları hedeflenir; yoğun planlar açık kaynak sınırı hatası verir.
- Görünür katman ayarları oturum içidir; planın geometri/ayar/metraj verileri kayıtlıdır. Kaydetmeden uygulama zorla kapanırsa taslak değişiklikler kaybolabilir.
- Önceki fazda raporlanan bağımlılık audit bulgularına force-fix uygulanmadı; uyumlu sürümler korundu.
