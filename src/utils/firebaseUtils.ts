const MAX_INIT_RETRIES = 3;

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function loadPlayers() {
    let retryCount = 0;
    while (retryCount < MAX_INIT_RETRIES) {
        try {
            // Add initialization validation
            if (!isInitialized()) {
                throw new Error('Initialization failed.');
            }

            // Logic to load players
            const players = await fetchPlayersFromAPI();
            console.log('Players loaded successfully:', players);
            return players;
        } catch (error) {
            console.error(`Error loading players (attempt ${retryCount + 1}):`, error);
            retryCount++;
            await delay(Math.pow(2, retryCount) * 1000); // Exponential backoff
        }
    }
    throw new Error('Max retries reached for loading players.');
}

async function loadMatches() {
    let retryCount = 0;
    while (retryCount < MAX_INIT_RETRIES) {
        try {
            // Add initialization validation
            if (!isInitialized()) {
                throw new Error('Initialization failed.');
            }

            // Logic to load matches
            const matches = await fetchMatchesFromAPI();
            console.log('Matches loaded successfully:', matches);
            return matches;
        } catch (error) {
            console.error(`Error loading matches (attempt ${retryCount + 1}):`, error);
            retryCount++;
            await delay(Math.pow(2, retryCount) * 1000); // Exponential backoff
        }
    }
    throw new Error('Max retries reached for loading matches.');
}

function isInitialized() {
    // Your initialization logic here
    return true; // Change this based on actual initialization checks
}

async function fetchPlayersFromAPI() {
    // Your logic to fetch players
}

async function fetchMatchesFromAPI() {
    // Your logic to fetch matches
}