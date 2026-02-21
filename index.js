const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Delay helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
];

async function getVehicleDetails(vNo, attempt = 1) {
    const registrationNumber = vNo.toUpperCase().trim();
    const url = `https://vahanx.in/rc-search/${registrationNumber}`;

    try {
        // Step 1: Mimic a real session by getting cookies from the home page first
        const initResponse = await axios.get('https://vahanx.in/', {
            headers: { 'User-Agent': USER_AGENTS[0] },
            timeout: 8000
        });
        const cookies = initResponse.headers['set-cookie'];

        // Step 2: Exponential backoff delay for retries
        if (attempt > 1) {
            console.log(`Retry attempt ${attempt} for ${registrationNumber}...`);
            await sleep(2000 * attempt); 
        }

        // Step 3: Fetch the actual data
        const response = await axios.get(url, {
            headers: {
                'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Referer': 'https://vahanx.in/',
                'Cookie': cookies ? cookies.join('; ') : '',
                'Cache-Control': 'no-cache'
            },
            timeout: 15000
        });

        const $ = cheerio.load(response.data);
        
        // Anti-Block Check: If page is too small or missing span tags
        if ($('span').length < 5) {
            if (attempt < 3) return await getVehicleDetails(vNo, attempt + 1);
            throw new Error("RATE_LIMITED_BY_TARGET");
        }

        const extract = (label) => {
            let val = "Not Found";
            $('span').each((i, el) => {
                if ($(el).text().trim().toLowerCase() === label.toLowerCase()) {
                    val = $(el).parent().find('p').text().trim() || "Not Found";
                }
            });
            return val;
        };

        const result = {
            "Vehicle No": extract("Registration Number"),
            "Model Name": extract("Model Name"),
            "Maker Model": extract("Maker Model"),
            "Owner Name": extract("Owner Name"),
            "Father's Name": extract("Father's Name"),
            "Registered RTO": extract("Registered RTO"),
            "Owner Serial No": extract("Owner Serial No"),
            "Vehicle Type": extract("Vehicle Class"),
            "Fuel Type": extract("Fuel Type"),
            "Fuel Norms": extract("Fuel Norms"),
            "Chassis No": extract("Chassis Number"),
            "Engine No": extract("Engine Number"),
            "Registration Date": extract("Registration Date"),
            "Registration Upto": extract("Registration Upto"),
            "Fitness Upto": extract("Fitness Upto"),
            "PUC Upto": extract("PUC Upto"),
            "PUC No": extract("PUC Number"),
            "Insurance Upto": extract("Insurance Upto"),
            "Insurance No": extract("Insurance Number"),
            "Insurance Company": extract("Insurance Company"),
            "Insurance Expiry In": extract("Insurance Expiry In"),
            "Vehicle Age": extract("Vehicle Age"),
            "Finance": extract("Finance"),
            "Financer Name": extract("Financier Name")
        };

        // If data is still blank, retry one last time
        if (result["Vehicle No"] === "Not Found" && attempt < 3) {
            return await getVehicleDetails(vNo, attempt + 1);
        }

        return { success: true, data: result };

    } catch (error) {
        if (attempt < 3 && (error.response?.status === 429 || error.code === 'ECONNABORTED')) {
            return await getVehicleDetails(vNo, attempt + 1);
        }
        return { 
            success: false, 
            message: "The server is currently busy or blocking requests. Try again in a few minutes.",
            error: error.message 
        };
    }
}

// Routes
app.get('/', (req, res) => res.status(200).send("Vehicle API Status: Active"));

app.get('/api/vehicle/:vno', async (req, res) => {
    const result = await getVehicleDetails(req.params.vno);
    res.json(result);
});

app.listen(PORT, () => console.log(`API running on port ${PORT}`));

// Keep Render Alive
setInterval(() => {
    if (process.env.RENDER_EXTERNAL_HOSTNAME) {
        axios.get(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}/`).catch(() => {});
    }
}, 600000);
