"use strict";

var express = require('express');
var router = express.Router();
var moment = require('moment');
const axios = require('axios');
var fs = require('fs');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// URL to get coordinates for cities
const NOMINATIM_URL="https://nominatim.openstreetmap.org/search?format=json&limit=3&q=";

// Mongo wird in app.js geöffnet und verbunden und bleibt immer verbunden !!

// Fetch the actual out of the dbase
router.get('/getaktdata/', async function (req, res) {
    var db = req.app.get('dbase');                                      // db wird in req übergeben (von app.js)
    let box = req.query.box;
    let poly = [];
    var collection = db.collection('properties');                       // Using properties collection now
    var aktData = [];                                                   // hier die daten sammeln
    var now = moment();                                                 // akt. Uhrzeit
    var lastDate = 0;
    let south=null,north=null,east=null,west=null;
    let loc = {};
    if(req.query.poly != undefined) {
        poly = JSON.parse(req.query.poly);
    }
    if (!((box == "") || (box == undefined))) {
        south = parseFloat(box[0][1]);
        north = parseFloat(box[1][1]);
        east = parseFloat(box[1][0]);
        west = parseFloat(box[0][0]);
        console.log("getaktdata: S=", south, " N=", north, " E=", east, " W=", west)
    }
    console.log("getaktdata: now fetching data from DB");

    // Build geo query - location is now in location array (last element)
    if(poly.length != 0) {
        loc = {
            'location.loc': {
                $geoWithin: {
                    $geometry: {
                        type: "Polygon",
                        coordinates: [poly],
                    }
                }
            },
            type: 'radioactivity'  // Only radiation sensors for map
        }
    } else if (south !== null) {
        loc = {
            'location.loc': {
                $geoWithin: {
                    $box: [
                        [west, south],
                        [east, north]
                    ]
                }
            },
            type: 'radioactivity'  // Only radiation sensors for map
        }
    } else {
        loc = {
            type: 'radioactivity'  // Only radiation sensors for map
        }
    }
    
    try {
        console.log("getaktdata: Query filter:", JSON.stringify(loc));
        let docs = await collection.find(loc).toArray();
        
        if (docs == null) {
            console.log("getaktdata: docs==null");
            res.json({"avgs": [], "lastDate": null});
            return;
        }
        console.log("getaktdata: data fetched, length=",docs.length);
        
        for (var i = 0; i < docs.length; i++) {
            var item = docs[i];
            
            // Skip if no values or no location
            if (!item.values || !item.location || item.location.length === 0) {
                continue;
            }
            
            // Get current location (last in array)
            let currentLoc = item.location[item.location.length - 1];
            
            // Get current name (last in array)
            let currentName = item.name;
            if (Array.isArray(item.name)) {
                currentName = item.name[item.name.length - 1].name;
            }
            
            var oneAktData = {};
            oneAktData['location'] = currentLoc.loc.coordinates;
            oneAktData['id'] = item._id;                                
            
            // Handle timestamp - might be in $date format
            let timestamp = item.values.timestamp;
            if (timestamp && timestamp.$date) {
                timestamp = new Date(timestamp.$date);
            } else {
                timestamp = new Date(timestamp);
            }
            
            oneAktData['lastSeen'] = timestamp;
            // Extract sensor type from name (e.g., "Radiation SBM-20" -> "SBM-20")
            oneAktData['name'] = currentName.replace('Radiation ', '');
            // indoor is now a number (0 or 1)
            oneAktData['indoor'] = currentLoc.indoor === 1;

            var dt = timestamp;
            if ((now - dt) >= (7  * 24 * 3600 * 1000)) {                  // älter als 1 Woche ->
                oneAktData['cpm'] = -2;                                   // -2 zurückgeben
            } else if ((now - dt) >= (2 * 3600 * 1000)) {                 // älter als 2 Stunde ->
                oneAktData['cpm'] = -1;                                   // -1 zurückgeben
            } else {
                oneAktData['cpm'] = -5;                                 // bedeutet -> nicht anzeigen
                if (item.values.hasOwnProperty('counts_per_minute')) {
                    oneAktData['cpm'] = item.values.counts_per_minute.toFixed(0);    // und merken
                }
                if (dt > lastDate) {
                    lastDate = dt;
                }
            }
            aktData.push(oneAktData);                                   // dies ganzen Werte nun in das Array
        }
        res.json({"avgs": aktData, "lastDate": lastDate});              // alles bearbeitet -> Array senden
    }
    catch(e) {
        console.log("Problem mit getaktdata", e);
        res.json({"avgs": [], "lastDate": null});
        return;
    }
});

// ===============================================================
// AKW (Nuclear Power Plant) FUNCTIONS
// ===============================================================

// Fetch all akw data out of the dbase
router.get('/getakwdata', async function (req, res) {
    const db = req.app.get('dbase');                        // db wird in req übergeben (von app.js)
    let collection = db.collection('akws');                 // die 'korrelation' verwenden
    let erg = [];
    let docs = [];
    console.log("getakwdata: now fetching data from DB");
    try {
        docs = await collection.find().toArray();                                // find all
        if (docs == null) {
            console.log("getakwdata: docs==null");
            res.json(erg);
            return;
        }
        console.log("getawkdata: data fetched from akws, length=",docs.length);
        for (var i = 0; i < docs.length; i++) {
            var item = docs[i];
            var oneAktData = {};
            oneAktData['location'] = {
                type: 'Point',
                coordinates: [item.lon, item.lat]
            };
            oneAktData['name'] = item.Name;
            oneAktData['active'] = item.Status == 'aktiv';
            oneAktData['start'] = item.Baujahr;
            oneAktData['end'] = item.Stillgeleg;
            oneAktData['type'] = item.Status === 'aktiv' ? 'akw_a' : 'akw_s';
            oneAktData['link'] = item.Wiki_Link;
            erg.push(oneAktData);                  // dies ganzen Werte nun in das Array
        }

        collection = db.collection('th1_akws');
        docs = await collection.find().toArray();
        if (docs == null) {
            console.log("getakwdata: docs==null");
            res.json(erg);
            return;
        }
        console.log("getawkdata: data fetched from th_akws, length=", docs.length);
        for (let i = 0; i < docs.length; i++) {
            const item = docs[i];
            let oneAktData = {};
            let loc = item.geo.substr(6).split(' ');
            let lon = parseFloat(loc[0]);
            let lat = parseFloat(loc[1]);
            oneAktData['location'] = {
                type: 'Point',
                coordinates: [lon, lat]
            };
            oneAktData['name'] = item.name;
            oneAktData['typeText'] = item.types;
            oneAktData['type'] = item.types == "Nuclear power plant" ? 'akw_a' : 'other';
            oneAktData['link'] = item.item;
            if (item.itemServiceretirement != undefined) {
                oneAktData['ende'] = item.itemServiceretirement.substr(0,4);
            }
            if (item.itemServiceentry != undefined) {
                oneAktData['begin'] = item.itemServiceentry.substr(0,4);
            }
            // Push only NOT 'Nuclear Power Plants' into data array
//            if(item.types != 'Nuclear power plant') {
                erg.push(oneAktData);
//            }
        }
        res.json(erg);
    }
    catch(e) {
        console.log("Problem mit getakwdata", e);
        res.json({"akws": [], "research": [], "fusion": [], "waste": [],});
        return;
    }
});

router.get('/getStuttgart/', function (req, res) {
    fs.readFile('public/Stuttgart.gpx',function(err,data) {
        res.send(data);
    })
});

router.get('/getcoord/', function (req, res) {
    getCoordinates(req.query.city)
        .then(erg => res.json(erg));
});

router.get('/getIcon/:col', function (req, res) {
    let color = req.params.col;
//    fs.readFile('public/radioak4_30.png',function(err,data) {
    fs.readFile('public/nuclear-'+color+'.svg',function(err,data) {
        res.send(data);
    })
});


router.get('/regionSensors/', function (req, res) {
    var db = req.app.get('dbase');                                      // db wird in req übergeben (von app.js)
    var spoints = JSON.parse(req.query.points);
    getRegionSensors(db,spoints)
        .then(erg => res.json(erg));
});

async function getRegionSensors(db,p) {
    let properties = [];
    let pcoll = db.collection("properties");
    
    properties = await pcoll.find({
            'location.loc': {
                $geoWithin: {
                    $geometry: {
                        type: "Polygon",
                        coordinates: [ p ],
                    }
                }
        },
        type: 'radioactivity'  // Only radiation sensors
    },{_id: 1, name: 1}
    ).toArray();
    
    let sids = [];
    properties.forEach(x => {
        sids.push(x._id);
    });
    console.log('Anzahl gefundene Sensoren:',sids.length);
    return sids;
}

router.get('/storeSensors/', function (req, res) {
    let data = req.query.sensors;
    fs.writeFile('stuttgart.txt',data,(err) => {
        if (err) throw(err);
        console.log("Sensoren gespeichert");
    });
});

async function getCoordinates(city) {
    let start = moment()
    let url = NOMINATIM_URL + city;
    const response = await axios.get(encodeURI(url));
    const data = response.data;
    if(data.length !== 0) {
        console.log(`Fetching of city ${city} needs ${(moment() - start) / 1000} seconds.`)
        return data[0];
    } else {
        console.log(`City ${city} not found` )
        return {lat: 0, lon: 0}
    }
}

module.exports = router;
