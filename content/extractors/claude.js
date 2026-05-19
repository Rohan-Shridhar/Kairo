// content/extractors/claude.js — Claude.ai DOM extractor
// Selectors verified: May 2026 — review every 4-6 weeks

export default {
  platform: 'claude',

  extract() {
    let turns;

    // Strategy 1: data-testid attributes (most stable)
    turns = [...document.querySelectorAll('[data-testid="human-turn"], [data-testid="ai-turn"]')];
    if (turns.length) {
      console.log(`[Kairo Extractor] Claude: ${turns.length} turns (data-testid)`);
      return turns.map(el => ({
        role: el.dataset.testid === 'human-turn' ? 'user' : 'assistant',
        text: el.innerText.trim(),
      }));
    }

    // Strategy 2: user/assistant message wrappers
    turns = [...document.querySelectorAll('[data-is-streaming], .font-claude-message, .font-user-message')];
    if (turns.length) {
      console.log(`[Kairo Extractor] Claude: ${turns.length} turns (message wrappers)`);
      return turns.map(el => ({
        role: (el.classList.contains('font-user-message') || el.querySelector('[data-testid="human-turn"]')) ? 'user' : 'assistant',
        text: el.innerText.trim(),
      }));
    }

    // Strategy 3: conversation turn containers by role attribute
    turns = [...document.querySelectorAll('[data-role]')];
    if (turns.length) {
      console.log(`[Kairo Extractor] Claude: ${turns.length} turns (data-role)`);
      return turns.map(el => ({
        role: el.dataset.role === 'human' || el.dataset.role === 'user' ? 'user' : 'assistant',
        text: el.innerText.trim(),
      }));
    }

    // Strategy 4: universal — look for alternating content blocks in the main conversation area
    const conversationArea = document.querySelector('main') || document.querySelector('[class*="conversation"]') || document.querySelector('[role="main"]');
    if (conversationArea) {
      // Try to find any message-like containers
      turns = [...conversationArea.querySelectorAll('[class*="Message"], [class*="message"], [class*="Turn"], [class*="turn"], [class*="chat"]')];
      if (turns.length >= 2) {
        console.log(`[Kairo Extractor] Claude: ${turns.length} turns (class pattern match)`);
        return turns.map((el, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          text: el.innerText.trim(),
        })).filter(t => t.text.length > 0);
      }

      // Absolute last resort: grab all substantial text blocks from the conversation area
      const allDivs = [...conversationArea.querySelectorAll(':scope > div > div')];
      const textBlocks = allDivs.filter(el => el.innerText.trim().length > 20);
      if (textBlocks.length >= 2) {
        console.log(`[Kairo Extractor] Claude: ${textBlocks.length} blocks (last resort)`);
        return textBlocks.map((el, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          text: el.innerText.trim(),
        }));
      }
    }

    // Final fallback: grab everything visible in the page
    console.warn('[Kairo Extractor] Claude: using full-page text fallback');
    const bodyText = document.body.innerText.trim();
    if (bodyText.length > 50) {
      return [{ role: 'user', text: bodyText.slice(0, 8000) }];
    }

    return [];
  },
};
