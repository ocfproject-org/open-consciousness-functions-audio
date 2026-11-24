const {expect} = require('@playwright/test');
async function openPreferences(page) {
  const dialog=page.locator('#preferences');
  if (!await dialog.isVisible()) await page.locator('.site-header [data-preferences-open]').click();
  await expect(dialog).toBeVisible();
}
async function closePreferences(page) {
  await page.locator('[data-preferences-close]').click();
  await expect(page.locator('#preferences')).not.toBeVisible();
}
async function selectPreference(page,label,value) {
  await openPreferences(page);
  await page.getByLabel(label,{exact:true}).selectOption(value);
  await closePreferences(page);
}

module.exports={openPreferences,closePreferences,selectPreference};
