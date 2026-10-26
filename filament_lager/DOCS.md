# Filament-Lager

Übersichtliche Lagerverwaltung für 3D-Druck-Filament, die direkt mit Bambuddy zusammenarbeitet. Alle Rollen, Einkaufslisten und Lagerplätze werden in Bambuddy gespeichert.

## Einrichtung

1. In Bambuddy unter Einstellungen → API-Schlüssel einen Schlüssel mit dem Recht **Inventar verwalten** anlegen und kopieren.
2. Hier im Reiter **Konfiguration** eintragen:
   - **Bambuddy-Adresse**, z. B. `http://192.168.1.50:8000`
   - **API-Schlüssel**
   - Unter **Benutzer und Rechte** dich selbst mit deinem Home-Assistant-Benutzernamen und dem Recht `admin`
3. Speichern, im Reiter Info starten und „In der Seitenleiste anzeigen“ einschalten.

## Rechte

| Recht | Darf |
|---|---|
| `kein` | nichts |
| `ansehen` | alles ansehen |
| `erfassen` | Rollen einbuchen, in den Drucker einlegen und herausnehmen, Einkaufsliste pflegen |
| `bearbeiten` | zusätzlich Sorten ändern, Restgewicht und Preise ändern, ausbuchen, Hersteller-Webseiten pflegen |
| `admin` | zusätzlich Logos hochladen und Übersicht „Benutzer“ |

Wer nicht unter **Benutzer und Rechte** steht, bekommt das **Standard-Recht**. Änderungen gelten sofort.

## RFID-Rollen

Neue Rollen zuerst in Filament-Lager erfassen, dann ins AMS stecken. Die App ordnet den Chip innerhalb einer Minute der Lager-Rolle zu, damit nichts doppelt gezählt wird. In Bambuddy muss „Unbekannte RFID-Spulen automatisch hinzufügen“ eingeschaltet sein.

## Rollen ohne Chip

Damit Bambuddy den Verbrauch abzieht, muss die Rolle einem AMS-Platz zugeordnet sein. Dafür bei der Sorte auf „🖨“ tippen. Steckt eine Rolle ohne Zuordnung im Drucker, zeigt die App oben einen Hinweis. Der API-Schlüssel braucht dafür zusätzlich das Recht „Status lesen“ (in Bambuddy standardmäßig an).

## Abbuchung korrigieren

Im Reiter Verbrauch lässt sich bei jedem Druck die abgebuchte Menge ändern. Die Differenz wird bei der Rolle verbucht, und die neue Summe des Drucks geht auch ins Bambuddy-Archiv. Dafür braucht der API-Schlüssel das Recht „Archive verwalten“ (in Bambuddy standardmäßig an). Ist der Druck im Archiv schon gelöscht, wird nur die Rolle korrigiert und die App zeigt einen Hinweis.

Bambuddys Statistikseite übernimmt den Archivwert nur, wenn beim Druck nichts gemessen wurde. Hat Bambuddy selbst einen Verbrauch gemessen, behält die Statistik diesen.

## Hilfe

Ausführliche Anleitung mit Bildern: siehe README im GitHub-Repository.
