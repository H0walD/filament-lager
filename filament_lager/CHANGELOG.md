# Änderungen

## 1.7.1

- Rollenauswahl mit Farbpunkt beim Nachtragen, Umbuchen und Einlegen, auch in der aufgeklappten Liste
- „Umbuchen auf“ steht jetzt in voller Breite unter der Rolle, auch auf dem Handy gut lesbar

## 1.7.0

- Reiter Verbrauch: neuer Abschnitt „Drucke ohne Abbuchung“. Die App vergleicht Bambuddys Archiv der letzten 30 Tage mit den Abbuchungen und zeigt fertige oder abgebrochene Drucke, bei denen keine Rolle belastet wurde (z. B. weil keine Rolle zugeordnet war)
- „Rolle nachtragen“ öffnet den Druck mit der Menge aus dem Archiv und schlägt zuerst eine Rolle vor, die in diesem Drucker steckt und zum Material passt; „Ausblenden“ für Drucke, die nicht abgebucht werden sollen
- Korrigieren: Jede Abbuchung lässt sich auf eine andere Rolle umbuchen. Die falsche Rolle bekommt die Menge zurück, die richtige wird belastet
- Braucht das Recht „Verbrauch korrigieren“; anzeigen dürfen alle, die den Reiter Verbrauch sehen

## 1.6.1

- Hinweis „Rolle im Drucker ohne Zuordnung“ wieder für die externe Spule bei Druckern ohne AMS (z. B. A1 Mini); bei Druckern mit AMS bleibt er dort aus

## 1.6.0

- 13 Schriftarten zur Auswahl, in der App mitgeliefert, damit sie auf jedem Gerät gleich aussehen: Inter, Roboto, Open Sans, Source Sans 3, Atkinson Hyperlegible, Lexend, Nunito, Comfortaa, Montserrat, Oswald, Merriweather, Roboto Slab, JetBrains Mono (plus Standard des Geräts)
- Schriftgrössen relativ zur Grundschrift des Geräts (rem): Wer dort grössere Schrift eingestellt hat, bekommt sie auch in der App
- Aktiver Reiter oben als gefüllte grüne Fläche, deutlich besser zu sehen

## 1.5.0

- Benutzergruppen mit einzelnen Rechten im Reiter Benutzer: welche Reiter eine Gruppe sieht und was sie darf (Einkaufsliste, Rollen hinzufügen, ausbuchen/löschen, Restgewicht und Lagerplatz, Sorten, Drucker, Verbrauch, Hersteller, Lagerplatz-Icons, Design)
- Admin hat immer alle Rechte; wer in der Konfiguration als admin steht, bleibt immer Admin
- Bestehende Rechte aus der Konfiguration werden als Gruppen Ansehen, Erfassen und Bearbeiten übernommen; Rollen hinzufügen und entfernen darf anfangs nur Admin
- Einkaufsliste zeigt, wer einen Eintrag wann gemacht hat

## 1.4.0

- Neuer Reiter „Design“: Schriftart für Titel und für Text, Schriftgrösse für Titel, Text und Beschreibungen einzeln; gilt pro Benutzer auf allen Geräten, mit Vorschau
- Einzelne Rolle in der Rollenübersicht löschen (endgültig, mit Bestätigung)
- Ganze Sorte löschen unter „Sorte bearbeiten“, zur Sicherheit mit Wisch-Bestätigung
- Ausbuchen-Knopf heisst jetzt „−1“

## 1.3.14

- Kein Hinweis „Rolle im Drucker ohne Zuordnung“ mehr für die externe Spule: Der Drucker hat dort keinen Sensor und meldet den zuletzt eingestellten Filamenttyp auch ohne Rolle

## 1.3.13

- Hinweis „Diese Sorte gibt es schon“ nur noch bei gleichem Hersteller, Material, Typ und Farbname; eine ähnliche Farbe allein löst ihn nicht mehr aus
- Eigene Auswahlliste beim Tippen (Hersteller, Material, Typ, MDI-Icons): grösser, weich scrollend, breitere Scrollbar, mit Pfeiltasten bedienbar
- Lagerplatz-Fenster hat keine waagrechte Scrollbar mehr

## 1.3.12

- Im Lager ist jeder Hersteller nach Material unterteilt, jeweils mit Überschrift und Anzahl Rollen
- Umschalter Kacheln / Liste neben „Neues Material“; die Wahl wird pro Benutzer gespeichert und gilt auf allen Geräten

## 1.3.11

- Hersteller löschen (Papierkorb im Reiter Hersteller), nur möglich, wenn dem Hersteller keine Rolle mehr zugewiesen ist; Webseite und Logo werden mit entfernt

## 1.3.10

- Transparente und durchscheinende Farben: neues Feld „Deckkraft“ beim Material, und der Hex-Code darf 8-stellig sein (#RRGGBBAA wie in Bambu Studio)
- Durchsichtige Farben werden wie in Bambu Studio über einem Schachbrett angezeigt

## 1.3.9

- Korrigierte Abbuchungen gehen auch ins Bambuddy-Archiv (Gramm und Materialkosten des Drucks)
- Ist der Druck im Archiv schon gelöscht oder fehlt das Recht dafür, gibt es einen Hinweis statt eines Fehlers; die Rolle wird trotzdem korrigiert

## 1.3.8

- Lagerplatz-Icons auch als Material Design Icon wie in Home Assistant, z. B. `mdi:fridge`, mit Vorschlägen beim Tippen und Vorschau
- Die Icons werden beim Installieren der App einmal mitgeladen, danach geht nichts mehr ins Internet

## 1.3.7

- Neuer Reiter „Lagerplätze“: pro Lagerplatz ein Icon wählen (Regal, Trockner, Kiste, Schublade, Schrank, Beutel) oder ein eigenes Bild hochladen; ohne Auswahl gilt das Regal
- Lagerplätze werden nicht mehr am Namen erkannt

## 1.3.6

- Einheitliche Linien-Icons statt Emojis
- Rollen im Drucker zeigen das Druckerbild aus Bambuddy
- Lagerplätze mit Icon: Trockner (erkannt am Namen, z. B. „Chitu“, „Trockner“, „Dryer“) oder Regal

## 1.3.5

- Abbuchung eines Drucks korrigieren („✎ Korrigieren“ im Reiter Verbrauch): Gramm pro Rolle ändern oder eine nicht abgebuchte Rolle nachtragen; die Differenz wird direkt bei der Rolle verbucht

## 1.3.4

- Verbrauch nach Druckauftrag: pro Rolle Gewicht vorher, abgebucht und danach

## 1.3.3

- Neuer Reiter „Verbrauch“: jede Abbuchung mit Datum, Uhrzeit, Rolle, Druck und Gramm, dazu Summen und Verbrauch nach Sorte für 7, 30, 90 Tage oder alles

## 1.3.2

- Dunkles Design ist Standard auf allen Geräten
- Schalter Hell/Dunkel oben rechts, wird pro Home-Assistant-Benutzer gespeichert und gilt auf allen Geräten

## 1.3.1

- Lagerplatz pro Rolle im Fenster „☰“ änderbar

## 1.3.0

- Rollen in den Drucker einlegen (AMS-Platz oder externe Spule) und wieder herausnehmen, damit Bambuddy auch bei Rollen ohne Chip den Verbrauch abzieht
- Hinweis, wenn eine Rolle im Drucker steckt, die keiner Lager-Rolle zugeordnet ist
- AMS-Platz auf jeder Kachel
- Rollen einzeln ansehen: Restgewicht, Platz, Wert und letzte Drucke mit Verbrauch
- Restgewicht pro Rolle ändern, direkt oder mit dem Gewicht von der Waage
- Leergewicht der Spule und Preis pro kg je Sorte, Lagerwert in der Übersicht

## 1.2.0

- Logos werden nicht mehr automatisch aus dem Internet geholt; nur Admins laden sie hoch (PNG, JPG, WebP, GIF)
- Ohne Logo wird nur der Herstellername angezeigt
- Webseite pro Hersteller als Link im Lager und auf der Hersteller-Seite

## 1.1.0

- Benutzerrechte in der App-Konfiguration (kein, ansehen, erfassen, bearbeiten, admin)
- Eintrag in der Seitenleiste für alle Home-Assistant-Benutzer
- Filter nach Hersteller, Material, Farbe und Lagerort, mit Mehrfachauswahl
- Angebrochene Rollen, Lagerplatz und „zuletzt verwendet“ auf jeder Kachel
- Sorten bearbeiten, Hex-Code bei der Farbe, Rollen ausbuchen
- Bestätigung vor jedem Ein- und Ausbuchen
- Farbe wird bei neuen Rollen zuverlässig übernommen

## 1.0.0

- Erste Version: Lagerübersicht, Einkaufsliste, Hersteller mit Logos
- Automatischer Abgleich von RFID-Rollen mit dem Lager
