// Colors from GitHub Linguist (github-linguist/linguist languages.yml), so the
// dot next to a language matches what users already see on github.com.
const LANGUAGE_COLORS: Record<string, string> = {
  'Assembly': '#6e4c13',
  'Astro': '#ff5a03',
  'C': '#555555',
  'C#': '#178600',
  'C++': '#f34b7d',
  'Clojure': '#db5855',
  'CSS': '#563d7c',
  'Dart': '#00b4ab',
  'Dockerfile': '#384d54',
  'Elixir': '#6e4a7e',
  'Emacs Lisp': '#c065db',
  'Go': '#00add8',
  'Haskell': '#5e5086',
  'HTML': '#e34c26',
  'Java': '#b07219',
  'JavaScript': '#f1e05a',
  'Julia': '#a270ba',
  'Jupyter Notebook': '#da5b0b',
  'Kotlin': '#a97bff',
  'Lua': '#000080',
  'Makefile': '#427819',
  'MDX': '#fcb32c',
  'Nix': '#7e7eff',
  'Objective-C': '#438eff',
  'OCaml': '#ef7a08',
  'Perl': '#0298c3',
  'PHP': '#4f5d95',
  'PowerShell': '#012456',
  'Python': '#3572a5',
  'R': '#198ce7',
  'Ruby': '#701516',
  'Rust': '#dea584',
  'Scala': '#c22d40',
  'SCSS': '#c6538c',
  'Shell': '#89e051',
  'Solidity': '#aa6746',
  'Svelte': '#ff3e00',
  'Swift': '#f05138',
  'TeX': '#3d6117',
  'TypeScript': '#3178c6',
  'Vim Script': '#199f4b',
  'Vue': '#41b883',
  'Zig': '#ec915c',
};

const SHORT_NAMES: Record<string, string> = {
  'Jupyter Notebook': 'Jupyter',
  'Emacs Lisp': 'Elisp',
  'Vim Script': 'Vim',
};

export function languageColor(language: string): string | undefined {
  return LANGUAGE_COLORS[language];
}

/** A compact display name, so long names like "Jupyter Notebook" don't widen the column. */
export function shortLanguageName(language: string): string {
  return SHORT_NAMES[language] ?? language;
}
