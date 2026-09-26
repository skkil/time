const normalize = (text: string) => text.toLowerCase().normalize('NFC').trim();

function termScore(title: string, body: string, term: string) {
  if (title.startsWith(term)) return 0.9;
  const words = title.split(/[\s\-_/.,:;()]+/);
  if (words.some((word) => word.startsWith(term))) return 0.8;
  if (title.includes(term)) return 0.6;
  const bodyWords = body.split(/[\s\-_/.,:;()]+/);
  if (bodyWords.some((word) => word.startsWith(term))) return 0.3;
  return 0;
}

export function searchScore(title: string, body: string, query: string) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 1;
  const heading = normalize(title);
  const text = normalize(body);
  const phrase = terms.join(' ');
  if (heading === phrase) return 1;
  if (heading.startsWith(phrase)) return 0.95;
  let score = 1;
  for (const term of terms) {
    const found = termScore(heading, text, term);
    if (found === 0) return 0;
    score = Math.min(score, found);
  }
  return score;
}
