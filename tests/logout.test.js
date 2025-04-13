const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    // Log in first
    await page.goto('http://localhost:3001/login');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Log out
    await page.click('a[onclick*="logout-form"]');

    // Verify redirection to the home page
    if (await page.url() === 'http://localhost:3001/') {
        console.log('Logout User Test Passed');
    } else {
        console.error('Logout User Test Failed');
    }

    await browser.close();
})();