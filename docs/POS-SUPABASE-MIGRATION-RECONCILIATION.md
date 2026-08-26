# POS — uskladitev Supabase migracij

Datum preverjanja: 24. avgust 2026.

Lokalni imenik je vseboval 147 migracij, oddaljena zgodovina projekta pa 144.
Primerjava po polnem imenu migracije je pokazala:

- 68 migracij z že enakim imenom in časovnim žigom;
- 76 istih migracij z drugačnim lokalnim časovnim žigom;
- 3 resnično lokalne, še neizvedene migracije;
- 0 oddaljenih migracij brez lokalne datoteke.

Pri 76 ujemanjih je bil spremenjen samo časovni žig lokalnega imena datoteke,
da se ujema z različico, ki jo je Supabase zabeležil ob dejanski izvedbi. SQL
vsebina in oddaljena baza nista bili spremenjeni; `migration repair` ni bil
uporabljen.

Po uskladitvi so edine lokalno čakajoče migracije:

- `20260822231500_sinhronizacija_mojih_korakov.sql`;
- `20260823150000_nedenarne_poravnave.sql`;
- `20260824090000_delna_nedenarna_poravnava.sql`.

Teh treh migracij ta postopek namenoma ne izvede samodejno. Pred uporabo je
potrebna ločena vsebinska presoja njihovega obsega in vpliva, saj prvi dve nista
omejeni samo na nemški POS, tretja pa spreminja pravila poravnave.

Supabase svetovalec je ob istem pregledu vrnil osem manjkajočih indeksov tujih
ključev, vendar nobeden ni na POS tabeli. Zato niso bili vključeni v ta POS
poseg. Opozorilo za preverjanje razkritih gesel ostaja ročna nastavitev Auth in
ni bilo samodejno vključeno.

Uradne poti za preostale ročne preglede:

- [preverjanje razkritih gesel](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection);
- [pregled namenoma izpostavljenih SECURITY DEFINER RPC-jev](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable);
- [manjkajoči indeksi tujih ključev](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

## Ponovni read-only pregled po POS utrditvah

Ponovni pregled 24. avgusta 2026 je bil izveden s Supabase CLI 2.111.0. V
oddaljeno bazo ni bila izvedena nobena migracija in zgodovina ni bila
popravljena. Zadnji `supabase db push --linked --dry-run --include-all` je
uspešno razčlenil takratno čakalno vrsto ter potrdil, da bi brez dodatne presoje
poskusil izvesti devet lokalnih migracij.

Pet od teh devetih je novih POS utrditev:

- `20260824172000_pos_openapi_webhook_submission_clock.sql`;
- `20260824173301_pos_manual_payment_retry_idempotency.sql`;
- `20260824173649_pos_archive_durable_document_recovery.sql`;
- `20260824181038_pos_public_rpc_invoker_hardening.sql`;
- `20260824181626_pos_database_lint_cleanup.sql`.

Preostale štiri niso omejene na POS in zato ne smejo biti samodejno vključene v
POS deployment. Lokalna `20260824174434_undo_completed_settlement.sql` je bila
pozneje bajtno primerjana z oddaljeno izvedeno in lokalno prisotno
`20260824174942_undo_completed_settlement.sql`; razlikovali sta se samo po dodatnem
podpičju na zadnji vrstici. Neizvedena podvojena datoteka `20260824174434` je bila
zato odstranjena brez spremembe poslovnega SQL ali oddaljene baze.

Ukaz `npm run check:pos-migrations` vedno izvede samo Supabase `--dry-run` in
primerja čakalno vrsto z zgornjim POS allowlistom. Če najde katerokoli drugo
migracijo, se zaključi z napako in izrecno potrdi, da ni bilo nič objavljeno.
Takrat je bil zato namenoma rdeč zaradi štirih nepovezanih migracij; novejše
stanje po odstranitvi preverjenega dvojnika je zapisano spodaj.

Svetovalec za zmogljivost ni našel težav. Varnostni svetovalec je v trenutno
oddaljeni različici vrnil 22 opozoril za prijavljenim uporabnikom dostopne
`SECURITY DEFINER` POS RPC-je ter eno opozorilo, da je zaščita pred razkritimi
gesli izklopljena. Vsak opozorjeni RPC je bil pregledan po zadnji lokalni
definiciji. Preostali javni wrapperji so v migraciji
`20260824181038_pos_public_rpc_invoker_hardening.sql` spremenjeni v
`SECURITY INVOKER`; zasebni izvajalci ohranjajo prazen `search_path`, preverjanje
`auth.uid()`, tenant filter, zaklep poslovne vrstice in eksplicitne pravice.
Dokler migracija ni varno izvedena, bodo oddaljena opozorila pričakovano ostala.

Oddaljeni `supabase db lint --linked --schema public,private` je uspel brez
napak in našel samo dve opozorili `plpgsql_check`: neuporabljen združljivostni
parameter in senčeno indeksno spremenljivko. Migracija
`20260824181626_pos_database_lint_cleanup.sql` ju odpravi brez spremembe
poslovnega rezultata. Lokalni `db reset` ostaja brez Dockerja ali Podmana
nedosegljiv; to je omejitev preverjanja, ne dovoljenje za poseg v produkcijo.

## Novejše razhajanje po Openapi utrditvi

Read-only `supabase migration list --linked` je pozneje istega dne najprej pokazal
11 lokalnih različic brez oddaljene izvedbe ter oddaljeno različico
`20260824183532` brez lokalne datoteke. Neposredna read-only poizvedba sistemskega
kataloga je nato potrdila, da ima oddaljena funkcija
`public.razveljavi_obljubo_placila` enako telo, podpis in pravice kot lokalna
`20260824182634_undo_payment_promise.sql`: `anon` in `authenticated` nimata
izvajanja, `service_role` pa ga ima. Lokalna datoteka je bila zato preimenovana v
`20260824183532_undo_payment_promise.sql`, brez `migration repair`, `db pull` ali
spremembe oddaljene baze.

Po obeh uskladitvah je v čakalni vrsti devet migracij: šest dovoljenih POS utrditev
in tri nepovezane migracije. Med POS utrditvami je tudi
`20260824182529_pos_openapi_reconciliation_tracking.sql`; allowlist jo prepozna,
vendar tri nepovezane migracije še naprej varno blokirajo skupni deployment.
Openapi usklajevanje je dodatno izolirano tako, da njegova še neizvedena migracija
ne prekine običajnega dostavnega crona; samo neobvezno usklajevanje poroča
`reconciliationUnavailable`.

## Tri lokalne različice brez zapisa v oddaljeni zgodovini

Nadaljnji read-only pregled sistemskega kataloga je pokazal, da tri migracije,
ki jih `migration list` še vedno prikazuje samo lokalno, niso tri manjkajoče
funkcionalnosti. Njihovi učinki so v oddaljeni bazi že prisotni:

- `20260822231500_sinhronizacija_mojih_korakov.sql`: tabela, primarni in tuji
  ključ, tri tenant RLS politike, članstvo v `supabase_realtime` publikaciji ter
  `SECURITY INVOKER` RPC z zaščito prijave, preverjanjem praznega vnosa in
  pravilom, da starejši odjemalec ne prepiše novejšega stanja;
- `20260823150000_nedenarne_poravnave.sql`: stolpec in obe kontrolni omejitvi na
  `zadeve`, revizijska tabela z njenimi ključi, RLS ter indeksom po `zadeva_id`;
- `20260824090000_delna_nedenarna_poravnava.sql`: trenutno oddaljeno telo
  `izvedi_opomin_ukrep` vsebuje idempotentno obravnavo, tenant in verzijsko
  zaščito ter vse tri poslovne veje `partial_payment`, `partial_settlement` in
  `paid_in_full`. RPC ima prazen `search_path`; izvajanje je dovoljeno samo
  `service_role`.

Pri dveh sprva neuspešnih besedilnih preverjanjih je šlo samo za razliko v
formatiranju, ki ga vrne `pg_get_functiondef`; ciljni vrstici sta bili nato
neposredno izpisani in se vsebinsko ujemata z lokalnima definicijama.

Zaključek: oddaljena shema vsebuje njihove učinke, oddaljena tabela zgodovine
migracij pa ne vsebuje teh treh časovnih različic. Zato jih ni varno ponovno
izvesti. Prav tako ni bil uporabljen `migration repair`, saj bi že sam popravek
zgodovine pomenil zapis v povezano produkcijsko bazo. Do izrecne odobritve mora
`npm run check:pos-migrations` te tri različice še naprej obravnavati kot
blokado, s čimer prepreči nenamerno ponovno izvajanje poslovnih migracij.
Varovalka jih zdaj izpiše v ločeni skupini »shema vsebuje učinke, zgodovina pa
nima različic«, zato jih ni več mogoče zamenjati z novo ali neodobreno kodo.

Poznejša oddaljena različica `20260824190948` je bila na enak način read-only
primerjana z lokalno `20260824193000_undo_stopped_plan.sql`. Telo funkcije,
podpis in pravice so enaki; oddaljena funkcija je izvedljiva samo za
`service_role`. Lokalna datoteka je bila zato usklajena na oddaljeni časovni
žig `20260824190948`, brez ponovne izvedbe SQL.

## Zaključena uskladitev in izvedba POS migracij

Po izrecni odobritvi 24. avgusta 2026 so bile tri že vsebinsko prisotne različice
`20260822231500`, `20260823150000` in `20260824090000` označene kot `applied` v
oddaljeni zgodovini. Poslovni SQL teh treh migracij ni bil ponovno izveden.

Nato je `supabase db push --linked --include-all --yes` izvedel samo šest
allowlistanih POS migracij:

- `20260824172000_pos_openapi_webhook_submission_clock.sql`;
- `20260824173301_pos_manual_payment_retry_idempotency.sql`;
- `20260824173649_pos_archive_durable_document_recovery.sql`;
- `20260824181038_pos_public_rpc_invoker_hardening.sql`;
- `20260824181626_pos_database_lint_cleanup.sql`;
- `20260824182529_pos_openapi_reconciliation_tracking.sql`.

Zaključni `npm run check:pos-migrations` ne najde več čakajočih migracij.
Oddaljena baza vsebuje tri stolpce Openapi usklajevanja, namenski indeks in
resetni trigger. Supabase svetovalec na ravni `error` po izvedbi ni našel težav.
