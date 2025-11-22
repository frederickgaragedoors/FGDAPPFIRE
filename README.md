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
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## PWA Setup (Important)

To ensure the PWA works correctly on the web and GitHub Pages:
1. Create a folder named `public` in the root directory.
2. Move the `icons` folder into `public`.
   - New path: `public/icons/icon.svg`
3. Run `npm install` to install the new PWA plugin.

## Building for Desktop (Electron)

To build the Windows installer:
`npm run electron:build`

### ⚠️ Troubleshooting Build Errors

**Error: `Cannot create symbolic link : A required privilege is not held by the client.`**

This is a permission issue on Windows because the build process needs to create symbolic links for the code signing tools.

**Solution:**
1. **Run as Administrator:**
   - Close your terminal or VS Code.
   - Right-click your terminal/VS Code icon and select **"Run as administrator"**.
   - Navigate back to your project folder.
   - Run `npm run electron:build` again.

2. **Alternative: Enable Developer Mode**
   - Go to **Windows Settings** > **Update & Security** > **For developers**.
   - Turn on **"Developer Mode"**.
   - Restart your computer and try building again.