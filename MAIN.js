const { Client, LocalAuth, MessageMedia } = require('./index');
// const qrcode = require('qrcode-terminal');
const puppeteer = require('puppeteer');
const sound = require('sound-play')
const path = require('path');
const MAX_RETRIES = 2000;
const CHECK_IN_MESSAGE = "CHECK-IN KAYN";
const URL = 'https://candidature.1337.ma/users/sign_in';
const { exec } = require('child_process');


const client = new Client({
    authStrategy: new LocalAuth()
});

let reloadCounter = 0;
let addText = "add me";
let admins = [];
let blockedUsers = [];
let usersToNotify = [];
let TIMEOUT_DELAY = 100;
let i = 0;


function playSound(name) {
    const filePath = path.join(__dirname, name)
    sound.play(filePath)
}

function playBeep(frequency, duration, beeps) {
    for (let i = 0; i < beeps; i++) {
        exec(`powershell.exe [console]::beep(${frequency},${duration})`);
    }
}

async function sendWhatsAppMessage(recipient, message, times = 1) {
    try {
        for (let i = 0; i < times; i++) {
            await client.sendMessage(recipient, message);
        }
    } catch (error) {
        console.error("Error sending WhatsApp message");
        // await sendWhatsAppMessage(msg.from, "Error sending WhatsApp message");
        throw error
    }
}
let breakLoop = false;

async function checkWebsiteForCasablanca() {
    while (true) {
        try {
            const browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36');
            await page.setJavaScriptEnabled(true);
            await page.goto(URL);

            await Promise.all([
                page.waitForSelector('#user_email'),
                page.waitForSelector('#user_password'),
                page.waitForSelector('input[type="submit"][value="Sign in"]')
            ]);

            await page.type('#user_email', '');
            await page.type('#user_password', '');

            await page.evaluate(() => {
                document.querySelector('input[type="submit"][value="Sign in"]').click();
            });

            await page.waitForNavigation();
            for (let j = 0; j < 20; j++) {
                if (j > 0) await page.reload();
                const htmlContent = await page.content();
                const containsText = !htmlContent.includes('when some will open') || htmlContent.includes('Casablanca');
                if (containsText) {
                    console.log("CHECK-IN!!!!!!!"+" "+"["+new Date().toLocaleString()+"]");
                    playBeep(700, 5000, 1)
                    playSound('./checkin.wav')
                    const screenshotBuffer = await page.screenshot({ fullPage: true });
                    const base64Screenshot = screenshotBuffer.toString('base64');
                    for (const user of usersToNotify) {
                        await sendWhatsAppMessage(user, new MessageMedia('image/jpeg', base64Screenshot));
                        await sendWhatsAppMessage(user, CHECK_IN_MESSAGE, 16);
                    }
                    breakLoop = true;
                    break;
                } else {
                    if (i >= MAX_RETRIES) {
                        const screenshotBuffer = await page.screenshot({ fullPage: true });
                        const base64Screenshot = screenshotBuffer.toString('base64');
                        for (const user of usersToNotify) {
                            await sendWhatsAppMessage(user, new MessageMedia('image/jpeg', base64Screenshot));
                            await sendWhatsAppMessage(user, "No check-in available");
                        }
                        i = 0
                    }
                    i++
                    console.log("No check-in available"+" "+"["+new Date().toLocaleString()+"]");
                }
            }
            await browser.close();
            if (breakLoop) break;
        } catch (error) {
            console.error("Error checking website");
            playBeep(1000, 100, 2)
            // await sendWhatsAppMessage(msg.from, "Error checking website");
            setTimeout(checkWebsiteForCasablanca, TIMEOUT_DELAY)
        }
    }
}

client.on('message', async (msg) => {
    try {
        if (msg.body.toLowerCase() === addText) {
            if (!usersToNotify.includes(msg.from)) {
                usersToNotify.push(msg.from);
                await sendWhatsAppMessage(msg.from, "added to the list");
                console.log("Added user to the list:", msg.from);
            }
        }
        else if (msg.body.toLowerCase() === '11020') {
            if (!admins.includes(msg.from)) {
                admins.push(msg.from);
                await sendWhatsAppMessage(msg.from, "added to the admins list");
                console.log("Added user to the admins list:", msg.from);
            }
        }
        else if (msg.body.toLowerCase() === 'ping') {
            sendWhatsAppMessage(msg.from, "pong");
        }
        else if (admins.includes(msg.from)) {
            if (msg.body.toLowerCase() === 'show users') {
                usersToNotify.forEach((user, index) => {
                    sendWhatsAppMessage(msg.from, `${index}: ${user}`);
                });
            }
            else if (msg.body.toLowerCase().startsWith('delete user')) {
                const index = parseInt(msg.body.split(' ')[2]);
                if (index >= 0 && index < usersToNotify.length) {
                    usersToNotify.splice(index, 1);
                    sendWhatsAppMessage(msg.from, `deleted user at index ${index}`);
                }
            }
            else if (msg.body.toLowerCase() === 'show admins') {
                admins.forEach((admin, index) => {
                    sendWhatsAppMessage(msg.from, `${index}: ${admin}`);
                });
            }
            else if (msg.body.toLowerCase().startsWith('delete admin')) {
                const index = parseInt(msg.body.split(' ')[2]);
                if (index >= 0 && index < admins.length) {
                    admins.splice(index, 1);
                    sendWhatsAppMessage(msg.from, `deleted admin at index ${index}`);
                }
            }
            else if (msg.body.toLowerCase() === 'show blocked users') {
                blockedUsers.forEach((user, index) => {
                    sendWhatsAppMessage(msg.from, `${index}: ${user}`);
                });
            }
            else if (msg.body.toLowerCase().startsWith('delete blocked user')) {
                const index = parseInt(msg.body.split(' ')[3]);
                if (index >= 0 && index < blockedUsers.length) {
                    blockedUsers.splice(index, 1);
                    sendWhatsAppMessage(msg.from, `deleted blocked user at index ${index}`);
                }
            }
            else if (msg.body.toLowerCase().startsWith('block user')) {
                const index = parseInt(msg.body.split(' ')[2]);
                if (index >= 0 && index < usersToNotify.length) {
                    blockedUsers.push(usersToNotify[index]);
                    usersToNotify.splice(index, 1);
                    sendWhatsAppMessage(msg.from, `blocked user at index ${index}`);
                }
            }
            else if (msg.body.toLowerCase() === 'show add text') {
                sendWhatsAppMessage(msg.from, `add text: ${addText}`);
            }
            else if (msg.body.toLowerCase().startsWith('set add text')) {
                addText = msg.body.split(' ')[3];
                sendWhatsAppMessage(msg.from, `add text set to: ${addText}`);
            }
            else if (msg.body.toLowerCase() === 'show timeout delay') {
                sendWhatsAppMessage(msg.from, `timeout delay: ${TIMEOUT_DELAY}`);
            }
            else if (msg.body.toLowerCase().startsWith('set timeout delay')) {
                TIMEOUT_DELAY = parseInt(msg.body.split(' ')[3]);
                sendWhatsAppMessage(msg.from, `timeout delay set to: ${TIMEOUT_DELAY}`);
            }
            else if (msg.body.toLowerCase() === 'show max retries') {
                sendWhatsAppMessage(msg.from, `max retries: ${MAX_RETRIES}`);
            }
            else if (msg.body.toLowerCase().startsWith('set max retries')) {
                MAX_RETRIES = parseInt(msg.body.split(' ')[3]);
                sendWhatsAppMessage(msg.from, `max retries set to: ${MAX_RETRIES}`);
            }
            else if (msg.body.toLowerCase() === 'help') {
                sendWhatsAppMessage(msg.from, "Commands: \n\n" +
                    "add me: Add user to the list of users to notify\n" +
                    "show users: Show users to notify\n" +
                    "delete user [index]: Delete user at index\n" +
                    "show admins: Show admins\n" +
                    "delete admin [index]: Delete admin at index\n" +
                    "show blocked users: Show blocked users\n" +
                    "delete blocked user [index]: Delete blocked user at index\n" +
                    "block user [index]: Block user at index\n" +
                    "show add text: Show add text\n" +
                    "set add text [text]: Set add text\n" +
                    "show timeout delay: Show timeout delay\n" +
                    "set timeout delay [delay]: Set timeout delay\n" +
                    "show max retries: Show max retries\n" +
                    "set max retries [retries]: Set max retries\n" +
                    "help: Show this message");
            }
            else {
                sendWhatsAppMessage(msg.from, "Invalid command");
            }
        }
    } catch (error) {
        console.error("Error handling message:", error);
        playBeep(1000, 100, 2)
        // await sendWhatsAppMessage(msg.from, "Error handling message");
    }
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('Client is ready!');
    setTimeout(checkWebsiteForCasablanca, TIMEOUT_DELAY)
});

client.initialize();
