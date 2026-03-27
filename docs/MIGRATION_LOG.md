# Migration zu neuer Datenbank-Struktur

**Datum:** 27. März 2026

## Ziel
Migration von Multi-Sensor-DB (PM + THP + Radiation) zu fokussierter DB (nur Radiation + THP)

## Änderungen

### Entfernt:
- ❌ PM (Feinstaub) Sensoren komplett
- ❌ `problemsensors` Collection
- ❌ `mapdata` Collection (ersetzt durch `properties.values`)
- ❌ Separate `data_<sid>` Collections

### Neu:
- ✅ Zentrale `radioactivity_sensors` Collection
- ✅ Zentrale `thp_sensors` Collection  
- ✅ Aktuelle Werte in `properties.values`
- ✅ Name als Array mit Historie
- ✅ Vereinfachte Location-Struktur

### Beibehalten (auskommentiert):
- 💤 AKW-Funktionalität (für spätere Verwendung)

## Bearbeitete Dateien

### ✅ Abgeschlossen
- ✅ **routes/fsdata.js**
  - Radiation: `data_<sid>` → `radioactivity_sensors` 
  - THP: `data_<sid>` → `thp_sensors`
  - properties.name als Array handhaben
  - PM-Funktionen auskommentiert (movAvgSDSWeek, calcMinMaxAvgSDS, isPM, getStatistics)
  
- ✅ **routes/utilities.js**
  - PM-Teile aus calcMovingAverage entfernt
  - Unterstützung für neue `values` Struktur hinzugefügt
  - `datetime.$date` Format-Handling
  
- ✅ **routes/apidata.js**
  - getAPIdata(): Type-basierte Collection-Auswahl (radioactivity_sensors/thp_sensors)
  - getAPIprops(): name Array, location.country statt address
  - getApiCities(): PM-Filter entfernt, type-basiert
  - PM-Funktionen auskommentiert (getAPIalldata, isPM)
  
- ✅ **routes/mapdata.js**
  - getaktdata(): properties Collection statt mapdata
  - properties.values für aktuelle Werte
  - location.loc statt location
  - indoor als Number (0/1)
  - getRegionSensors(): PM-Filter entfernt
  - AKW-Funktionen auskommentiert (getakwdata)
  
- ✅ **docs/MongoDB_Struktur.md**
  - THP-Struktur dokumentiert
  - Neue Collections beschrieben
  - Migrations-Anleitungen hinzugefügt

## Wichtige Änderungen im Detail

### 1. Collections
- ❌ `data_<sid>` (tausende separate Collections)
- ✅ `radioactivity_sensors` (eine zentrale Collection)
- ✅ `thp_sensors` (eine zentrale Collection)
- ❌ `mapdata` Collection
- ✅ Aktuelle Werte jetzt in `properties.values`

### 2. Properties-Struktur
- `name`: String → Array von {name, since}
- `location.address`: Objekt → nur `location.country`: String
- `indoor`: Boolean → Number (0/1)
- Neu: `location.id`, `location.exact_loc`, `location.since`
- Neu: `type: "radioactivity"` zur Typ-Identifikation
- Neu: `values` Objekt mit aktuellen Messwerten

### 3. Zeitstempel
- Alt: `datetime: Date`
- Neu: `datetime: { $date: Date }`
- Beide Formate werden jetzt unterstützt

### 4. Query-Änderungen
- Sensor-ID-Filter: `sensorid: sid` statt Collection-Name
- Zeitstempel-Filter: `'datetime.$date'` statt `datetime`
- Messwerte-Zugriff: `values.counts_per_minute` statt `counts_per_minute`
- Location-Zugriff: `location.loc` statt `location` (für GeoJSON)

### 5. Indizes (müssen erstellt werden!)
```javascript
db.radioactivity_sensors.createIndex({ sensorid: 1, "datetime.$date": 1 });
db.radioactivity_sensors.createIndex({ "datetime.$date": -1 });
db.thp_sensors.createIndex({ sensorid: 1, "datetime.$date": 1 });
db.thp_sensors.createIndex({ "datetime.$date": -1 });
db.properties.createIndex({ type: 1 });
db.properties.createIndex({ "location.loc": "2dsphere" });
```

## Nächste Schritte

1. **Datenbank-Verbindung**: Environment-Variablen für neue DB setzen
2. **Indizes erstellen**: Obige Indizes in MongoDB anlegen  
3. **Testen**: Alle Funktionen durchTesten
4. **AKW-Features**: Bei Bedarf auskommentierte AKW-Funktionen reaktivieren

## Bekannte Einschränkungen

- `othersensors` Array in properties wird möglicherweise nicht mehr gefüllt
- Stadt-Namen (Stadt-basierte Queries) funktionieren möglicherweise nicht mehr  
- PM-bezogene API-Endpunkte geben Fehler zurück
- AKW-Funktionalität ist auskommentiert

## Bugfixes nach Migration

### 27.03.2026 - Frontend Name-Handling
**Problem:** `Uncaught TypeError: data.name.startsWith is not a function`
- Frontend erwartete name als String, erhielt aber Array
**Lösung:**
- routes/fsdata.js: getSensorProperties konvertiert name-Array zu String für Frontend
- public/js/global.js: holAddress auf neue location.country Struktur angepasst

### 27.03.2026 - MongoDB datetime.$date Query-Fehler
**Problem:** `MongoServerError: FieldPath field names may not start with '$'`
- MongoDB interpretiert `$date` in `'datetime.$date'` als Operator, nicht als Feldname
**Lösung:**
- Alle Queries auf direktes `datetime` Feld umgestellt (BSON Date)
- Betroffene Funktionen:
  - routes/fsdata.js: readRadiationMovingAverage, readRadiationAverages, readClimateAverages
  - routes/apidata.js: getAPIdataSensor
- utilities.js bleibt unverändert (behandelt beide Formate bei Datenverarbeitung)
**Hinweis:** Datenbank muss datetime als BSON Date speichern, nicht als verschachteltes Objekt
