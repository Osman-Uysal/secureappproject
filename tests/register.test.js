const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('http://localhost:3001/register');

    // Fill out the registration form
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Verify redirection to the login page
    if (await page.url() === 'http://localhost:3001/login') {
        console.log('Register User Test Passed');
    } else {
        console.error('Register User Test Failed');
    }

    await browser.close();
})();