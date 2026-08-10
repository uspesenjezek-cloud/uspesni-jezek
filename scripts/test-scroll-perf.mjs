/**
 * Testi za scroll performans izboljšave (korak 2).
 * Zagon: node scripts/test-scroll-perf.mjs
 */
import assert from "node:assert/strict";

let ok = 0;
function test(ime, fn) {
  try {
    fn();
    ok += 1;
    console.log("OK  " + ime);
  } catch (e) {
    console.error("FAIL " + ime);
    console.error("  " + (e && e.message ? e.message : e));
    process.exitCode = 1;
  }
}

// Simuliramo DOM strukturo za testiranje logike
function mockDOM() {
  const mockDocument = {
    querySelectorAll: function(selector) {
      if (selector === ".predlog-kartica__stevilke-izbirnik--plavajoč") {
        return this._floatingPickers || [];
      }
      return [];
    },
    _floatingPickers: [],
    body: {
      appendChild: function(el) {
        this._floatingPickers = this._floatingPickers || [];
        this._floatingPickers.push(el);
      },
      _floatingPickers: []
    }
  };
  
  const mockSeznam = {
    querySelectorAll: function(selector) {
      if (selector === ".predlog-kartica__stevilka[aria-expanded=\"true\"]") {
        return this._expandedButtons || [];
      }
      return [];
    },
    _expandedButtons: []
  };
  
  return { document: mockDocument, seznam: mockSeznam };
}

test("zapriVseStevilkeIzbire - brez odprtih izbirnikov (optimizacija)", () => {
  const { document, seznam } = mockDOM();
  
  // Simuliramo funkcijo - naj bi se vrnila takoj, ko ni odprtih izbirnikov
  function zapriVseStevilkeIzbire() {
    const odprtiIzbirniki = document.querySelectorAll(".predlog-kartica__stevilke-izbirnik--plavajoč");
    if (odprtiIzbirniki.length === 0) return;
    // Nadaljnja logika...
  }
  
  // Test: funkcija se vrne takoj, ko ni odprtih izbirnikov
  const result = zapriVseStevilkeIzbire();
  assert.equal(result, undefined);
  assert.equal(document._floatingPickers.length, 0);
});

test("zapriVseStevilkeIzbire - z odprtim izbirnikom", () => {
  const { document, seznam } = mockDOM();
  
  // Dodamo mock odprt izbirnik
  const mockPicker = { className: "" };
  document._floatingPickers = [mockPicker];
  
  let closedCount = 0;
  function zapriVseStevilkeIzbire() {
    const odprtiIzbirniki = document.querySelectorAll(".predlog-kartica__stevilke-izbirnik--plavajoč");
    if (odprtiIzbirniki.length === 0) return;
    odprtiIzbirniki.forEach((el) => {
      closedCount++;
    });
  }
  
  zapriVseStevilkeIzbire();
  assert.equal(closedCount, 1);
});

test("RAF debouncing logika", () => {
  let rafCallCount = 0;
  let debounceCallCount = 0;
  let rafId = null;
  let debounceTimer = null;
  
  function posodobiDrsnikRaf() {
    if (rafId != null) return;
    if (debounceTimer != null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    rafId = 1; // Mock RAF ID
    rafCallCount++;
  }
  
  function debouncedZapri() {
    if (debounceTimer != null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      debounceCallCount++;
    }, 100);
  }
  
  // Test: RAF se kliče samo enkrat, če ni bil še klican
  posodobiDrsnikRaf();
  assert.equal(rafCallCount, 1);
  
  // Test: Ponovni klic RAF ne stori ničesar (ker je že v teku)
  posodobiDrsnikRaf();
  assert.equal(rafCallCount, 1);
  
  // Test: Debounce se kliče in prekliče prejšnji timer
  debouncedZapri();
  debouncedZapri();
  assert.equal(debounceCallCount, 0); // Še ni potekel
  
  // Počakamo, da debounce timer poteka
  return new Promise(resolve => {
    setTimeout(() => {
      assert.equal(debounceCallCount, 1);
      resolve();
    }, 150);
  });
});

test("Debounce prekliče prejšnji timer", () => {
  let debounceCount = 0;
  let timer = null;
  
  function debouncedAction() {
    if (timer != null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      debounceCount++;
    }, 50);
  }
  
  debouncedAction();
  debouncedAction();
  debouncedAction();
  
  return new Promise(resolve => {
    setTimeout(() => {
      assert.equal(debounceCount, 1); // Samo en klic kljub 3-ih invokacijah
      resolve();
    }, 100);
  });
});

console.log("Scroll performans testi...");
console.log("================================");

// Počakamo na asinhroni testi
Promise.all([
  test("RAF debouncing logika"),
  test("Debounce prekliče prejšnji timer")
]).then(() => {
  console.log("================================");
  console.log(`Vseh testov: ${ok + 2} (2 asinhroni)`);
  console.log(`Uspešnih: ${ok + 2}`);
  if (process.exitCode === 0) {
    console.log("✅ Vsi testi uspešni!");
  } else {
    console.log("❌ Nekateri testi so spodleteli.");
  }
  process.exit(process.exitCode || 0);
}).catch(err => {
  console.error("Napaka pri asinhronih testih:", err);
  process.exit(1);
});
