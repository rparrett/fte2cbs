const puppeteer = require('puppeteer');
const config = require('./config');

const fteTeamToCBS = {
  'Dolphins': 'Miami',
  'Jaguars': 'Jacksonville',
  'Bears': 'Chicago',
  'Falcons': 'Atlanta',
  'Bengals': 'Cincinnati',
  'Eagles': 'Philadelphia',
  'Texans': 'Houston',
  'Steelers': 'Pittsburgh',
  'Rams': 'LA Rams',
  'Bills': 'Buffalo',
  'Raiders': 'Las Vegas',
  'Patriots': 'New England',
  '49ers': 'San Francisco',
  'Giants': 'New York(NYG)',
  'Titans': 'Tennessee',
  'Vikings': 'Minnesota',
  'Washington': 'Washington',
  'Browns': 'Cleveland',
  'Panthers': 'Carolina',
  'Chargers': 'LA Chargers',
  'Jets': 'New York(NYJ)',
  'Colts': 'Indianapolis',
  'Cowboys': 'Dallas',
  'Seahawks': 'Seattle',
  'Lions': 'Detroit',
  'Cardinals': 'Arizona',
  'Buccaneers': 'Tampa Bay',
  'Broncos': 'Denver',
  'Packers': 'Green Bay',
  'Saints': 'New Orleans',
  'Chiefs': 'Kansas City',
  'Ravens': 'Baltimore'
};

async function getFtePicks(page) {
  await page.goto(config.fte_url);

  const gamesSelector = 'section.week:nth-child(1) .game-body';
  await page.waitForSelector(gamesSelector);

  const picks = await page.evaluate((gamesSelector, fteTeamToCBS) => {
    const bodys = Array.from(document.querySelectorAll(gamesSelector));

    return bodys.map(body => {
      let firstTeam = body.querySelector('tr:nth-child(1) .team');
      let firstSpread = body.querySelector('tr:nth-child(1) .spread');

      let secondTeam = body.querySelector('tr:nth-child(2) .team');
      let secondSpread = body.querySelector('tr:nth-child(2) .spread');

      if (!firstTeam || !firstSpread || !secondTeam || !secondSpread) {
        return null;
      }

      firstTeam = firstTeam.textContent.trim();
      firstSpread = firstSpread.textContent.trim();
      secondTeam = secondTeam.textContent.trim();
      secondSpread = secondSpread.textContent.trim();

      if (firstSpread !== '') {
        return { 
          team: fteTeamToCBS[firstTeam],
          spread: firstSpread === 'PK' ? -0.5 : parseFloat(firstSpread)
        };
      }

      return { 
        team: fteTeamToCBS[secondTeam],
        spread: secondSpread === 'PK' ? -0.5 : parseFloat(secondSpread)
      };
    });
  }, gamesSelector, fteTeamToCBS);

  return picks;
}

(async () => {
  const browser = await puppeteer.launch({headless: config.headless});

  const pages = await browser.pages();
  let page = pages[0];
  
  await page.exposeFunction('fte2cbs_log', (...args) => console.log(...args));
  page.setDefaultNavigationTimeout(120 * 1000);

  console.log("Grabbing picks from FiveThirtyEight.");

  const picks = await getFtePicks(page);
  if (picks === null) {
    console.log('Failed to retrieve picks from FiveThirtyEight');
    process.exit(1);
  }

  // Leave the FiveThirtyEight picks tab alone so we can reference it
  // while debugging.

  page = await browser.newPage();
  await page.exposeFunction('fte2cbs_log', (...args) => console.log(...args));
  page.setDefaultNavigationTimeout(120 * 1000);

  // Login

  console.log("Logging into CBS");

  await page.goto(config.cbs_login_url);
  await page.type('#userid', config.cbs_userid);
  await page.type('#password', config.cbs_password);
  await page.click('input[type=submit]');
  await page.waitForNavigation();

  // Make Picks

  console.log("Making Picks");

  await page.goto(config.cbs_make_picks_url);
  await page.waitForSelector('.teamSelection');

  for (const pick of picks) {
    await page.evaluate((pick) => {
      const matchups = Array.from(document.querySelectorAll('.pickContainer'));
      for (const matchup of matchups) {
        const homeTeamButton = matchup.querySelector('.homeTeamSelection');
        const homeTeamName = homeTeamButton.textContent.trim();
        const awayTeamButton = matchup.querySelector('.awayTeamSelection');
        const awayTeamName = awayTeamButton.textContent.trim();

        if (homeTeamName !== pick.team && awayTeamName !== pick.team) {
          continue;
        }

        const spreadContainer = matchup.querySelector('.spreadInfo');
        let spread = parseFloat(spreadContainer.textContent.replace(/[^-.\d]/g, ''));

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

        fte2cbs_log('538: ', pick.team, pick.spread);
        fte2cbs_log('CBS: ', cbsPreferredName, spread);

        let pickName;
        let pickButton;
        let coinFlip = false;

        if (cbsPreferredName === pick.team) {
          if (pick.spread < spread) {
            pickButton = cbsPreferredButton;
            pickName = cbsPreferredName;
          } else if (pick.spread === spread) {
            coinFlip = true;
            if (Math.floor(Math.random() * 2) === 0) {
              pickButton = cbsPreferredButton;
              pickName = cbsPreferredName;
            } else {
              pickButton = cbsOtherButton;
              pickName = cbsOtherName;
            }
          } else {
            pickButton = cbsOtherButton;
            pickName = cbsOtherName;
          }
        } else {
          pickButton = cbsOtherButton;
          pickName = cbsOtherName;
        }

        const preferredSelected = cbsPreferredButton.classList.contains('selected');
        const otherSelected = cbsOtherButton.classList.contains('selected');
        const anySelected = preferredSelected || otherSelected;

        const pickSelected = pickButton.classList.contains('selected');

        if (coinFlip) {
          if (preferredSelected) {
            fte2cbs_log('Pick:', cbsPreferredName, "(coin flip)");
          } else if (otherSelected) {
            fte2cbs_log('Pick:', cbsOtherName, "(coin flip)");
          } else {
            fte2cbs_log('Pick:', pickName, "(coin flip)");
          }
        } else {
          fte2cbs_log('Pick:', pickName);
        }

        if (!anySelected || (!pickSelected && !coinFlip)) {
          fte2cbs_log('Clicking button for ', pickName);
          pickButton.click();
        } else {
          fte2cbs_log('Skipping, no change or coinflip');
        }

        fte2cbs_log();
      }
    }, pick);
  }

  console.log('Waiting for all buttons to have definitely been clicked');

  await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('.awayTeamSelection'));
    const selected = Array.from(document.querySelectorAll('.teamSelection.selected'));
    fte2cbs_log(buttons.length + "/" + selected.length);

    return buttons.length === selected.length;
  }, { polling: 200 });

  console.log('Submitting');

  await page.click('#pickSubmit');

  await page.waitForFunction(() => {
    const dialog = document.getElementById('saveConfirmed');
    return dialog && dialog.parentElement.style.display === 'block';
  }, { polling: 200 });

  console.log('Done.');

  if (config.headless || config.autoclose) {
    process.exit(0);
  }
})();
