# FAZ 00 ilerleme
Plan: docs/superpowers/plans/2026-11-05-faz00.md
Kullanıcı doğrudan uygulamayı onayladı; ek tasarım ve plan onayı istemiyor.
Karar: Boş yeni proje dizininde çalışılır; korunacak mevcut kod veya dal yoktur.
Karar: Node SQLite test adaptörü gerçek SQLite sorgularını çalıştırır; native Expo bağlayıcısı cihazda ayrıca doğrulanır.

Task 1: complete — gerçek SQLite ve mm domain testleri geçti.
Task 2: complete — Router, tema, CRUD ekranları ve hazırlık modülleri; tsc geçti.
Task 3: complete (kod) — Skia native iPhone okuma/render kontrolü geçti; etkileşim QA açık.
Task 4: automated checks complete — 12/12 test, tsc, format, doctor20/20, iOS+Android export. Native tablet/Android kabul testleri açık.
Karar: Telefon yatay konumda tablet sayılmaz; küçük iPad ve dar split-view için kısa kenar da değerlendirilir.
Karar: API Headers nesnesi normalize edilir; gerçek HTTP regresyon testi eklendi.
İnceleme: undo/redo sonrasında aktif çizgi kimliği korunur; 2 regresyon testi geçti.
İnceleme dışında: native gesture/kalem/safe-area cihaz etkileşimleri; FAZ01 hesapları kapsam dışı.
Karar: Kullanıcının ek onay istememe talebi doğrultusunda dal yerinde tutulur; merge/push/yayın yapılmaz.
