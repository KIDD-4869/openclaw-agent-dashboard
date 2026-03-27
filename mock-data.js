// Mock data for development/demo
// Replace with your actual session data or use the API endpoint
window.MOCK_SESSIONS = [
  {
    key: "agent:main:main",
    kind: "main",
    label: "主会话",
    channel: "webchat",
    model: "claude-opus-4-6",
    contextTokens: 200000,
    totalTokens: 62988,
    updatedAt: Date.now() - 60000
  },
  {
    key: "agent:main:cron:example-cron-1",
    kind: "cron",
    label: "每日配置备份",
    channel: "unknown",
    model: "claude-sonnet-4-6",
    contextTokens: 200000,
    totalTokens: 68584,
    updatedAt: Date.now() - 3600000
  },
  {
    key: "agent:main:cron:example-cron-2",
    kind: "cron",
    label: "天气提醒",
    channel: "feishu",
    model: "claude-sonnet-4-5",
    contextTokens: 200000,
    totalTokens: 149694,
    updatedAt: Date.now() - 7200000
  },
  {
    key: "agent:main:cron:example-cron-3",
    kind: "cron",
    label: "Jira日报",
    channel: "feishu",
    model: "claude-sonnet-4-6",
    contextTokens: 200000,
    totalTokens: 23302,
    updatedAt: Date.now() - 86400000
  },
  {
    key: "agent:main:feishu:group:example_group_1",
    kind: "group",
    label: "示例群聊 A",
    channel: "feishu",
    model: "claude-sonnet-4-5",
    contextTokens: 200000,
    totalTokens: 146179,
    updatedAt: Date.now() - 5400000
  },
  {
    key: "agent:main:feishu:group:example_group_2",
    kind: "group",
    label: "示例群聊 B",
    channel: "feishu",
    model: "claude-opus-4-6",
    contextTokens: 200000,
    totalTokens: 5294,
    updatedAt: Date.now() - 14400000
  }
];
