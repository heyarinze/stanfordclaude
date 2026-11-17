// Tags offered in the submit forms and filters. Edit these lists to change the options.
// Older submissions may carry values that aren't listed here; filters still pick those up.

export const CLAUDE_PRODUCTS = [
  'Claude',
  'Claude Code',
  'Claude Cowork',
  'Claude Skills',
  'Claude API',
  'Claude Agent SDK',
  'MCP',
];

export const BUILD_CATEGORIES = [
  'Agent',
  'Learning',
  'Planning',
  'Productivity',
  'Research',
  'Reasoning',
  'Writing',
  'Creative',
  'Shopping',
  'Social',
  'Health',
  'Fun',
];

export const RESOURCE_CATEGORIES = ['How-To', 'Research', 'Fix-It', 'Hacks', 'Essays', 'Video', 'Course'];

// Keep in sync with firebase/firestore.rules.
export const LIMITS = {
  title: 80,
  desc: 600,
  howBuilt: 6000,
  why: 1000,
  name: 80,
  url: 500,
  otherTool: 80,
  otherTools: 10,
  tools: 10,
  categories: 6,
};
