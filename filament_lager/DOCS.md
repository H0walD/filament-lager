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
| `erfassen` | Rollen einbuchen, Einkaufsliste pflegen |
| `bearbeiten` | zusätzlich Sorten ändern, ausbuchen, Hersteller-Webseiten pflegen |
| `admin` | zusätzlich Logos hochladen und Übersicht „Benutzer“ |

Wer nicht unter **Benutzer und Rechte** steht, bekommt das **Standard-Recht**. Änderungen gelten sofort.

## RFID-Rollen

Neue Rollen zuerst in Filament-Lager erfassen, dann ins AMS stecken. Die App ordnet den Chip innerhalb einer Minute der Lager-Rolle zu, damit nichts doppelt gezählt wird. In Bambuddy muss „Unbekannte RFID-Spulen automatisch hinzufügen“ eingeschaltet sein.

## Hilfe

Ausführliche Anleitung mit Bildern: siehe README im GitHub-Repository.
