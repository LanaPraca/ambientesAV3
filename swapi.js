// StarWars API Code
const http = require("http");
const https = require("https");

// Configurações
const DEFAULT_TIMEOUT = 5000;
const MAX_STARSHIPS_DISPLAY = 3;
const PLANET_POPULATION_THRESHOLD = 1000000000;
const PLANET_DIAMETER_THRESHOLD = 10000;
const NUMERO_PORT = 3000;
const OK = 200;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const maxlastCharacterId = 4;
const HTTP_STATUS = {
    OK,
    BAD_REQUEST,
    NOT_FOUND,
};

// Estado da aplicação
const cache = {};
let debugMode = true;
let timeout = DEFAULT_TIMEOUT;
let errorCount = 0;
let fetchCount = 0;
let totalDataSize = 0;
let lastCharacterId = 1;

const tasks = [
    { endpoint: `people/${lastCharacterId}`, handler: displayCharacterDetails },
    { endpoint: "starships/?page=1", handler: displayStarships },
    { endpoint: "planets/?page=1", handler: displayLargePlanets },
    { endpoint: "films/", handler: displayFilmsChronologically },
];

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
            try {
                if (response.statusCode >= HTTP_STATUS.BAD_REQUEST) 
                    throw (new Error(`Request failed with status code ${response.statusCode}`));
                response.on("data", chunk => rawData += chunk);
                response.on("end", () => {
                    cache[endpoint] = JSON.parse(rawData);
                    debugLog(`Successfully fetched data for ${endpoint}`);
                    debugLog("Cache Size:", JSON.stringify(Object.keys(cache).length));
                    resolve(JSON.parse(rawData));
                });
            } catch (error) {
                reject(error);
            }
        });
        request.setTimeout(timeout, () => {
            request.abort();
            reject(new Error(`Request timeout for ${endpoint}`));
        });
        request.on("error", reject);
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

const knownNumber = numberOrString => numberOrString !== "unknown" && !Number.isNaN(Number(numberOrString));

//filtra se a populacao de um planeta passa do limite
function hasLargePopulation(planet) {
    return knownNumber(planet.population) && Number(planet.population) > PLANET_POPULATION_THRESHOLD;
}
//filtra se o diametro  de um planeta passa do limite
function hasLargeDiameter(planet) {
    return knownNumber(planet.diameter) && Number(planet.diameter) > PLANET_DIAMETER_THRESHOLD;
}

//filtra se o diametro e a populacao de um planeta passam dentro limite
function isBigPopulatedPlanet(planet) {
    return hasLargePopulation(planet) && hasLargeDiameter(planet);
}
//Filtra e exibe planetas com população e diâmetro elevados
function displayLargePlanets(planets) {
    console.log("\nLarge populated planets:");
    planets.results
        .filter(isBigPopulatedPlanet)
        .forEach(({ name, population, diameter, climate, films = [] }) => {
            console.log(
                `${name} - Pop: ${population} - Diameter: ${diameter} - Climate: ${climate}`
            );

            if (films.length) {
                console.log(`  Appears in ${films.length} film${films.length > 1 ? "s" : ""}`);
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

        for (const { endpoint, handler } of tasks) {
            const data = await fetchFromApi(endpoint);
            totalDataSize += JSON.stringify(data).length;
            handler(data);
        }

        if (lastCharacterId <= maxlastCharacterId) {
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
    /* global process */
    const paramsFromArg = 2;
    const args = process.argv.slice(paramsFromArg);
    if (args.includes("--no-debug")) debugMode = false;
    if (args.includes("--timeout")) {
        const index = args.indexOf("--timeout");
        if (index < args.length - 1) timeout = parseInt(args[index + 1]);
    }
}

function statsStringfied() {
    return JSON.stringify({
        api_calls: fetchCount,
        cache_size: Object.keys(cache).length,
        data_size: totalDataSize,
        errors: errorCount,
        debug: debugMode,
        timeout: timeout
    });
}

//Servidor HTTP
function startServer() {
    const server = http.createServer((req, res) => {
        if (req.url === "/" || req.url === "/index.html") {
            return renderHomePage(res);
        }

        if (req.url === "/api") {
            fetchStarWarsData();
            res.writeHead(HTTP_STATUS.OK, { "Content-Type": "text/plain" });
            return res.end("Check server console for results");
        }

        if (req.url === "/stats") {
            res.writeHead(HTTP_STATUS.OK, { "Content-Type": "application/json" });
            return res.end(statsStringfied());
        }

        res.writeHead(HTTP_STATUS.NOT_FOUND, { "Content-Type": "text/plain" });
        return res.end("Not Found");
    });

    const PORT = process.env.PORT || NUMERO_PORT;
    server.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
        console.log("Open the URL in your browser and click the button to fetch Star Wars data");
        debugLog("Debug mode: ON");
        debugLog("Timeout:", timeout, "ms");
    });
}
//HEAD com CSS
const PAGE_HEAD = /* html */ `
  <head>
    <title>Star Wars API Demo</title>
    <style>
      body   { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
      h1     { color: #FFE81F; background-color: #000; padding: 10px; }
      button { background-color: #FFE81F; border: none; padding: 10px 20px; cursor: pointer; }
      .footer{ margin-top: 50px; font-size: 12px; color: #666; }
      pre    { background: #f4f4f4; padding: 10px; border-radius: 5px; }
    </style>
  </head>
`;

//script for HTML
const PAGE_SCRIPT = /* html */ `
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
            `;

//Página HTML principal
function renderHomePage(res) {
    res.writeHead(HTTP_STATUS.OK, { "Content-Type": "text/html" });
    res.end(`
        <!DOCTYPE html>
        <html>
        ${PAGE_HEAD}
        <body>
            <h1>Star Wars API Demo</h1>
            <p>This page demonstrates fetching data from the Star Wars API.</p>
            <p>Check your console for the API results.</p>
            <button onclick="fetchData()">Fetch Star Wars Data</button>
            <div id="results"></div>
             ${PAGE_SCRIPT}
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
