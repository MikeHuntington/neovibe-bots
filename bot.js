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
let parser = new Parser({
  headers: {
    Accept: "application/rss+xml, application/xml",
  },
});
let maxPostPerScan = process.env.MAX_POST_PER_SCAN;

const M = new Mastodon({
  access_token: `${process.env.MASTODON_ACCESS_KEY}`,
  timeout_ms: 60 * 1000, // optional HTTP request timeout to apply to all requests.
  api_url: `${process.env.MASTODON_API_URL}`,
});

const download_image = async (url, image_path) => {
  let response = await axios({
    method: "get",
    url,
    responseType: "stream",
  });

  console.log(response);

  return new Promise((resolve, reject) =>
    response.data
      .pipe(fs.createWriteStream(image_path))
      .on("finish", () => {
        console.log("---- Image Written Succesfully", url);
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
  }, process.env.FEED_INTERVAL);
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
  let feeds = JSON.parse(process.env.FEEDS || {});
  let feed = await parser.parseURL(feeds.feeds[0].url);
  return { feed, isNews: feeds.feeds[0] };
}

async function processFeed(feed, postDate, feedOptions) {
  let count = 0;
  let validFeeds = feed.items
    .filter((item) => {
      let pubDate = new Date(item.pubDate);
      return pubDate > postDate;
    })
    .slice(0, maxPostPerScan);

  return Promise.all(
    validFeeds.map(async (item) => {
      let path;

      if (feedOptions.isNews) {
        let currentCount = count++;

        let metadata = await urlMetadata(item.link);

        // Download feed item image
        path = Path.resolve(__dirname, "images", `post-image-${currentCount}`);
        await download_image(metadata.image, path);
      }

      return postFeedItem(path, item, feedOptions);
    })
  );
}

async function postFeedItem(path, item, feedOptions) {
  if (feedOptions.isNews) {
    let mediaup = await M.post("media", {
      file: fs.createReadStream(path),
    });

    return M.post("statuses", {
      status: `${feedOptions.tag}: ${item.title}\n\n${
        item.contentSnippet ? "\n\n" + item.contentSnippet : ""
      }\n\n#NeoVibe ${getHashTags()}\n\n${item.link}`,
      media_ids: [mediaup.data.id],
    });
  } else {
    return M.post("statuses", {
      status: `${feedOptions.tag}: ${
        item.title
      }\n\n#NeoVibe ${getHashTags()}\n\n${item.link}`,
      media_ids: [],
    });
  }
}

async function runBot() {
  console.log("Running Bot: runBot()");

  let feed = await readFeeds();

  let postDate = await getLastPostDate();

  let processedFeed = await processFeed(feed.feed, postDate, feed.isNews);

  console.log("Completed Running Bot: runBot()");

  return processedFeed;
}

function getHashTags() {
  let hashTags = process.env.POST_HASHTAG.split(",")
    .map((hashtag) => {
      return `#${hashtag}`;
    })
    .join(" ");

  return hashTags;
}

const requestListener = function (req, res) {
  res.writeHead(200);
  res.end("Hello, World!");
};

const server = http.createServer(requestListener);
server.listen(8080);
