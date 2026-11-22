# Personal job finder

Publish **web/** to an HTTPS static host with no build command. For local use run `npm start` and visit http://127.0.0.1:4173 in Brave. Connect the unpacked extension from **brave-connector/** using the instructions on the finder page.

One click scans pages 1–10 of the India tech filter. The next click scans 11–20. If a batch stops early, the next click requests only the remaining pages in that batch. Every page is saved to IndexedDB before the connector advances. Listings from earlier batches stay in the ranking, deduplicated by application URL. The last batch ends when the portal disables Next.

Keep the collector tab open between batches. The portal keeps its page number inside the tab. Closing it or restarting Brave can require **Start from page 1**. The finder can be reopened on the same origin and reconnected. A fresh scan replaces the previous results only after its first page is saved. Existing older reports can be viewed but have no resumable portal tab.

Results use evidence in the listing card and the supplied resume. They consider work responsibilities, industry overlap, production versus project experience, early-career seniority and requirements explicitly shown. Employer descriptions are not automatically fetched. The portal may change its ordering between batches or request a pause. The app keeps the last saved page on interruption.

After editing the extension, regenerate **web/brave-connector.zip** from the contents of **brave-connector/** and reload the installed unpacked extension.

The recommended view excludes unrelated roles and experience stretches. Narrow it by role family, match quality, or keywords. In a listing, **Compare employer description** uses the text you paste to reassess responsibilities and experience requirements. Descriptions, saved jobs, and filters stay in your browser on that origin.

Run `npm test` for ranking regressions. With the preview running, `node verify-batches.mjs` runs the Edge integration test. Set FINDER_TEST_URL when testing a different preview address.

The free GitHub Pages deployment serves the contents of **web/** on the **gh-pages** branch. After pushing updated source, deploy with `git subtree push --prefix web origin gh-pages`.

Use **Upload resume** to parse a text-based PDF, DOCX or TXT file locally. Review the extracted skills and experience evidence, and correct the full-time start month if needed. The browser saves the derived profile on this site origin and re-ranks saved jobs immediately. Image-only scans need a text version.
