# DeckAft Studio — Kod İncelemesi, Hata Düzeltmeleri ve FAZ 03'ün Tamamlanması

Sen deneyimli bir Senior React Native, TypeScript, CAD Geometri ve Optimizasyon Algoritmaları geliştiricisisin.

## PROJE BİLGİLERİ

**Proje:** DeckAft Studio

**Yerel dizin:** `/Volumes/KIOXIA/deckaft-studio`

**GitHub:** https://github.com/fethiaksit/deckaft-studio

**Mevcut geliştirme dalı:** `feat/faz03-cutting-optimization`

**Mevcut Pull Request:** https://github.com/fethiaksit/deckaft-studio/pull/1

FAZ 00, FAZ 01 ve FAZ 02 geliştirmeleri yapılmıştır. FAZ 03'ün ilk kodları GitHub'a eklenmiştir ancak henüz tamamlanmamıştır.

## 1. ÖNCE GITHUB VE YEREL PROJEYİ İNCELE

- GitHub'daki güncel kodları kontrol et.
- Yerel değişiklikleri kaybetmeden `git fetch` yap.
- Mevcut branch ve commit geçmişini incele.
- FAZ 03 geliştirme dalındaki değişiklikleri kontrol et.
- `main` ile FAZ 03 dalını karşılaştır.
- Mevcut testleri çalıştır.
- Kod tekrarlarını, mantık hatalarını ve eksik doğrulamaları tespit et.
- FAZ 00–02 özelliklerini koru.

Gerekli düzeltmeleri uygula. İlgisiz dosyaları değiştirme.

## 2. KESİM OPTİMİZASYONUNU TAMAMLA

Mevcut `src/modules/cutting/engine.ts` dosyasını incele.

Algoritmanın görevi:

- Karkastaki bütün profilleri okumak.
- Her profilin gerçek uzunluğunu hesaplamak.
- Profil kesitlerine göre gruplandırmak.
- 6000 mm stok profillerden minimum adetle kesim yapmak.
- 3 mm testere kesim payını hesaba katmak.
- Artan kullanılabilir parçaları takip etmek.
- Fire miktarını hesaplamak.

Mevcut Best-Fit Decreasing algoritmasını başlangıç çözümü olarak kullanabilirsin.

Ancak sonuç matematiksel olarak en iyi çözüm değilse bunu kesin optimum olarak gösterme.

Küçük ve orta büyüklükteki problemler için kesin optimizasyon algoritması ekle. Büyük problemler için süre veya kaynak sınırı olan sezgisel çözüm kullanılabilir.

Optimizasyon durumlarını ayır:

- Optimal çözüm kanıtlandı.
- Geçerli çözüm bulundu, optimalite kanıtlanmadı.
- Hesaplanamadı.
- Geçersiz profil verisi.

Minimum stok sayısını, toplam fireyi ve çözüm kalitesini ayrı göster.

## 3. PROFİL KESİM KURALLARI

Varsayılan değerler:

- Stok profil: 6000 mm
- Testere kesim payı: 3 mm
- Deck boyu: 3000 mm
- Üst taşıyıcı aralığı: maksimum 300 mm
- Karkas: iki katmanlı, üst üste
- Deck birleşimleri: çift destek

Kesim payı, ilk/son kesim ve uç düzeltme kuralları gerçek üretim sürecine göre açıkça modellenmeli.

Özellikle 3000 + 3000 mm parçaların 6000 mm stoktan kesim payı olmadan çıkacağını varsayma.

Profil kesitlerini, et kalınlıklarını ve malzeme türlerini karıştırma.

6 metreden uzun profilleri otomatik olarak rastgele bölme.

Ek gerektiren profilleri ayrı listede göster. Kullanıcı ek tasarımını ve gerekli teknik onayı tamamlamadan bu parçaları üretime hazır sayma.

## 4. KULLANILABİLİR ARTIK PROFİLLER

Kesim sonrası kalan parçaları iki kategoriye ayır:

**Kullanılabilir artık:** Kullanıcının belirlediği minimum uzunluğun üzerindeki parçalar.

**Fire:** Kullanılamayacak kadar kısa parçalar ve testere kayıpları.

Kullanıcı minimum kullanılabilir artık uzunluğunu değiştirebilmeli.

Örneğin 50 cm üzerindeki parçaları stokta tutmak isteyebilir.

Artık parçaları ileride diğer projelerde kullanabilmek için ayrı bir envanter veri modeli oluştur.

Ancak bu aşamada projeler arası otomatik stok tüketimi zorunlu değildir.

## 5. MOBİL KESİM PLANI EKRANI

Telefon ve tablet için profesyonel bir kesim ekranı oluştur.

Kullanıcı şu bilgileri görüntüleyebilmeli:

- Kaç adet 600 cm profil gerekli?
- Toplam satın alınacak profil uzunluğu nedir?
- Toplam kullanılan profil uzunluğu nedir?
- Kaç metre fire oluşuyor?
- Kaç parça kullanılabilir artık kalıyor?
- Hangi profiller kesim hesabına dahil edilmedi?

Her 6 metrelik profil yatay bir çubuk şeklinde gösterilmeli.

Örnek:

**Profil S-001 — 600 cm**

- U-014: 245 cm
- U-021: 180 cm
- A-003: 170 cm
- Kesim kayıpları
- Kalan: 4,1 cm (3 kesim × 0,3 cm varsayımıyla)

Kesim çubukları farklı renklerle bölümlendirilmeli.

Her parçanın üzerinde profil kodu ve uzunluğu bulunmalı.

Telefon ekranında yatay kaydırma veya yakınlaştırma ile bütün parçalar rahatça incelenebilmeli.

Tabletlerde stok listesi ve kesim detayları yan yana gösterilebilmeli.

## 6. KESİM PLANI VE KARKAS BAĞLANTISI

Kullanıcı kesim listesindeki bir parçaya dokunduğunda:

- Parçanın kodu görüntülensin.
- Uzunluğu gösterilsin.
- Hangi stok profilden kesileceği gösterilsin.
- Karkas projesindeki konumu vurgulansın.
- Üst veya alt karkasa ait olduğu gösterilsin.

Aynı şekilde karkas ekranında profil seçildiğinde ilgili kesim parçasına geçilebilsin.

Profil kodları iki ekran arasında aynı kalmalı.

## 7. SQLITE KAYIT SİSTEMİ

Kesim planını mevcut proje kaydına bağla.

Kaydedilecek bilgiler:

- Kesim planı ID
- Proje ID
- Kaynak karkas planı ID ve revizyonu
- Stok uzunluğu
- Kesim payı
- Kesilecek profil listesi
- Stok kesim kombinasyonları
- Fire miktarı
- Kullanılabilir artıklar
- Optimizasyon sonucu ve durumu
- Oluşturulma tarihi

Yeni migration oluştur.

Eski veritabanı tablolarını silme.

Karkas değiştiğinde eski kesim planını geçersiz işaretle.

Kullanıcının eski kesim planlarını yanlışlıkla güncel imalat planı olarak kullanmasını engelle.

## 8. TESTLER

Şu senaryoları test et:

- 6000 mm stokta 3000 + 3000 mm ve 3 mm kesim kaybı.
- 2450 + 1800 + 1700 mm kombinasyonu.
- Farklı profil kesitleri.
- Farklı et kalınlıkları.
- Stok boyunu aşan profil.
- Ek tasarımı eksik profil.
- Tek parçalı kesim.
- Birden fazla stok profili.
- Minimum fire kombinasyonu.
- Optimal çözüm doğrulaması.
- Kullanılabilir artık sınıflandırması.
- Karkas değişince kesim planının geçersizleşmesi.
- SQLite kayıt ve yeniden yükleme.
- Telefon ve tablet kesim ekranları.
- Eski FAZ 00–02 fonksiyonlarının korunması.

Özellikle küçük optimizasyon problemlerinde sonucu bağımsız brute-force referans çözücüyle karşılaştır.

## 9. TEKNİK GÜVENLİK

Bu uygulama sahada kullanılacağı için hesaplamaların doğruluğu önemlidir.

- Yapısal onay olmadan karkası montaja hazır işaretleme.
- Eksik bağlantı veya mesnet hesabını gizleme.
- Karkas geometrisindeki hataları kesim optimizasyonuyla düzeltmeye çalışma.
- Üretime uygun olmayan profilleri satın alma listesinden ayrı göster.
- Profil kesitlerini birbirine karıştırma.
- Kesim sonucunu gerçek stok adediyle tutarlı hesapla.

Geometrik kesim optimizasyonu, statik uygunluk ve üretim onayı birbirinden ayrı durumlar olmalıdır.

## 10. DOĞRULAMA VE GITHUB

Geliştirme sonrasında:

1. TypeScript kontrolünü çalıştır.
2. Bütün birim ve arayüz testlerini çalıştır.
3. Expo Doctor kontrolünü gerçekleştir.
4. iOS ve Android paketleme kontrollerini yap.
5. Mümkünse iPhone simülatöründe test et.
6. Telefon ve tablet ekranlarını kontrol et.
7. Test sonuçlarını raporla.
8. Değişiklikleri Git commit olarak kaydet.
9. `feat/faz03-cutting-optimization` dalına gönder.
10. Mevcut PR #1'i güncelle.

Ana dalı doğrudan değiştirme.

Testler başarısızsa veya kritik hesaplama hataları varsa PR'ı birleştirme.

## 11. TAMAMLANMA KRİTERLERİ

FAZ 03 ancak şu koşullarda tamamlanmış kabul edilsin:

- Profil uzunlukları doğru hesaplanıyor.
- Kesim payları doğru uygulanıyor.
- Minimum stok optimizasyonu çalışıyor.
- Kesin optimum ile sezgisel sonuç ayrılıyor.
- Profil kesitleri ayrı hesaplanıyor.
- Artık ve fire miktarları doğru gösteriliyor.
- Kesim çubukları mobil ekranda görüntüleniyor.
- Karkas ve kesim parçaları birbiriyle ilişkilendiriliyor.
- Kesim planı SQLite üzerinde korunuyor.
- Karkas değişikliklerinde kesim sonucu geçersizleşiyor.
- Önceki fazlarda regresyon bulunmuyor.
- Testler ve paketleme kontrolleri başarılı.

## ÇALIŞMA TALİMATI

Bu talimat geliştirme onayıdır.

Gereksiz brainstorming veya tasarım onayı isteme.

Önce GitHub ve mevcut kodları analiz et, ardından gerekli düzeltmeleri yap ve FAZ 03'ü tamamla.

Bütün değişiklikleri yerel projede gerçekleştir ve GitHub'a gönder.

Kodları yalnızca açıklama; gerçek dosyalarda uygula.

İşlem tamamlandığında test sonuçlarını, değişen dosyaları, oluşturulan commit'i, PR bağlantısını ve bilinen sınırları bildir.

**FAZ 04'e geçme.**

Hedef: DeckAft Studio'nun mevcut karkas projelerinden gerçek ölçülere dayalı, düşük fireli ve izlenebilir profil kesim planları üretmesini sağlamak.