// This is a template for a Node.js scraper on morph.io (https://morph.io)

import cheerio from "cheerio";
import sqlite3 from "sqlite3";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

function initDatabase(callback) {
  // Set up sqlite database.
  var db = new sqlite3.Database("data.sqlite");
  db.serialize(function () {
    //db.run("CREATE TABLE IF NOT EXISTS data (name TEXT)");
    //callback(db);
  });
}

function updateRow(db, value) {
  // Insert some data.
  var statement = db.prepare("INSERT INTO data VALUES (?)");
  statement.run(value);
  statement.finalize();
}

function getRow(titel) {
  db.all("SELECT * FROM data WHERE titel = ?", [titel], (err, rows) => {
    rows.forEach((row) => {});
  });
}

function readRows(db) {
  // Read some data.
  db.each("SELECT rowid AS id, name FROM data", function (err, row) {
    console.log(row.id + ": " + row.name);
  });
}

function fetchPage(url, callback) {
  // Use request to read in pages.
  request(url, function (error, response, body) {
    if (error) {
      console.log("Error requesting page: " + error);
      return;
    }

    callback(body);
  });
}

function run(db) {
  // Use request to read in pages.
  fetchPage("https://morph.io", function (body) {
    // Use cheerio to find things in the page with css selectors.
    var $ = cheerio.load(body);

    var elements = $("div.media-body span.p-name").each(function () {
      var value = $(this).text().trim();
      updateRow(db, value);
    });

    readRows(db);

    db.close();
  });
}

function tryRequest() {
  const url = process.env.MORPH_API_BASE + "broadcasts/2023-04-30";

  request(
    {
      url: url,
      method: "GET",
      headers: {
        "content-type": "application/json",
      },
      json: true,
    },
    function optionalCallback(err, httpResponse, body) {
      console.log(httpResponse.statusCode, httpResponse.statusMessage);
      if (err) {
        return console.error("upload failed:", err);
      }

      console.log(body);
    }
  );
}

initDatabase(run);
//tryRequest();

const searchlist = [];
const programlist = [];
let datumsObjekt = new Date();
const channelMap = new Map();

function getProgramsForNextXDays(dayCount) {
  console.info("-----------------> Searching programs ");
  const result = [];
  for (i = 1; i < dayCount; i++) {
    datumsObjekt.setDate(datumsObjekt.getDate() + 1);
    let datum = datumsObjekt.toISOString().slice(0, 10);
    const url = process.env.MORPH_API_BASE + `broadcasts/${datum}`;

    result.push(axios.get(url));
  }
  return result;
  /*.then(function optionalCallback(response) {
    jsonObject = response.data;
    jsonObject.events.forEach((event) => {
      let existingEvent = programlist.find((e) => e.title === event.title);
      const time = event.startTime.split("T")[1].substring(0, 5);
      if (!existingEvent) {
        event.events = [];
        programlist.push(event);
        existingEvent = event;
      }
      existingEvent.events.push({
        startTime: event.startTime,
        endTime: event.endTime,
        channel: event.channel,
        duration: event.duration,
      });
    });
    console.info("-----------------> Programs loaded ");
    getSearchlist();
  });
  */
}

function sendMail(findings) {
  console.info("-----------------> Found something, sending email ");

  // HTML erstellen
  content = "<h1>TV Scraper information</h1>";
  content +=
    "<p>Hallo, die Suche nach Programmen war erfolgreich. Folgende Sendungen werden ausgestrahlt.";
  content += "<ul>";
  findings.forEach((finding) => {
    content += "<li><b>" + finding.title + "</b></li>";
    console.log("Found match in ", finding.title);
    console.log("Sendetermine");
    content += "<ul>";
    finding.events.forEach((event) => {
      content +=
        "<li>" +
        event.startTime.substr(8, 2) +
        "." +
        event.startTime.substr(5, 2) +
        "." +
        event.startTime.substr(0, 4) +
        " " +
        event.startTime.substr(11, 5) +
        " bis " +
        event.endTime.substr(11, 5) +
        ", " +
        channelMap.get(event.channel).name +
        "</li>";
      console.log(
        "=> Start: ",
        event.startTime.substr(8, 2) +
          "." +
          event.startTime.substr(5, 2) +
          "." +
          event.startTime.substr(0, 4) +
          " " +
          event.startTime.substr(11, 8),
        ", End: ",
        event.endTime.substr(8, 2) +
          "." +
          event.endTime.substr(5, 2) +
          "." +
          event.endTime.substr(0, 4) +
          " " +
          event.endTime.substr(11, 8),
        ", Channel: ",
        channelMap.get(event.channel).name
      );
    });
    content += "</ul>";
  });
  content += "</ul>";

  mailUrl = process.env.MORPH_TVSCRAPER_BASE + "email.php";

  mailConfig = {
    headers: {
      Authorization: process.env.MORPH_EMAILSECRET,
    },
  };
  mailContent = { text: content };
  //axios.post(mailUrl, JSON.stringify(mailContent), mailConfig);
}

function matchProgramsWithSearchlist() {
  console.info("-----------------> Matching searchlist with programs ");
  const findings = programlist.filter((event) => {
    return searchlist.some((searchstring) => {
      return event.title.includes(searchstring);
    });
  });
  if (findings.length > 0) {
    sendMail(findings);
  } else {
    console.info("-----------------> Nothing found ");
  }
}

function getSearchlist() {
  console.info("-----------------> Getting searchlist ");
  const url =
    "http://bernhardkoehler.bplaced.net/TVScraper/index.php/suchliste";

  return axios.get(url);
  /*.then(function optionalCallback(response) {
    jsonObject = response.data;
    jsonObject.forEach((entity) => {
      searchlist.push(entity.Name);
    });
    console.log("Searchlist l = ", searchlist.length);
    console.info("-----------------> Searchlist loaded ");
    matchProgramsWithSearchlist();
  });
  */
}

function getChannels() {
  const url = process.env.MORPH_API_BASE + "channels";
  return axios.get(url);
}
const dayCount = 7;
$programs = getProgramsForNextXDays(dayCount);
$searchlist = getSearchlist();
$channels = getChannels();

Promise.all([$searchlist, $channels, ...$programs]).then(function (results) {
  // programs
  const events = [];
  for (let i = 2; i < dayCount + 1; i++) {
    jsonObject = results[i].data.events;
    events.push(...jsonObject);
  }
  events.forEach((event) => {
    let existingEvent = programlist.find((e) => e.title === event.title);
    const time = event.startTime.split("T")[1].substring(0, 5);
    if (!existingEvent) {
      event.events = [];
      programlist.push(event);
      existingEvent = event;
    }
    existingEvent.events.push({
      startTime: event.startTime,
      endTime: event.endTime,
      channel: event.channel,
      duration: event.duration,
    });
  });

  // Searchlist
  jsonObject = results[0].data;
  jsonObject.forEach((entity) => {
    searchlist.push(entity.Name);
  });
  console.log("Searchlist l = ", searchlist.length);

  // Channels
  jsonObject = results[1].data.channels;
  jsonObject.forEach((channel) => {
    channelMap.set(channel.id, channel);
  });

  matchProgramsWithSearchlist();
});
