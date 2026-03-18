// Listen for download requests from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "download-hd") {
    const hdUrl = msg.url.replace(/=[wsh]\d+.*$/, "=s0");
    chrome.downloads.download({
      url: hdUrl,
      filename: generateFilename(hdUrl, "jpg")
    });
    sendResponse({ success: true });
  }
  if (msg.action === "download-video") {
    chrome.downloads.download({
      url: msg.url,
      filename: generateFilename(msg.url, "mp4")
    });
    sendResponse({ success: true });
  }
});

function generateFilename(url, ext) {
  const match = url.match(/\/([\w-]{10,20})[=?]/);
  const id = match ? match[1] : Date.now().toString();
  return `${id}.${ext}`;
}
