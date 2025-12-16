// --- JSON till CSV Konverteringsskript ---
const fs = require('fs');
const path = require('path');

// FILNAMN
// Utdatafilen för den sammanfogade CSV-datan
const OUTPUT_FILE_NAME = 'foretag_data.csv';
// MÖNSTER för de JSON-filer som skapades av API-anroparen
const INPUT_FILE_PATTERN = /^foretag_(\d+)\.json$/; 


// Funktionen för konvertering kommer nu att hämta alla rubriker dynamiskt.
// Vi tar bort den hårdkodade listan DESIRED_HEADERS.


/**
 * Funktion för att konvertera en array av JSON-objekt till en CSV-sträng
 * @param {Array<Object>} data - Array av JSON-objekt.
 * @param {boolean} includeHeader - Om rubrikraden ska inkluderas.
 * @returns {string} - Innehållet i CSV-format.
 */
function jsonToCsv(data, includeHeader) {
    if (!data || data.length === 0) {
        return "";
    }

    // 1. EXTRAHERAR ALLA rubriker (nycklar) dynamiskt från det första objektet.
    const headers = Object.keys(data[0]);

    let csvContent = '';

    // 2. Skapa rubrikraden (header row) ENDAST om includeHeader är sant
    if (includeHeader) {
        csvContent += headers.join(';') + '\n';
    }

    // 3. Skapa dataraderna
    const csvRows = data.map(row => {
        // Mappar varje fältvärde till en sträng, omsluter med citattecken
        const values = headers.map(header => {
            let value = row[header] || ''; // Hantera null/undefined
            
            // Konvertera till sträng och escapa citattecken
            value = String(value).replace(/"/g, '""'); 

            // Omslut värdet i citattecken om det innehåller mellanslag eller semikolon
            if (value.includes(';') || value.includes(' ') || value.includes(',')) {
                return `"${value}"`;
            }
            return value;
        });
        return values.join(';');
    });

    csvContent += csvRows.join('\n');
    return csvContent;
}


/**
 * Läser in alla JSON-filer som matchar mönstret och sammanfogar dem till en CSV-fil.
 */
function mergeAndConvertAll() {
    const files = fs.readdirSync(__dirname);
    let allData = [];
    let isFirstFile = true;
    let totalRows = 0;
    
    // Raderar gammal CSV-fil innan vi börjar bygga upp den nya
    const outputPath = path.join(__dirname, OUTPUT_FILE_NAME);
    if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
    }
    
    console.log(`\n--- STARTAR SAMMANFOGNING TILL CSV ---`);

    for (const file of files) {
        if (INPUT_FILE_PATTERN.test(file)) {
            const inputPath = path.join(__dirname, file);
            console.log(`Bearbetar: ${file}`);

            try {
                const jsonData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

                if (Array.isArray(jsonData) && jsonData.length > 0) {
                    // Konvertera och skriv till CSV. Inkludera rubrik endast för första filen.
                    const csvContent = jsonToCsv(jsonData, isFirstFile);
                    
                    // Skriv till filen. Använd appendFileSync för att lägga till data.
                    fs.appendFileSync(outputPath, csvContent + '\n', 'utf8');

                    totalRows += jsonData.length;
                    isFirstFile = false; // Rubriken ska inte inkluderas igen
                }
            } catch (e) {
                console.error(`VARNING: Kunde inte bearbeta eller parsa ${file}:`, e.message);
            }
        }
    }
    
    if (totalRows > 0) {
        console.log('\n--- SAMMANFOGNING KLAR ---');
        console.log(`✅ Totalt ${totalRows} rader konverterade och sparade.`);
        console.log(`✅ CSV-fil sparat till: ${OUTPUT_FILE_NAME}`);
        console.log(`Filen innehåller nu data från alla JSON-filer.`);
    } else {
        console.log("\nInga JSON-filer hittades eller de var tomma. Ingen CSV-fil skapades.");
    }
}

// Kör sammanfogningsfunktionen direkt
mergeAndConvertAll();