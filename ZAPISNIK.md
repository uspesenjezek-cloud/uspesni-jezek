# ZAPISNIK PROJEKTA — »Uspešni Jezek«
> Aktualno stanje na dan **14. 8. 2026**. Ta dokument prilepi kot prvo sporočilo v novo okno.
> Nadomešča `HANDOFF.md` (zastarel — navaja 34/34 testov, zdaj jih je 98) in `OPECODE.md` (zastarel).

---

## 1. Kdo sem in kaj je projekt

Sem lastnik/razvijalec **Uspešnega Jezka** — spletne aplikacije za obrtnike/SME v Sloveniji in Nemčiji.
Trenutno v razvoju: **Kategorija 1 — Neplačila** (avtomatizirana izterjava dolgov z opominskim načrtom).

Komuniciram **v slovenščini**. Pogosto pošljem zelo podrobne specifikacije (mockup slike + obsežen tekstovni brief), ki jih včasih pripravim z drugim AI orodjem in prilepim za implementacijo.

**Uporabniški tok neplačil (3 koraki):**
1. `app/neplacila.html` — vnos dolžnika
2. `app/neplacila-sporocilo.html` — vnos sporočila
3. `app/neplacila-posiljanje.html` — **načrt opominjanja** (~95 % dela se dogaja tu)

Načrt ima **10 korakov**: koraki 1–9 so SMS opomini (`kind: "sms"`, avtomatski), **korak 10 je »Predaja odvetniku«** (`kind: "manual_lawyer"`, ročni).

---

## 2. Tehnologija in okolje

- **Stack:** čist HTML/CSS/JS, **brez frameworkov**. Vercel hosting + `/api` serverless funkcije. Supabase (Postgres + Auth + Storage + Realtime).
- **Edina npm odvisnost:** `luxon` (časovni pasovi). Nov devDependency: `pg` (samo za integracijske teste).
- **Mobilno prvenstveno**, UI v slovenščini, mint/teal barvna shema.
- **Barve:** `--teal: #51999a`, `--teal-dark: #347d7e`, `--barva-cta: #4d9494`, `--barva-znamka: #3d7676`. Font `Inter`.
- **Repo:** `C:\Users\jkjob\Desktop\uspesen jezik git` (Windows, Git Bash + PowerShell)
- **Branch:** `feature/korak3-cas-sheet-in-predloge` (glavna veja: `main`)
- **Lokalni strežnik:** `node scripts/local-server.js --port 8123` → strani so na `http://localhost:8123/app/...`
- **Ngrok:** `./ngrok.exe http --domain=spoiled-vengeful-cofounder.ngrok-free.dev 8000`

---

## 3. ⚠️ KRITIČNO: vzporedna AI orodja delajo na isti kodi

Poleg tebe na istem repozitoriju **hkrati delata še najmanj dve drugi AI orodji** (Codex in DeepSeek/Cursor). Posledice:

- `app/opomin-nacrt-ui.js` (~12.900 vrstic) in `app/styles.css` (~26.000 vrstic) se lahko spremenita **med tvojimi lastnimi orodjnimi klici**.
- **Vedno znova preberi trenutno stanje** pred vsakim posegom v skupno datoteko. Ne zanašaj se na to, kar si prebral prej.
- Če opaziš, da neka tvoja sprememba »izgine«, jo ponovno zapiši in **takoj preveri** (`grep` / `node --check`).
- Če opaziš ponavljajoče se, hitro izginjajoče spremembe na istem mestu, to **jasno povej meni** namesto tihega »boja« s prepisovanjem.
- `app/opomin-nacrt-ui.js` je bila v celoti pretvorjena v **CRLF** (12.869 CRLF proti 134 LF) — to ni tvoje delo. Testi, ki primerjajo dobesedne `\n` nize, zato lahko padejo. Rešitev: normaliziraj **v testu** (`.replace(/\r\n/g, "\n")`), **NE** normaliziraj celotne produkcijske datoteke (diff bi bil nevaren in nepregleden).

---

## 4. Delovna pravila (uveljavljen delovni tok)

1. **Predlagaj obseg → implementiraj → Node testi (`npm test`, `node --check`) → poveži UI → CSS → testiraj v brskalniku → poročaj.**
2. **Majhni, ciljni popravki** — nikoli masivni refaktorji.
3. **Nikoli ne briši/spreminjaj obstoječe kode brez vprašanja** — izjema: ko dam jasno, eksplicitno navodilo.
4. **Zamrznjena področja** se eksplicitno navedejo in se jih NE sme spreminjati (glej razdelek 9).
5. **⚠️ VEDNO dvigni cache-busting `?v=`** na spremenjenih `<link>`/`<script>` v pripadajočem HTML. **To sem že enkrat pozabil in sem po nepotrebnem trdil, da »nič nisi spremenil«** — dejansko je bil kriv predpomnilnik. Za `styles.css` je ključni HTML `app/neplacila-posiljanje.html`.
6. **En vir resnice** — brez vzporednih stanj. Podatki živijo v `lawyerHandoff`, `plan.steps` ipd.
7. **Ne uporabljaj `outerHTML`** — raje `innerHTML` panelov + ponovna vezava handlerjev.
8. **Ne dodajaj CSS override na konec datoteke** — popravi obstoječe pravilo na mestu.
9. **Lokalno testiranje brez spraševanja (izrecno dovoljeno):** v `app/auth-zascita.js` na začetek `preveriPrijavo()` dodaj `if (localStorage.getItem("__UJ_LOKALNI_TEST__") === "1") return;`, zaženi lokalni strežnik, v svežem zavihku nastavi `localStorage.setItem("__UJ_LOKALNI_TEST__","1")` + testne podatke v `sessionStorage` (ključi `neplacilo-korak1-podatki`, `neplacilo-korak2-podatki`, plan pod `neplacilo-korak3-nacrt`). **Po testu vedno povrni `auth-zascita.js` in ustavi strežnik.**
10. **Screenshotov v tem okolju pogosto ni mogoče zajeti** (`computer` orodje javi napako, ker Browser pane ni prikazan) — namesto tega uporabi natančne DOM/computed-style meritve prek `mcp__Claude_Browser__javascript_tool` in to **jasno povej**.
11. **Vizualnega rezultata ne označuj kot potrjenega brez dokaza.**
12. Moje povratne informacije so pogosto **»ocena X/10 + specifičen popravek«** — izvedi **samo** navedeni popravek, ne celega widgeta.
13. Pri **obsežnih nalogah** opozori na Traycer za zasnovo — izjema: če sam podam dovolj podroben spec-dokument, Traycer ni potreben.
14. **Razjasnitvena vprašanja naj bodo preprosta**, vezana na konkretne UI elemente, ne abstraktna.
15. **Barvna paleta eskalacije opominov** (kartice 1–9 + vijolična za »Predaja odvetniku«) je enotna, definirana v `styles.css` prek `.opomin-nacrt__stage--eskalacija-1..9` in `--predaja`. **Nikoli je ne podvajaj z novo paleto.**

---

## 5. Ključne datoteke

| Datoteka | Vloga |
|---|---|
| `app/opomin-nacrt.js` | **Podatkovna plast** načrta (čista logika, brez DOM), ~3.000 vrstic. Ima `module.exports` za teste |
| `app/opomin-nacrt-ui.js` | **UI plast** (HTML generatorji + event binding), ~12.900 vrstic ⚠️ zamrznjeno |
| `app/styles.css` | Vsi stili, ~26.000 vrstic ⚠️ pogosto spreminjano vzporedno |
| `app/app.js` | Glavna logika, Supabase, seznam zadev, navigacija |
| `app/auth-zascita.js` | Zaščita strani + dinamično nalaganje globalnih skript |
| `api/_lib/supabase-server.js` | `konfiguracija`, `preveriUporabnika` (JWT), `preberiZadevo`, `pridobiVrstice`, `pokliciRpc` |
| `api/_lib/scheduler-core.js` | Generični worker `obdelajZapadle` (claim → sendSms → finish) |
| `api/aktiviraj-nacrt.js` | Aktivacija načrta → vrstice v `opomin_koraki` |
| `api/obdelaj-opomine.js` | Cron endpoint (avtoriziran s `CRON_SECRET`) |
| `supabase/migrations/` | SQL migracije |

### Ključne podatkovne strukture
- **Plan:** `{ schemaVersion, id, status, version (string, optimistic lock!), steps: [...], allowedSendWindow, ... }`
- **Korak:** `{ id, index, kind, deliveryMode, status, sendAt/scheduledAt, finalMessage, messageEditedManually, _randomSchedule, ... }`
- **`lawyerHandoff`** (samo na koraku `manual_lawyer`): `{ status, lawyerId, lawyerSnapshot, selectedPackage, documents, message, messageEditedManually, preparedSnapshot, handoffTimingMode, ... }`
- **Tabele:** `zadeve` (z JSONB `opomin_nacrt`), `opomin_koraki`, `opomin_kartice_nastavitve`

---

## 6. Zadnje veliko delo: produkcijska stran »IZVEDBA« (ta seja)

Implementirana **cela nova produkcijska stran** za izvajanje opominov. Šla je skozi **3 kroge varnostnega pregleda** (25 popravkov) preden se je začelo kodiranje.

### Poslovni cilj
Obrtnik na strani `izvedba.html` vidi zapadli korak in izbere eno od dejanj: Pošlji opomin / Račun poravnan / Prekliči korak / Ustavi načrt / Predaj odvetniku / Prestavi / Obljubljeno plačilo / Delno plačilo.

### 🔒 Najpomembnejša sprememba: fail-closed scheduler
**Prej:** scheduler je zapadel SMS poslal **samodejno**. **Zdaj:** dolžniku se brez obrtnikove potrditve ne pošlje NIČ.
```
scheduled → awaiting_confirmation → ready_to_send → processing → sent
```
`prevzemi_zapadle_opomine` zdaj zahteva `execution_state = 'ready_to_send'` IN `kanal = 'sms'`.

### Nove datoteke
- `supabase/migrations/20260814200000_izvedba.sql` — **34 KB**, cela shema (glej spodaj)
- `api/_lib/izvedba-core.js` — čista poslovna logika za 7 ukrepov + fingerprint
- `api/_lib/email-provider.js` — stub (`konfiguriran() → false`)
- `api/pridobi-izvedbo.js`, `api/izvedi-opomin-ukrep.js`, `api/poslji-opomin-zdaj.js`
- `app/izvedba.html`, `.css`, `.js`, `-api.js`, `-komponente.js`
- `app/obvestila-globalno.js` — globalni v-app zvonček (NE OS push)
- `scripts/test-izvedba-actions.mjs` (31 testov), `scripts/test-izvedba-rpc-integration.mjs`

### Spremenjene datoteke
- `api/obdelaj-opomine.js` — označevanje zapadlih + obvestila teče **neodvisno od SMS providerja**; kanalna varovalka
- `api/_lib/scheduler-core.js` — payload dobi `channel: row.kanal`
- `api/_lib/supabase-server.js` — razširjen select + nov `pridobiVrstice`
- `app/auth-zascita.js` — vklop globalnega obvestilnega modula
- `app/app.js` — gumb »Izvedba« na kartici aktivne zadeve
- `scripts/test-scheduler.js` — 2 nova testa za `channel`
- `package.json` — nov `test:integration`, `pg` devDependency

### Varnostne rešitve v migraciji (rezultat 3 krogov pregleda)
1. **`sistem_stikala`** — DB kill-switch, privzeto `vklopljeno = false` (fail-closed). V sili: `update sistem_stikala set vklopljeno=false where ime='opomin_scheduler';` ustavi vse v sekundi, brez deploya.
2. **Idempotenca** — `INSERT ... ON CONFLICT (action_id) DO NOTHING` (atomska rezervacija, brez race). `zahteva_fingerprint` (sha256): isti `action_id` z drugačno zahtevo → `ACTION_ID_REUSED`. Poslovne napake se zapišejo kot `failed` (nikoli obtičal `pending`).
3. **`execution_snapshot`** sestavi **RPC sam** iz zaklenjenih podatkov; odjemalec pošlje samo ID + besedilo.
4. **Dovoljen DTO** — nikoli `to_jsonb(cela_tabela)` (skrival bi `claim_token`, `idempotency_key`).
5. **Denarni stolpci** zaščiteni s **trigerjem** (`app.dovoli_denarne_spremembe`), ne s stolpčnim `revoke` (ta ne deluje ob širšem tabelnem grantu).
6. **Numerične primerjave verzij** povsod (`"10"` ni starejši od `"9"`).
7. **Idempotentna** `alter publication supabase_realtime`.
8. **`poslji_opomin_zdaj`** zahteva **VSE** čakajoče SMS vrstice koraka (`INCOMPLETE_RECIPIENTS`) — ni delnega pošiljanja prejemnikom.
9. **Preflight `DO` blok** varno prekine celo migracijo ob neveljavnih denarnih podatkih.

### ⛔ Trenutne BLOKADE (ne obiti!)
| Blokada | Kaj potrebujem od tebe |
|---|---|
| **SQL integracijski testi** | `TEST_DATABASE_URL` do prazne/staging baze. Docker/Podman **ni nameščen** lokalno, zato `supabase start` ne dela. |
| **Pravi uporabniški tok** | Staging URL + testni obrtnik (e-pošta/geslo) + testna zadeva z aktiviranim planom in korakom v `awaiting_confirmation`. |
| **Vizualna dokazila 320/390 px** | Odvisno od zgornjega — brez pravih podatkov bi bili posnetki zavajajoči. |

**Odločitev: `BLOKIRANO`** — ni pripravljeno ne za staging ne za produkcijo.
**Migracija NI pognana, deploya NI, scheduler NI vklopljen.** Tako naj ostane do nadaljnjega.

### Varen vrstni red uvedbe (ko pride čas)
1. Ustavi cron / `OPOMIN_SCHEDULER_ENABLED=false`, počakaj da ni `status='processing'` vrstic
2. Zaženi migracijo (ena transakcija, sama se prekine ob neveljavnih podatkih)
3. Šele nato deploy
4. Ročno: `update sistem_stikala set vklopljeno=true ...`
> Rollback **nikoli** ne pomeni vračanja stare `prevzemi_zapadle_opomine` — ta ne pozna `execution_state` in bi spet pošiljala samodejno.

---

## 7. Stanje testov

```bash
npm test            # ⚠️ PADE — glej spodaj
npm run test:integration   # se varno preskoči brez TEST_DATABASE_URL
```

| Test | Rezultat |
|---|---|
| `test-random.js` | ✅ 312/312 |
| `test-scheduler.js` | ✅ 21/21 |
| `test-predaja-koncni-pregled.js` | ✅ 15/15 |
| `test-opomini-pregled.js` | ✅ 19/19 |
| `test-paket-storitev.js` | ❌ **PADE** |
| `test-predaja-sestavljalnik.mjs` | ✅ 98/98 |
| `test-opomin-kartice-sync.mjs` | ✅ |
| `test-priporocilo-zagon.mjs` | ✅ |
| `test-izvedba-actions.mjs` | ✅ 31/31 |
| `test-filter-ponudb.js` | ✅ |

### ⚠️ Odprta zadeva: `test-paket-storitev.js`
Test preverja **dobesedne CSS vrednosti**, ki jih vzporedno orodje spreminja. Že smo popravili dve (z mojo izrecno potrditvijo):
- `.lp-koraki__vrstica` `min-height: 150px → 112px` ✅
- `.lp-korak__ikona` `64px → 54px` ✅

**Naslednja neusklajenost (čaka mojo odločitev):**
- Test pričakuje: `.lp-koraki__puscica { margin: 24px 2px 0; }`
- Dejansko v CSS: `margin: 20px 2px 0;`

**Pravilo:** ne popravljaj testa samo zato, da postane zelen. Najprej ugotovi, ali je test zastarel ali gre za regresijo, **vprašaj me**, in šele nato spremeni **eno** trditev. CSS ne spreminjaj — kompaktnejše vrednosti so namerne (večkrat sem zahteval nižji widget).

---

## 8. Zadnji manjši UI popravki (ta seja, po Izvedbi)

Vse v widgetu **»Kaj se bo zgodilo po potrditvi?«** na končnem pregledu predaje odvetniku:
- Barve iz vijolične `--predaja` sheme → **zelena** aplikacijska (`--barva-cta` / `--barva-znamka`). Omejeno **samo** na `.opomin-predaja-pregled__proces` — skupni razred `opomin-nacrt__stage--predaja` ostaja nedotaknjen (druge kartice so še vedno vijolične).
- Besedilo povečano: naziv `10.5px → 11.5px`, podtekst `9px → 10px` (+ proporcionalno v ožjem media-query).
- Krogci pomaknjeni gor: `margin-top: 4px → 1px` (da se »držijo« številk).
- Cache-buster dvignjen: `neplacila-posiljanje.html` → `styles.css?v=20260814-proces-zeleni-v9`

**Razveljavljeno na mojo zahtevo** (ne ponavljaj): premik gumba »Shrani« k svinčniku; vijolična kartica »Izbrani paket« (ostaja mint/teal).

---

## 9. Zamrznjena področja (ne spreminjaj brez izrecnega navodila)

- Trenutni dizajn **desetih kartic** načrta
- **`app/opomin-nacrt-ui.js`** (razen ciljnih, dogovorjenih popravkov)
- **Paketi odvetnikov**, dokumenti, končni pregled predaje
- Trenutne **barve in razmerja kartic** (kompaktne vrednosti so namerne)
- Prazno stanje zgodovine opominov (`lp-opomini-pregled--prazen`)
- Poslovna logika pošiljanja/predaje v `opomin-nacrt.js`
- **Druge vzporedne spremembe v umazanem worktreeju**

---

## 10. Git stanje

- **59 spremenjenih/novih datotek** v working tree — iz **več ločenih zgodb in več sej**, ne samo iz zadnje naloge.
- **Nič ni commitano.** Pri commitu upoštevaj, da tree vsebuje tudi delo drugih orodij.
- Zadnji commit: `845db2b Utrjeno: JWT avtorizacija, Luxon TZ, atomic PATCH verify, preview ločen od resolved, 312 testov`

---

## 11. Kaj sledi (odprto)

1. **Odloči** o `.lp-koraki__puscica` margin (20px vs 24px) → nato zelen `npm test`
2. **Priskrbi staging** (baza + testni uporabnik) → odblokira integracijske teste, pravi uporabniški tok in vizualna dokazila za stran Izvedba
3. Šele nato: migracija → deploy → vklop schedulerja
4. Še neimplementirano/blokirano: **e-poštno pošiljanje** (ni providerja, vrstice se sploh ne ustvarjajo), **prave OS push obvestila** (nadomeščene z v-app zvončkom), **avtomatska predaja odvetniku**
