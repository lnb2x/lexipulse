(() => {
  if (!['5173', '4173'].includes(location.port) || window !== window.top) return;
  const origin = location.origin;
  const jobs = new Map();
  const reply = (requestId, kind, data = {}) => window.postMessage({
    channel: 'lexipulse-quizlet-v1', direction: 'extension', requestId, kind, ...data,
  }, origin);

  window.addEventListener('message', event => {
    const message = event.data;
    if (event.source !== window || event.origin !== origin || !message
      || message.channel !== 'lexipulse-quizlet-v1' || message.direction !== 'app'
      || typeof message.requestId !== 'string' || message.requestId.length > 100) return;
    const { requestId, kind } = message;
    if (kind === 'ping') {
      if (chrome.runtime.id) reply(requestId, 'ready');
      return;
    }
    if (kind === 'cancel') {
      jobs.get(requestId)?.disconnect();
      jobs.delete(requestId);
      return;
    }
    if (kind !== 'start' || typeof message.url !== 'string' || message.url.length > 2048 || jobs.has(requestId)) return;
    if (jobs.size) { reply(requestId, 'result', { result: { success: false, code: 'server_busy' } }); return; }
    try {
      const port = chrome.runtime.connect({ name: 'lexipulse-quizlet-v1' });
      jobs.set(requestId, port);
      let finished = false;
      port.onMessage.addListener(data => {
        if (data.kind === 'result') { finished = true; jobs.delete(requestId); }
        reply(requestId, data.kind, data.kind === 'result' ? { result: data.result } : { status: data.status });
      });
      port.onDisconnect.addListener(() => {
        void chrome.runtime.lastError;
        jobs.delete(requestId);
        if (!finished) reply(requestId, 'result', { result: { success: false, code: 'browser_disconnected' } });
      });
      port.postMessage({ url: message.url });
    } catch {
      reply(requestId, 'result', { result: { success: false, code: 'browser_disconnected' } });
    }
  });
})();
