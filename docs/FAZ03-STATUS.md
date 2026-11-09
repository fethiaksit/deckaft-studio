# FAZ 03 — Profil kesim optimizasyonu

FAZ 03, kayıtlı karkasın koordinatlarından profil boylarını yeniden hesaplar. Aynı malzeme, genişlik, yükseklik ve et kalınlığına sahip profilleri ayrı stok gruplarına ayırır. Ölçüsü veya kesiti tutarsız profiller, çözümlenmemiş ekler ve üye düzeyinde geometrisi doğrulanmamış profiller ayrı listelenir. Hariç tutulanlar satın alma tahminine katılmaz; kısmi sonuç özet kartında belirtilir.

## Hesap modeli

- Başlangıç değerleri: 6000 mm stok, 3 mm testere, 0 mm başlangıç/son uç düzeltmesi, 500 mm minimum kullanılabilir artık. Stok ve testere varsayılanları kayıtlı karkas ayarlarından alınır; kesim ekranında ayrı değiştirilebilir.
- Her çıkış parçasına (son dahil) bir ayırma kesimi, sıfırdan büyük her uç düzeltmesine bir ek kesim yazılır. Uç düzeltme boyu testere kaybından ayrıdır; fabrika ucundan kesimsiz son parça kredisi verilmez. Bu nedenle 6000 mm parça, pozitif testere payıyla 6000 mm stoktan kesilebilir sayılmaz.
- Gerçek boy koordinat mesafesidir. Üretim boyu, testere ve uç payı 0,001 mm yukarı; stok kapasitesi aşağı yuvarlanır. Yerleştirme tam sayı mikrometrelerle yapılır. Parça + kullanılabilir artık + fire, stok boyunu verir. Fire; testere kaybı, uç düzeltme ve eşiğin altındaki artıktır.
- Best-fit decreasing bir başlangıç yerleşimi verir. Hacim ve yarım stoktan büyük parça sayısı alt sınırdır. Grup başına en fazla 100 parça için branch-and-bound, daha az çubuk kullanan yerleşimleri arar; bütün gruplar toplamında 250.000 düğüm ve 150 ms kesin arama bütçesi vardır. Alt sınıra ulaşma veya aramanın tamamlanması optimumu kanıtlar. Daha büyük/sınırı aşan gruplarda geçerli yerleşim ve kanıtlanabilen alt sınır gösterilir.
- Optimum yalnız **dahil edilen profillerin stok adedi** içindir. Aynı stok adediyle kullanılabilir artıkların dağılımı değişebilir. Kaydedilen optimum iddiası açılışta sınırlı aramayla doğrulanır; doğrulanamayan iddia geçerli çözüm düzeyine indirilir ve kanıtsız alt sınır gösterilmez.

## Kayıt ve izlenebilirlik

SQLite şeması v3, eski tabloları ve kayıtları koruyarak `cutting_plans` tablosunu ekler. Proje başına son plan; kaynak karkas ID'si, zaman damgası, tam kaynak revizyonu, hesap ayarları, stok/parça eşlemesi, fire, artıklar ve çözüm kalitesiyle saklanır. Yazma sırasında kaynak çizim ve karkas belgeleri koşullu SQL ile karşılaştırılır. Karkas revizyonu veya alan geometrisi değişince eski sonuç güncel görünümden kaldırılır; kayıt silinmez ve envanter girdileri eski olarak işaretlenir. Geometriyi etkilemeyen çizim değişiklikleri tek başına geçersizlik oluşturmaz.

Telefon ekranında yatay kaydırılan renkli stok çubukları ve ayrı parça ayrıntısı; tablette stok ve parça/karkas panelleri yan yana çalışır. Her iki yönde aynı profil kimliği ve koduyla geçiş yapılır. Kullanılabilir artıklar stok, proje, kesim planı ve kesit bilgisiyle ayrı bir envanter modeli olarak okunabilir. Projeler arası otomatik stok tüketimi, PDF ve FAZ 04 bu kapsamda yoktur.

Karkasın teknik durumu **Ön Yerleşim — Teknik Onay Gerekli** olarak kalır. Kesim hesabı, statik yeterlilik, bağlantı/mesnet tasarımı veya imalat onayı sağlamaz. Uzun üyeler otomatik bölünmez.

[Doğrulama ve değişen dosyalar](FAZ03-VERIFICATION.md)
