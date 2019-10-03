require('./http-server')
const puppeteer = require('puppeteer');
const URL = 'http://localhost:8000';

puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }).then(async browser => {
    const page = await browser.newPage();
    await page.goto(URL, {waitUntil: 'networkidle0'});
    const results = await page.evaluate(() => {
      try {
	if (window.isFinished && window.isFinished()) {
	  return window.results;
	}
      } catch(err) {
        reject(err.toString());
        console.log("Failed", err);
      }
    });
    console.log("Comparing in Chrome");
    console.log("Comparison Test Results:");
    await browser.close();
    if (results) {
      var success = true;
      var successes = [],failures = [];
      for (var i = 0; i < results.length; i++) {
        var result = results[i];
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
      }
    }
    process.exit();
}).catch(function(error) {
    console.error(error);
    process.exit();
});
