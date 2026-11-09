export type PhraseRule<T, C> = {
  pattern: string;
  resolve: (groups: string[], context: C) => T | undefined;
  phraseOnly?: boolean;
};

export type RuleTable<T, C> = {
  pattern: string;
  parse: (phrase: string, context: C) => T | undefined;
};

export function ruleTable<T, C>(rules: PhraseRule<T, C>[]): RuleTable<T, C> {
  const anchored = rules.map((rule) => ({
    regex: new RegExp(`^(?:${rule.pattern})$`, 'iu'),
    resolve: rule.resolve,
  }));
  return {
    pattern: rules
      .filter((rule) => !rule.phraseOnly)
      .map((rule) => rule.pattern)
      .join('|'),
    parse: (phrase, context) => {
      const text = phrase.trim().replace(/\s+/g, ' ');
      for (const { regex, resolve } of anchored) {
        const match = regex.exec(text);
        if (match) return resolve([...match], context);
      }
      return undefined;
    },
  };
}
