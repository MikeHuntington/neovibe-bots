if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
let Mastodon = require("mastodon-api");
let Parser = require("rss-parser");
let parser = new Parser();

(async () => {
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

  feed.items.forEach((item) => {
    let pubDate = new Date(item.pubDate);

    if (pubDate > postDate) {
      M.post("statuses", {
        status: `#${process.env.POST_PREFIX}:\n\n${item.title}\n\n${item.link}`,
      });
    }
  });
})();
