const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36'
];

// GLOBAL COOKIE JAR
let SESSION_COOKIE = "";

async function initSession() {
    try {
        const res = await axios.get("https://vahanx.in/", {
            headers: { "User-Agent": USER_AGENTS[0] },
            timeout: 10000
        });

        if (res.headers["set-cookie"]) {
            SESSION_COOKIE = res.headers["set-cookie"].join("; ");
        }
    } catch {}
}

async function fetchPage(url) {
    const headers = {
        "User-Agent": USER_AGENTS[Math.floor(Math.random()*USER_AGENTS.length)],
        "Accept": "text/html,application/xhtml+xml",
        "Referer": "https://vahanx.in/",
        "Cookie": SESSION_COOKIE,
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Connection": "keep-alive"
    };

    return axios.get(url, { headers, timeout: 15000 });
}

async function getVehicleDetails(vNo, attempt = 1) {
    const reg = vNo.toUpperCase().trim();
    const url = `https://vahanx.in/rc-search/${reg}`;

    try {
        if (!SESSION_COOKIE) await initSession();

        if (attempt > 1) {
            await sleep(2000 + Math.random()*2000);
        }

        const res = await fetchPage(url);
        const html = res.data;

        // Detect block page
        if (!html || html.length < 5000 || html.includes("Just a moment")) {
            if (attempt <= 3) {
                await initSession();
                return getVehicleDetails(vNo, attempt+1);
            }
            throw new Error("BLOCKED");
        }

        const $ = cheerio.load(html);

        const extract = (label) => {
            let value = "Not Found";

            $("span").each((i, el) => {
                const txt = $(el).text().trim().toLowerCase();
                if (txt === label.toLowerCase()) {
                    value = $(el).parent().find("p").text().trim() || "Not Found";
                }
            });

            return value;
        };

        const data = {
            "Vehicle No": extract("Registration Number"),
            "Model Name": extract("Model Name"),
            "Maker Model": extract("Maker Model"),
            "Owner Name": extract("Owner Name"),
            "Father Name": extract("Father's Name"),
            "RTO": extract("Registered RTO"),
            "Vehicle Type": extract("Vehicle Class"),
            "Fuel Type": extract("Fuel Type"),
            "Chassis": extract("Chassis Number"),
            "Engine": extract("Engine Number"),
            "Reg Date": extract("Registration Date"),
            "Reg Upto": extract("Registration Upto"),
            "Insurance": extract("Insurance Company"),
            "Insurance Upto": extract("Insurance Upto"),
            "Vehicle Age": extract("Vehicle Age"),
            "Finance": extract("Finance"),
            "Financer": extract("Financier Name")
        };

        if (data["Vehicle No"] === "Not Found") {
            if (attempt <= 3) {
                return getVehicleDetails(vNo, attempt+1);
            }
        }

        return { success: true, data };

    } catch (err) {
        if (attempt <= 3) {
            await initSession();
            return getVehicleDetails(vNo, attempt+1);
        }

        return {
            success: false,
            message: "Target site blocking or busy. Try later.",
            error: err.message
        };
    }
}

// ROUTES
app.get("/", (req,res)=>res.send("Vehicle API Running"));

app.get("/api/vehicle/:vno", async (req,res)=>{
    const result = await getVehicleDetails(req.params.vno);
    res.json(result);
});

app.listen(PORT, ()=>console.log("API running on", PORT));

// Keep Render alive
setInterval(()=>{
    if (process.env.RENDER_EXTERNAL_HOSTNAME) {
        axios.get(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}/`).catch(()=>{});
    }
},600000);
