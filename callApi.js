// --- INNAN KÖRNING: KÖR npm install dotenv I TERMINALEN FÖR ATT INSTALLERA DENNA MODUL ---
// Ladda miljövariabler från .env-filen
require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');


// --- KONFIGURATION ---
const API_HOST = 'privateapi.scb.se';
const API_PATH = '/nv0101/v1/sokpavar/api/Je/HamtaForetag'; 

// Sökväg till PFX-certifikatet
const PFX_FILE_PATH = path.join(__dirname, 'certs/Certifikat_SokPaVar_A00525_2025-10-14 16-39-56Z.pfx');
const PFX_PASS = process.env.PFX_PASSWORD;
const API_ID = process.env.SCB_API_ID;


// --- KOMMUNFILTER: Alla kommuner i Stockholms Län (01) ---
// Använder kommuner i Stockholms län för att segmentera den stora sökningen.
const MUNICIPALITY_CODES = [
'0114','0115','0117','0120','0123','0125','0126','0127','0128','0136','0138','0139','0140','0160','0162','0163','0180','0181','0182','0183','0184','0186','0187','0188','0191','0192','0305','0319','0330','0331','0360','0380','0381','0382','0428','0461','0480','0481','0482','0483','0484','0486','0488','0509','0512','0513','0560','0561','0562','0563','0580','0581','0582','0583','0584','0586','0604','0617','0642','0643','0662','0665','0680','0682','0683','0684','0685','0686','0687','0760','0761','0763','0764','0765','0767','0780','0781','0821','0834','0840','0860','0861','0862','0880','0881','0882','0883','0884','0885','0980','1060','1080','1081','1082','1083','1214','1230','1231','1233','1256','1257','1260','1261','1262','1263','1264','1265','1266','1267','1270','1272','1273','1275','1276','1277','1278','1280','1281','1282','1283','1284','1285','1286','1287','1290','1291','1292','1293','1315','1380','1381','1382','1383','1384','1401','1402','1407','1415','1419','1421','1427','1430','1435','1438','1439','1440','1441','1442','1443','1444','1445','1446','1447','1452','1460','1461','1462','1463','1465','1466','1470','1471','1472','1473','1480','1481','1482','1484','1485','1486','1487','1488','1489','1490','1491','1492','1493','1494','1495','1496','1497','1498','1499','1715','1730','1737','1760','1761','1762','1763','1764','1765','1766','1780','1781','1782','1783','1784','1785','1814','1860','1861','1862','1863','1864','1880','1881','1882','1883','1884','1885','1904','1907','1960','1961','1962','1980','1981','1982','1983','1984','2021','2023','2026','2029','2031','2034','2039','2061','2062','2080','2081','2082','2083','2084','2085','2101','2104','2121','2132','2161','2180','2181','2182','2183','2184','2260','2262','2280','2281','2282','2283','2284','2303','2305','2309','2313','2321','2326','2361','2380','2401','2403','2404','2409','2417','2418','2421','2422','2425','2460','2462','2463','2480','2481','2482','2505','2506','2510','2513','2514','2518','2521','2523','2560','2580','2581','2582','2583','2584'
];


// --- Validering ---
if (!PFX_PASS || !API_ID) {
  console.error("FEL: Kontrollera att PFX_PASSWORD och SCB_API_ID är inställda i filen .env.");
  process.exit(1);
}

let pfx;
try {
  pfx = fs.readFileSync(PFX_FILE_PATH);
} catch (e) {
  console.error(`FEL: Kunde inte läsa PFX-filen på sökvägen: ${PFX_FILE_PATH}. Kontrollera filnamn och mapp.`);
  console.error(e.message);
  process.exit(1);
}
// --- Slut Validering ---


// DEFINIERAR VILKA VARIABLER SOM SKA HÄMTAS I UTDATA
const requestedOutputVariables = [
    "OrgNr (12 siffror)", 
    "Namn",               
    "Firma",
    "Postadress",
    "Besöksadress",
    "Telefon",
    "E-post",
    "Startdatum",
    "Reklam"              
 ];


/**
 * Skickar ett API-anrop för en specifik kommun.
 * @param {string} municipalityCode - Kommunens kod (t.ex. '0880').
 */
function makeApiCall(municipalityCode) {
    // Sparar resultatet till en unik fil för varje kommun
    const OUTPUT_FILE_NAME = `foretag_${municipalityCode}.json`;
    
    // Payload som skickas till SCB API:et (Server-side begäran)
    const requestBody = {
        "VariabelBeskrivning": requestedOutputVariables,
        "Företagsstatus": "1", 
        "Kategorier": [
            // 1. Branschfilter (Lång lista med 5-siffriga SNI-koder)
            {
                 "Kategori": "Bransch",
                 "BranschNiva": "3", // Korrekt versalisering
                 "Kod": [
                     // 42xx Anläggningsarbeten
                "23510","23520",
                "68110","68120",
                    "68201","68202","68203","68204","608209",
                        "68310","68320"

                     
                                     ] 
            },
            // 2. GEOGRAFISKT FILTER: Filtrering på SätesKommun (Korrigerat)
            {
                "Kategori": "SätesKommun", // FIX: Använder det korrekta kategorinamnet
                "Kod": [municipalityCode] // Filtrera på aktuell kommun
            }
        ]
    };
    
    const jsonPayload = JSON.stringify(requestBody);
    
    // --- HTTPS REQUEST OPTIONS ---
    const options = {
        hostname: API_HOST,
        port: 443,
        path: API_PATH,
        method: 'POST',
        pfx: pfx,
        passphrase: PFX_PASS,
        headers: {
          'Accept': 'application/json',
          'X-SCB-API-ID': API_ID,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(jsonPayload)
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            console.log(`\n--- ANROP FÖR KOMMUN ${municipalityCode} ---`);
            console.log(`HTTP-STATUS: ${res.statusCode}`);

            if (res.statusCode !== 200) {
                console.error(`API-anropet misslyckades. SCB returnerade status ${res.statusCode}.`);
                res.on('data', (chunk) => console.log('Svarstext från servern:', chunk.toString()));
                // Gå vidare till nästa kommun även vid fel
                return resolve(false); 
            }
            
            let data = '';
            res.on('data', (chunk) => { data += chunk; });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);

                    if (Array.isArray(jsonData) && jsonData.length > 0) {
                        // Skriver det RÅA JSON-svaret till unik fil.
                        fs.writeFileSync(OUTPUT_FILE_NAME, JSON.stringify(jsonData, null, 2), 'utf8');
                        console.log(`✅ Rå JSON-data sparat till fil: ${OUTPUT_FILE_NAME}`);
                        console.log(`Antal företag/poster i svaret: ${jsonData.length}`);
                    } else {
                        console.log(`Inga poster hittades för kommun ${municipalityCode}. Ingen fil skapades.`);
                    }
                    resolve(true);

                } catch (e) {
                    console.error('Kunde inte parsa JSON eller oväntat svar:', e.message);
                    resolve(false);
                }
            });
        });

        req.on('error', (e) => {
            console.error(`PROBLEM MED ANROP (TLS/Nätverk): ${e.message}`);
            reject(e);
        });

        req.write(jsonPayload);
        req.end();
    });
}


/**
 * Kör alla API-anrop sekventiellt (efter varandra) för att undvika överbelastning.
 */
async function runAllCalls() {
    console.log(`Startar ${MUNICIPALITY_CODES.length} anrop sekventiellt (Stockholms Län).`);
    for (const code of MUNICIPALITY_CODES) {
        // Lägger till en liten fördröjning för att ytterligare minska risken för rate-limiting
        await new Promise(resolve => setTimeout(resolve, 500)); 
        await makeApiCall(code);
    }
    console.log('\n--- ALLA ANROP KLARA ---');
    console.log('Kör nu convert_json_to_csv.js för att sammanfoga till en CSV-fil.');
}

runAllCalls();