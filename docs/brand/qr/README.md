# Adro QR code

All versions open **https://adroapp.com/get** (checked: they scan at small sizes too, the dark and blue ones included).

| File | Use |
|---|---|
| adro-qr.svg / .png | White, with "Get adro" under it (print, posters, the box) |
| adro-qr-plain.svg / .png | White, no text |
| adro-qr-dark.svg / .png | On black (the black box, dark slides) |
| adro-qr-blue.svg / .png | On Adro blue |

The SVG files are for print (sharp at any size). Keep the code at least 2 cm wide, with a small quiet border around it.

## Where it goes

adroapp.com/get is a small page (public/site/get.html):
- **Before launch** (now): opens the website, adroapp.com.
- **On launch day:** change `LIVE = false` to `LIVE = true` in public/site/get.html. Then iPhones go straight to the App Store page (apps.apple.com/app/id6826500429) and everyone else to the website.

The printed code never has to change: only the page behind it does. Android can be added the same way when the Play Store link exists.
