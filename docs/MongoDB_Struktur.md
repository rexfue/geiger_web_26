# MongoDB Datenbankstruktur - Geiger_WEB_26

## Übersicht
**Datenbankname:** `allsensors` (aus MONGOBASE Environment-Variable)

Die Datenbank enthält Messdaten von Strahlungs-, Feinstaub- und Klimasensoren.

---

## Collections

### 1. **properties**
Speichert die Eigenschaften und Metadaten aller Sensoren.

#### Struktur:
```javascript
{
    _id: Number,                    // Sensor-ID (z.B. 140, 1234)
    name: String,                   // Sensor-Typ/Name
                                    // Beispiele:
                                    // - Feinstaub: "SDS011", "PMS7003", "PMS3003", "PMS5003", "HPM", "SDS021", "PPD42NS"
                                    // - Strahlung: "Radiation <Type>" (z.B. "Radiation SBM-20", "Radiation Si22G")
                                    // - Klima: andere Typen für Temp/Hum/Press
    
    date_since: Date,              // Startdatum des Sensors
    last_seen: Date,               // Letzter Kontakt mit dem Sensor
    
    location: [                    // Array mit Standort-Historie (neuester = letzter Eintrag)
        {
            loc: {                 // GeoJSON Point
                type: "Point",
                coordinates: [longitude, latitude]  // [lon, lat] Format!
            },
            altitude: Number,      // Höhe über NN in Metern
            address: {             // Adressinformationen
                country: String,   // Ländercode (z.B. "DE", "AT")
                plz: String,       // Postleitzahl
                city: String,      // Stadt
                street: String     // Straße (optional)
            }
        }
    ],
    
    indoor: Boolean,               // true = Innenraum-Sensor
    
    othersensors: [               // Zugehörige Sensoren (für Multi-Sensor-Geräte)
        {
            id: Number,           // oder direkt: Number (ältere Einträge)
            name: String
        }
    ]
}
```

#### Verwendung:
- Abruf per Sensor-ID: `db.collection('properties').findOne({_id: sensorId})`
- Geo-Abfragen für Karten-Bounds
- Filtern nach Sensor-Typ (PM, Radiation, etc.)

---

### 2. **data_<sid>** (Dynamische Collections)
Für jeden Sensor existiert eine eigene Collection mit seinen Messdaten.
Format: `data_140`, `data_1234`, etc.

#### Struktur (abhängig vom Sensor-Typ):

**Feinstaub-Sensoren (PM):**
```javascript
{
    datetime: Date,               // Zeitstempel der Messung
    P1: Number,                   // PM10 Wert (Feinstaub < 10μm)
    P2: Number,                   // PM2.5 Wert (Feinstaub < 2.5μm)
}
```

**Klima-Sensoren (THP):**
```javascript
{
    datetime: Date,               // Zeitstempel der Messung
    temperature: Number,          // Temperatur in °C
    humidity: Number,             // Luftfeuchtigkeit in %
    pressure: Number,             // Luftdruck in Pa
    pressure_at_sealevel: Number  // Normierter Luftdruck auf Meereshöhe
}
```

**Strahlungs-Sensoren (Radiation):**
```javascript
{
    datetime: Date,               // Zeitstempel der Messung
    counts_per_minute: Number     // CPM (Counts per Minute)
}
```

#### Verwendung:
- Zeitbereich-Abfragen mit `datetime` Filter
- Aggregation für Durchschnittswerte über Zeiträume
- Sortiert nach `datetime`

---

### 3. **values**
Vorberechnete/aggregierte Tageswerte für schnelleren API-Zugriff.

#### Struktur:
```javascript
{
    _id: String,                  // Format: "<sid>_YYYYMMDD" (z.B. "140_20180602")
    values: [                     // Array mit Messwerten des Tages
        {
            datetime: Date,
            P1: Number,           // oder andere Sensor-spezifische Felder
            P2: Number,
            // ... weitere Felder je nach Sensor-Typ
        }
    ]
}
```

#### Verwendung:
- Schneller Zugriff auf Tagesdaten
- Mehrere Tage werden durch mehrere findOne-Calls abgerufen

---

### 4. **mapdata**
Aktuelle Sensordaten für die Karten-Visualisierung.

#### Struktur:
```javascript
{
    _id: Number,                  // Sensor-ID
    name: String,                 // Sensor-Name (z.B. "Radiation SBM-20")
    location: {                   // GeoJSON Point
        type: "Point",
        coordinates: [longitude, latitude]
    },
    indoor: Boolean,              // Innen-/Außensensor
    values: {                     // Aktuellster Messwert
        datetime: Date,
        counts_per_minute: Number, // oder P1, P2, temperature, etc.
        // ... je nach Sensor-Typ
    }
}
```

#### Verwendung:
- Geo-Abfragen mit `$geoWithin` für Karten-Bounds
- Filter nach Sensor-Namen (z.B. `/Radiation/`)
- Anzeige aktueller Werte auf der Karte

---

### 5. **problemsensors**
Sensoren mit erkannten Problemen/Anomalien.

#### Struktur:
```javascript
{
    _id: Number,                  // Sensor-ID (0 = Metadaten-Eintrag mit Textbeschreibungen)
    problemNr: Number,            // Problem-Typ-Nummer
    // ... weitere problem-spezifische Felder
}
```

#### Besonderheit:
- `_id: 0` enthält Textbeschreibungen der Problem-Typen
- Bulk-Updates mit `bulkWrite()` und `upsert: true`

---

### 6. **akws**
Atomkraftwerke-Daten.

#### Struktur:
```javascript
{
    _id: Mixed,
    Name: String,                 // Name des AKW
    lat: Number,                  // Breitengrad
    lon: Number,                  // Längengrad
    Status: String,               // "aktiv" oder Stillgelegt-Status
    Baujahr: String,              // Baujahr
    Stillgeleg: String,           // Stilllegungsjahr (falls zutreffend)
    Wiki_Link: String             // Wikipedia-Link
}
```

---

### 7. **th1_akws**
Erweiterte AKW-Daten (vermutlich aus Wikidata).

#### Struktur:
```javascript
{
    _id: Mixed,
    name: String,                 // Name
    geo: String,                  // Format: "POINT(lon lat)"
    types: String,                // "Nuclear power plant" oder andere
    item: String,                 // Wikidata/Wikipedia-Link
    itemServiceentry: String,     // Inbetriebnahme-Datum
    itemServiceretirement: String // Stilllegungs-Datum
}
```

---

## Indizes und Performance

### GeoJSON-Indizes:
- `properties.location.0.loc` - 2dsphere Index für Geo-Abfragen
- `mapdata.location` - 2dsphere Index für Kartenansicht

### Zeitstempel-Indizes:
- `data_<sid>.datetime` - Index für schnelle Zeitbereich-Abfragen
- Sortierung erfolgt meistens nach `datetime`

---

## Wichtige Queries

### 1. Sensor-Eigenschaften abrufen:
```javascript
db.collection('properties').findOne({_id: sensorId})
```

### 2. Messdaten für Zeitraum:
```javascript
db.collection('data_' + sensorId).find({
    datetime: {
        $gte: new Date(start),
        $lt: new Date(end)
    }
}).sort({datetime: 1}).toArray()
```

### 3. Aggregierte Durchschnittswerte:
```javascript
db.collection('data_' + sensorId).aggregate([
    {$sort: {datetime: 1}},
    {$match: {datetime: {$gte: startDate, $lt: endDate}}},
    {
        $group: {
            _id: {
                $toDate: {
                    $subtract: [
                        {$toLong: '$datetime'},
                        {$mod: [{$toLong: '$datetime'}, zeitinterval]}
                    ]
                }
            },
            cpmAvg: {$avg: '$counts_per_minute'},
            count: {$sum: 1}
        }
    },
    {$sort: {_id: 1}}
])
```

### 4. Geo-Abfrage für Karten-Bereich:
```javascript
db.collection('mapdata').find({
    location: {
        $geoWithin: {
            $box: [[west, south], [east, north]]
        }
    },
    name: /Radiation/
})
```

### 5. Sensoren innerhalb Polygon:
```javascript
db.collection('properties').find({
    'location.0.loc': {
        $geoWithin: {
            $geometry: {
                type: "Polygon",
                coordinates: [polygonCoords]
            }
        }
    }
})
```

---

## Sensor-Typen

### Feinstaub (PM):
- SDS011, PMS7003, PMS3003, PMS5003, HPM, SDS021, PPD42NS
- Felder: `P1` (PM10), `P2` (PM2.5)

### Strahlung (Radiation):
- Typen: SBM-20, SBM-19, Si22G
- Feld: `counts_per_minute` (CPM)
- Umrechnungsfaktoren in µSv/h:
  - SBM-20: 1/2.47/60
  - SBM-19: 1/9.81888/60
  - Si22G: 0.081438/60

### Klima (THP):
- Felder: `temperature`, `humidity`, `pressure`
- Druckberechnung auf Meereshöhe mit Formel aus BMP180 Datenblatt

---

## Verbindung

```javascript
const MONGO_URL = 'mongodb://rexfueAdmin:D6grTasE56@207.180.224.98:20019/?authSource=admin'
const MONGOBASE = 'allsensors'

MongoClient.connect(MONGO_URL, {useNewUrlParser: true, useUnifiedTopology: true})
    .then(client => {
        const db = client.db(MONGOBASE);
        // ... Verwendung der Datenbank
    })
```

---

## Notizen

1. **Dynamische Collections**: Für jeden neuen Sensor wird automatisch eine `data_<sid>` Collection angelegt
2. **Location-Array**: Das neueste Location-Objekt ist immer am Ende des Arrays (`location[location.length-1]`)
3. **Zeitstempel**: Alle Zeitstempel sind als JavaScript Date-Objekte gespeichert
4. **GeoJSON**: Koordinaten sind im Format `[longitude, latitude]` (nicht lat/lon!)
5. **Offline-Sensoren**: 
   - > 2 Stunden offline: `cpm = -1`
   - > 7 Tage offline: `cpm = -2`
   - Aktiv: tatsächlicher CPM-Wert

---
---

# NEUE DATENBANKSTRUKTUR (Geplant für zukünftige Verwendung)

## Übersicht
Die neue MongoDB-Struktur fokussiert sich ausschließlich auf **Geiger-Sensoren (Radioaktivität)** und vereinfacht einige Aspekte der Datenorganisation.

---

## Hauptunterschiede zur aktuellen Struktur

| Aspekt | Alte Struktur | Neue Struktur |
|--------|---------------|---------------|
| Sensor-Typen | Multi-Sensor (PM, THP, Radiation) | Nur Radioaktivität |
| Messdaten-Collections | Separate `data_<sid>` pro Sensor | Eine zentrale `radioactivity_sensors` |
| Sensor-Name | `name: String` | `name: Array` mit Historie |
| Adresse | Detailliert im `location.address` | Nur `country` im `location` |
| Aktuelle Werte | Separate `mapdata` Collection | Direkt in `properties.values` |
| Indoor-Flag | `indoor: Boolean` | `indoor: Number (0/1)` |
| Location-ID | Nicht vorhanden | `location.id` |
| Zeitstempel-Feld | `datetime` in `data_<sid>` | `datetime.$date` in `radioactivity_sensors` |
| Sensor-Identifikation | Collection-Name (`data_<sid>`) | Feld `sensorid` |
| Zusätzliche Felder | - | `hv_pulses`, `counts`, `sample_time_ms` |

---

## Collections (Neue Struktur)

### 1. **properties** (Neue Struktur)
Enthält sowohl Metadaten als auch aktuelle Messwerte der Sensoren.

#### Struktur:
```javascript
{
    _id: Number,                    // Sensor-ID
    
    type: String,                   // Sensor-Typ: "radioactivity"
    
    name: [                         // Name-Historie als Array
        {
            name: String,           // z.B. "Radiation Si22G", "Radiation SBM-20"
            since: {                // Gültig seit
                $date: Date
            }
        }
    ],
    
    location: [                     // Location-Historie als Array
        {
            loc: {                  // GeoJSON Point
                type: "Point",
                coordinates: [longitude, latitude]
            },
            id: Number,             // Location-ID (neu)
            altitude: Number,       // Höhe über NN in Metern
            since: {                // Gültig seit
                $date: Date
            },
            exact_loc: Number,      // 0 = ungefähr, 1 = exakt
            indoor: Number,         // 0 = outdoor, 1 = indoor
            country: String         // ISO Ländercode (z.B. "AU", "DE")
        }
    ],
    
    values: {                       // Aktuellste Messwerte (neu in properties!)
        counts_per_minute: Number,  // CPM (Counts per Minute)
        hv_pulses: Number,          // Hochspannungs-Pulse
        counts: Number,             // Gesamt-Counts in der Messperiode
        sample_time_ms: Number,     // Messzeit in Millisekunden
        timestamp: {                // Zeitstempel der Messung
            $date: Date
        }
    }
}
```

#### Beispiel:
```javascript
{
    _id: 12345,
    type: "radioactivity",
    name: [
        {
            name: "Radiation Si22G",
            since: { $date: "2024-06-20T10:13:12.970Z" }
        }
    ],
    location: [
        {
            loc: {
                type: "Point",
                coordinates: [151.032, -33.792]
            },
            id: 70638,
            altitude: 62,
            since: { $date: "2024-06-20T10:13:12.970Z" },
            exact_loc: 0,
            indoor: 0,
            country: "AU"
        }
    ],
    values: {
        counts_per_minute: 61,
        hv_pulses: 44,
        counts: 154,
        sample_time_ms: 151052,
        timestamp: { $date: "2026-03-27T13:18:15.000Z" }
    }
}
```

---

### 2. **radioactivity_sensors** (Zentrale Messdaten-Collection)
**WICHTIG**: Anders als in der alten Struktur gibt es **keine** separaten `data_<sid>` Collections mehr!  
Alle Sensordaten werden in einer einzigen Collection `radioactivity_sensors` gespeichert.

#### Struktur:
```javascript
{
    datetime: {                    // Zeitstempel der Messung
        $date: Date
    },
    sensorid: Number,             // Sensor-ID (Referenz zu properties._id)
    values: {                     // Messwerte
        counts_per_minute: Number,  // CPM (Counts per Minute)
        hv_pulses: Number,          // Hochspannungs-Pulse
        counts: Number,             // Gesamt-Counts in der Messperiode
        sample_time_ms: Number      // Messzeit in Millisekunden
    }
}
```

#### Beispiel:
```javascript
{
    datetime: { $date: "2024-06-20T10:56:55.000Z" },
    sensorid: 74797,
    values: {
        counts_per_minute: 46,
        hv_pulses: 823,
        counts: 114,
        sample_time_ms: 146826
    }
}
```

#### Verwendung:
```javascript
// Alle Daten für einen Sensor abrufen
db.collection('radioactivity_sensors').find({
    sensorid: 74797,
    datetime: { $gte: new Date(start), $lt: new Date(end) }
}).sort({ datetime: 1 }).toArray()

// Aggregation für Durchschnittswerte
db.collection('radioactivity_sensors').aggregate([
    { $match: { sensorid: 74797, datetime: { $gte: startDate, $lt: endDate } } },
    { $sort: { datetime: 1 } },
    {
        $group: {
            _id: {
                $toDate: {
                    $subtract: [
                        { $toLong: '$datetime' },
                        { $mod: [{ $toLong: '$datetime' }, zeitinterval] }
                    ]
                }
            },
            cpmAvg: { $avg: '$values.counts_per_minute' },
            countsAvg: { $avg: '$values.counts' },
            count: { $sum: 1 }
        }
    },
    { $sort: { _id: 1 } }
])
```

#### Vorteile gegenüber alten `data_<sid>` Collections:
✅ Zentralisiert: Nur eine Collection statt tausende  
✅ Einfachere Wartung und Backups  
✅ Sensor-übergreifende Queries möglich  
✅ Index auf `sensorid` für schnelle Filterung  

#### Nachteile:
⚠️ Größere Collection → Indizes wichtiger  
⚠️ `sensorid` muss bei jeder Query gefiltert werden  

---

### 3. **thp_sensors** (Zentrale Klima-Messdaten-Collection)
Analog zu `radioactivity_sensors` werden alle Klima-Sensordaten (Temperatur, Luftfeuchtigkeit, Luftdruck) in einer einzigen Collection gespeichert.

#### Struktur:
```javascript
{
    datetime: {                    // Zeitstempel der Messung
        $date: Date
    },
    sensorid: Number,             // Sensor-ID (Referenz zu properties._id)
    values: {                     // Messwerte
        temperature: Number,        // Temperatur in °C
        pressure: Number,           // Luftdruck in Pa
        humidity: Number,           // Luftfeuchtigkeit in %
        pressure_at_sealevel: Number // Normierter Luftdruck auf Meereshöhe in Pa
    }
}
```

#### Beispiel:
```javascript
{
    datetime: { $date: "2024-06-20T11:02:08.000Z" },
    sensorid: 550,
    values: {
        temperature: 28.42,
        pressure: 98326.75,
        humidity: 47.15,
        pressure_at_sealevel: 101559.71
    }
}
```

#### Verwendung:
```javascript
// Alle Daten für einen THP-Sensor abrufen
db.collection('thp_sensors').find({
    sensorid: 550,
    datetime: { $gte: new Date(start), $lt: new Date(end) }
}).sort({ datetime: 1 }).toArray()

// Aggregation für Durchschnittswerte
db.collection('thp_sensors').aggregate([
    { $match: { sensorid: 550, datetime: { $gte: startDate, $lt: endDate } } },
    { $sort: { datetime: 1 } },
    {
        $group: {
            _id: {
                $toDate: {
                    $subtract: [
                        { $toLong: '$datetime' },
                        { $mod: [{ $toLong: '$datetime' }, zeitinterval] }
                    ]
                }
            },
            tempAvg: { $avg: '$values.temperature' },
            humiAvg: { $avg: '$values.humidity' },
            pressAvg: { $avg: '$values.pressure_at_sealevel' },
            count: { $sum: 1 }
        }
    },
    { $sort: { _id: 1 } }
])
```

---

## Wichtige Änderungen für die Migration

### 1. Name-Feld
**Alt:**
```javascript
name: "Radiation Si22G"
```

**Neu:**
```javascript
name: [
    {
        name: "Radiation Si22G",
        since: { $date: "2024-06-20T10:13:12.970Z" }
    }
]
```

**Zugriff auf aktuellen Namen:**
```javascript
const currentName = sensor.name[sensor.name.length - 1].name;
```

---

### 2. Location-Feld
**Alt:**
```javascript
location: [
    {
        loc: { type: "Point", coordinates: [lon, lat] },
        altitude: 62,
        address: {
            country: "AU",
            plz: "2000",
            city: "Sydney"
        }
    }
]
```

**Neu:**
```javascript
location: [
    {
        loc: { type: "Point", coordinates: [lon, lat] },
        id: 70638,
        altitude: 62,
        since: { $date: "2024-06-20T10:13:12.970Z" },
        exact_loc: 0,
        indoor: 0,
        country: "AU"
    }
]
```

**Zugriff auf aktuelle Location:**
```javascript
const currentLoc = sensor.location[sensor.location.length - 1];
const country = currentLoc.country;  // Nicht mehr currentLoc.address.country!
const isIndoor = currentLoc.indoor === 1;  // Nicht mehr Boolean!
```

---

### 3. Aktuelle Werte
**Alt:** Separate `mapdata` Collection
```javascript
db.collection('mapdata').findOne({_id: sensorId})
```

**Neu:** Direkt in `properties.values`
```javascript
const sensor = db.collection('properties').findOne({_id: sensorId});
const currentValue = sensor.values.counts_per_minute;
const lastUpdate = sensor.values.timestamp.$date;
```

---

### 4. Indoor-Flag
**Alt:**
```javascript
if (sensor.indoor) { ... }  // Boolean
```

**Neu:**
```javascript
if (sensor.location[sensor.location.length - 1].indoor === 1) { ... }  // Number!
```

---

## Neue Messwerte-Felder

### hv_pulses (Hochspannungs-Pulse)
Anzahl der Hochspannungspulse, die zur Ansteuerung des Geiger-Müller-Zählrohrs verwendet wurden.

### counts (Gesamt-Counts)
Gesamtzahl der registrierten Impulse während der Messperiode.

### sample_time_ms (Messzeit)
Dauer der Messperiode in Millisekunden. Wichtig für genaue CPM-Berechnungen:
```javascript
const cpm = (counts / sample_time_ms) * 60000;
```

---

## Migrations-Checkliste

### Code-Anpassungen erforderlich:

#### Datenbank-Zugriffe:
- [ ] **Messdaten-Collection**: Von `db.collection('data_' + sid)` zu `db.collection('radioactivity_sensors')`
- [ ] **Sensor-Filter**: Query um `sensorid: sid` erweitern (statt Collection-Name)
- [ ] **Indizes**: `sensorid` und `datetime` Index auf `radioactivity_sensors` erstellen
- [ ] **Zeitstempel-Feld**: `datetime.$date` statt nur `datetime` beim Lesen beachten

#### Metadaten-Zugriffe:
- [ ] **Name-Zugriff**: Von `sensor.name` zu `sensor.name[sensor.name.length-1].name`
- [ ] **Country-Zugriff**: Von `sensor.location[i].address.country` zu `sensor.location[i].country`
- [ ] **Indoor-Check**: Von Boolean zu Number-Vergleich (`=== 1`)
- [ ] **Aktuelle Werte**: Von `mapdata` Collection zu `properties.values`
- [ ] **Address-Felder**: Entfernen von `plz`, `city`, `street` (nur noch `country`)

#### Neue Felder:
- [ ] **Messwerte**: `values.counts_per_minute` statt direktem `counts_per_minute`
- [ ] **Neue Metriken**: `hv_pulses`, `counts`, `sample_time_ms` verarbeiten
- [ ] **Location-ID**: Neues Feld `location.id` berücksichtigen
- [ ] **exact_loc**: Neues Feld für Positionsgenauigkeit
- [ ] **Zeitstempel-Format**: `$date`-Wrapper bei MongoDB-Exporten beachten

#### Performance-Optimierungen:
- [ ] **Compound Index**: `{sensorid: 1, datetime: 1}` auf `radioactivity_sensors`
- [ ] **Projection**: Nur benötigte Felder aus `values` laden
- [ ] **Query-Limits**: Pagination bei großen Zeiträumen über mehrere Sensoren

### Migrations-Beispiele:

#### Messdaten abrufen:

**Alt:**
```javascript
const collection = db.collection('data_' + sid);
const docs = await collection.find({
    datetime: { $gte: new Date(start), $lt: new Date(end) }
}).sort({ datetime: 1 }).toArray();
```

**Neu:**
```javascript
const collection = db.collection('radioactivity_sensors');
const docs = await collection.find({
    sensorid: sid,
    'datetime.$date': { $gte: new Date(start), $lt: new Date(end) }
}).sort({ 'datetime.$date': 1 }).toArray();

// Werte-Zugriff:
const cpm = docs[0].values.counts_per_minute;  // Nicht docs[0].counts_per_minute!
```

#### Aggregation:

**Alt:**
```javascript
const collection = db.collection('data_' + sid);
const docs = await collection.aggregate([
    { $match: { datetime: { $gte: start, $lt: end } } },
    { $group: { 
        _id: ..., 
        cpmAvg: { $avg: '$counts_per_minute' } 
    }}
]).toArray();
```

**Neu:**
```javascript
const collection = db.collection('radioactivity_sensors');
const docs = await collection.aggregate([
    { $match: { 
        sensorid: sid,
        'datetime.$date': { $gte: start, $lt: end } 
    }},
    { $group: { 
        _id: ..., 
        cpmAvg: { $avg: '$values.counts_per_minute' }  // Path in values!
    }}
]).toArray();
```

### Vorteile der neuen Struktur:

✅ **Einfacher**: Keine separate `mapdata` Collection nötig  
✅ **Historisch**: Name- und Location-Änderungen werden nachvollziehbar  
✅ **Fokussiert**: Nur Radioaktivitätssensoren, keine Multi-Sensor-Logik  
✅ **Zusätzliche Metriken**: Mehr technische Details (HV-Pulse, Sample-Time)  
✅ **Zentralisiert**: Alle Messdaten in einer Collection statt tausenden  
✅ **Sensor-übergreifend**: Queries über mehrere Sensoren gleichzeitig möglich  
✅ **Wartungsfreundlich**: Keine dynamischen Collection-Namen mehr  

### Nachteile / Herausforderungen:

⚠️ **Weniger Details**: Keine vollständigen Adressen (Stadt, PLZ, Straße)  
⚠️ **Breaking Changes**: Viele Code-Stellen müssen angepasst werden  
⚠️ **Boolean → Number**: Weniger typsicher für `indoor` und `exact_loc`  
⚠️ **Indizes kritisch**: Ohne richtigen Index auf `sensorid` + `datetime` langsam  
⚠️ **Größere Collection**: Mehr Daten in einer Collection → Monitoring wichtig  
⚠️ **Nested Values**: Alle Messwerte in `values` → längere Accesspfade  

### Empfohlene Indizes für neue Struktur:

```javascript
// Essenziell für radioactivity_sensors
db.radioactivity_sensors.createIndex({ sensorid: 1, "datetime.$date": 1 });
db.radioactivity_sensors.createIndex({ "datetime.$date": -1 });  // Für neueste Werte

// Für properties
db.properties.createIndex({ type: 1 });
db.properties.createIndex({ "location.country": 1 });
db.properties.createIndex({ "location.loc": "2dsphere" });  // Geo-Queries
db.properties.createIndex({ "values.timestamp.$date": -1 });  // Aktualitäts-Check
```

---

## Zusammenfassung: Kritischste Änderungen

### 🔴 Kritisch - Muss angepasst werden:

1. **Collection-Zugriff für Messdaten**
   - ❌ Alt: `db.collection('data_' + sid)`
   - ✅ Neu: `db.collection('radioactivity_sensors')` mit `{sensorid: sid}`

2. **Messwerte-Zugriff**
   - ❌ Alt: `doc.counts_per_minute`
   - ✅ Neu: `doc.values.counts_per_minute`

3. **Name-Zugriff**
   - ❌ Alt: `sensor.name`
   - ✅ Neu: `sensor.name[sensor.name.length-1].name`

4. **Adress-Zugriff**
   - ❌ Alt: `sensor.location[i].address.country`
   - ✅ Neu: `sensor.location[i].country`

### 🟡 Wichtig - Sollte beachtet werden:

5. **Indoor-Flag**: `indoor === 1` statt `indoor === true`
6. **Zeitstempel**: `datetime.$date` statt `datetime` bei Exporten
7. **Aktuelle Werte**: `properties.values` statt `mapdata` Collection
8. **Index**: Compound Index auf `{sensorid: 1, "datetime.$date": 1}` essentiell!

### 🟢 Optional - Neue Features:

9. **Neue Metriken**: `hv_pulses`, `counts`, `sample_time_ms` verfügbar
10. **Location-Historie**: `location[].since` zeigt Gültigkeit
11. **Positionsgenauigkeit**: `exact_loc` (0=ungefähr, 1=exakt)
12. **Location-ID**: `location[].id` für eindeutige Identifikation

---

**Stand der Dokumentation:** 27. März 2026
