# Filament-Lager

Übersichtliche Lagerverwaltung für 3D-Druck-Filament, die direkt mit Bambuddy zusammenarbeitet. Alle Rollen, Einkaufslisten und Lagerplätze werden in Bambuddy gespeichert.

## Einrichtung

1. In Bambuddy unter Einstellungen → API-Schlüssel einen Schlüssel mit dem Recht **Inventar verwalten** anlegen und kopieren.
2. Hier im Reiter **Konfiguration** eintragen:
   - **Bambuddy-Adresse**, z. B. `http://192.168.1.50:8000`
   - **API-Schlüssel**
   - Unter **Benutzer und Rechte** dich selbst mit deinem Home-Assistant-Benutzernamen und dem Recht `admin` (alle anderen danach in der App im Reiter Benutzer)
3. Speichern, im Reiter Info starten und „In der Seitenleiste anzeigen“ einschalten.

## Benutzergruppen und Rechte

Im Reiter **Benutzer** (nur Admin) ordnest du jedem Benutzer eine Gruppe zu und stellst pro Gruppe ein, was sie darf: welche Reiter sie sieht, Einkaufsliste, Rollen hinzufügen, Rollen ausbuchen und löschen, Restgewicht und Lagerplatz, Sorten bearbeiten, Drucker, Verbrauch korrigieren, Hersteller und Lagerplatz-Icons.

- **Admin** hat immer alle Rechte und verwaltet als Einziger Benutzer und Gruppen.
- Wer hier unter **Benutzer und Rechte** als `admin` eingetragen ist, bleibt immer Admin, so kann sich niemand aussperren.
- Die übrigen Einträge und das **Standard-Recht** gelten als Vorgabe, solange in der App keine Gruppe gewählt ist. Die Gruppen „Ansehen“, „Erfassen“ und „Bearbeiten“ heissen wie die Rechte hier.
- Rollen hinzufügen und entfernen darf anfangs nur Admin; du kannst es jeder Gruppe geben.
- Änderungen gelten sofort. Die App prüft die Rechte auch auf dem Server.

## RFID-Rollen

Neue Rollen zuerst in Filament-Lager erfassen, dann ins AMS stecken. Die App ordnet den Chip innerhalb einer Minute der Lager-Rolle zu, damit nichts doppelt gezählt wird. In Bambuddy muss „Unbekannte RFID-Spulen automatisch hinzufügen“ eingeschaltet sein.

## Rollen ohne Chip

Damit Bambuddy den Verbrauch abzieht, muss die Rolle einem AMS-Platz zugeordnet sein. Dafür bei der Sorte auf „🖨“ tippen. Steckt eine Rolle ohne Zuordnung im Drucker, zeigt die App oben einen Hinweis. Der API-Schlüssel braucht dafür zusätzlich das Recht „Status lesen“ (in Bambuddy standardmäßig an).

## Abbuchung korrigieren

Im Reiter Verbrauch lässt sich bei jedem Druck die abgebuchte Menge ändern. Die Differenz wird bei der Rolle verbucht, und die neue Summe des Drucks geht auch ins Bambuddy-Archiv. Dafür braucht der API-Schlüssel das Recht „Archive verwalten“ (in Bambuddy standardmäßig an). Ist der Druck im Archiv schon gelöscht, wird nur die Rolle korrigiert und die App zeigt einen Hinweis.

War beim Druck die falsche Rolle zugeordnet, wählst du beim Korrigieren unter der Rolle „Umbuchen auf“ die richtige: Die falsche bekommt die Menge zurück, die richtige wird belastet. Drucke, bei denen gar nichts abgebucht wurde, zeigt die App oben im Reiter Verbrauch unter „Drucke ohne Abbuchung“ (aus Bambuddys Archiv, letzte 30 Tage). Mit „Rolle nachtragen“ buchst du sie mit der Menge aus dem Archiv ab, mit „Ausblenden“ verschwinden sie aus der Liste.

Bambuddys Statistikseite übernimmt den Archivwert nur, wenn beim Druck nichts gemessen wurde. Hat Bambuddy selbst einen Verbrauch gemessen, behält die Statistik diesen.

## Hilfe

Ausführliche Anleitung mit Bildern: siehe README im GitHub-Repository.
