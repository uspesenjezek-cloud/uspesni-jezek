const { chromium } = require('C:/Users/jkjob/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const errors = [];

  async function odpri(width, height, label) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    page.on('pageerror', (error) => errors.push(label + ' pageerror: ' + error.message));
    page.on('console', (message) => {
      const messageText = message.text();
      if (message.type() === 'error' && !messageText.includes('favicon') && !messageText.includes('ERR_NETWORK_ACCESS_DENIED') && !messageText.includes('404')) errors.push(label + ' console: ' + messageText);
    });
    await page.addInitScript(() => {
      sessionStorage.setItem('neplacilo-korak1-podatki', JSON.stringify({ imeDolznika: 'Testni dolžnik', znesek: '9446,00', telefonDolznika: '994949', emailDolznika: 'test@example.com', datumZapadlosti: '2026-08-20' }));
      sessionStorage.setItem('neplacilo-korak2-podatki', JSON.stringify({ potrjen: true, sporociloDolzniku: 'Prosimo za plačilo.', sporociloKanali: { sms: true, email: true }, dodatki: { rok: false, obrocno: false, trr: false }, dodatekBesedila: { rok: '', obrocno: '', trr: '' } }));
    });
    await page.goto('http://localhost:8001/app/neplacila-posiljanje.html?app-preview=1&reference=1', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.getElementById('opomin-bridge-obrocno').click());
    await page.waitForTimeout(200);
    if (label === 'reference') {
      await page.locator('.obrocno-sheet__nacin').screenshot({ path: 'output/playwright/delno-obrocno-equal-width-installment.png' });
    }
    await page.locator('#obrocno-sheet-nacin-delno').click();
    await page.waitForTimeout(350);
    return page;
  }

  async function izmeri(page) {
    return page.evaluate(() => {
      const section = document.querySelector('#obrocno-sheet .delno-resitev');
      const rect = section && section.getBoundingClientRect();
      const fitElements = section ? [...section.querySelectorAll('[data-fit-text]')] : [];
      const clipped = fitElements.filter((element) => element.scrollWidth > element.clientWidth + 0.5 || element.scrollHeight > element.clientHeight + 0.5).map((element) => ({ text: (element.textContent || '').trim(), client: [element.clientWidth, element.clientHeight], scroll: [element.scrollWidth, element.scrollHeight] }));
      const rows = section ? [...section.querySelectorAll('[data-delno-predlog-vrstica]')] : [];
      const headers = section ? [...section.querySelectorAll('[data-delno-preostanek]')] : [];
      const firstRect = headers[0] && headers[0].getBoundingClientRect();
      const secondRect = headers[1] && headers[1].getBoundingClientRect();
      const paymentModeButtons = [...document.querySelectorAll('#obrocno-sheet .obrocno-sheet__nacin-gumb')];
      const paymentModeWidths = paymentModeButtons.map((button) => button.getBoundingClientRect().width);
      return {
        section: rect ? { width: rect.width, height: rect.height } : null,
        rowCount: rows.length,
        checkedMode: section && section.querySelector('[data-delno-preostanek][aria-checked="true"]')?.dataset.delnoPreostanek,
        activeHeader: section && section.querySelector('[data-delno-preostanek].is-active')?.dataset.delnoPreostanek || null,
        activeProposal: section && section.querySelector('[data-delno-predlog-vrstica].is-active')?.dataset.delnoPredlogVrstica || null,
        activeIndicators: section ? section.querySelectorAll('.delno-resitev__indikator.is-active').length : 0,
        indicatorSize: section ? getComputedStyle(section.querySelector('.delno-resitev__indikator')).width : null,
        panelHidden: section ? section.querySelector('.delno-resitev__vsebina').hidden : null,
        headerGap: firstRect && secondRect ? secondRect.left - firstRect.right : null,
        headerWidthDiff: firstRect && secondRect ? Math.abs(firstRect.width - secondRect.width) : null,
        headerTexts: headers.map((header) => (header.querySelector('strong')?.textContent || '').trim().replace(/\s+/g, ' ')),
        headerBackgrounds: headers.map((header) => getComputedStyle(header).backgroundColor),
        paymentModeWidths,
        paymentModeWidthDiff: paymentModeWidths.length === 2 ? Math.abs(paymentModeWidths[0] - paymentModeWidths[1]) : null,
        starCount: section ? section.querySelectorAll('.delno-resitev__zvezdica:not(:empty)').length : 0,
        recommendationTextCount: section ? [...section.querySelectorAll('*')].filter((element) => element.children.length === 0 && element.textContent.trim() === 'Priporočeno').length : 0,
        clipped,
        bodyWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
      };
    });
  }

  async function izmeriPriporocilo(page) {
    return page.evaluate(() => {
      const card = document.querySelector('#obrocno-sheet-recommendation .recommendation-card');
      if (!card) return null;
      const title = card.querySelector('.recommendation-card__title');
      const description = card.querySelector('.recommendation-card__description');
      const badge = card.querySelector('.recommendation-card__badge');
      const apply = card.querySelector('.recommendation-card__button--apply');
      const rect = card.getBoundingClientRect();
      const applyRect = apply && apply.getBoundingClientRect();
      const style = getComputedStyle(card);
      const clipped = [title, description, badge, apply].filter(Boolean).filter((element) => element.scrollWidth > element.clientWidth + 0.5 || element.scrollHeight > element.clientHeight + 0.5).map((element) => (element.textContent || '').trim());
      return {
        width: rect.width,
        height: rect.height,
        display: style.display,
        borderRadius: style.borderRadius,
        title: (title?.textContent || '').trim(),
        titleDisplay: title ? getComputedStyle(title).display : null,
        description: (description?.textContent || '').trim(),
        descriptionDisplay: description ? getComputedStyle(description).display : null,
        badge: (badge?.textContent || '').trim(),
        applyText: (apply?.textContent || '').trim(),
        applyWidth: applyRect ? applyRect.width : 0,
        clipped,
      };
    });
  }

  async function izmeriPostavitev(page) {
    return page.evaluate(() => {
      const panel = document.querySelector('#obrocno-sheet-panel');
      const header = panel && panel.querySelector('.rok-sheet__glava');
      const body = panel && panel.querySelector('.rok-sheet__telo');
      const footer = panel && panel.querySelector('.rok-sheet__noga');
      const handle = panel && panel.querySelector('.rok-sheet__rocaj');
      const tabs = panel && panel.querySelector('.obrocno-sheet__nacin');
      const buttons = tabs ? [...tabs.querySelectorAll('.obrocno-sheet__nacin-gumb')] : [];
      const rectOf = (element) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      };
      const panelStyle = panel && getComputedStyle(panel);
      const headerStyle = header && getComputedStyle(header);
      const bodyStyle = body && getComputedStyle(body);
      return {
        panel: rectOf(panel),
        panelPadding: panelStyle ? [panelStyle.paddingTop, panelStyle.paddingRight, panelStyle.paddingBottom, panelStyle.paddingLeft] : [],
        panelBorderRadius: panelStyle && panelStyle.borderRadius,
        panelBorderTopWidth: panelStyle && panelStyle.borderTopWidth,
        handleDisplay: handle && getComputedStyle(handle).display,
        beforeContent: panel ? getComputedStyle(panel, '::before').content : null,
        header: rectOf(header),
        headerPadding: headerStyle ? [headerStyle.paddingTop, headerStyle.paddingRight, headerStyle.paddingBottom, headerStyle.paddingLeft] : [],
        headerBorderBottomWidth: headerStyle && headerStyle.borderBottomWidth,
        body: rectOf(body),
        bodyPadding: bodyStyle ? [bodyStyle.paddingTop, bodyStyle.paddingRight, bodyStyle.paddingBottom, bodyStyle.paddingLeft] : [],
        footer: rectOf(footer),
        tabs: rectOf(tabs),
        buttons: buttons.map(rectOf),
      };
    });
  }

  const reference = await odpri(350, 844, 'reference');
  const partialLayout = await izmeriPostavitev(reference);
  await reference.screenshot({ path: 'output/playwright/delno-postavitev-celota.png' });
  const partialRecommendation = await izmeriPriporocilo(reference);
  await reference.locator('#obrocno-sheet-recommendation .recommendation-card').screenshot({ path: 'output/playwright/delno-priporocilo-poenoteno.png' });
  await reference.locator('#obrocno-sheet-nacin-obrocno').click();
  await reference.waitForTimeout(120);
  const installmentLayout = await izmeriPostavitev(reference);
  await reference.screenshot({ path: 'output/playwright/obrocno-postavitev-celota.png' });
  const installmentRecommendation = await izmeriPriporocilo(reference);
  await reference.locator('#obrocno-sheet-recommendation .recommendation-card').screenshot({ path: 'output/playwright/obrocno-priporocilo-referenca.png' });
  await reference.locator('#obrocno-sheet-nacin-delno').click();
  await reference.waitForTimeout(120);
  const expanded = await izmeri(reference);
  await reference.locator('.delno-resitev').screenshot({ path: 'output/playwright/delno-resitev-expanded-15.png' });
  await reference.locator('.obrocno-sheet__nacin').screenshot({ path: 'output/playwright/delno-obrocno-equal-width.png' });

  await reference.locator('[data-delno-predlog-vrstica="debtor_deadline"] .delno-resitev__predlog-tekst').click();
  await reference.waitForTimeout(100);
  const afterRowClick = await izmeri(reference);

  await reference.locator('[data-delno-preostanek="open"]').click();
  await reference.waitForTimeout(100);
  const collapsedWhite = await izmeri(reference);
  await reference.locator('.delno-resitev').screenshot({ path: 'output/playwright/delno-resitev-collapsed-white.png' });

  await reference.locator('[data-delno-preostanek="open"]').click();
  await reference.locator('.delno-resitev__indikator[data-delno-predlog="debtor_deadline"]').click();
  await reference.waitForTimeout(100);
  const afterCircleClick = await izmeri(reference);
  await reference.locator('.delno-resitev').screenshot({ path: 'output/playwright/delno-resitev-selected-circle.png' });
  await reference.locator('.delno-resitev__indikator[data-delno-predlog="debtor_deadline"]').click();
  await reference.waitForTimeout(100);
  const afterCircleUncheck = await izmeri(reference);
  await reference.locator('.delno-resitev__indikator[data-delno-predlog="debtor_deadline"]').click();
  await reference.waitForTimeout(100);
  await reference.locator('[data-delno-preostanek="open"]').click();
  await reference.waitForTimeout(100);
  const collapsedConfirmed = await izmeri(reference);
  await reference.locator('.delno-resitev').screenshot({ path: 'output/playwright/delno-resitev-collapsed-confirmed.png' });

  await reference.locator('[data-delno-preostanek="credit_note"]').click();
  await reference.waitForTimeout(100);
  const creditUnconfirmed = await izmeri(reference);
  await reference.locator('.delno-resitev__indikator[data-delno-predlog="credit_deadline"]').click();
  await reference.waitForTimeout(100);
  const creditConfirmed = await izmeri(reference);
  await reference.locator('[data-delno-preostanek="credit_note"]').click();
  await reference.waitForTimeout(100);
  const creditCollapsedLabel = await izmeri(reference);
  await reference.locator('.delno-resitev').screenshot({ path: 'output/playwright/delno-resitev-credit-selected-label.png' });

  const narrow = await odpri(320, 844, 'narrow');
  await narrow.evaluate(() => {
    const row = document.querySelector('#obrocno-sheet [data-delno-predlog-vrstica="agreement"]');
    row.querySelector('strong').textContent = 'Dogovorimo se o celotnem poplačilu preostalega dolga';
    row.querySelector('small').textContent = 'Dolžnik odgovori in skupaj natančno določite najprimernejši nadaljnji način poravnave preostalega zneska.';
    if (window.UJPrilagodiVelikostBesedila) row.querySelectorAll('[data-fit-text]').forEach(window.UJPrilagodiVelikostBesedila);
  });
  await narrow.waitForTimeout(120);
  const stress = await izmeri(narrow);
  await narrow.locator('.delno-resitev').screenshot({ path: 'output/playwright/delno-resitev-stress-320.png' });

  const desktop = await odpri(900, 900, 'desktop');
  const desktopMetrics = await izmeri(desktop);

  console.log(JSON.stringify({ errors, partialLayout, installmentLayout, partialRecommendation, installmentRecommendation, expanded, afterRowClick, collapsedWhite, afterCircleClick, afterCircleUncheck, collapsedConfirmed, creditUnconfirmed, creditConfirmed, creditCollapsedLabel, stress, desktop: desktopMetrics }, null, 2));

  const layoutOk = partialLayout && installmentLayout && partialLayout.panel.y > 0 && Math.abs(partialLayout.panel.y - installmentLayout.panel.y) <= 0.5 && Math.abs(partialLayout.panel.height - installmentLayout.panel.height) <= 0.5 && partialLayout.panelPadding.join('|') === installmentLayout.panelPadding.join('|') && partialLayout.panelBorderRadius === installmentLayout.panelBorderRadius && partialLayout.panelBorderTopWidth === installmentLayout.panelBorderTopWidth && partialLayout.handleDisplay === 'none' && partialLayout.beforeContent === 'none' && partialLayout.headerPadding.join('|') === installmentLayout.headerPadding.join('|') && partialLayout.headerBorderBottomWidth === installmentLayout.headerBorderBottomWidth && partialLayout.bodyPadding.join('|') === installmentLayout.bodyPadding.join('|') && Math.abs(partialLayout.tabs.width - installmentLayout.tabs.width) <= 0.5 && Math.abs(partialLayout.tabs.height - installmentLayout.tabs.height) <= 0.5 && partialLayout.buttons.length === 2 && installmentLayout.buttons.length === 2 && partialLayout.buttons.every((button, index) => Math.abs(button.width - installmentLayout.buttons[index].width) <= 0.5 && Math.abs(button.height - installmentLayout.buttons[index].height) <= 0.5);
  const recommendationOk = partialRecommendation && installmentRecommendation && partialRecommendation.title === 'Priporočilo sistema' && partialRecommendation.titleDisplay !== 'none' && partialRecommendation.descriptionDisplay !== 'none' && partialRecommendation.description.startsWith('Prvo delno plačilo poravnate do') && partialRecommendation.badge.endsWith('€') && partialRecommendation.applyText === 'Uporabi priporočilo' && partialRecommendation.applyWidth >= partialRecommendation.width - 24 && partialRecommendation.borderRadius === installmentRecommendation.borderRadius && partialRecommendation.clipped.length === 0 && installmentRecommendation.clipped.length === 0;
  const expandedOk = expanded.checkedMode === 'open' && expanded.activeHeader === 'open' && expanded.activeProposal === null && expanded.activeIndicators === 0 && expanded.section.height >= 275 && expanded.section.height <= 310 && expanded.indicatorSize === '32px' && expanded.headerGap >= 7 && expanded.headerWidthDiff <= 0.5 && expanded.paymentModeWidthDiff <= 0.5 && expanded.starCount === 1 && expanded.recommendationTextCount === 0;
  const onlyCircleSelects = afterRowClick.activeProposal === null && afterRowClick.activeIndicators === 0 && afterCircleClick.activeProposal === 'debtor_deadline' && afterCircleClick.activeIndicators === 1 && afterCircleUncheck.activeProposal === null && afterCircleUncheck.activeIndicators === 0;
  const collapsedOk = collapsedWhite.panelHidden && collapsedWhite.activeHeader === null && collapsedWhite.headerGap >= 7 && collapsedWhite.headerBackgrounds.every((color) => color === 'rgb(255, 255, 255)') && collapsedConfirmed.panelHidden && collapsedConfirmed.activeHeader === 'open' && collapsedConfirmed.headerGap >= 7 && collapsedConfirmed.headerTexts[0] === 'Dolžnik predlaga rok';
  const creditOk = creditUnconfirmed.checkedMode === 'credit_note' && creditUnconfirmed.activeProposal === null && creditConfirmed.activeProposal === 'credit_deadline' && creditConfirmed.activeIndicators === 1 && creditCollapsedLabel.panelHidden && creditCollapsedLabel.headerTexts[1] === 'Ponudba velja do roka';
  const views = [expanded, afterRowClick, collapsedWhite, afterCircleClick, afterCircleUncheck, collapsedConfirmed, creditUnconfirmed, creditConfirmed, creditCollapsedLabel, stress, desktopMetrics];
  if (errors.length || !layoutOk || !recommendationOk || !expandedOk || !onlyCircleSelects || !collapsedOk || !creditOk || views.some((view) => !view.section || view.rowCount !== 3 || view.clipped.length || view.bodyWidth > view.viewportWidth)) process.exitCode = 1;

  await reference.close();
  await narrow.close();
  await desktop.close();
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
