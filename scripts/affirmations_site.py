"""Static, personal-data-free shells for the optional affirmations helper."""


def page(morning=False):
    title = "My Morning" if morning else "Affirmations"
    description = ("A quiet space for the lines you choose. Bookmark this page; your favorites stay on this device."
                   if morning else "Optional words for reflection. Choose what feels believable today, adapt it, or leave it aside.")
    return f'''<div class="affirmations-page" data-affirmations-view="{'morning' if morning else 'library'}">
<header class="page-intro"><h1>{title}</h1><p>{description}</p></header>
<nav class="affirmation-nav" aria-label="Affirmation pages"><a href="../affirmations/" {'aria-current="page"' if not morning else ''}>Affirmation library</a><a href="../my-morning/" {'aria-current="page"' if morning else ''}>My Morning</a></nav>
<details class="affirmation-help-details"><summary>Privacy{' and writing tips' if not morning else ''}</summary><p>Your lines stay in this browser. Private backup and reset are in Preferences; backups may contain personal text. Nothing is uploaded.</p>
{'<p class="affirmation-tip">Try a line you can believe: name a small choice within reach, in your own words. Present tense is optional. These prompts are not OCF instructions or promises of results.</p>' if not morning else ''}</details>
<div data-affirmation-controls hidden><button type="button" data-affirmation-add>Add my own line</button>
{'<p class="affirmation-help">♥ saves a favorite to My Morning. Favorites are saved in this browser.</p>' if not morning else ''}
{'<div class="affirmation-filters"><label>Search affirmations <input type="search" maxlength="200" data-affirmation-search></label><label>Category <select aria-label="Filter by category" data-affirmation-category><option value="">All categories</option></select></label><button type="button" data-affirmation-clear>Clear filters</button></div>' if not morning else ''}</div>
<p data-affirmation-status role="status" tabindex="-1">Loading optional local tools…</p><p data-affirmation-count></p><ul class="affirmation-list" data-affirmation-list></ul>
<noscript><p>Affirmations and My Morning need JavaScript. No personal lines are included in this page or sent to a server.</p></noscript></div>
<link rel="stylesheet" href="../assets/css/affirmations.css"><script src="../assets/js/affirmations.js" defer></script>'''
