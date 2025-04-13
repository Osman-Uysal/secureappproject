const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('http://localhost:3001/login');

    // Fill out the login form
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Verify redirection to the home page
    if (await page.url() === 'http://localhost:3001/') {
        console.log('Login User Test Passed');
    } else {
        console.error('Login User Test Failed');
    }

    await browser.close();
})();