module.exports = async (page) => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const crypto = await import("node:crypto");
  const outputRoot = path.resolve("output", "playwright", "boniteta-100-gmbh");
  const payload = await page.evaluate(async () => {
    const response = await fetch("/output/playwright/boniteta-100-gmbh/fixtures.json", { cache: "no-store" });
    if (!response.ok) throw new Error("fixtures_http_" + response.status);
    return response.json();
  });

  await page.setViewportSize({ width: 350, height: 844 });
  const results = [];
  let previous = null;

  for (const item of payload.fixtures) {
    const result = await page.evaluate((input) => {
      const item = input.item;
      const canvas = document.createElement("canvas");
      canvas.width = 900;
      canvas.height = 500;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 900, 500);
      ctx.fillStyle = "#eef3f5";
      ctx.fillRect(0, 0, 900, 72);
      ctx.fillStyle = "#1f2b33";
      ctx.font = "700 20px Arial";
      ctx.fillText("INSOLVENZBEKANNTMACHUNGEN", 34, 43);
      ctx.font = "700 22px Arial";
      ctx.fillText("Suchergebnis – Veröffentlichungsliste", 34, 120);
      ctx.font = "16px Arial";
      ctx.fillText("Firma: " + item.searchName, 34, 175);
      ctx.fillText("Sitz: " + item.city, 34, 210);
      ctx.fillText("Register: " + item.registerCourt + " · " + item.registerType + " " + item.registerNumber, 34, 245);
      ctx.fillStyle = "#f7f8f8";
      ctx.fillRect(26, 290, 848, 90);
      ctx.fillStyle = "#243038";
      ctx.font = "700 17px Arial";
      ctx.fillText("Keine Treffer", 43, 330);
      ctx.font = "14px Arial";
      ctx.fillText("Za te iskalne podatke ni bila najdena insolvenčna objava.", 43, 360);
      const evidenceImage = canvas.toDataURL("image/jpeg", 0.82);
      const register = item.registerType + " " + item.registerNumber;
      const checkedAt = new Date().toISOString();
      const data = {
        checkedAt,
        confirmationRequired: false,
        locationMatch: { status: "matched" },
        identity: {
          status: "verified_register",
          entityType: "company",
          ime: item.legalName,
          naziv: item.legalName,
          naslov: item.street,
          postnaStevilka: item.postalCode,
          kraj: item.city,
          companyId: item.companyId,
          legalForm: "GmbH",
          registerNumber: register,
          registerCourt: item.registerCourt,
          active: true,
          source: "openregister",
        },
        identityEvidence: {
          status: "verified_api",
          evidenceReady: true,
          evidenceKind: "structured_api",
          verifiedAt: checkedAt,
          sourceUrl: "https://openregister.de",
          officialName: item.legalName,
          officialStreet: item.street,
          officialPostalCode: item.postalCode,
          officialCity: item.city,
          companyId: item.companyId,
          registerNumber: register,
          registerCourt: item.registerCourt,
          active: true,
        },
        sources: [],
        publicProfile: null,
        openregister: { status: "found" },
        insolvency: {
          status: "clear",
          verificationMode: "official_portal_only",
          searchedName: item.searchName,
          searchedCity: item.city,
          searchedPostalCode: item.postalCode,
          searchedCompanyId: item.companyId,
          officialVerification: {
            status: "clear",
            checkedAt,
            evidenceStatus: "captured",
            evidenceImage,
            searchedRegister: item.registerCourt + " · " + register,
            inputVerification: {
              status: "matched",
              fields: {
                firmaPriimek: item.searchName,
                ime: "",
                kraj: item.city,
                registrskoSodisce: item.registerCourt,
                vrstaRegistra: item.registerType,
                registrskaStevilka: item.registerNumber,
              },
            },
            screenshotAnnotation: { status: "applied", highlightedTones: ["blue", "green", "violet"] },
            publications: [],
          },
        },
        result: { level: "green", title: "Brez objave" },
      };

      if (typeof window.UJBonitetaAuditIzrisi !== "function") throw new Error("audit_hook_missing");
      window.UJBonitetaAuditIzrisi(data);
      window.UJBonitetaNastaviInsolvencnoOkno(true, true);

      const rows = Array.from(document.querySelectorAll("#boniteta-insolvenca-podatki .boniteta-podatek")).map((row) => ({
        label: row.querySelector("dt")?.textContent.trim() || "",
        value: row.querySelector("dd")?.textContent.trim() || "",
      }));
      const row = (label) => rows.find((entry) => entry.label === label)?.value || "";
      const problems = [];
      const expectedRegister = item.registerCourt + " · " + item.registerType + " " + item.registerNumber;
      const status = document.getElementById("boniteta-insolvenca-status").textContent.trim();
      const description = document.getElementById("boniteta-insolvenca-opis").textContent.trim();
      const heading = document.querySelector(".boniteta-insolvenca-podatki-glava h3").textContent.trim();
      const caption = document.querySelector("#boniteta-insolvenca-posnetek figcaption strong").textContent.trim();
      const badge = document.getElementById("boniteta-insolvenca-izid-znacka").textContent.trim();
      const image = document.getElementById("boniteta-insolvenca-slika");

      if (status !== "Ni najdenih insolvenčnih objav") problems.push("status");
      if (description !== "Za preverjene iskalne podatke v uradnem insolvenčnem registru ni bila najdena objava.") problems.push("description");
      if (heading !== "Uporabljeni iskalni podatki") problems.push("heading");
      if (caption !== "Uradni insolvenčni register") problems.push("caption");
      if (badge !== "BREZ OBJAVE") problems.push("badge");
      if (row("Kraj") !== item.city) problems.push("city");
      if (row("Poštna številka") !== item.postalCode) problems.push("postalCode");
      if (row("Register") !== expectedRegister) problems.push("register");
      if (row("Uradni insolvenčni register") !== "Brez objave") problems.push("officialResult");
      if (item.wildcard) {
        if (row("Potrjeno pravno ime") !== item.legalName) problems.push("legalName");
        if (row("Iskalni niz podjetja") !== item.searchName) problems.push("searchName");
      } else if (row("Ime podjetja") !== item.searchName) {
        problems.push("companyName");
      }
      if (!image.src.startsWith("data:image/jpeg;base64,")) problems.push("evidenceImage");
      if (input.previous) {
        const values = rows.map((entry) => entry.value);
        const staleValues = [input.previous.legalName, input.previous.searchName, input.previous.city,
          input.previous.registerCourt + " · " + input.previous.registerType + " " + input.previous.registerNumber]
          .filter((value) => value && ![item.legalName, item.searchName, item.city, expectedRegister].includes(value));
        if (staleValues.some((value) => values.includes(value))) problems.push("stale_previous_company");
        if (image.src === input.previous.evidenceImage) problems.push("stale_evidence_image");
      }
      const clipped = Array.from(document.querySelectorAll("#boniteta-insolvenca-sklop dd, #boniteta-insolvenca-sklop strong, #boniteta-insolvenca-sklop p"))
        .filter((element) => element.clientWidth > 0 && (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1))
        .map((element) => element.textContent.trim().slice(0, 80));
      if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) problems.push("horizontal_overflow");

      return { problems, rows, status, description, heading, caption, badge, clipped, evidenceImage: image.src };
    }, { item, previous });

    await page.waitForTimeout(25);
    const filename = "case-" + String(item.caseNumber).padStart(3, "0") + ".png";
    const screenshotPath = path.join(outputRoot, filename);
    await page.locator("#boniteta-insolvenca-sklop").screenshot({ path: screenshotPath });
    const imageBytes = await fs.readFile(screenshotPath);
    results.push({
      caseNumber: item.caseNumber,
      legalName: item.legalName,
      searchName: item.searchName,
      city: item.city,
      register: item.registerCourt + " · " + item.registerType + " " + item.registerNumber,
      wildcard: item.wildcard,
      screenshot: filename,
      screenshotBytes: imageBytes.length,
      screenshotSha256: crypto.createHash("sha256").update(imageBytes).digest("hex"),
      actual: {
        status: result.status,
        description: result.description,
        heading: result.heading,
        caption: result.caption,
        badge: result.badge,
        rows: result.rows,
      },
      clipped: result.clipped,
      problems: result.problems,
    });
    previous = Object.assign({}, item, { evidenceImage: result.evidenceImage });
  }

  const failures = results.filter((entry) => entry.problems.length || entry.clipped.length);
  const report = {
    generatedAt: new Date().toISOString(),
    viewport: { width: 350, height: 844 },
    source: payload.source,
    sourceSnapshotDate: payload.sourceSnapshotDate,
    total: results.length,
    wildcardCases: results.filter((entry) => entry.wildcard).length,
    screenshots: results.filter((entry) => entry.screenshotBytes > 0).length,
    failures: failures.length,
    results,
  };
  await fs.writeFile(path.join(outputRoot, "report.json"), JSON.stringify(report, null, 2));
  return {
    total: report.total,
    wildcardCases: report.wildcardCases,
    screenshots: report.screenshots,
    failures: report.failures,
    firstFailure: failures[0] || null,
  };
};
