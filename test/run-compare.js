const closeServer = require("./http-server");
const puppeteer = require("puppeteer");
const URL = "http://localhost:8000";

puppeteer
  .launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })
  .then(async (browser) => {
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: "networkidle0" });
    const results = await page.evaluate(() => {
      /* global window:false */
      try {
        if (window.isFinished && window.isFinished()) {
          return window.results;
        }
      } catch (err) {
        console.log("Failed", err);
      }
    });
    console.log("Comparing in Chrome");
    console.log("Comparison Test Results:");
    await browser.close();
    if (results) {
      let success = true;
      let successes = [],
        failures = [];
      for (let i = 0; i < results.length; i++) {
        let result = results[i];
        if (result.success) {
          successes.push(result.name);
        } else {
          failures.push(result.name);
        }
        success = success && result.success;
      }
      console.log("Success:", successes.join(", "));
      if (failures.length) {
        console.log("Failure:", failures.join(", "));
        if (failures.length > 10) {
          console.error("failures higher than expected");
          process.exitCode = 1;
        }
      }
    } else {
      process.exitCode = 1;
    }
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    closeServer();
  });
