# Bundled component assets

`manifest.json` records source URLs, pinned revisions, SHA-256 hashes, licenses,
and generated model bounds. Source STEP files are unchanged. STL files are
lightweight previews, not manufacturing exports.

Rebuild from the GUI checkout:

```sh
node scripts/prepare-components.cjs
node scripts/prepare-component-footprints.cjs
```

The first command verifies model hashes before tessellation. The second converts
Pico and XIAO footprint sources into portable Ergogen providers. Project creation
embeds selected providers and models in the existing project archive format.
Bundled entries remain immutable; library customization creates an override.

## Verification status

These are imported assets, not a completed verified catalogue. Manifest entries
remain `pending verification`. Preview rendering and native generation tests do
not establish pad polarity, mounting height, connector access or enclosure fit.

| Variant | Footprint | Source model | Status |
| --- | --- | --- | --- |
| Cherry MX PCB | Ceoloide | KiSwitch STEP | Alignment pending |
| Kailh Choc V1 | Ceoloide | KiSwitch STEP | Alignment pending |
| Kailh MX/Choc V1 sockets | Ceoloide | KiSwitch STEP | Side/origin validation pending |
| Choc V2 | Ceoloide | None | Footprint-only draft |
| Raspberry Pi Pico RP2040 | KiCad-RP-Pico | KiCad STEP | Pin/model validation pending |
| Seeed XIAO RP2040 | Marbastlib experimental | Marbastlib STEP | Pin/model validation pending |
| Pro Micro | Ergogen | None | Footprint-only draft |
| nice!nano v2 | Ceoloide | Scotto / infused-kim STEP | Mounting and power validation pending |
| SuperMini nRF52840 | Ceoloide | None | Power/model validation pending |
| SK6812MINI-E | Ceoloide | Marbastlib STEP | Model origin not yet bound |

XIAO nRF52840, RP2040-Zero, KB2040 and Elite-C are not yet selectable. SOD-123,
encoder, reset and battery/power accessories currently lack bundled exact models.
TRRS, USB-C and RJ45 setup selections reserve serial GPIO but do not yet place
verified connector circuits. Wireless power placements are provisional. No
Ethernet networking, routing or firmware is generated.

## Current release boundary

Setup and selected-key template editing are implemented. Whole-layout 3D,
manual GPIO assignment, verified reversible population, split connector circuits,
full LED-chain repair after arbitrary edits, and automatic template inheritance
when growing a matrix are not complete. Exact accessory-model previews and
first-use offline catalogue availability are also unverified.

Validation on September 10, 2026: native single/mirrored/reversible generation
fixtures, default back-side diode clearance, template snapshot/update and ownership
regressions pass. Browser checks covered creation, reopening and Pico 3D rendering.
A 5×4 Pico setup compiled to YAML in 5.01 ms median over 20 runs; native analysis
took 1202 ms cold and 968 ms repeated in this checkout. These are source/analysis
measurements, not fabrication or case-generation approval.

## nice!nano and nice!view

`Nice_Nano_V2.step` and `Nice_View.step` come from infused-kim/kb_ergogen_fp,
revision `bb80a207d8a6fa7b9245caad2c2d97e2adc2f612`. nice!nano was modelled by
Joe Scotto, with headers removed by infused-kim; nice!view is attributed to
TweetyDaBird. The source README has inconsistent license labels; its LICENSE and
plain-language terms specify **CC BY-NC-SA 4.0, noncommercial use**. That license
is retained in `licenses/infused-kim` and applies to these assets and previews.

Both are available under **Bundled models** in the model editor. nice!nano v2 is
also included in new-design controller previews and portable exports. Source
origins remain unchanged; socket spacing and final alignment require review.
These are not interchangeable with SuperMini or generic OLED models.
