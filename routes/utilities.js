"use strict";
const moment = require('moment');

// *********************************************
// Calculate moving average over the data array.
//
//  params:
//      data:       array of data
//      mav:        time in minutes to average
//      name:       name of sensor
//      api:        default=false,  true = API -> no akt. values
//
// return:
//      array with averaged values
// TODO <-----  die ersten Einträge in newData mit 0 füllen bis zum Beginn des average
// *********************************************
async function calcMovingAverage(db, sid, data, mav, api, factor) {
    var newDataT = [], newDataR = [];
    var avgTime = mav*60;           // average time in sec

    let havepressure = false;       // true: we have pressure

    if (avgTime === 0) {            // if there's nothing to average, then
        avgTime = 1;
    }
    // first convert date to timestamp (in secs)
    for (var i=0; i<data.length; i++) {
        // Handle both old datetime and new datetime.$date format
        if (data[i].datetime && data[i].datetime.$date) {
            data[i].datetime = (new Date(data[i].datetime.$date)) / 1000;
        } else {
            data[i].datetime = (new Date(data[i].datetime)) / 1000;
        }
    }

    let left=0, roll_sum3=0, roll_sum4=0, roll_sum5=0, roll_sum6=0;
    
    // Check if we have pressure data
    if(data[0] && data[0].values && data[0].values.pressure != undefined) {
        havepressure = true;
    } else if (data[0] && data[0].pressure != undefined) {
        havepressure = true;
    }
    
    for (let right =0; right <  data.length; right++) {
        // Handle values object (new structure)
        let temperature = data[right].values ? data[right].values.temperature : data[right].temperature;
        let humidity = data[right].values ? data[right].values.humidity : data[right].humidity;
        let pressure = data[right].values ? data[right].values.pressure : data[right].pressure;
        let counts_per_minute = data[right].values ? data[right].values.counts_per_minute : data[right].counts_per_minute;

        if (temperature != undefined) {
            roll_sum3 += temperature;
        }
        if (humidity != undefined) {
            roll_sum4 += humidity;
        }
        if (pressure != undefined) {
            roll_sum5 += pressure;
        }
        if (counts_per_minute != undefined) {
            roll_sum6 += counts_per_minute;
        }
        
        while (data[left].datetime <= data[right].datetime - avgTime) {
            let temp_left = data[left].values ? data[left].values.temperature : data[left].temperature;
            let humi_left = data[left].values ? data[left].values.humidity : data[left].humidity;
            let press_left = data[left].values ? data[left].values.pressure : data[left].pressure;
            let cpm_left = data[left].values ? data[left].values.counts_per_minute : data[left].counts_per_minute;
            
            if (temp_left != undefined) {
                roll_sum3 -= temp_left;
            }
            if (humi_left != undefined) {
                roll_sum4 -= humi_left;
            }
            if (press_left != undefined) {
                roll_sum5 -= press_left;
            }
            if (cpm_left != undefined) {
                roll_sum6 -= cpm_left;
            }
            left += 1;
        }
        
        if (api == true) {
            newDataT[right] = {'dt': moment.unix(data[right].datetime)};
            if (roll_sum3 != 0) newDataT[right]['T'] = (roll_sum3 / (right - left + 1)).toFixed(1);
            if (roll_sum4 != 0) newDataT[right]['H'] = (roll_sum4 / (right - left + 1)).toFixed(0);
            if (roll_sum5 != 0) newDataT[right]['P'] = (roll_sum5 / (right - left + 1)).toFixed(2);

            newDataR[right] = {'date': data[right].datetime * 1000};
            if (roll_sum6 != 0) newDataR[right]['cpm'] = roll_sum6 / (right - left + 1);
        } else {
            newDataT[right] = {'date': data[right].datetime * 1000};
            if (roll_sum3 != 0) newDataT[right]['temp_mav'] = roll_sum3 / (right - left + 1);
            if (roll_sum4 != 0) newDataT[right]['humi_mav'] = roll_sum4 / (right - left + 1);
            if (roll_sum5 != 0) newDataT[right]['press_mav'] = roll_sum5 / (right - left + 1);

            newDataR[right] = {'_id':  moment.unix(data[right].datetime).toDate()};
            if (roll_sum6 != 0) {
                let val = roll_sum6 / (right - left + 1);
                newDataR[right]['cpmAvg'] = val;
                newDataR[right]['uSvphAvg'] = val * factor;
            }
        }
    }
    if (havepressure == true) {
        let altitude = await getAltitude(db, sid);
        if (api == true) {
            newDataT = calcSealevelPressure(newDataT, 'P', altitude);
            for (let i = 0; i < newDataT.length; i++) {
                newDataT[i].P = (newDataT[i].P / 100).toFixed(0);
            }
        } else {
            newDataT = calcSealevelPressure(newDataT, 'press_mav', altitude);
        }
    }
    if (api == true) {
        // Return THP or Radiation data depending on what's available
        return (roll_sum3 != 0 || roll_sum4 != 0 || roll_sum5 != 0) ? newDataT : newDataR;
    }
    return { 'THP' : newDataT , 'RAD' : newDataR};
}

// Berechnung des barometrischen Druckes auf Seehöhe
//
// Formel (lt. WikiPedia):
//
//  p[0] = p[h] * ((T[h] / (T[h] + 0,0065 * h) ) ^-5.255)
//
//  mit
//		p[0]	Druck auf NN (in hPa)
//		p[h]	gemessener Druck auf Höhe h (in m)
//		T[h]	gemessene Temperatur auf Höhe h in K (== t+273,15)
//		h		Höhe über NN in m
//
//  press	->	aktuelle Druck am Ort
//	temp	->	aktuelle Temperatur
//  alti	-> Höhe über NN im m
//
// NEU NEU NEU
// Formel aus dem BMP180 Datenblatt
//
//  p0 = ph / pow(1.0 - (altitude/44330.0), 5.255);
//
//
//
//	Rückgabe: normierter Druck auf Sehhhöhe
//
function calcSealevelPressure(data, p, alti) {
    if (!((alti == 0) || (alti == undefined))) {
        for (let i = 0; i < data.length; i++) {
            if (p=='') {
                data[i] = data[i] / Math.pow(1.0 - (alti / 44330.0), 5.255);
            } else {
                data[i][p] = data[i][p] / Math.pow(1.0 - (alti / 44330.0), 5.255);
            }
        }
    }
    return data
}

// Aus der 'properties'-collection die altitude für die
// übergebene sid rausholen
async function getAltitude(db,sid) {
    let collection = db.collection('properties');
    try {
        let values = await collection.findOne({"_id":sid});
        return values.location[values.location.length-1].altitude;
    }
    catch(e) {
        console.log("GetAltitude Error",e);
        return 0
    }
}

// Get address from coordinates using OpenStreetMap Nominatim API
// params: db, sensorid
// returns: {address: {street, plz, city}, err}
async function getAddress(db, sid) {
    const axios = require('axios');
    let ret = {address: {street: "", plz: "", city: ""}, err: null};
    
    // Get sensor properties to extract coordinates
    let collection = db.collection('properties');
    let props;
    try {
        props = await collection.findOne({"_id": sid});
        if (!props || !props.location || props.location.length === 0) {
            return {address: ret.address, err: "No location found for sensor"};
        }
    } catch(e) {
        console.log("getAddress - DB Error:", e);
        return {address: ret.address, err: e.message};
    }
    
    // Get coordinates from last location entry
    let coord = props.location[props.location.length - 1].loc.coordinates;
    let lat = coord[1];
    let lon = coord[0];
    
    // Call Nominatim API for reverse geocoding
    let url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    
    try {
        const response = await axios(encodeURI(url), {
            headers: {
                'User-Agent': 'MultiGeiger-Web/2.9.6'  // Nominatim requires User-Agent
            }
        });
        
        if (response.status !== 200) {
            return {address: ret.address, err: `Nominatim API returned status ${response.status}`};
        }
        
        let akt = response.data.address;
        
        // Try to find city name in various fields
        const CITY = ['city', 'town', 'village', 'suburb', 'county'];
        let city = "unknown";
        for (let c of CITY) {
            if(akt[c] !== undefined) {
                city = akt[c];
                break;
            }
        }
        
        ret.address = {
            street: (akt.road ? akt.road : ""), 
            plz: (akt.postcode ? akt.postcode : ""), 
            city: city
        };
    } catch (e) {
        console.log("getAddress - API Error:", e.message);
        return {address: ret.address, err: e.message};
    }
    
    return ret;
}

module.exports.calcMovingAverage = calcMovingAverage;
module.exports.calcSealevelPressure = calcSealevelPressure;
module.exports.getAltitude = getAltitude;
module.exports.getAddress = getAddress;
