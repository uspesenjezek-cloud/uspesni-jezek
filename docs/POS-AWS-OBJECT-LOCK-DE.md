# POS-Archiv: AWS S3 Object Lock

## Zielbild

Supabase bleibt der operative Speicher für schnelle PDF- und XML-Abrufe. Jede
Originaldatei wird zusätzlich in einen privaten, versionierten S3-Bucket in
`eu-central-1` (Frankfurt) kopiert. Die Kopie erhält eine SHA-256-Prüfsumme und
eine Object-Lock-Aufbewahrungsfrist.

- Entwicklungsaccount: Testbelege mit `GOVERNANCE`, standardmäßig 7 Tage,
  höchstens 30 Tage.
- Produktionsaccount: auch der kurze Wiederherstellungstest verwendet
  `COMPLIANCE`, damit er den späteren Live-Schutz tatsächlich nachweist.
- Produktivbetrieb: `COMPLIANCE` bis zum Ende des gesetzlichen Achtjahreszeitraums.
- Der Anwendungscode besitzt keine S3-Löschberechtigung und verwendet keine
  Governance-Bypass-Berechtigung.
- Neue und fehlgeschlagene Kopien werden täglich verarbeitet. Jede gespeicherte
  Version wird spätestens nach 90 Tagen erneut geprüft.
- Ein Wiederherstellungstest lädt eine konkrete S3-Version zurück und vergleicht
  Größe und SHA-256. Erst danach kann der Archivstatus bereit werden.

## AWS-Einrichtung für den Testbetrieb

1. Eigenen Entwicklungs-AWS-Account verwenden; nicht den späteren Firmenaccount.
2. S3-Bucket in Frankfurt erstellen und Object Lock bereits bei der Erstellung
   aktivieren. Öffentlichen Zugriff vollständig blockieren.
3. Versionierung und Standardverschlüsselung aktiv lassen. Für Testobjekte wird
   die Aufbewahrung durch die Anwendung im Governance-Modus gesetzt.
4. Einen eigenen IAM-Benutzer nur für dieses Archiv erstellen. Er braucht nur:
   `s3:PutObject`, `s3:GetObject`, `s3:GetObjectVersion`,
   `s3:GetObjectRetention`, `s3:GetBucketObjectLockConfiguration` und
   `s3:ListBucket`. Nicht erlauben: `s3:DeleteObject`,
   `s3:DeleteObjectVersion`, `s3:BypassGovernanceRetention`.
5. Die Werte aus `.env.example` als verschlüsselte Vercel-Variablen setzen,
   ausschließlich serverseitig. `POS_ARCHIVE_S3_LIVE_ENABLED` bleibt `false`.
6. Den Archivarbeiter einmal manuell ausführen. Erwartet werden: erfolgreiche
   Kopien, konkrete `VersionId`, passender SHA-256 und erfolgreicher Downloadtest.

## Späterer Produktivwechsel

Nach Gründung des deutschen Unternehmens wird ein separater, vom Unternehmen
besessener AWS-Account und ein neuer Produktions-Bucket verwendet. Erst nach
Freigabe der Verfahrensdokumentation und einem echten Wiederherstellungstest wird
`POS_ARCHIVE_S3_LIVE_ENABLED=true` gesetzt. Ab dann schreibt die Anwendung
ausschließlich `COMPLIANCE`-Sperren. Ein Testbeleg bleibt dabei nur für die kurze
Testfrist gesperrt; echte Rechnungen bleiben bis zum im Archivregister
berechneten Datum gesperrt.

Ein Compliance-Retention-Datum kann auch durch den Root-Benutzer nicht verkürzt
werden. Deshalb wird der Achtjahres-Lock niemals auf dem persönlichen Testkonto
aktiviert.

## Betriebliche Nachweise

Die Datenbank enthält pro Original eine laufende Replikationszeile und eine
append-only Ereignisspur. Gespeichert werden Provider, Bucket, Objektschlüssel,
Version-ID, Modus, Ablaufdatum, Größe, SHA-256, Versuche und Prüfergebnisse. Bereits
gespeicherte Objektidentität und Retention dürfen nicht nachträglich verändert
oder gelöscht werden.
