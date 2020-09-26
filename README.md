# fte2cbs

A quick and dirty puppeteer script to automate making "CBS Pick'Em" picks "against the spread."

## Why

- Automating things is fun
- Gambling is sort of silly
- Smaller chance of free money if you forget to make picks

This is unlikely to be useful to anyone and is just being published here for safekeeping.

## How

We'll assume (probably incorrectly) that the people from fivethirtyeight.com are better at predicting the outcome of sports games than whatever betting book is driving CBS's spreads.

If fivethirtyeight and CBS agree, we'll flip a coin.

We'd probably be just as well off flipping a coin for every match.

## Usage

Copy `config.js.example` to `config.js`

Edit config.js with your CBS credentials and CBS team url

`node index.js`
