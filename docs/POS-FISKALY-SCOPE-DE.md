# Geltungsbereich der fiskaly-Integration

## Verbindliche Produktentscheidung

Der POS-Terminal dieser Anwendung unterstützt ausschließlich bargeldlose Rechnungen und Zahlungen. Er enthält keine Kassenfunktion und keine Möglichkeit, fiskaly SIGN DE für gewöhnliche Rechnungen zu aktivieren.

Das sichtbare fiskaly-Panel dient ausschließlich einem isolierten TRAINING-Verbindungstest. Ein dort erzeugter Test-Kassenbon ist kein echter Beleg, gehört zu keiner Kundenrechnung und bewegt kein Geld.

## Technische Grenze

- Die reguläre Rechnungsausgabe ruft fiskaly nicht auf.
- Der TRAINING-Endpunkt verwendet nur die fiskaly-Testumgebung.
- `cashModuleEnabled` bleibt fest auf `false`.
- Eine fehlgeschlagene fiskaly-Verbindung blockiert bargeldlose Rechnungen nicht.
- Die Oberfläche darf keinen späteren Schalter oder eine Benutzeraktivierung versprechen.

## Wann diese Entscheidung neu geprüft werden muss

Sobald Barzahlungen, eine elektronische Registrierkasse oder andere aufzeichnungspflichtige Kassenvorgänge eingeführt werden sollen, muss vor deren Freigabe eine gesonderte rechtliche und technische Prüfung erfolgen. Dazu gehören insbesondere TSE-Pflichten, KassenSichV, DSFinV-K, Belegausgabe und der vollständige Produktionsbetrieb von SIGN DE. Eine solche Erweiterung ist ein eigenes Projekt und darf nicht durch Umschalten des TRAINING-Panels erfolgen.
