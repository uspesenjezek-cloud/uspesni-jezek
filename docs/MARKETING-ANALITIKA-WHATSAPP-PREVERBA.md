# WhatsApp analitika — preverba in zamenjave v obstoječih modulih

Vhod: lokalni popis strani `analitika.html?kanal=whatsapp` (september 2026, vzorčni podatki).

Pravilo: moduli, grafike in vrstni red ostanejo. Spremenijo se podatki in besedila. Kjer podatka ni mogoče dobiti, se zamenja vir.

## 0. Osnovni pogoj

Vse WhatsApp številke obstajajo samo, če je obrtnikova številka povezana z **WhatsApp Business Platform (Coexistence)**. Obrtnik pri tem aplikacijo na telefonu obdrži. Brezplačna aplikacija WhatsApp Business ne da nobenih podatkov.

Kaj dobimo po povezavi:
- **iz webhookov** (izračunamo sami): vsa dohodna sporočila, odgovore s telefona (`smb_message_echoes`), statuse in vir (`referral` pri oglasu);
- **od Mete**: rezultate kampanj (`template_analytics`: poslano, dostavljeno, prebrano, klik), strošek (`pricing`) in odjave (`user_preferences`).

---

## 1. Glava

| Element | Zdaj | Novo | Zakaj |
|---|---|---|---|
| podnaslov | September · **vsi kanali skupaj** | September · **WhatsApp** | napaka |
| izbira meseca | ni je | **enak izbirnik kot pri Googlu/Facebooku** | enotnost |
| Strošek sporočil | Ni potrjeno | **14 €** (vsota `pricing` iz statusov sporočil v mesecu) | Meta strošek da za vsako sporočilo |
| 21 ljudi · 3 povpraševanja · 1 naročilo · 1.200 € | ostane | ostane | pravilno |

## 2. WhatsApp pogovori (`wa1`)

| Element | Zdaj | Novo |
|---|---|---|
| naslov, 8 novih / 13 že pisalo | ostane | ostane |
| viri | 4 vidni, »Vir ni znan 3« skrit pod »Pokaži več« | »Vir ni znan« je **vedno viden**; pod »Pokaži več« gre najmanjši vir (Letak s QR kodo 1) |
| KAJ VIDIMO | Novi ljudje prihajajo. Izvor je potrjen pri 18 od 21 … | **Največ ljudi je pisalo po kampanji (9). Facebook oglas in spletna stran sta pripeljala po 4.** |
| UKREPALI | Preverimo izvor novih kontaktov … | **Kampanje obdržimo. Na letak dodamo večjo QR kodo – prinesla je samo 1 pogovor.** |

Kako dobimo vir:
- **Facebook oglas**: polje `referral` v prvem sporočilu.
- **Spletna stran in QR koda**: vsak ima svojo povezavo `wa.me` s predizpolnjenim besedilom.
- **Kampanja**: odgovor na poslano predlogo.

## 3. Hitrost odgovora (`wa2`)

| Element | Zdaj | Novo |
|---|---|---|
| 18 min · 20 odgovorjenih · 1 še čaka | ostane | ostane (izračun iz webhookov je pravilen) |
| KAJ VIDIMO | Odgovori so izmerjeni … | **Običajno odgovorite v 18 minutah. 1 človek čaka na odgovor.** |
| UKREPALI | Spremljamo pogovore, ki še čakajo … | **Opomnimo vas na pogovor, ki čaka.** |

## 4. Kampanje WhatsApp (`wa3`)

Manjka glavni del, ki ga Meta da: **koliko ljudi je sporočilo dobilo, prebralo in kliknilo.** Predogled telefona in izbira kampanje ostaneta.

| Element | Zdaj | Novo |
|---|---|---|
| nad rezultati | — | vrstica **Poslano 85 · Prebralo 61 · Kliknilo 9 · Odgovorilo 7** (Opomnik); **120 · 84 · 11 · 2** (Akcija) |
| rezultati | 2 povpraševanji · 7 strank je odgovorilo · 0 naročil | ostane |
| strošek | — | **Strošek kampanje: 5,95 €** / **8,40 €** |
| odjave | — | **1 se je odjavil** (le če > 0) |
| opomba | — | »Prebrano je najmanj toliko – nekateri ljudje imajo izklopljeno potrdilo o branju.« |
| KAJ VIDIMO (Opomnik) | Prišla so povpraševanja. 2 povpraševanji. Potrjenih naročil še ni. | **7 od 85 ljudi je odgovorilo, 2 sta želela termin. Naročila še ni.** |
| UKREPALI | Preverimo odziv posamezne kampanje … | **Obema pošljemo predlog termina še ta teden.** |

Cene so okvirne (Slovenija, marketinška predloga ~0,07 €). Prave vrednosti pridejo iz `pricing` v statusih sporočil.

## 5. Od kod vam pišejo (`waKr`) — **zamenjava vira**

Kraja iz naslova v pogovoru ne razbiramo, ker WhatsApp tega podatka ne da in razbiranje iz besedila ni zanesljivo. Ilustracija hiš ostane, vir postane **kraj iz povpraševanja v vaši evidenci**, enako kot pri Facebooku.

| Element | Zdaj | Novo |
|---|---|---|
| naslov | Največ vam pišejo iz Domžal. | **Največ povpraševanj je iz Domžal.** |
| hiše | Domžale 6 ljudi · Kamnik 4 · Mengeš 3 | **Domžale 2 povpr. · Kamnik 1 povpr. · Mengeš 0** |
| opomba | Kraj preberemo iz naslova v pogovoru – znan je pri 16 od 21 ljudi. | **Kraj je iz povpraševanja v vaši evidenci.** |

## 6. Kdaj vam pišejo (`ak`) — **popravek izračuna**

Zdaj je mreža statična in v nasprotju z naslovom. Izračunati jo je treba iz **prvih dohodnih sporočil** (webhooki), enako kot pri Facebooku.

| Element | Zdaj | Novo |
|---|---|---|
| mreža | statične barve | iz podatkov; celice z opisom »Torek, večer: 5 ljudi« |
| naslov | Največ pišejo v nedeljo zjutraj. (mreža kaže torek zvečer) | izračunan iz iste mreže, npr. **Največ pišejo v torek zvečer.** |
| KAJ VIDIMO | Kaj kažejo podatki … | **11 od 21 ljudi vam je pisalo zvečer, po delovnem času.** |
| UKREPALI | Spremljanje odzivov prilagodimo … | **Vklopimo samodejni odgovor po delovnem času: »Odgovorimo vam zjutraj do 8.00.«** |

## 7. Povzetek meseca

| Element | Zdaj | Novo |
|---|---|---|
| September / Avgust | 3 · 1 / 2 · 0 | ostane |
| nova vrstica | — | **Kampanje: 3 povpraševanja · 1 naročilo · 4,70 € na povpraševanje** |
| KAJ VIDIMO | Kaj kaže evidenca … | **Vse 3 povpraševanja so prišla iz kampanj.** |
| UKREPALI | Preverimo izvor … | **Pred zimo pošljemo še opomnik za servis kotla.** |

## 8. Slovnica

Uporabi skupno funkcijo za 1 / 2 / 3–4 / 5+ (človek / človeka / ljudje / ljudi; stranka / stranki / stranke / strank).
