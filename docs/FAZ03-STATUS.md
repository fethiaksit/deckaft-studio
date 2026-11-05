# FAZ 03 — Kesim optimizasyonu (ilk uygulanmış dilim)

## GitHub incelemesi
FAZ 02 model ve motoru, `FramingScreen`, kayıt doğrulaması, varsayılan ayarlar, teknik uyarılar ve rapor okundu. Eski planlar `version: 1` ile saklanmaya devam eder; bu değişiklik onları göç ettirmez veya değiştirmez.

## Eklenenler
- `src/modules/cutting/engine.ts`: her fiziksel üyeyi gerçek koordinat mesafesinden doğrular; kesit + malzeme + et kalınlığına göre gruplar, 6000 mm (kullanıcı ayarı) stoklarda best-fit decreasing kesim tahmini çıkarır.
- 3 mm (kullanıcı ayarı) her parçaya bir kesim payı ayrılır. Bu **muhafazakâr** modeldir; uç düzeltme ve kesme makinesi koşulları sahada belirlenmelidir.
- Stok boyunu aşan, ek tasarımı gereken, tutarsız veya kesiti geçersiz profiller sessizce bölünmez: **hariç listesine** alınır.
- Karkas ekranında kesim tahmini, her stoktaki parça kodları, kesim boyları, kalan miktar ve hariç profiller görünür.
- `tests/cutting.test.ts`: stok/kerf, grup ayrımı, ek gereksinimi, geçersiz uzunluk ve deterministik sonuç testleri eklendi.

## Onay ve sınırlamalar
Bu modül **minimum fireyi matematiksel olarak garanti etmez**: best-fit decreasing deterministik bir sezgisel yöntemdir. Bütün stok sayısı için kesin optimalite isteyen sürümde küçük örnekler için branch-and-bound, büyük gruplarda CP-SAT/OR-Tools veya exact integer programming değerlendirilmelidir.

Profil geometrisi açıkta kalmamalı: 6 metreden uzun hatları ek yerlerine ayırma işi otomatik yapılmadı; ekin konstrüktif tasarımı, mesnet noktaları ve kapasite kontrolü gerekiyor. Karkas planının `productionReady=false` ve `requires-approval` durumu korunur. **PDF, nihai satın alma listesi, hesapların SQLite'a ayrı kaydı ve üretime hazır plan henüz yok.**

Karkas geometrisi / kesim tahmini telefon üzerinde hesaplanır. Cihaz testleri bu GitHub değişikliğinde çalıştırılmadı; raporlanan geçmiş 66 test, bu yeni değişikliğin testi değildir.

## Sonraki işler
1. Cihazda yeni kesim panelini ve uzun profil hariç listesini test et.
2. Kesim tahminini sürümlü, kaynak-karkas imzalı yerel veri modeline ve SQLite'a kaydet.
3. Kesim özeti ve fire şemasını özel ekranda grafikle göster.
4. Exact solver ile minimum stok sayısı için optimalite sınırı / kanıtı raporla.
5. Onaylanmış konstrüktif ek parçası modelini ekleyip yalnız teknik olarak uygun kesimleri üretime aktar.
6. Ustaya imalat PDF'si ve parça kodlama çıktısı için FAZ 04 entegrasyonu yap.
7. Tüm proje testleri, strict TypeScript, Expo Doctor, iOS/Android cihaz akışları ile kabulü tamamla.
