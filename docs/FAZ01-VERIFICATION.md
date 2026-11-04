# FAZ 01 doğrulama ve bilinen sınırlar

5 Kasım 2026 · macOS · Node 26.10.0 · Expo SDK 58 · dal `feat/faz01-smart-drawing`.

## Sonuçlar

| Kontrol | Sonuç |
|---|---|
| Başlangıç FAZ00 testleri | 12/12 başarılı |
| `npm run typecheck` | Strict TypeScript başarılı |
| `npm run test:unit` | 29/29 başarılı |
| `npm run test:ui` | 6/6 başarılı |
| `npm run format:check` | Başarılı |
| `npx expo install --check` | Bağımlılıklar uyumlu |
| `npx expo-doctor` | 20/20 başarılı |
| iOS + Android native export | İki platform için Hermes bundle üretildi |
| `git diff --check` | Başarılı |

Toplam 35 test. Native export APK/IPA derlemesi değildir.

## Geometri testleri

- 10×10 m dış alan: 100 m², 40 m dış çevre.
- 2×2 m boşluk: 96 m² net; L biçimi: 64 m².
- Ayrı boşluklar, üst üste gelen boşluklar, iç içe boşluklar ve sınırla temas.
- Açık poligon, kendini kesme/dokunma, sıfır kenar, sıfır alan, taşan/sonlu olmayan koordinatlar: tüm sayısal sonuçlar null.
- Dışarı taşan veya girintili sınırın çentiğini kesen boşluklar reddedilir; yalnız köşe içerme testiyle yetinilmez.
- Negatif/büyük koordinatlar, saat yönü bağımsızlığı, kesirli mm duyarlılığı.
- Kenar değişimi gerçek koordinatı ve alanı değiştirir; sabit uç korunur. Geçersiz sonuç eski belgeyi değiştirmez.
- Birim girişleri, ölçeğe bağlı yakalama, görünmez katmanda seçim/birleştirme engeli ve viewport ortalama.

## Editör ve kayıt testleri

Jest Expo + React Native Testing Library, gerçek `useDrawingWorkspace` ve gerçek `ProjectRepository` üzerinde Node SQLite motoruyla çalışır. Aşağıdakiler yürütüldü:

1. Alanı köşelerden oluşturup kapatma; 100 m² sonucu.
2. Kenarı 12 m yapma; geometride (12000,0) ve 110 m² sonucu; undo/redo.
3. Köşeyi birden fazla drag güncellemesiyle taşıma; tek geçmiş adımı. Drag sırasında kesin sonuç gizlenir; bitince doğrulanır.
4. Ev boşluğu oluşturma; açıkken hesap yok, kapalıyken net 96 m².
5. Katman görünürlüğü, viewport fit/zoom, SQLite kaydı ve yeni hook oturumunda aynı koordinat/sonuçları okuma.
6. Yeni boşluğu geri aldıktan sonra sonraki noktanın sessizce serbest çizgiye dönüşmemesi.
7. Telefon ve yatay tablet ekran ağacında uygun araç/özellik yerleşimi.
8. Gerçek telefon ekran bileşeninde paneli açma, dış alanı başlatma, X/Y TextInput alanlarını doldurma, Nokta ekle/Alanı kapat/Kaydet düğmelerine basma ve SQLite sonucunu okuma.

Eski v1 JSON kaydının okuyucuda dönüşmesi eski SQL satırını değiştirmez. v2 kaydı, özel katman/yakalama ayarları ve net 96 m² sonucu dosya kapatılıp yeniden açıldığında aynıdır. Hatalı kaydetme isteği son geçerli çizimi ezmez. Proje kayıtları korunur. Tablo değişmedi; `user_version=1`, belge `version=2`.

UI testlerinde native GPU/gesture dispatch sınırı ve Router ortamı uyarlanır. Bunlar gerçek çoklu dokunma veya cihaz üzerinde uçtan uca test değildir. Form TextInput ve düğmeleri gerçek React Native bileşenleridir.

## Native cihaz gözlemi

[iPhone FAZ01 ekran görüntüsü](screenshots/faz01-iphone.png): iPhone 17 Pro / iOS 26.5 / Expo Go 58.0.7, gerçek Skia yüzeyi, kenar etiketleri, iç boşluk ve **Brüt 100,00 − Hariç 4,00 = Net 96,00 m²** görüldü. Bu görüntü için SQLite'a dışarıdan eklenen açıkça etiketli QA verisi kullanıldı; native UI üzerinden veri giriş testi olarak sayılmadı. Kontrol sonunda yalnız bu geçici QA projesi silindi; kalan QA kaydı 0. Kullanıcı projelerine dokunulmadı; ürün demo veri yüklemez.

8081 portundaki mevcut Metro eski FAZ00 bundle'ını sundu. Kullanıcı süreci kapatılmadan 8082 portunda yeni Metro açıldı; yeni belge ve alan ekranı burada doğrulandı.

- CUA cihaz penceresine bağlantıda zaman aşımına uğradı; otomatik cihaz dokunuşları çalıştırılamadı.
- iPad'de bu fazın yeni ekranına ait native etkileşim/yatay ekran/klavye testleri çalıştırılamadı. Tablet yerleşimi React Native renderer'da test edildi.
- `adb devices` çıktısında bağlı Android cihaz yoktu. Android runtime testi yapılamadı; Android export başarılı.
- Gerçek Apple Pencil/Android kalem, çoklu parmak pinch-pan ve sistem geri hareketi cihazda yeniden doğrulanmalı. Önceki faz için kullanıcının bildirdiği başarılı testler yeni kontrollerin testi olarak sayılmadı.

Bu nedenle kod kapsamı ve otomatik kontroller tamamlanmış olsa da tüm fiziksel cihaz kabul kriterlerinin doğrulandığı iddia edilmez. FAZ 02'ye geçilmedi.

## İnceleme ve giderilen bulgular

Bağımsız inceleyici iki somut bulgu iletti: undo sonrası kaybolan aktif alan ve gizli katman köşesiyle birleştirme. Her ikisi önce başarısız regresyon testiyle doğrulanıp düzeltildi. İnceleyicinin oturumu kullanım limiti nedeniyle son genel raporu tamamlayamadı; kalan son kontrol yazar tarafından yapıldı. Tam ve temiz bağımsız inceleme iddiası yoktur.

Yazarın kontrolünde drag önizlemesi sırasında önceki alanın kesin sayı olarak gösterilmesi ayrıca testle yakalanıp düzeltildi.

## Bilinen sınırlar

- Double precision geometri; aşırı yakın kollinear noktalarda sayısal duyarlılık sınırı vardır. Gerçek dışarı taşan boşluk toleransla sessizce kabul edilmez.
- Ölçü düzenleme bir kısıt çözücü değildir: kullanıcı sabit ucu seçer, karşı uç yön korunarak taşınır; komşu kenarlar serbesttir ve etiketleri yenilenir. Kalıcı ölçü kilidi sunulmaz.
- Tek dış sınır, çoklu boşluk desteklenir. FAZ00 ek yolları serbest çizgi olarak korunur; kullanıcı rol atayabilir.
- Çok büyük geometride minimum zoom sınırı nedeniyle görünüm bütün alanı tuvale sığdıramayabilir; merkezi yine doğru hesaplanır.
- Serbest el mürekkep, basınç/eğim/hover, otomatik kayıt, bulut eşitleme, karkas/kesim/PDF/parsel motorları uygulanmadı.
- Kaydetmeden uygulamanın zorla kapatılması kaydedilmemiş değişiklikleri kaybettirebilir.
- Kurulumun npm audit çıktısı 24 kayıt (1 low, 23 moderate) bildirdi; test/Expo araç zinciri dahil. Force fix uyumsuz ana sürüm değişiklikleri gerektirdiğinden uygulanmadı. High/critical kayıt bildirilmedi.
