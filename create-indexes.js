// MongoDB Indexe für Geiger_WEB_26 Performance-Optimierung
// Führen Sie diese Datei mit: mongosh < create-indexes.js
// Oder: mongosh --eval "$(cat create-indexes.js)"

// Verbindung zur Datenbank (passen Sie ggf. an)
use allsensors;

print("=== STARTE INDEX-ERSTELLUNG ===\n");

// ============================================
// HÖCHSTE PRIORITÄT - Essentiell für Performance
// ============================================

print("1. Erstelle Index auf radioactivity_sensors (sensorid + datetime)...");
db.radioactivity_sensors.createIndex({ sensorid: 1, datetime: 1 });
print("   ✓ Fertig\n");

print("2. Erstelle Index auf thp_sensors (sensorid + datetime)...");
db.thp_sensors.createIndex({ sensorid: 1, datetime: 1 });
print("   ✓ Fertig\n");

print("3. Erstelle 2dsphere Index auf properties (location.loc)...");
db.properties.createIndex({ "location.loc": "2dsphere" });
print("   ✓ Fertig\n");

// ============================================
// HOHE PRIORITÄT - Stark empfohlen
// ============================================

print("4. Erstelle Compound Index auf properties (type + location)...");
db.properties.createIndex({ type: 1, "location.loc": "2dsphere" });
print("   ✓ Fertig\n");

// ============================================
// MITTLERE PRIORITÄT - Optimierung
// ============================================

print("5. Erstelle Index auf radioactivity_sensors (datetime absteigend)...");
db.radioactivity_sensors.createIndex({ datetime: -1 });
print("   ✓ Fertig\n");

print("6. Erstelle Index auf thp_sensors (datetime absteigend)...");
db.thp_sensors.createIndex({ datetime: -1 });
print("   ✓ Fertig\n");

// ============================================
// OPTIONAL - Zusätzliche Optimierungen
// ============================================

print("7. Erstelle Index auf properties (name.name)...");
db.properties.createIndex({ "name.name": 1 });
print("   ✓ Fertig\n");

print("8. Erstelle Index auf properties (location.country)...");
db.properties.createIndex({ "location.country": 1 });
print("   ✓ Fertig\n");

print("9. Erstelle Index auf problemsensors (problemNr)...");
db.problemsensors.createIndex({ problemNr: 1 });
print("   ✓ Fertig\n");

// ============================================
// Index-Übersicht anzeigen
// ============================================

print("\n=== INDEX-ÜBERSICHT ===\n");

print("Indexe auf radioactivity_sensors:");
printjson(db.radioactivity_sensors.getIndexes());

print("\nIndexe auf thp_sensors:");
printjson(db.thp_sensors.getIndexes());

print("\nIndexe auf properties:");
printjson(db.properties.getIndexes());

print("\n=== FERTIG! ===");
print("Alle Indexe wurden erfolgreich erstellt.");
print("Ihre Datenbank-Performance sollte jetzt deutlich besser sein!");
