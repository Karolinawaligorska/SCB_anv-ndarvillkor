// --- INNAN KÖRNING: KÖR npm install dotenv I TERMINALEN FÖR ATT INSTALLERA DENNA MODUL ---
// Ladda miljövariabler från .env-filen
require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');


// --- FILNAMN FÖR UTDATA ---
const OUTPUT_FILE_NAME = 'foretag_stockholm_bransch_test.json';


// --- KONFIGURATION ---
const API_HOST = 'privateapi.scb.se';
// Återgår till sök-endpointen för Juridiska Enheter (JE)
const API_PATH = '/nv0101/v1/sokpavar/api/Je/KategorierMedKodtabeller'; 

// Sökväg till PFX-certifikatet
const PFX_FILE_PATH = path.join(__dirname, 'certs/Certifikat_SokPaVar_A00525_2025-10-14 16-39-56Z.pfx');
const PFX_PASS = process.env.PFX_PASSWORD;
const API_ID = process.env.SCB_API_ID;


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
    "OrgNr",  
    "Namn",               
    "Firma",
    "Postadress",
    "Besöksadress",
    "Telefon",
    "E-post",
    "Startdatum",
    "Reklam"              
 ];


// Payload som skickas till SCB API:et (Server-side begäran)
const requestBody = {
    // Använder singular "VariabelBeskrivning"
    "VariabelBeskrivning": requestedOutputVariables,
    
    // Filtrerar på aktiva företag
    "Företagsstatus": "1", 
    
    // FILTRERING: En bransch och ett län
    "Kategorier": [
        // 1. Filtrering på 5-siffrig branschnivå (Endast en kod: Sågning av trä)
        {
             "Kategori": "Bransch",
             "Branschnivå": "3", 
             // FIX: Endast en kod i listan för att testa om det löser säkerhetsspärren
             "Kod": [ "16101" ] // Sågning av trä
        },
        // 2. Filtrering på Län (Stockholm)
        {
            "Kategori": "SätesLän", 
            "Kod": ["01"] // Stockholm Län
        }
    ]
};


const jsonPayload = JSON.stringify(requestBody);


// --- HTTPS REQUEST OPTIONS ---
const options = {
    hostname: API_HOST,
    port: 443,
    path: API_PATH,
    method: 'POST', // Denna typ av begäran kräver POST
    pfx: pfx,
    passphrase: PFX_PASS,
    headers: {
      'Accept': 'application/json',
      'X-SCB-API-ID': API_ID,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(jsonPayload)
    }
};


// --- SKICKA ANROP ---
console.log(`Försöker ansluta till: https://${API_HOST}${API_PATH}`);
console.log('Skickar POST-anrop med extremt begränsad sökning (Bransch 16101 i Stockholm). Payload:');
console.log(JSON.stringify(requestBody, null, 2));


const req = https.request(options, (res) => {
    console.log(`HTTP-STATUS: ${res.statusCode}`);

    if (res.statusCode !== 200) {
        console.error(`API-anropet misslyckades. SCB returnerade status ${res.statusCode}.`);
        console.error(`KONTROLLERA: 1) PFX-certifikatet, 2) API_ID, 3) URL/Path.`);
        res.on('data', (chunk) => console.log('Svarstext från servern:', chunk.toString()));
        return;
    }


    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });


    res.on('end', () => {
        try {
            const jsonData = JSON.parse(data);

            if (Array.isArray(jsonData) && jsonData.length > 0) {

                // Skriver det RÅA JSON-svaret till fil.
                fs.writeFileSync(OUTPUT_FILE_NAME, JSON.stringify(jsonData, null, 2), 'utf8');

                console.log('\n--- DATAHÄMTNING KLAR ---');
                console.log(`✅ Rå JSON-data sparat till fil: ${OUTPUT_FILE_NAME}`);
                console.log(`Antal företag/poster i svaret: ${jsonData.length}`);

            } else {
                console.log("\nInga poster matchade eller oväntat tomt svar. Ingen fil skapades.");
                console.log("Rådata (första 500 tecken):", data.substring(0, 500) + '...');
            }

        } catch (e) {
          console.error('Kunde inte parsa JSON eller oväntat svar:', e.message);
          console.log('Rådata (första 500 tecken):', data.substring(0, 500) + '...');
        }
    });
});


req.on('error', (e) => {
    console.error(`PROBLEM MED ANROP (TLS/Nätverk): ${e.message}`);
});


// SKICKA REQUEST BODY OCH AVSLUTA ANROPET
req.write(jsonPayload);
req.end();