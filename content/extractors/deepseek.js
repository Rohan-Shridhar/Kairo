// content/extractors/deepseek.js — DeepSeek DOM extractor
// Selectors verified: May 2026

export default {
  platform: 'deepseek',

  extract() {
    let turns;

    // Strategy 1: chat-message class
    turns = [...document.querySelectorAll('.chat-message')];
    if (turns.length) {
      console.log(`[Kairo Extractor] DeepSeek: ${turns.length} turns (chat-message)`);
      return turns.map(el => ({
        role: el.classList.contains('user') ? 'user' : 'assistant',
        text: el.innerText.trim(),
      })).filter(t => t.text.length > 0);
    }

    // Strategy 2: data-role attributes
    turns = [...document.querySelectorAll('[data-role]')];
    if (turns.length) {
      console.log(`[Kairo Extractor] DeepSeek: ${turns.length} turns (data-role)`);
      return turns.map(el => ({
        role: el.dataset.role === 'user' ? 'user' : 'assistant',
        text: el.innerText.trim(),
      })).filter(t => t.text.length > 0);
    }

    // Strategy 3: message class patterns
    turns = [...document.querySelectorAll('[class*="ChatMessage"], [class*="chat-message"], [class*="Message"]')];
    if (turns.length) {
      console.log(`[Kairo Extractor] DeepSeek: ${turns.length} turns (ChatMessage class)`);
      return turns.map(el => {
        const classStr = el.classList.toString().toLowerCase();
        const isUser = classStr.includes('user') || el.querySelector('[class*="user"]') !== null;
        return {
          role: isUser ? 'user' : 'assistant',
          text: el.innerText.trim(),
        };
      }).filter(t => t.text.length > 0);
    }

    // Strategy 4: general conversation area
    const mainArea = document.querySelector('main') || document.querySelector('[role="main"]') || document.querySelector('[class*="chat"]');
    if (mainArea) {
      turns = [...mainArea.querySelectorAll('[class*="message"], [class*="turn"], .markdown')];
      if (turns.length >= 2) {
        console.log(`[Kairo Extractor] DeepSeek: ${turns.length} turns (generic)`);
        return turns.map((el, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          text: el.innerText.trim(),
        })).filter(t => t.text.length > 0);
      }
    }

    // Final fallback
    console.warn('[Kairo Extractor] DeepSeek: using full-page text fallback');
    const bodyText = document.body.innerText.trim();
    if (bodyText.length > 50) {
      return [{ role: 'user', text: bodyText.slice(0, 8000) }];
    }

    return [];
  },
};
