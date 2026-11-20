"""Install a personal-data-free routine shell; use the existing guide projection."""
def install(staging):
    page = staging / "my-morning/index.html"
    text = page.read_text(encoding="utf-8")
    text = text.replace("your favorites stay on this device.", "your chosen cues and favorite lines stay on this device.")
    shell = '<section class="morning-routine" aria-labelledby="morning-routine-title"><h2 id="morning-routine-title">My cues</h2><p>Optional reminders you choose to read. Nothing plays or activates automatically.</p><div data-morning-routine></div></section>'
    text = text.replace('<nav class="affirmation-nav"', shell + '<h2>My affirmations</h2><nav class="affirmation-nav"', 1)
    text = text.replace('</body>', '<link rel="stylesheet" href="../assets/css/morning.css"><script src="../assets/js/morning.js" defer></script></body>')
    page.write_text(text, encoding="utf-8")
