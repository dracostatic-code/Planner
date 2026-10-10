# My Daily Planner

A small, mobile-friendly planner intended for Android Chrome and GitHub Pages. The app stores tasks and preferences in the browser's local storage on the device.

## Included features

- Daily routine checkboxes for animal feeding at **8:00 AM** and **5:30 PM**, plus dinner from **6:00–7:00 PM**
- Add, edit, complete and delete tasks
- Categories for house building, practical jobs, website work, LeadBright and personal tasks
- Daily completion progress and weekly progress overview
- Flexible-break reminders
- Hot-weather mode
- Light/dark appearance
- JSON export and import for backups
- Progressive Web App manifest and service worker for installability/offline shell

## Publish using GitHub Pages

1. Create a new repository on GitHub. For a public repository, choose a simple name such as `my-daily-planner`.
2. Extract the ZIP file on your computer.
3. Upload the **contents** of the extracted folder to the repository root. The files should sit directly at the top level: `index.html`, `styles.css`, `app.js`, `manifest.webmanifest`, `sw.js`, `README.md`, and the `icons` folder. Do not upload only the ZIP.
4. On GitHub, open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/(root)`, then save.
6. Wait for GitHub Pages to publish. The public URL will look like `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.
7. Open that URL on Android using Chrome. Use Chrome's three-dot menu and choose **Install app** or **Add to Home screen** if available.

## Updating the app

Edit the relevant file in GitHub and commit the change. If the app seems stuck on an old version, close it fully and reopen it. A service-worker cache update may take a refresh or two.

## Data and privacy

- Tasks and settings stay in the browser storage on the device where you use the app.
- The app does **not** automatically sync between devices.
- Clearing Chrome site data can erase planner data. Use **Settings → Export backup (.json)** periodically and keep the file somewhere safe.
- The Google Fonts import is optional visual styling; if unavailable, the app uses system fonts. The core planner does not require a server or account.

## Important note

This is a starter planner, not a substitute for a separate backup. Check the deployed app on your phone after publishing and keep a backup before importing or resetting data.
