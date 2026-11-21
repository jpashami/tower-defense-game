# Publishing the game on Google Play (and later the App Store)

This guide is for a parent who is happy to follow steps but isn't a programmer. Most of it is filling in Google's forms; the game itself is ready.

**How long it takes:** about an evening for the setup, then **14 days** of testing with friends before Google lets a new personal account publish to everyone.

**What it costs:** Google Play charges a one-time US$25 registration fee. The Apple App Store costs US$99 every year and needs a Mac (see the end of this guide).

## What you will need

- A Google account you will keep (the app belongs to this account for good).
- [Android Studio](https://developer.android.com/studio), installed once. It brings the Android tools and the Java the build needs.
- [Node.js](https://nodejs.org) and this project, with `npm install` already run.
- 12 friends or relatives with Android phones who will join a test for 14 days (only for a new personal account).

## Before your first upload: is the app id yours?

Every app on Google Play has a unique id, and it can never change after the first upload. This project's id is `io.github.jpashami.pixeltd`.

- **If you are publishing the original game:** keep it.
- **If this is your family's own copy:** change it first, to something with your GitHub name in it, for example `io.github.yourname.pixeltd`. Ask Claude Code: *"Change the Android app id to io.github.yourname.pixeltd"*. It needs changing in `capacitor.config.ts`, in `android/app/build.gradle` (`namespace` and `applicationId`), in `android/app/src/main/res/values/strings.xml`, and the folder of `MainActivity.java`. Change the app's name in the same places if you like.

## Step 1: make your upload key (once)

Google Play only accepts apps signed with a key that proves they come from you. You make this key once and use it for every update.

1. Open a terminal (in Windows, **PowerShell**) and run this, changing `you` to your Windows user name:

   ```powershell
   & "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v -keystore C:\Users\you\pixeltd-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```

   On a Mac the tool is at `/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool`.

2. It asks for a password (twice), then your name and a few details (your town and country are enough; the rest can be left blank), then confirms. **Write the password down somewhere safe.**
3. **Back up the file** `pixeltd-upload.jks` (a USB stick or your password manager). Keep it out of the project folder.

   If the key is ever lost, Google can reset it for you, because Play keeps its own signing key ("Play App Signing"). It takes a support request and a few days, so it's much easier not to lose it.

4. In the project, copy `android/keystore.properties.example` to `android/keystore.properties` and fill it in with the path to your key file (use forward slashes, like `C:/Users/you/pixeltd-upload.jks`) and your password.

`keystore.properties` and `.jks` files are ignored by git, so they are never uploaded to GitHub. Never send them to anyone.

## Step 2: build the app for Google Play

```bash
npm run android:bundle
```

This builds the game, copies it into the Android project and makes a signed **app bundle**. When it finishes, it prints where the file is:

```
android/app/build/outputs/bundle/release/app-release.aab
```

That `.aab` file is what you upload to Google Play.

### If the build fails

- **"JAVA_HOME is not set" or "java not found":** the build needs the Java that comes with Android Studio. In PowerShell, run this, then try again in the same window:

  ```powershell
  $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
  ```

- **"SDK location not found":** open the project once in Android Studio (`npm run android:open`) and let it finish syncing. It writes the SDK's location for you.
- **"No android/keystore.properties found":** the build still finishes, but unsigned, and Google Play will refuse it. Go back to Step 1.
- Anything else: ask Claude Code, pasting the error.

## Step 3: create your Google Play developer account

1. Go to [play.google.com/console](https://play.google.com/console) and sign up. Choose a **personal** account unless you have a registered business.
2. Pay the US$25 fee and verify your identity (Google asks for ID and a phone number; this can take a day or two).

## Step 4: create the app in Play Console

Press **Create app** and fill in:

- **App name:** Pixel Tower Defence (or your family's name for it)
- **Default language:** your language
- **App or game:** Game
- **Free or paid:** Free
- Tick the declarations.

## Step 5: fill in "App content"

Play Console's dashboard lists these forms under **Policy > App content**. The answers for this game:

| Form | Answer |
| --- | --- |
| Privacy policy | `https://jpashami.github.io/tower-defense-game/privacy.html` (a family copy: the same page on your own site, see below) |
| Ads | No, the app has no ads |
| App access | All functionality is available without special access |
| Content rating | Fill in the questionnaire (category: Game). It has cartoon or fantasy violence (towers defeat cartoon monsters), no blood, no realistic violence, no swearing, no gambling, no chat or sharing between users, no purchases. This usually gives a rating for everyone or ages 7+. |
| Target audience and content | Choose the age groups you want. If you include children under 13, Google applies its Families policy, which this game meets (no ads, no data collection), but expect a slower, closer review. "13 and over" is the quickest to get through. |
| Data safety | The app does **not** collect or share any user data. |
| Government apps, financial features, health, news | No |

**Your privacy policy page:** the game includes one at `public/privacy.html`. It goes live on your website the next time `main` is published (pushing to `main` publishes the website, so check with the family first). Open the address in a browser to make sure it works before you enter it. Read it through and change anything that isn't true for your copy, for example the contact link.

## Step 6: the store listing

Under **Grow users > Store presence > Main store listing**:

- **Short description** (up to 80 characters), for example:

  > Build towers, stop the monsters, and design your own levels. No ads, ever.

- **Full description**, for example:

  > Pixel Tower Defence is a cheerful pixel-art tower defence game for the whole family.
  >
  > Build archers, cannons, frost and lightning towers beside the road, and stop waves of goblins, knights, wolf riders and flying wyverns before they reach your castle. New enemies need new tactics: armour, flyers, healers and bosses.
  >
  > Make it your own: the Creator lets you draw your own levels and share them as short codes, and MY VERSION lets your family invent new enemies, towers and maps.
  >
  > Plays offline. No ads, no in-app purchases, no accounts and no data collected.

- **App icon:** `store/icon-512.png`
- **Feature graphic:** `store/feature-graphic.png`
- **Phone screenshots:** at least 2. Play the game on a phone held sideways and take screenshots (usually power + volume down). A title screen, a busy wave and the Creator make a good set. For tablets, add 2 from a tablet if you have one.

The two images in `store/` are drawn from the game's own art by `npm run icons`.

## Step 7: testing, then publishing

Google needs new personal accounts to test with real people before publishing to everyone.

1. **Internal testing** (optional, instant): under **Test and release > Testing > Internal testing**, create a release, upload `app-release.aab`, add your own family's email addresses as testers, and install it from the link it gives you. Good for a first check.
2. **Closed testing** (required for new personal accounts): create a closed testing release with the same `.aab`, add at least **12 testers** (by email list or a Google Group) and send them the opt-in link. They must stay opted in for **14 days in a row**. Ask them to play now and then.
3. **Apply for production:** after the 14 days, the dashboard offers **Apply for production**. Answer the questions about your test (what testers thought, what you changed).
4. **Production release:** once approved, create a production release, upload the bundle and send it for review. Reviews usually take a few days. Then the game is on Google Play.

## Updating the game later

1. Change the game as usual and test it.
2. Raise the version in `package.json`, for example `"version": "0.1.0"` to `"0.1.1"`. The Android build turns this into the version number Google needs, which must be higher for every upload (keep the second and third numbers below 100).
3. Run `npm run android:bundle` and upload the new `app-release.aab` as a new release on the same track.

## Later: the iPhone App Store

This isn't set up yet, because it needs things only you can provide:

- A **Mac** with **Xcode** (free from the Mac App Store). iPhone apps can't be built on Windows.
- An **Apple Developer Program** membership: US$99 a year, at [developer.apple.com/programs](https://developer.apple.com/programs/).

When you have them, on the Mac:

1. `npm install @capacitor/ios`, then `npx cap add ios`, then `npm run build && npx cap sync ios`.
2. `npx cap open ios` opens the project in Xcode. Under **Signing & Capabilities**, choose your team and a bundle id (for example `io.github.yourname.pixeltd`). Set the app to landscape only.
3. Add the app icon: a 1024x1024 version can be made by adding one line to `scripts/make-icons.mjs` (ask Claude Code).
4. **Product > Archive**, then **Distribute App** to upload it to App Store Connect.
5. In [App Store Connect](https://appstoreconnect.apple.com), test it with **TestFlight**, fill in the listing, the privacy answers ("Data Not Collected"), the age rating (cartoon violence, usually 9+), and send it for review.

Claude Code can do steps 1 to 3 for you on the Mac.
