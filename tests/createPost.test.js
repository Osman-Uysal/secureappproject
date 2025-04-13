const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    // Log in first
    await page.goto('http://localhost:3001/login');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Create a new post
    await page.fill('input[name="title"]', 'My First Post');
    await page.fill('textarea[name="content"]', 'This is the content of my first post.');
    await page.click('form[action="/posts"] button[type="submit"]');

    // Verify the post is displayed on the home page
    const postTitle = await page.textContent('h2');
    if (postTitle === 'My First Post') {
        console.log('Create Post Test Passed');
    } else {
        console.error('Create Post Test Failed');
    }

    await browser.close();
})();