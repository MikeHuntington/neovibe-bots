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

const download_image = async (url, image_path) => {
  let response = await axios({
    url,
    responseType: "stream",
  });

  return new Promise((resolve, reject) =>
    response.data
      .pipe(fs.createWriteStream(image_path))
      .on("finish", () => resolve(true))
      .on("error", (e) => reject(e))
  );
};

(async () => {
  await postFeed();

  setInterval(async () => {
    await postFeed();
  }, 60 * 60 * 1000);
})();

async function postFeed() {
  console.log("Running postFeed()");
  const M = new Mastodon({
    access_token: `${process.env.MASTODON_ACCESS_KEY}`,
    timeout_ms: 60 * 1000, // optional HTTP request timeout to apply to all requests.
    api_url: `${process.env.MASTODON_API_URL}`,
  });

  let feed = await parser.parseURL("http://feeds.feedburner.com/ign/games-all");

  let timeline = await M.get(
    `accounts/${process.env.MASTODON_ACCOUNT_ID}/statuses`,
    {}
  );
  let postDate = new Date(timeline.data[0].created_at);

  let count = 0;
  feed.items.every(async (item) => {
    let pubDate = new Date(item.pubDate);

    if (pubDate > postDate) {
      let currentCount = ++count;

      if (currentCount > maxPostPerScan) return false;

      let metadata = await urlMetadata(item.link);

      // Download feed item image
      let path = Path.resolve(
        __dirname,
        "images",
        `post-image-${currentCount}`
      );
      let isDownloaded = await download_image(metadata.image, path);

      let rstream = fs.createReadStream(path);
      rstream.on("open", async (fd) => {
        let mediaup = await M.post("media", {
          file: rstream,
        });

        await M.post("statuses", {
          status: `${item.title}\n\n#NeoVibe #${process.env.POST_HASHTAG}\n\n${item.link}`,
          media_ids: [mediaup.data.id],
        });

        return true;
      });
      rstream.on("error", (err) => {
        // error on the stream
      });
    }

    return true;
  });

  return true;
}

const requestListener = function (req, res) {
  res.writeHead(200);
  res.end("Hello, World!");
};

const server = http.createServer(requestListener);
server.listen(8080);
