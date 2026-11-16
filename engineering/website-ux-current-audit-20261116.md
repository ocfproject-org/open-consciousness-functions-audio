# Current website UX audit reconciliation — 2026-11-16

This is a fresh re-review of the current public site, not dismissal of the supplied audit based on its older identifiers. Live baseline: audio-site main `881b2effb75c02d9194ea914b31cdeab11be531e`. Local approved-copy draft begins at PR29 head `1c3710250fbd94b2f589e6cc6c472c2bd72a8dbb`; subsequent local fixes below are not yet deployed. Published source pin remains `704440da8e0379cee8dfd332203bc0001c0a5f27`.

Evidence was collected using normal-TLS public HTML and Chromium browser interaction with public media blocked except the explicitly bounded MP3 diagnostic. Mobile widths are browser emulation, not physical-device testing. Independent reviewer inspected screenshots and all58 function pages. Automated contrast/axe checks do not certify accessibility.

| Audit item | Current evidence and disposition |
|---|---|
|01 Download columns|118 download-format links in bounds at320/375/390/768/1440; mobile download screenshots inspected.|
|02 Theme/contrast|24 current-live theme states across home/browse/reference: sampled normal/large text minimum contrast5.14; explicit System/Light/Dark/Black states. Not exhaustive image/OS certification.|
|03 Header clipping|Live160–1440CSS-width reflow checks found no document overflow; mobile pixels inspected.|
|04 Player destruction|Existing stable-player/filter/back regression suite passes locally. Live Browse starts with0audio elements and creates1on explicit request. Bounded WebKit probe corrected separately below; no full-release/nativeSafari claim.|
|05 Cue search|Live PLUS-RELAX, repeated spaces and em-dash variants resolve the same single Relax result; clear/no-result and Quick Reference search verified.|
|06 Mobile Quick Reference|Live320 cards expose title,cue,description; deliberately clipped table header is not visible overflow.|
|07 Device lists|All5 device Baseline sections contain actualUL/LI lists; Android mobile screenshot inspected.|
|08 Canonical discrepancies/availability|Source-pin/catalog identity guards remain; all58 instruction/cue/lifecycle values and118transcript bytes independently compared unchanged. This is publication parity, not independent validation of function effectiveness or instruction correctness. Owner's separate editorial work is not imported.|
|09 Homepage length|Live0audio elements; measured heights4366/3786/2878/2917px at320/390/768/1440. Footer reachable. Still approximately4–5mobile screens: subjective compactness remains a design tradeoff, not a falsely declared bug fix.|
|10 Listen placement|All58 current function pages expose Listen near title; Automatic Action mobile screenshot checked.|
|11 Duplicate summaries|Fresh live review found2exact duplicates: DissolveEXP003 and ClearZoneEXP005. Local fix suppresses only normalized exact lead/explanation equality. Distinct secondary meanings and every activation step remain.|
|12 Technical terminology|Owner approved presentation labels: How to use this function, Activation steps, Follow the steps below (only exact generic boilerplate), Use and duration. Raw effect-scope/activation/persistence values remain accessible under nativeTechnical details disclosures; actual descriptions, triggers and release guidance remain visible. Local fix, not deployed.|
|13 Download metadata|Fresh live repeated FLAC·flac and MP3·MP3 bitrate tokens confirmed. Local fix removes only redundant format token; bitrate, sample rate, channel count, size,duration and source metadata retained. Server-defined downloaded filenames remain outside static-site control.|
|14 Browse paths|Live /functions/ is Browse & Listen with static guide/download fallback and enhanced search; guide links remain independent of player construction.|
|15 Filter density|Live useful category selector, no redundant single-choice voice/language selectors.|
|16 Typography/grid|Live320–1440 and320with200%text reflow passed for inspected pages. Not every font/string/device combination.|
|17 Focus/theme semantics|Visible controls after opening disclosures inspected:318downloads,70listening plushome/browse/reference; no absent outline/shadow. Skip-link screenshot confirms visible focus.|
|18 AT/status|Live no-result and transcript statuses use polite announcements; first transcript failure then retry verified. Native buttons/output and axe-tested local match navigation added. Manual screen-reader operation remains unverified.|
|19 Transcript mobile/search|Live natural page scroll,max-height:none,overflow:visible,width375;55highlighted Relax matches. Missing next/previous/count confirmed. Local owner-approved controls add cyclic navigation,count,no-match/clear,keyboardEnter/Shift+Enter and scopedsticky toolbar. No auto-scroll on typing. RepeatedNext320screenshot verified toolbar remains visible.|
|20 Onboarding repetition|Fresh /start/ returns the current choose-your-path flow; previously approved five optional starters and Preparation exception remain under browser regression. No generic instruction rewriting. New About copy and counts are approved draft, not live.|
|21 Relationships|Fresh live Function Chains page contains17optional ordered examples; canonical relationships remain separate and unchanged. No additional unapproved chains inserted.|
|22 About|Fresh liveAbout lacks Our Vision, as expected before deployment. PR29 contains exact owner-authored About/OurVision, requested reference links and separately approved technology/anchoring paragraphs.|
|23 Runtime/performance|Live Browse0initial→1requested player, homepage0players. Prior ledger “under review” is historical. Runtime slim catalog still used on Browse. Field Core Web Vitals/performance are not measured.|
|24 No-JS truthfulness|Fresh no-JS Browse: no audio elements or interactiveJS cards,58staticMP3 links remain; search/player limitation explicitly stated and controls hidden.|
|25 Canonical/old links|Canonical/OG agree on10checkedroutes; sitemap200with76URLs; testedfunction/chain deeplinks200; unknownroute404; explicit404.html200expected. Not a crawl of every external link. NoDNSchanges.|
|26 Real-use evidence|Current-live emulated browser evidence plus local regression tests documented above. No physical mobile/nativeSafari, human listening,manualAT,fieldperformance or blanket accessibility-compliance claim.|

## WebKit bounded-media diagnostic

The original test narrowed native byte ranges to256KiB. Relax has324,730bytes ofID3 metadata before its firstMPEGframe, so the test truncated before any audio frames and reportedNETWORK_NO_SOURCE. Installed WebKit decoded a syntheticMP3 using bothaudio/mpeg andapplication/octet-stream, ruling out either missing MP3 support or MIME alone as sufficient explanation.

A controlled cached-prefix differential reproduced failure with256KiB and playback with512KiB. The corrected test-only harness assembles a coherent512KiB WebKit response from separately validated upstream chunks of at most262,144bytes, reserves a32request/8MiB budget beforeawait, validates exact206Content-Range/Content-Length and rejects short/oversized bodies. It does not change production hosting, proxy requests for users, or alter audio assets. WebKit's bounded prefix may reportduration0 while playing, so its test explicitly verifies decode/play/pause/resume, not seeking/full duration/nativeSafari. Chromium/Firefox retain full-duration and seek assertions in the optional range probe.

All source canonical values, catalog provenance, released asset URLs and transcript bytes are preserved. No new audio rendered or published. New public labels were approved by the owner before PR inclusion.

## Local validation outcome

202 Python tests passed; full Chromium suite46passed/1opt-in-media skip. The corrected opt-in WebKit prefix test passed with2validated HTTP206ranges totaling524,288bytes and real time progression/pause/resume. All checks refer to the local draft; this document does not claim deployment. Independent production diff review found no instruction or asset changes.
