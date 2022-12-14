if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
const http = require("http");
var fs = require("fs");
const Path = require("path");
const axios = require("axios");
const urlMetadata = require("url-metadata");
let Mastodon = require("mastodon-api");
let Parser = require("rss-parser");
let parser = new Parser();
let maxPostPerScan = process.env.MAX_POST_PER_SCAN;

const M = new Mastodon({
  access_token: `${process.env.MASTODON_ACCESS_KEY}`,
  timeout_ms: 60 * 1000, // optional HTTP request timeout to apply to all requests.
  api_url: `${process.env.MASTODON_API_URL}`,
});

const download_image = async (url, image_path) => {
  let response = await axios({
    url,
    responseType: "stream",
  });

  return new Promise((resolve, reject) =>
    response.data
      .pipe(fs.createWriteStream(image_path))
      .on("finish", () => {
        console.log("---- Image Written Succesfully");
        resolve(true);
      })
      .on("error", (e) => {
        console.log("---- Image Written Failure");
        reject(e);
      })
  );
};

(async () => {
  runBot();

  setInterval(async () => {
    await runBot();
  }, 60 * 60 * 1000);
})();

async function getLastPostDate() {
  console.log("Getting Last Post Date: getLastPostDate()");
  let timeline = await M.get(
    `accounts/${process.env.MASTODON_ACCOUNT_ID}/statuses`,
    {}
  );
  let postDate = new Date(timeline.data[0].created_at);

  return postDate;
}

async function readFeeds() {
  console.log("Processing Feeds: readFeeds()");
  let feed = await parser.parseURL("http://feeds.feedburner.com/ign/games-all");
  return feed;
}

async function processFeed(feed, postDate) {
  let count = 0;
  let validFeeds = feed.items
    .filter(async (item) => {
      let pubDate = new Date(item.pubDate);

      if (pubDate > postDate) {
        return item;
      }
    })
    .slice(0, maxPostPerScan);

  return Promise.all(
    validFeeds.map(async (item) => {
      let currentCount = count++;

      let metadata = await urlMetadata(item.link);

      // Download feed item image
      let path = Path.resolve(
        __dirname,
        "images",
        `post-image-${currentCount}`
      );
      await download_image(metadata.image, path);

      return postFeedItem(path, item);
    })
  );
}

async function postFeedItem(path, item) {
  let mediaup = await M.post("media", {
    file: fs.createReadStream(path),
  });

  return M.post("statuses", {
    status: `${item.title}\n\n${
      item.contentSnippet ? "\n\n" + item.contentSnippet : ""
    }\n\n#NeoVibe #${process.env.POST_HASHTAG}\n\n${item.link}`,
    media_ids: [mediaup.data.id],
  });
}

async function runBot() {
  console.log("Running Bot: runBot()");

  let feed = await readFeeds();

  let postDate = await getLastPostDate();

  let processedFeed = await processFeed(feed, postDate);

  console.log("Completed Running Bot: runBot()");

  return processedFeed;
}

const requestListener = function (req, res) {
  res.writeHead(200);
  res.end("Hello, World!");
};

const server = http.createServer(requestListener);
server.listen(8080);
