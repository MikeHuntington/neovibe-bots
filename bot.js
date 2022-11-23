if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
let Mastodon = require("mastodon-api");
let Parser = require("rss-parser");
let parser = new Parser();
let maxPostPerScan = process.env.MAX_POST_PER_SCAN;

(async () => {
  await postFeed();

  setInterval(async () => {
    await postFeed();
  }, 20 * 60 * 1000);
})();

async function postFeed() {
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
  var postDate = new Date(timeline.data[0].created_at);

  let count = 0;
  feed.items.every(async (item) => {
    if (count > maxPostPerScan) return false;

    let pubDate = new Date(item.pubDate);

    if (pubDate > postDate) {
      count++;
      await M.post("statuses", {
        status: `${item.title}\n\n#NeoVibe #${process.env.POST_HASHTAG}\n\n${item.link}`,
      });
      return true;
    }

    return true;
  });
}
