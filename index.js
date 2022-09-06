const puppeteer = require("puppeteer");
const config = require("./config");

(async () => {
  const browser = await puppeteer.launch({ headless: config.headless });

  const pages = await browser.pages();
  let page = pages[0];

  await page.exposeFunction("fte2cbs_log", (...args) => console.log(...args));
  page.setDefaultNavigationTimeout(120 * 1000);

  // Login

  console.log("Logging into CBS");

  await page.goto(config.cbs_login_url);
  await page.type("#userid", config.cbs_userid);
  await page.type("#password", config.cbs_password);
  await page.click("input[type=submit]");
  await page.waitForNavigation();

  // Make Picks

  console.log("Making Picks");

  await page.goto(config.cbs_make_picks_url);
  await page.waitForSelector(".teamSelection");

  await page.evaluate(() => {
    const matchups = Array.from(document.querySelectorAll(".pickContainer"));
    for (const matchup of matchups) {
      const homeTeamButton = matchup.querySelector(".homeTeamSelection");
      const homeTeamName = homeTeamButton.textContent.trim();
      const awayTeamButton = matchup.querySelector(".awayTeamSelection");
      const awayTeamName = awayTeamButton.textContent.trim();

      const spreadContainer = matchup.querySelector(".spreadInfo");
      let spread = parseFloat(
        spreadContainer.textContent.replace(/[^-.\d]/g, "")
      );

      let cbsPreferredName;
      let cbsPreferredButton;
      let cbsOtherName;
      let cbsOtherButton;

      if (spread < 0.0) {
        cbsPreferredName = homeTeamName;
        cbsPreferredButton = homeTeamButton;
        cbsOtherName = awayTeamName;
        cbsOtherButton = awayTeamButton;
      } else {
        cbsPreferredName = awayTeamName;
        cbsPreferredButton = awayTeamButton;
        cbsOtherName = homeTeamName;
        cbsOtherButton = homeTeamButton;
        spread *= -1;
      }

      if (Math.floor(Math.random() * 2) === 0) {
        ftePickButton = cbsPreferredButton;
        ftePickName = cbsPreferredName;
      } else {
        ftePickButton = cbsOtherButton;
        ftePickName = cbsOtherName;
      }

      const preferredSelected =
        cbsPreferredButton.classList.contains("selected");
      const otherSelected = cbsOtherButton.classList.contains("selected");
      const anySelected = preferredSelected || otherSelected;

      const pickSelected = ftePickButton.classList.contains("selected");

      if (preferredSelected) {
        fte2cbs_log("Sel: ", cbsPreferredName);
      } else if (otherSelected) {
        fte2cbs_log("Sel: ", cbsOtherName);
      }

      fte2cbs_log("Pick:", ftePickName, "(coin flip)");

      if (!anySelected || !pickSelected) {
        fte2cbs_log("Clicking button for ", ftePickName);
        ftePickButton.click();
      } else {
        fte2cbs_log("Skipping, no change");
      }

      fte2cbs_log();
    }
  });

  console.log("Waiting for all buttons to have definitely been clicked");

  await page.waitForFunction(
    () => {
      const buttons = Array.from(
        document.querySelectorAll(".awayTeamSelection")
      );
      const selected = Array.from(
        document.querySelectorAll(".teamSelection.selected")
      );
      fte2cbs_log(buttons.length + "/" + selected.length);

      return buttons.length === selected.length;
    },
    { polling: 200 }
  );

  console.log("Submitting");

  await page.click("#pickSubmit");

  await page.waitForFunction(
    () => {
      const dialog = document.getElementById("saveConfirmed");
      return dialog && dialog.parentElement.style.display === "block";
    },
    { polling: 200 }
  );

  console.log("Done.");

  if (config.headless || config.autoclose) {
    process.exit(0);
  }
})();
