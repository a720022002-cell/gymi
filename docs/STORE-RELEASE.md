# Putting Gymi on the App Store and Google Play

Everything in the code is ready for the phone apps. The steps below need **your** accounts, so only you can do them.

## What is already done

- Phone camera: barcode scanning and photos (meals, labels, machines, lab reports, progress) work in the phone app.
- Daily reminders (check-in, water, meals, training, vitamins) are scheduled on the phone.
- Delete account and download data (Apple and Google require this). Deleting runs on the server only.
- Privacy policy and terms pages inside the app (You → Account).
- App settings for the stores: app name, icons, splash, bundle id `com.gymi.app`, camera and photo permission texts, and build profiles in `eas.json`.

## What you need to do

1. **Make the store accounts**
   - Apple Developer Program (about 99 USD a year): https://developer.apple.com/programs/
   - Google Play Console (25 USD once): https://play.google.com/console
2. **Make an Expo account** (free): https://expo.dev/signup
3. **Give me an Expo access token, without pasting it in the chat**
   - On expo.dev: Account settings → Access tokens → Create token.
   - Add it to **this Claude Code environment** as a secret named **`EXPO_TOKEN`**.
   - Then tell me "build the phone apps". I will run the cloud builds (`eas build`) for iPhone and Android.
4. **First upload to the stores**
   - Apple asks you to sign in once during the first iPhone build (it makes the certificates for you).
   - For Google, the first upload of the Android file is done by hand in the Play Console; after that I can send updates.
5. **Store pages**: app description, screenshots and the privacy questions. I can write the text and make the screenshots when you're ready.

## Things that come after launch

- **Paid plans (Gymi Pro)**: the plan screen is ready. Real payments need the store accounts first, then a payments service (RevenueCat). When you get there, I'll tell you the exact key names and where to add them.
- **Apple Health, Health Connect, WHOOP, Garmin**: these need the phone app to be live first. The Your readings screen already shows what Gymi tracks from your own logs.
- **Coach approval**: new coaches wait as "under review". Approving them is done by our team in the database for now. Ask me and I'll approve a coach for you.
