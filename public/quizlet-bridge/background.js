import { readQuizletPage } from './extractor.js';

export function parseSetUrl(raw) {
  try {
    if (typeof raw !== 'string' || raw.length > 2048) return null;
    const url = new URL(raw);
    const match = url.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(\d+)(?:\/[^/]+)?\/?$/i);
    if (url.protocol !== 'https:' || !['quizlet.com', 'www.quizlet.com'].includes(url.hostname)
      || url.port || url.username || url.password || !match) return null;
    decodeURIComponent(url.pathname);
    url.search = ''; url.hash = '';
    return { url: url.href, id: match[1] };
  } catch { return null; }
}

export function allowedApp(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
      && ['5173', '4173'].includes(url.port) && !url.username && !url.password;
  } catch { return false; }
}

// Exported for lifecycle tests using a fake Chrome API; no live site is needed.
export function attachBridge(api) {
  let busy = false;
  api.runtime.onConnect.addListener(port => {
    if (port.name !== 'lexipulse-quizlet-v1' || port.sender?.frameId !== 0 || !allowedApp(port.sender?.url)) {
      port.disconnect(); return;
    }
    let started = false;
    let done = false;
    let ownsSlot = false;
    let tabId;
    let leaveOpen = false;
    let timer;
    let lastStatus;
    let deadline;
    const notify = data => { try { port.postMessage(data); } catch { /* Disconnected caller. */ } };
    const finish = async result => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (ownsSlot) { busy = false; ownsSlot = false; }
      if (result) notify({ kind: 'result', result });
      if (tabId !== undefined && !leaveOpen) await api.tabs.remove(tabId).catch(() => {});
      port.disconnect();
    };
    port.onDisconnect.addListener(() => { void finish(); });
    port.onMessage.addListener(async message => {
      if (started || done) return;
      started = true;
      const set = parseSetUrl(message?.url);
      if (!set) { await finish({ success: false, code: 'invalid_url' }); return; }
      if (busy) { await finish({ success: false, code: 'server_busy' }); return; }
      busy = true; ownsSlot = true;
      deadline = Date.now() + 180000;
      try {
        const tab = await api.tabs.create({ url: set.url, active: false });
        tabId = tab.id;
        if (done) { await api.tabs.remove(tabId).catch(() => {}); return; }
      } catch { await finish({ success: false, code: 'browser_disconnected' }); return; }
      const poll = async () => {
        if (done) return;
        if (Date.now() >= deadline) {
          await finish({ success: false, code: lastStatus === 'more_cards' ? 'incomplete_set'
            : lastStatus === 'verification' ? 'challenge_blocked'
            : lastStatus === 'login' ? 'quizlet_login_required' : 'no_terms_found' });
          return;
        }
        let tab;
        try { tab = await api.tabs.get(tabId); }
        catch { await finish({ success: false, code: 'browser_closed' }); return; }
        if (done) return;
        if (tab.status === 'complete') {
          let state;
          try {
            const output = await api.scripting.executeScript({ target: { tabId }, func: readQuizletPage, args: [set.id] });
            state = output[0]?.result;
          } catch {
            // A navigation may replace the document between tabs.get and injection.
            if (tab.url && !parseSetUrl(tab.url) && !/^https:\/\/(?:www\.)?quizlet\.com\/login(?:[/?#]|$)/.test(tab.url)) {
              leaveOpen = true;
              await finish({ success: false, code: 'blocked_resource' }); return;
            }
          }
          if (done) return;
          if (state?.state === 'success') { await finish(state.result); return; }
          if (state?.state === 'error') {
            leaveOpen = true;
            await finish({ success: false, code: state.code }); return;
          }
          const status = state?.status || 'loading';
          if (status !== lastStatus) {
            lastStatus = status;
            notify({ kind: 'progress', status });
            if (['verification', 'login', 'more_cards'].includes(status)) {
              leaveOpen = true;
              await api.tabs.update(tabId, { active: true }).catch(() => {});
            }
          }
        }
        if (!done) timer = setTimeout(poll, 1000);
      };
      void poll();
    });
  });
}

if (typeof chrome !== 'undefined') attachBridge(chrome);
