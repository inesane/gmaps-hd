// Matches Google image/video CDN domains
const GOOGLE_IMG_RE = /(lh[3-6]\.(googleusercontent\.com|ggpht\.com)|geo[0-3]\.ggpht\.com|streetviewpixels-pa\.googleapis\.com)/;

// =============================================================
// Detect whether current Maps page is showing a video or image
// In Google Maps URLs: !1e5 = video, !1e2 = photo
// =============================================================

function detectMediaType() {
  const url = decodeURIComponent(window.location.href);
  if (url.includes("!1e5")) return "video";
  if (url.includes("!1e2")) return "image";
  // Check for <video> element on page
  const video = document.querySelector("video");
  if (video) return "video";
  return "image";
}

// =============================================================
// STRATEGY 1: Parse the Google Maps URL for embedded media URLs
// =============================================================

function extractMediaFromPageUrl() {
  const url = decodeURIComponent(window.location.href);
  const matches = url.match(/https?:\/\/lh[3-6]\.googleusercontent\.com\/[^\s!,;)]+/g);
  if (matches && matches.length > 0) {
    return matches[0].replace(/%3D/g, "=");
  }
  return null;
}

// =============================================================
// STRATEGY 2: Find <video> element source URL
// =============================================================

function findVideoSource() {
  // Check for <video> elements
  const videos = document.querySelectorAll("video");
  for (const video of videos) {
    // Direct src
    if (video.src && !video.src.startsWith("blob:")) return video.src;

    // <source> children
    for (const source of video.querySelectorAll("source")) {
      if (source.src && !source.src.startsWith("blob:")) return source.src;
    }

    // currentSrc
    if (video.currentSrc && !video.currentSrc.startsWith("blob:")) return video.currentSrc;
  }
  return null;
}

// =============================================================
// STRATEGY 3: Persistent download bar
// =============================================================

let downloadBar = null;
let lastUrl = window.location.href;

function createDownloadBar() {
  const bar = document.createElement("div");
  bar.id = "gmaps-hd-bar";
  bar.innerHTML = `
    <span id="gmaps-hd-bar-type"></span>
    <button id="gmaps-hd-bar-btn">Download HD</button>
    <select id="gmaps-hd-bar-quality" style="display:none">
      <option value="dv">Best available</option>
      <option value="m37">1080p</option>
      <option value="m22">720p</option>
      <option value="m18">360p</option>
    </select>
    <span id="gmaps-hd-bar-status"></span>
  `;
  document.body.appendChild(bar);

  bar.querySelector("#gmaps-hd-bar-btn").addEventListener("click", () => {
    handleDownload();
  });

  return bar;
}

function handleDownload() {
  const mediaType = detectMediaType();
  const status = document.querySelector("#gmaps-hd-bar-status");
  const qualitySelect = document.querySelector("#gmaps-hd-bar-quality");

  if (mediaType === "video") {
    // Try to get video from <video> element first
    const videoSrc = findVideoSource();
    if (videoSrc) {
      chrome.runtime.sendMessage({ action: "download-video", url: videoSrc });
      status.textContent = "Downloading video...";
      setTimeout(() => { status.textContent = ""; }, 3000);
      return;
    }

    // Fall back to constructing video URL from the thumbnail/media URL
    const mediaUrl = extractMediaFromPageUrl() || findLargestGoogleMedia();
    if (mediaUrl) {
      const quality = qualitySelect.value;
      const baseUrl = mediaUrl.replace(/=[wsh]\d+.*$/, "");
      chrome.runtime.sendMessage({
        action: "download-video",
        url: baseUrl + "=" + quality,
        filename: "gmaps-video-" + Date.now()
      });
      status.textContent = "Downloading video (" + qualitySelect.selectedOptions[0].text + ")...";
      setTimeout(() => { status.textContent = ""; }, 3000);
    } else {
      status.textContent = "No video found";
      setTimeout(() => { status.textContent = ""; }, 2000);
    }
  } else {
    // Image download
    const url = extractMediaFromPageUrl() || findLargestGoogleMedia();
    console.log("[GMaps HD] Downloading image URL:", url);
    if (url) {
      chrome.runtime.sendMessage({ action: "download-hd", url });
      status.textContent = "Downloading image...";
      setTimeout(() => { status.textContent = ""; }, 2000);
    } else {
      status.textContent = "No image found";
      setTimeout(() => { status.textContent = ""; }, 2000);
    }
  }
}

function updateDownloadBar() {
  if (!downloadBar) return;

  const mediaType = detectMediaType();
  const typeLabel = downloadBar.querySelector("#gmaps-hd-bar-type");
  const qualitySelect = downloadBar.querySelector("#gmaps-hd-bar-quality");
  const btn = downloadBar.querySelector("#gmaps-hd-bar-btn");

  if (mediaType === "video") {
    typeLabel.textContent = "Video";
    typeLabel.style.color = "#f44336";
    qualitySelect.style.display = "inline-block";
    btn.textContent = "Download Video";
  } else {
    typeLabel.textContent = "Photo";
    typeLabel.style.color = "#4caf50";
    qualitySelect.style.display = "none";
    btn.textContent = "Download HD";
  }
}

// =============================================================
// DOM scanning for Google media
// =============================================================

function findLargestGoogleMedia() {
  let best = null;
  let bestArea = 0;

  // Check <img> tags first (fastest, most reliable)
  for (const img of document.querySelectorAll("img")) {
    if (!GOOGLE_IMG_RE.test(img.src || "")) continue;
    const rect = img.getBoundingClientRect();
    const area = rect.width * rect.height;
    if (area > bestArea && rect.width > 30 && rect.height > 30) {
      best = img.src;
      bestArea = area;
    }
  }
  if (best) return best;

  // Check elements with background-image
  for (const el of document.querySelectorAll("[style]")) {
    const url = extractGoogleUrl(el);
    if (!url) continue;
    const rect = el.getBoundingClientRect();
    const area = rect.width * rect.height;
    if (area > bestArea && rect.width > 30 && rect.height > 30) {
      best = url;
      bestArea = area;
    }
  }

  // Check <a> tags
  if (!best) {
    for (const a of document.querySelectorAll("a[href]")) {
      if (!GOOGLE_IMG_RE.test(a.href || "")) continue;
      if (!a.href.includes("googleusercontent.com/") && !a.href.includes("ggpht.com/")) continue;
      const rect = a.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > bestArea && rect.width > 30 && rect.height > 30) {
        best = a.href;
        bestArea = area;
      }
    }
  }

  return best;
}

function extractGoogleUrl(el) {
  if (!el || el.nodeType !== 1) return null;

  if (el.tagName === "IMG" && GOOGLE_IMG_RE.test(el.src || "")) return el.src;

  if (el.tagName === "A" && GOOGLE_IMG_RE.test(el.href || "")) {
    if (el.href.includes("googleusercontent.com/") || el.href.includes("ggpht.com/")) {
      return el.href;
    }
  }

  // background-image via style property
  const bgImg = el.style.backgroundImage;
  if (bgImg && bgImg !== "none" && GOOGLE_IMG_RE.test(bgImg)) {
    const m = bgImg.match(/url\(["']?(https?:\/\/[^"')]+)["']?\)/);
    if (m) return m[1];
  }

  // Computed background-image
  try {
    const computed = getComputedStyle(el).backgroundImage;
    if (computed && computed !== "none" && GOOGLE_IMG_RE.test(computed)) {
      const m = computed.match(/url\(["']?(https?:\/\/[^"')]+)["']?\)/);
      if (m) return m[1];
    }
  } catch (e) {}

  return null;
}

// =============================================================
// Hover detection with deep search
// =============================================================

let hdButton = null;
let currentEl = null;

function getOrCreateButton() {
  if (!hdButton) {
    const btn = document.createElement("button");
    btn.id = "gmaps-hd-hover-btn";
    btn.textContent = "HD";
    btn.title = "Download full resolution";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const url = btn.dataset.url;
      const isVideo = btn.dataset.isVideo === "true";
      if (url) {
        if (isVideo) {
          const baseUrl = url.replace(/=[wsh]\d+.*$/, "");
          chrome.runtime.sendMessage({ action: "download-video", url: baseUrl + "=m37" });
        } else {
          chrome.runtime.sendMessage({ action: "download-hd", url });
        }
        btn.textContent = "...";
        setTimeout(() => { btn.textContent = "HD"; }, 1500);
      }
    }, true);
    btn.addEventListener("mouseleave", () => { hideHoverButton(); });
    document.body.appendChild(btn);
    hdButton = btn;
  }
  return hdButton;
}

function showHoverButton(el, url) {
  const btn = getOrCreateButton();
  const rect = el.getBoundingClientRect();
  if (rect.width < 40 || rect.height < 40) return;
  const isVideo = detectMediaType() === "video";
  btn.dataset.url = url;
  btn.dataset.isVideo = isVideo;
  btn.textContent = isVideo ? "Video" : "HD";
  btn.style.top = `${rect.top + 6}px`;
  btn.style.left = `${rect.right - (isVideo ? 68 : 54)}px`;
  btn.style.display = "block";
  currentEl = el;
}

function hideHoverButton() {
  if (hdButton) {
    hdButton.style.display = "none";
    currentEl = null;
  }
}

document.addEventListener("mouseover", (e) => {
  const found = findGoogleImageNear(e.target);
  if (found) showHoverButton(found.el, found.url);
}, { passive: true });

document.addEventListener("mouseout", (e) => {
  const related = e.relatedTarget;
  if (hdButton && (related === hdButton || (hdButton.contains && hdButton.contains(related)))) return;
  if (currentEl && currentEl.contains(related)) return;
  setTimeout(() => {
    if (hdButton && hdButton.matches(":hover")) return;
    if (currentEl && currentEl.matches(":hover")) return;
    hideHoverButton();
  }, 150);
}, { passive: true });

function findGoogleImageNear(startEl) {
  let el = startEl;
  for (let up = 0; up < 15 && el; up++) {
    const url = extractGoogleUrl(el);
    if (url) return { el, url };
    const childResult = searchChildren(el, 3);
    if (childResult) return childResult;
    el = el.parentElement;
  }
  return null;
}

function searchChildren(el, depth) {
  if (depth <= 0 || !el.children) return null;
  for (const child of el.children) {
    if (child.id && child.id.startsWith("gmaps-hd")) continue;
    const url = extractGoogleUrl(child);
    if (url) return { el: child, url };
    const deeper = searchChildren(child, depth - 1);
    if (deeper) return deeper;
  }
  return null;
}

// Reposition on scroll
window.addEventListener("scroll", () => {
  if (currentEl && hdButton && hdButton.style.display === "block") {
    const rect = currentEl.getBoundingClientRect();
    hdButton.style.top = `${rect.top + 6}px`;
    hdButton.style.left = `${rect.right - 54}px`;
  }
}, { passive: true });

// =============================================================
// UI management and SPA navigation monitoring
// =============================================================

function updateUI() {
  const isGmaps = window.location.hostname.includes("google.com") &&
                  window.location.pathname.includes("/maps");

  if (isGmaps) {
    if (!downloadBar) downloadBar = createDownloadBar();
    downloadBar.style.display = "flex";
    updateDownloadBar();
  } else if (downloadBar) {
    downloadBar.style.display = "none";
  }
}

// Poll for URL changes every 500ms — MutationObserver misses SPA navigations
setInterval(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    updateUI();
  }
}, 500);

updateUI();
