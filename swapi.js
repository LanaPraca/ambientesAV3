// StarWars API Code
const http = require("http");
const https = require("https");

// Configurações
const DEFAULT_TIMEOUT = 5000;
const MAX_STARSHIPS_DISPLAY = 3;
const PLANET_POPULATION_THRESHOLD = 1000000000;
const PLANET_DIAMETER_THRESHOLD = 10000;

// Estado da aplicação
const cache = {};
let debugMode = true;
let timeout = DEFAULT_TIMEOUT;
let errorCount = 0;
let fetchCount = 0;
let totalDataSize = 0;
let lastCharacterId = 1;

// Log de depuração condicional
function debugLog(...args) {
    if (debugMode) console.log(...args);
}

//Lida com erros e atualiza contador
function handleError(message) {
    errorCount++;
    console.error("Error:", message);
}

//Busca dados da API com cache
async function fetchFromApi(endpoint) {
    if (cache[endpoint]) {
        debugLog("Using cached data for", endpoint);
        return cache[endpoint];
    }

    return new Promise((resolve, reject) => {
        let rawData = "";
        const request = https.get(`https://swapi.dev/api/${endpoint}`, { rejectUnauthorized: false }, (response) => {
            if (response.statusCode >= 400) {
                return reject(new Error(`Request failed with status code ${response.statusCode}`));
            }

            response.on("data", chunk => rawData += chunk);
            response.on("end", () => {
                try {
                    const parsedData = JSON.parse(rawData);
                    cache[endpoint] = parsedData;
                    debugLog(`Successfully fetched data for ${endpoint}`);
                    resolve(parsedData);
                } catch (error) {
                    reject(error);
                }
            });
        });

        request.on("error", reject);

        request.setTimeout(timeout, () => {
            request.abort();
            reject(new Error(`Request timeout for ${endpoint}`));
        });
    });
}

// Exibe detalhes de uma pessoa
function displayCharacterDetails(character) {
    console.log("Character:", character.name);
    console.log("Height:", character.height);
    console.log("Mass:", character.mass);
    console.log("Birthday:", character.birth_year);
    if (character.films?.length > 0) {
        console.log("Appears in", character.films.length, "films");
    }
}

//Exibe uma lista de naves
function displayStarships(starships) {
    console.log("\nTotal Starships:", starships.count);
    starships.results.slice(0, MAX_STARSHIPS_DISPLAY).forEach((ship, index) => {
        console.log(`\nStarship ${index + 1}:`);
        console.log("Name:", ship.name);
        console.log("Model:", ship.model);
        console.log("Manufacturer:", ship.manufacturer);
        console.log("Cost:", ship.cost_in_credits !== "unknown" ? `${ship.cost_in_credits} credits` : "unknown");
        console.log("Speed:", ship.max_atmosphering_speed);
        console.log("Hyperdrive Rating:", ship.hyperdrive_rating);
        if (ship.pilots?.length > 0) {
            console.log("Pilots:", ship.pilots.length);
        }
    });
}

//Filtra e exibe planetas com população e diâmetro elevados
function displayLargePlanets(planets) {
    console.log("\nLarge populated planets:");
    planets.results.forEach(planet => {
        if (
            planet.population !== "unknown" && parseInt(planet.population) > PLANET_POPULATION_THRESHOLD &&
            planet.diameter !== "unknown" && parseInt(planet.diameter) > PLANET_DIAMETER_THRESHOLD
        ) {
            console.log(`${planet.name} - Pop: ${planet.population} - Diameter: ${planet.diameter} - Climate: ${planet.climate}`);
            if (planet.films?.length > 0) {
                console.log(`  Appears in ${planet.films.length} films`);
            }
        }
    });
}

//Ordena e exibe os filmes por data de lançamento
function displayFilmsChronologically(films) {
    console.log("\nStar Wars Films in chronological order:");
    const sortedFilms = films.results.sort((a, b) => new Date(a.release_date) - new Date(b.release_date));
    sortedFilms.forEach((film, i) => {
        console.log(`${i + 1}. ${film.title} (${film.release_date})`);
        console.log(`   Director: ${film.director}`);
        console.log(`   Producer: ${film.producer}`);
        console.log(`   Characters: ${film.characters.length}`);
        console.log(`   Planets: ${film.planets.length}`);
    });
}

//Exibe um veículo específico
function displayVehicle(vehicle) {
    console.log("\nFeatured Vehicle:");
    console.log("Name:", vehicle.name);
    console.log("Model:", vehicle.model);
    console.log("Manufacturer:", vehicle.manufacturer);
    console.log("Cost:", vehicle.cost_in_credits, "credits");
    console.log("Length:", vehicle.length);
    console.log("Crew Required:", vehicle.crew);
    console.log("Passengers:", vehicle.passengers);
}

//Função principal
async function fetchStarWarsData() {
    try {
        debugLog("Starting data fetch...");
        fetchCount++;

        const character = await fetchFromApi(`people/${lastCharacterId}`);
        totalDataSize += JSON.stringify(character).length;
        displayCharacterDetails(character);

        const starships = await fetchFromApi("starships/?page=1");
        totalDataSize += JSON.stringify(starships).length;
        displayStarships(starships);

        const planets = await fetchFromApi("planets/?page=1");
        totalDataSize += JSON.stringify(planets).length;
        displayLargePlanets(planets);

        const films = await fetchFromApi("films/");
        totalDataSize += JSON.stringify(films).length;
        displayFilmsChronologically(films);

        if (lastCharacterId <= 4) {
            const vehicle = await fetchFromApi(`vehicles/${lastCharacterId}`);
            totalDataSize += JSON.stringify(vehicle).length;
            displayVehicle(vehicle);
            lastCharacterId++;
        }

        debugLog("\nStats:");
        debugLog("API Calls:", fetchCount);
        debugLog("Cache Size:", Object.keys(cache).length);
        debugLog("Total Data Size:", totalDataSize, "bytes");
        debugLog("Error Count:", errorCount);

    } catch (err) {
        handleError(err.message);
    }
}

//Processa argumentos da linha de comando
function processCommandLineArgs() {
    const args = process.argv.slice(2);
    if (args.includes("--no-debug")) debugMode = false;
    if (args.includes("--timeout")) {
        const index = args.indexOf("--timeout");
        if (index < args.length - 1) timeout = parseInt(args[index + 1]);
    }
}

//Servidor HTTP
function startServer() {
    const server = http.createServer((req, res) => {
        if (req.url === "/" || req.url === "/index.html") {
            return renderHomePage(res);
        }

        if (req.url === "/api") {
            fetchStarWarsData();
            res.writeHead(200, { "Content-Type": "text/plain" });
            return res.end("Check server console for results");
        }

        if (req.url === "/stats") {
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({
                api_calls: fetchCount,
                cache_size: Object.keys(cache).length,
                data_size: totalDataSize,
                errors: errorCount,
                debug: debugMode,
                timeout: timeout
            }));
        }

        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
    });

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
        console.log("Open the URL in your browser and click the button to fetch Star Wars data");
        debugLog("Debug mode: ON");
        debugLog("Timeout:", timeout, "ms");
    });
}

//Página HTML principal
function renderHomePage(res) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Star Wars API Demo</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                h1 { color: #FFE81F; background-color: #000; padding: 10px; }
                button { background-color: #FFE81F; border: none; padding: 10px 20px; cursor: pointer; }
                .footer { margin-top: 50px; font-size: 12px; color: #666; }
                pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
            </style>
        </head>
        <body>
            <h1>Star Wars API Demo</h1>
            <p>This page demonstrates fetching data from the Star Wars API.</p>
            <p>Check your console for the API results.</p>
            <button onclick="fetchData()">Fetch Star Wars Data</button>
            <div id="results"></div>
            <script>
                function fetchData() {
                    document.getElementById('results').innerHTML = '<p>Loading data...</p>';
                    fetch('/api')
                        .then(res => res.text())
                        .then(() => {
                            alert('API request made! Check server console.');
                            document.getElementById('results').innerHTML = '<p>Data fetched! Check server console.</p>';
                        })
                        .catch(err => {
                            document.getElementById('results').innerHTML = '<p>Error: ' + err.message + '</p>';
                        });
                }
            </script>
            <div class="footer">
                <p>API calls: ${fetchCount} | Cache entries: ${Object.keys(cache).length} | Errors: ${errorCount}</p>
                <pre>Debug mode: ${debugMode ? "ON" : "OFF"} | Timeout: ${timeout}ms</pre>
            </div>
        </body>
        </html>
    `);
}

// Inicialização
processCommandLineArgs();
startServer();
