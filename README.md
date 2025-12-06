<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1xJA6rpQZS01dmE8B58TgPs9XjPQXlcOo

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

Your API keys for Gemini and Google Maps should be entered in the app's **Settings** menu for local development.

## PWA Setup (Important)

To ensure the PWA works correctly on the web and GitHub Pages:
1. Create a folder named `public` in the root directory.
2. Move the `icons` folder into `public`.
   - New path: `public/icons/icon.svg`
3. Run `npm install` to install the new PWA plugin.

## Deploying to the Web (Vercel/GitHub Pages)

The Gemini API calls are handled by a secure serverless function.
1. Push your code to GitHub to trigger the GitHub Action.
2. In your Vercel project settings, add an Environment Variable named `GEMINI_API_KEY` with your key value.
3. Once deployed, enter your Google Maps API key in the app's **Settings** menu.

## Building for Desktop (Electron)

The Electron main process acts as a secure proxy for Gemini API calls. All keys are managed within the app's settings at runtime.

To build the Windows installer:
1. **Run the build command:**
   `npm run electron:build`
2. After installing and running the app, go to the **Settings** menu to enter your Gemini and Google Maps API keys.

### ⚠️ Troubleshooting Build Errors

**Error: `Cannot create symbolic link : A required privilege is not held by the client.`**

This is a permission issue on Windows.

**Solution:**
1. **Run as Administrator:**
   - Close your terminal/VS Code.
   - Right-click your terminal/VS Code icon and select **"Run as administrator"**.
   - Navigate back to your project folder and run the build command again.

2. **Alternative: Enable Developer Mode**
   - Go to **Windows Settings** > **Update & Security** > **For developers**.
   - Turn on **"Developer Mode"**.
   - Restart your computer and try building again.