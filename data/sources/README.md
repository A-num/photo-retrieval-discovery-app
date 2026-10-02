# Collecting real data

Each collector writes a CSV to `data/real/`, which is git-ignored because it holds real people's words. Upload the CSVs on the app's **Data** page.

| Source | Method | Command |
|---|---|---|
| App Store | Apple's public reviews feed (automatic) | `npm run collect:appstore` |
| Google Photos Community | You pick threads, the script fetches them | `npm run collect:community` |
| Reddit | Official Data API (needs a free app registration) | `npm run collect:reddit` |
| Play Store | Manual copy into a template | none |

## App Store
No setup. The script pulls up to 500 recent and 500 most-helpful reviews per storefront (US, GB, CA, AU, IN, IE, NZ). It keeps reviews that mention finding, searching, scrolling, screenshots or missing photos. Run it again later to pick up new reviews.

## Google Photos Community
The forum has no API, and its robots.txt disallows automated search, so you choose the threads and the script only fetches those pages (one every 3 seconds).

1. In a browser, search Google for `site:support.google.com/photos/thread` plus phrases like `"can't find"`, `search`, `screenshot`, `"looking for a photo"`, `"search not working"`, `"old photo"`.
2. Open the promising threads and paste their URLs into `community-urls.txt`, one per line. 50–100 threads is plenty.
3. Run `npm run collect:community`. Only the original question is saved. Replies and usernames are not.

Tip: choose threads where someone is looking for a *specific* photo. "My backup disappeared" threads are about recovery, not retrieval, and the pipeline will mostly screen them out.

## Reddit
1. Sign in, go to https://www.reddit.com/prefs/apps and click **create another app**.
2. Choose **script**, give it a name, and set the redirect URI to `http://localhost:8080` (it isn't used). Reddit may review new API apps before approving them.
3. Copy the client ID (the string under the app name) and the secret into `.env.local`:
   ```
   REDDIT_CLIENT_ID=...
   REDDIT_CLIENT_SECRET=...
   ```
4. Run `npm run collect:reddit`. By default it searches r/googlephotos plus all of Reddit for posts that mention Google Photos. To add subreddits: `npm run collect:reddit -- --subs googlephotos,GooglePixel,DataHoarder`.

r/photos is a photography-sharing community, so it has very few posts about finding photos in an app. r/googlephotos is where retrieval problems get discussed.

Reddit's Data API terms allow non-commercial use such as a personal research project, but prohibit using the data to train AI models. Read them before using the data for anything beyond this project.

## Play Store
There is no public reviews API for apps you don't own, and scraping tools break Google Play's terms. Collect a sample by hand instead:

1. Open https://play.google.com/store/apps/details?id=com.google.android.apps.photos and click **See all reviews**.
2. Sort by *Newest*, and filter to 1–3 stars, where retrieval complaints concentrate.
3. Copy reviews that mention searching, finding, scrolling or screenshots into a copy of `play-store-template.csv`, one per row. 40–60 reviews is a solid sample.
4. Upload the file on the Data page.

## Before sharing anything publicly
- Quote short excerpts and link to the source rather than republishing whole posts.
- Leave out usernames. The collectors never save them.
- State your sample: sources, date ranges, counts, and how you filtered.
