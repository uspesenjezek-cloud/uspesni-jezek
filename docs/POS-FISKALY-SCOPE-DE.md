# Geltungsbereich der fiskaly-Integration

## Aktualisierte verbindliche Produktentscheidung

Der POS-Terminal soll neben bargeldlosen Zahlungen auch Barzahlungen unterstützen. Damit gehören Kassenfunktion, fiskaly SIGN DE, KassenSichV, DSFinV-K und die vorgeschriebenen Belegdaten zum verbindlichen Produktionsumfang.

Bis dieser Produktionsweg vollständig extern aktiviert und geprüft ist, bleibt der sichtbare Kassenweg ausschließlich TRAINING. Ein dort erzeugter Kassenbon ist kein echter steuerlicher Beleg und bewegt kein Geld.

## Technische Grenze

- Die reguläre Rechnungsausgabe ruft fiskaly nicht auf.
- Der TRAINING-Endpunkt verwendet nur die fiskaly-Testumgebung.
- `cashModuleEnabled` bleibt bis zur vollständigen Umsetzung und Freigabe fest auf `false`.
- Eine fehlgeschlagene fiskaly-Verbindung blockiert bargeldlose Rechnungen nicht.
- Die Oberfläche darf eine produktive Barzahlung nicht anbieten, bevor alle unten genannten Freigaben erfüllt sind.

## Lokal vorbereiteter, weiterhin gesperrter Kassenabschluss

- Das lokale Domänenmodell akzeptiert ausschließlich `CASH` in `EUR`, prüft die Summe aller Positionen und verlangt eine ausdrückliche Bestätigung.
- Eine idempotente Request-ID verhindert eine zweite TSE-Signatur und eine doppelte Zahlung beim Wiederholen derselben Aktion.
- Ein unvollständiges oder nicht eindeutig zuordenbares TSE-Ergebnis führt fail-closed zu `recovery_required`; ohne vollständige Signatur darf keine Zahlung entstehen.
- Ein vollständiger Signaturnachweis umfasst Zähler, Algorithmus, TSS-/Client-Seriennummer, QR-Daten und einen gültigen Start-/Endzeitraum innerhalb fester Größenlimits. Ein Replay muss auch nach `completed` exakt denselben Nachweis enthalten.
- Die lokale Migration `20260826182713_pos_cash_checkout_state.sql` trennt `prepared`, `signed`, `completed` und `recovery_required`. Erst der service-role-only Abschluss schreibt Zahlung und Audit-Ereignis atomar.
- Die lokale Migration `20260826194158_pos_cash_refund_state.sql` führt dieselben fail-closed Zustände für Erstattungen, bindet jede Erstattung eindeutig an den ursprünglichen Checkout und setzt Zahlung, Refund und Audit-Ereignis erst nach der TSE-Signatur atomar auf abgeschlossen.
- Der lokale POS kann eine TEST-Rechnung bar abschließen, den signierten TRAINING-Kassenbon erneut anzeigen und eine vollständige Erstattung erst nach einer eigenen idempotenten Mock-TSE-Signatur erfassen.
- Kasseneinlage und Kassenentnahme werden als eigene lokale TRAINING-Ereignisse geführt.
- Der lokale DSFinV-K-2.4-Modell-Export erzeugt getrennte CSV-Inhalte für Kassenabschluss, Vorgänge, Zahlarten, Positionen, Umsatzsteuer und TSE innerhalb eines prüfbaren JSON-Pakets; Verkauf und Erstattung erhalten jeweils eine eigene TSE-Zeile.
- Eine Erstattung in `prepared`, `signed` oder `recovery_required` sowie eine abgeschlossene Erstattung ohne vollständige TSE-Nachweise blockiert den gesamten Export; sie darf nicht stillschweigend aus dem Paket entfallen.
- Das Verhalten ist über UI-Domänenfunktionen, HTTP-Handler und rein lokalen Mock-TSE getestet. Die Produktionsmigration ist nicht ausgerollt und echte fiskaly-Ressourcen werden nicht angesprochen; deshalb bleibt `cashModuleEnabled` unverändert `false`.

Damit ist der lokal ausführbare TRAINING-/Mock-Umfang vollständig. Diese Aussage ist ausdrücklich keine KassenSichV-, DSFinV-K- oder steuerrechtliche Produktionszertifizierung.

## Produktionsfreigabe für Barzahlungen

Barzahlungen bleiben fail-safe gesperrt, bis mindestens folgende Punkte abgeschlossen sind:

- produktiver SIGN-DE-Vertrag und produktive TSS/Client-Registrierung,
- atomarer Kassenabschluss mit TSE-Transaktion und sicherem Fehler-/Ausfallablauf,
- deutscher Kassenbon mit vollständigen TSE-Angaben und QR-Code,
- DSFinV-K-Export, Aufbewahrung und nachvollziehbare Kassenbewegungen,
- Storno, Rückzahlung, Kassenentnahme und Kasseneinlage,
- Meldung des elektronischen Aufzeichnungssystems und rechtlich-steuerliche Abnahme.

Der TRAINING-Endpunkt darf diese Freigabe niemals automatisch oder durch einen UI-Schalter ersetzen.
