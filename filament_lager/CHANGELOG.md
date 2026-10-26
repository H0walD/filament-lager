# Änderungen

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
