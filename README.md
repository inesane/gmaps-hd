# gmaps-hd

A Chrome extension that downloads Google Maps photos and videos at their highest available quality.

> **Note:** This extension is not available on the Chrome Web Store. It was rejected because downloading Google Maps media violates Google's Terms of Service. You can still install it manually as an unpacked extension for personal use — but be aware that doing so may conflict with Google Maps ToS.

## Features

- **Download HD photos** — Replaces Google's size-limited URL parameters with `=s0` to fetch the original full-resolution image
- **Download videos** — Downloads place videos in selectable quality (best available, 1080p, 720p, 360p)
- **Automatic detection** — Detects whether you're viewing a photo or video and adjusts the download button accordingly
- **Multiple detection strategies** — Parses the Maps URL, scans `<img>` tags, background images, and `<video>` elements to find media on any page layout (place pages, contributor profiles, photo viewer)

## Install (manual / unpacked)

1. Clone this repo
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the cloned directory

## Usage

A **Download HD** / **Download Video** button appears in the bottom-right corner on any Google Maps page. Click it to download the currently viewed media at full quality.

For videos, a quality dropdown lets you choose between:
- Best available
- 1080p
- 720p
- 360p

## How it works

Google serves images and videos from `lh3-6.googleusercontent.com` with size parameters in the URL suffix:

| Suffix | Result |
|--------|--------|
| `=w600-h988-p-k-no` | Resized to 600x988 |
| `=s4000` | Longest edge capped at 4000px |
| `=s0` | **Original resolution, no resizing** |
| `=dv` | Best available video quality |
| `=m37` | 1080p MP4 video |

The extension replaces whatever size suffix Google uses with `=s0` for images or the selected quality parameter for videos.

## Supported pages

- Place pages (`/maps/place/...`)
- Contributor profiles (`/maps/contrib/...`)
- Photo viewer (full-screen image/video view)
