async function request(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

export const api = {
  agents: () => request('/api/agents'),
  subagents: () => request('/api/subagents'),
  cron: () => request('/api/cron'),
  usage: (days = 30) => request('/api/usage?days=' + days),
  gatewayStatus: () => request('/api/gateway/status'),
  tasks: (agentId) => request('/api/subagents/' + encodeURIComponent(agentId) + '/tasks'),
  taskPreview: (agentId, sessionKey) =>
    request('/api/subagents/' + encodeURIComponent(agentId) + '/tasks/' + encodeURIComponent(sessionKey) + '/preview'),
  tools: (agentId, limit = 200, tool = null) => {
    let url = '/api/subagents/' + encodeURIComponent(agentId) + '/tools?limit=' + limit;
    if (tool) url += '&tool=' + encodeURIComponent(tool);
    return request(url);
  },
  cancelTask: (sk) => request('/api/tasks/' + encodeURIComponent(sk) + '/cancel', { method: 'POST' }),
  pauseTask: (sk) => request('/api/tasks/' + encodeURIComponent(sk) + '/pause', { method: 'POST' }),
  resumeTask: (sk) => request('/api/tasks/' + encodeURIComponent(sk) + '/resume', { method: 'POST' }),
  cronRun: (jobId) => request('/api/cron/' + encodeURIComponent(jobId) + '/run', { method: 'POST' }),
  markFailed: (sk) => request('/api/tasks/' + encodeURIComponent(sk) + '/fail', { method: 'POST' }),
  discussions: () => request('/api/discussions'),
  discussion: (id) => request('/api/discussions/' + id),
  discussionDelete: (id) => request('/api/discussions/' + id, { method: 'DELETE' }),
  discussionInject: (id, content) =>
    request('/api/discussions/' + id + '/inject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }),
  startDiscussion: (topic, agents, rounds) => {
    // Returns the raw Response for SSE streaming
    return fetch('/api/discuss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, agents, rounds }),
    });
  },
  files: () => request('/api/files'),
  settings: () => request('/api/settings'),
  settingsStorage: () => request('/api/settings/storage'),
  settingsUpdate: (data) => request('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
};
