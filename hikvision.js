const DigestFetch = require('digest-fetch');
const fetch = require('node-fetch');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

const HIKVISION_URL = process.env.HIKVISION_URL || "https://10.10.2.250";
const HIKVISION_USER = process.env.HIKVISION_USER || "admin";
const HIKVISION_PASS = process.env.HIKVISION_PASS || ""; // Requires .env

const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

const client = new DigestFetch(HIKVISION_USER, HIKVISION_PASS);

async function fetchLogs(startTime, endTime) {
    const url = `${HIKVISION_URL}/ISAPI/AccessControl/AcsEvent?format=json`;
    const searchID = uuidv4();
    let position = 0;
    const maxResults = 30;
    const allEvents = [];

    while (true) {
        const payload = {
            AcsEventCond: {
                searchID: searchID,
                searchResultPosition: position,
                maxResults: maxResults,
                major: 0,
                minor: 0,
                startTime: startTime,
                endTime: endTime
            }
        };

        const response = await client.fetch(url, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' },
            agent: httpsAgent
        });

        if (!response.ok) {
            console.error(`Error fetching logs: HTTP ${response.status}`);
            break;
        }

        const data = await response.json();
        const acsEvent = data.AcsEvent || {};
        const infoList = acsEvent.InfoList || [];

        if (infoList.length === 0) {
            break;
        }

        allEvents.push(...infoList);
        console.log(`Fetched ${allEvents.length} events so far...`);

        if (infoList.length < maxResults) {
            break;
        }

        position += maxResults;
    }

    return allEvents;
}

module.exports = { fetchLogs };
