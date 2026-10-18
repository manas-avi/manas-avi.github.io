# LUMEN questionnaire and letter of intent

A static form: no server, no build step, no tracking. It works by opening `index.html`, and on any web host.

## Files

| File | Purpose |
|---|---|
| `index.html` | The page (share-preview tags are in its `<head>`) |
| `styles.css` | All styling, light and dark mode |
| `app.js` | Questions, letter text, validation, PDF generation |
| `config.js` | The only file you normally edit |
| `vendor/jspdf.umd.min.js` | PDF library (jsPDF 2.5.1, MIT licence, included) |

## Put it online

Upload the whole folder to any static host (your own web space, Netlify, GitHub Pages, Cloudflare Pages) and share the URL of `index.html`, for example `https://your-domain.com/lumen-form/`. Keep the folder structure as it is. Serve it over https so the share button and clipboard work.

## Settings (`config.js`)

- `teamEmail`: the address the "Open an email draft" button writes to.
- `submitUrl` (optional): a form endpoint that accepts a multipart POST (Formspree, Getform, your own server). When set, the last step shows "Send to the LUMEN team" and submits the answers plus both PDFs in one step. The fields sent are `practice`, `name`, `role`, `email`, `interest`, `answers` (JSON), `summary` (text), `responses_pdf` and `letter_pdf`. Your endpoint must allow cross-origin requests from your site, and some services only accept file uploads on paid plans. If it fails, the respondent is told to save the files and email them instead.

With `submitUrl` empty, nothing leaves the respondent's device until they email the files themselves.

## Editing the content

Questions and option lists are the constants near the top of `app.js` (`TRIGGERS`, `LIKERT`, `BARRIERS`, and so on). The letter text appears twice, in `stepLetter()` for the page and in `buildLetter()` for the PDF. If you change the wording, change both.

## Things to know

- Fonts load from Google Fonts. If you must avoid third-party requests, download Familjen Grotesk and Newsreader, self-host them and replace the font link in `index.html`. The page falls back to system fonts if they do not load.
- The PDFs use standard fonts, so characters outside Western European alphabets (for example "ł") print as "?" in the PDF. The text copy keeps them.
- Add a short privacy notice to your page or site stating how you use and store the responses.
