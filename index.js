const fs = require('fs');
const readline = require('readline');
const { ethers } = require('ethers');
const dotenv = require('dotenv');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

dotenv.config();

const colors = {
    reset: "\x1b[0m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    white: "\x1b[37m",
    bold: "\x1b[1m",
};

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
];
function randomUA() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}
function parseProxy(proxyLine) {
    let proxy = proxyLine.trim();
    if (!proxy) return null;
    proxy = proxy.replace(/^https?:\/\//, '');
    const specialMatch = proxy.match(/^([^:]+):(\d+)@(.+):(.+)$/);
    if (specialMatch) {
        const [, host, port, user, pass] = specialMatch;
        return `http://${user}:${pass}@${host}:${port}`;
    }
    const parts = proxy.split(':');
    if (parts.length === 4 && !isNaN(parts[1])) {
        const [host, port, user, pass] = parts;
        return `http://${user}:${pass}@${host}:${port}`;
    }
    return `http://${proxy}`;
}
function readAndParseProxies(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    return lines.map(line => parseProxy(line)).filter(Boolean);
}
const CUSTOM_SIGN_TEXT = `blockstreet.money wants you to sign in with your Ethereum account:
0x4CBB1421DF1CF362DC618d887056802d8adB7BC0

Welcome to Block Street

URI: https://blockstreet.money
Version: 1
Chain ID: 1
Nonce: Z9YFj5VY80yTwN3n
Issued At: 2025-10-27T09:49:38.537Z
Expiration Time: 2025-10-27T09:51:38.537Z`;
const SAMPLE_HEADERS = {
    timestamp: process.env.EXAMPLE_TIMESTAMP || '',
    signatureHeader: process.env.EXAMPLE_SIGNATURE || ``,
    fingerprint: process.env.EXAMPLE_FINGERPRINT || '',
    abs: process.env.EXAMPLE_ABS || '',
    token: process.env.EXAMPLE_TOKEN || '',
    origin: 'https://blockstreet.money'
};
async function solveTurnstile(apikey, sitekey, pageurl) {
    logger.loading('Solving Cloudflare Turnstile captcha...');
    if (!apikey) throw new Error('2Captcha API key is missing from your .env file.');
    const submitUrl = 'http://2captcha.com/in.php';
    const submitData = new URLSearchParams({ key: apikey, method: 'turnstile', sitekey, pageurl, json: 1 });
    try {
        const submitRes = await axios.post(submitUrl, submitData);
        if (submitRes.data.status !== 1) throw new Error(`2Captcha submit failed: ${submitRes.data.request}`);
        const requestId = submitRes.data.request;
        const resUrl = `http://2captcha.com/res.php?key=${apikey}&action=get&id=${requestId}&json=1`;
        while (true) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            const resRes = await axios.get(resUrl);
            if (resRes.data.status === 1) {
                logger.success('Captcha solved successfully!');
                return resRes.data.request;
            }
            if (resRes.data.request !== 'CAPCHA_NOT_READY') throw new Error(`2Captcha solve failed: ${resRes.data.request}`);
            logger.loading('Captcha not ready, waiting...');
        }
    } catch (error) {
        throw new Error(`Captcha solving process error: ${error.message}`);
    }
}
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (query) => new Promise(resolve => rl.question(query, resolve));
const closeRl = () => rl.close();
const getRandomAmount = (min, max) => Math.random() * (max - min) + min;
const randomDelay = async () => await sleep(getRandomAmount(5000, 10000
