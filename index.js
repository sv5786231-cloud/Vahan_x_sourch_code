const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Helper: Delay function to bypass rate limits
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0'
];

const REFERERS = [
    'https://www.google.com/',
    'https://www.bing.com/',
    'https://duckduckgo.com/',
    'https://vahanx.in/'
];

/**
 * Core Scraping Logic with Retry Mechanism
 */
async function getVehicleDetails(vNo, attempt = 1) {
    const registrationNumber = vNo.toUpperCase().trim();
    const url = `https://vahanx.in/rc-search/${registrationNumber}`;

    try {
        // Human-like delay: Wait longer on subsequent attempts
        if (attempt > 1) {
            const waitTime = attempt * 2000;
            console.log(`Attempt ${attempt}: Waiting ${waitTime}ms before retry...`);
            await sleep(waitTime);
        }

        const response = await axios.get(url, {
            headers: {
                'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
                'Referer': REFERERS[Math.floor(Math.random() * REFERERS.length)],
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache'
            },
            timeout: 15000
        });

        // Check if we received a block page (Status 200 but no content)
        if (response.data.length < 1000) {
            throw new Error("EMPTY_OR_BLOCKED_RESPONSE");
        }

        const $ = cheerio.load(response.data);
        
        const extract_field = (label_text) => {
            let value = "Not Found";
            $('span').each((i, el) => {
                if ($(el).text().trim().toLowerCase() === label_text.toLowerCase()) {
                    const valTag = $(el).parent().find('p');
                    if (valTag.length > 0) {
                        value = valTag.text().trim();
                    }
                }
            });
            return value;
        };

        const data = {
            "Vehicle No": extract_field("Registration Number"),
            "Model Name": extract_field("Model Name"),
            "Maker Model": extract_field("Maker Model"),
            "Owner Name": extract_field("Owner Name"),
            "Father's Name": extract_field("Father's Name"),
            "Registered RTO": extract_field("Registered RTO"),
            "Owner Serial No": extract_field("Owner Serial No"),
            "Vehicle Type": extract_field("Vehicle Class"),
            "Fuel Type": extract_field("Fuel Type"),
            "Fuel Norms": extract_field("Fuel Norms"),
            "Chassis No": extract_field("Chassis Number"),
            "Engine No": extract_field("Engine Number"),
            "Registration Date": extract_field("Registration Date"),
            "Registration Upto": extract_field("Registration Upto"),
            "Fitness Upto": extract_field("Fitness Upto"),
            "PUC Upto": extract_field("PUC Upto"),
            "PUC No": extract_field("PUC Number"),
            "Insurance Upto": extract_field("Insurance Upto"),
            "Insurance No": extract_field("Insurance Number"),
            "Insurance Company": extract_field("Insurance Company"),
            "Insurance Expiry In": extract_field("Insurance Expiry In"),
            "Vehicle Age": extract_field("Vehicle Age"),
            "Finance": extract_field("Finance"),
            "Financer Name": extract_field("Financier Name")
        };

        // If the main fields are missing, the site might have "Shadow Blocked" us
        if (data["Vehicle No"] === "Not Found" && attempt < 3) {
            return await getVehicleDetails(vNo, attempt + 1);
        }

        return { success: true, data };

    } catch (error) {
        // Handle 429 specifically with a retry
        if ((error.response?.status === 429 || error.message === "EMPTY_OR_BLOCKED_RESPONSE") && attempt < 3) {
            return await getVehicleDetails(vNo, attempt + 1);
        }

        return { 
            success: false, 
            message: error.response?.status === 429 ? "Rate Limit Exceeded" : "Data Parsing Failed",
            error: error.message 
        };
    }
}

// --- API Endpoints ---

app.get('/', (req, res) => res.json({ status: "API is Live", time: new Date() }));

app.get('/api/vehicle/:vno', async (req, res) => {
    const result = await getVehicleDetails(req.params.vno);
    res.json(result);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Keep-Alive for Render (Self-Ping)
setInterval(() => {
    if (process.env.RENDER_EXTERNAL_HOSTNAME) {
        axios.get(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}/`).catch(() => {});
    }
}, 600000); // 10 minutes
