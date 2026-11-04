# FAZ 02 ilerleme

Plan: docs/superpowers/plans/2026-11-05-faz02.md
Başlangıç: 807545c, temiz ağaç, önceki 35 test başarılı.

Task 1 complete: bağımsız motor, deterministik iki kot, hat kırpma, gerçek sıra/ek desteği, metraj ve uyarılar. 18 motor testi geçti.
Task 2 complete: migration1→2, ayrı framing JSON kaydı, atomik kaynak kontrolü, manuel profil/mesnet işlemleri ve gerçek SQLite reopen/cascade testleri.
Task 3 complete (kod): Skia viewer, responsive araçlar/profil/ayar/metraj, eski ekranlardan giriş, ayar taslağı kalıcılığı (oturum), kayıt/undo.
Task 4 automated complete: 54 unit + 12 UI, tsc, format, doctor20/20, iOS+Android export. Native iPhone görüntü alındı. Android/iPad/fiziksel kalem ve tam cihaz etkileşim kabulü açık.

Kararlar: kullanıcı uygulama onayı verdi; ek brainstorming/onay sorulmadı. İlk ayarlarda bilinemeyen alt/mesnet aralığı, tahta/derz/boşluk değerleri null bırakılır. Plan kısmi ise eksik geometri uyarılır, kesin üretim yoktur. Montaj boşluğu çift destek yüzleri arasındaki minimum açıklıktır; overhang tahmini yapılmaz. Statik durum her zaman requires-approval, productionReady=false. Sıra kamaları/kalıntı şeritleri ve genişlik kanıtı olmayan profiller açık uyarı taşır. Kaynak sınırları büyük/dar aralık isteklerinde freeze yerine hata verir. Kesim/stock dağıtımı yapılmadı.

İnceleme: eğik üste aks ve uç destek kanıtı hataları düzeltildi. Ayar taslağı kaybı kullanıcı etkisi nedeniyle düzeltildi. Bilinen sınırdaki mesnet ve batched drag regresyonları giderildi. Son tam testler başarılı; bağımsız incelemenin statik/cihaz ergonomisi kapsam dışı alanları raporda açık bırakıldı. Dal yerinde tutulur; push/merge/yayın yapılmaz. FAZ03'e geçilmez.
