import { generateEmbedding, isEmbeddingModelCached } from '../lib/embeddings.js';
import { staleSyncHint } from '../lib/format.js';
import { hybridSearch } from '../lib/search.js';
import { getMeta } from '../lib/config.js';
import { hasAnyEmbeddings, listRepos } from '../lib/storage.js';
import { copyToClipboard, openUrl } from '../lib/system.js';
import { openScreen } from '../tui/screen.js';
import {
  applySemanticResults,
  handleKey,
  initialState,
  scrollIntoView,
  setQuery,
  type BrowseState,
} from '../tui/state.js';
import { listHeight, renderFrame } from '../tui/view.js';

// Typing pauses this long before the slower semantic search replaces keyword matches.
const SEMANTIC_DELAY_MS = 250;
const SEMANTIC_LIMIT = 50;
const MESSAGE_MS = 2500;
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export async function runBrowse(initialQuery = ''): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('`starepo browse` needs an interactive terminal; use `starepo search` (or `--json`) in scripts.');
  }

  const all = await listRepos();
  if (all.length === 0) throw new Error('No local data found. Run `starepo sync` first.');
  const semanticAvailable = isEmbeddingModelCached() && await hasAnyEmbeddings(all.length);

  let state: BrowseState = setQuery(initialState(all), initialQuery);
  let modelLoading = semanticAvailable;
  let spin = 0;
  const screen = openScreen();

  const draw = () => {
    state = scrollIntoView(state, listHeight(screen.width, screen.height));
    screen.render(renderFrame(state, {
      width: screen.width,
      height: screen.height,
      spinner: SPINNER_FRAMES[spin % SPINNER_FRAMES.length],
      semanticAvailable,
      modelLoading,
    }));
  };

  await new Promise<void>((resolve) => {
    let searchTimer: NodeJS.Timeout | undefined;
    let messageTimer: NodeJS.Timeout | undefined;
    const spinner = setInterval(() => {
      if (!state.searching && !modelLoading) return;
      spin++;
      draw();
    }, 80);

    const flash = (message: string, ms = MESSAGE_MS) => {
      state = { ...state, message };
      draw();
      clearTimeout(messageTimer);
      messageTimer = setTimeout(() => {
        state = { ...state, message: null };
        draw();
      }, ms);
    };

    const scheduleSearch = () => {
      clearTimeout(searchTimer);
      if (!semanticAvailable || !state.query.trim()) return;
      searchTimer = setTimeout(async () => {
        const query = state.query;
        state = { ...state, searching: true };
        draw();
        try {
          state = applySemanticResults(state, query, await hybridSearch(query, SEMANTIC_LIMIT));
          draw();
        } catch {
          if (query === state.query) flash('Semantic search failed; showing keyword matches');
        }
      }, SEMANTIC_DELAY_MS);
    };

    const finish = () => {
      clearInterval(spinner);
      clearTimeout(searchTimer);
      clearTimeout(messageTimer);
      screen.close();
      resolve();
    };

    screen.onResize(draw);
    screen.onKey((text, key) => {
      const pageSize = listHeight(screen.width, screen.height);
      const result = handleKey(state, text, key, pageSize);
      state = result.state;
      const repo = state.results[state.selected];

      switch (result.effect) {
        case 'quit':
          finish();
          return;
        case 'search':
          scheduleSearch();
          break;
        case 'open':
          if (repo) {
            void openUrl(repo.html_url).then((ok) => flash(ok ? `Opened ${repo.full_name}` : 'Could not launch a browser'));
          }
          break;
        case 'copy':
          if (repo) {
            void copyToClipboard(repo.html_url).then((ok) => flash(ok ? `Copied ${repo.html_url}` : 'No clipboard available'));
          }
          break;
      }
      draw();
    });

    draw();
    const stale = staleSyncHint(getMeta('last_sync'));
    if (stale) flash(stale, 5000);
    scheduleSearch();

    if (semanticAvailable) {
      // Load the model up front so the first semantic search doesn't stall.
      generateEmbedding('warm up')
        .catch(() => flash('Embedding model failed to load; keyword search only'))
        .finally(() => {
          modelLoading = false;
          draw();
        });
    }
  });
}
