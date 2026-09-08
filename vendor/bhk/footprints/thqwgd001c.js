module.exports = {
    params: {
        designator: 'MOD',
        reversible: true,
        P1: { type: 'net', value: 'GND' },
        P2: { type: 'net', value: 'VCC' },
        P3: { type: 'net', value: 'SDA' },
        P4: { type: 'net', value: 'SCL' }
    },
    body: p => {
        // 1. Common Setup (Outline, Properties, Holes)
        const standard = `
            (footprint "THQWGD001C" (layer "F.Cu")
            ${p.at /* Place footprint at anchor */}
            (property "Reference" "${p.ref}" (at 0 -8 ${p.r}) (layer "F.SilkS")
                (effects (font (size 1 1) (thickness 0.15)))
            )
            (attr through_hole)

            ${'' /* Mounting Holes (NPTH) - Static coordinates from KiCad file */}
            (pad "" np_thru_hole oval (at -7.2 -5.1 ${p.r + 270}) (size 2 1.4) (drill oval 2 1.4) (layers "*.Cu" "*.Mask"))
            (pad "" np_thru_hole oval (at -7.2 5.1 ${p.r + 270}) (size 2 1.4) (drill oval 2 1.4) (layers "*.Cu" "*.Mask"))
            (pad "" np_thru_hole oval (at -6.4 -4.8 ${p.r + 180}) (size 3 1.4) (drill oval 3 1.4) (layers "*.Cu" "*.Mask"))
            (pad "" np_thru_hole oval (at -6.4 4.8 ${p.r}) (size 3 1.4) (drill oval 3 1.4) (layers "*.Cu" "*.Mask"))
            (pad "" np_thru_hole oval (at -6 -6.25 ${p.r + 270}) (size 1.7 5.85) (drill oval 1.7 5.85) (layers "*.Cu" "*.Mask"))
            (pad "" np_thru_hole oval (at -6 6.25 ${p.r + 270}) (size 1.7 5.85) (drill oval 1.7 5.85) (layers "*.Cu" "*.Mask"))
            (pad "" np_thru_hole oval (at -5.6 -5.1 ${p.r + 270}) (size 2 1.4) (drill oval 2 1.4) (layers "*.Cu" "*.Mask"))
            (pad "" np_thru_hole oval (at -5.6 5.1 ${p.r + 270}) (size 2 1.4) (drill oval 2 1.4) (layers "*.Cu" "*.Mask"))
            (pad "" np_thru_hole circle (at 7 -5 ${p.r}) (size 2.05 2.05) (drill 2.05) (layers "*.Cu" "*.Mask"))
            (pad "" np_thru_hole circle (at 7 5 ${p.r}) (size 2.05 2.05) (drill 2.05) (layers "*.Cu" "*.Mask"))

            ${'' /* Visual Silk Screen Box */}
            (fp_line (start -9.5 -9.5) (end 9.5 -9.5) (stroke (width 0.12) (type solid)) (layer "F.SilkS"))
            (fp_line (start 9.5 -9.5) (end 9.5 9.5) (stroke (width 0.12) (type solid)) (layer "F.SilkS"))
            (fp_line (start 9.5 9.5) (end -9.5 9.5) (stroke (width 0.12) (type solid)) (layer "F.SilkS"))
            (fp_line (start -9.5 9.5) (end -9.5 -9.5) (stroke (width 0.12) (type solid)) (layer "F.SilkS"))
        `

        // 2. Logic for Pads
        // KiCad data shows asymmetric layout (-7.8 for Front, -4.9 for Back), so we define them separately.
        
        const front_pads = `
            (pad "A" thru_hole roundrect (at -7.8 2.5 ${p.r + 90}) (size 1.5 1.6) (drill 0.9) (layers "*.Cu" "*.Mask") (roundrect_rratio 0.25) ${p.P3.str})
            (pad "B" thru_hole roundrect (at -7.8 0 ${p.r + 90}) (size 1.6 1.6) (drill 0.9) (layers "*.Cu" "*.Mask") (roundrect_rratio 0.25) ${p.P4.str})
            (pad "C" thru_hole roundrect (at -7.8 -2.5 ${p.r + 90}) (size 1.5 1.6) (drill 0.9) (layers "*.Cu" "*.Mask") (roundrect_rratio 0.25) ${p.P1.str})
            
            ${'' /* Module support pads Front/Back shared? The dump put them at positive X. Assuming they pass through. */}
            (pad "1" thru_hole roundrect (at 3.25 -2.25 ${p.r}) (size 1.6 1.6) (drill 1) (layers "*.Cu" "*.Mask") (roundrect_rratio 0.25) ${p.P1.str})
            (pad "2" thru_hole roundrect (at 3.25 2.25 ${p.r}) (size 1.6 1.6) (drill 1) (layers "*.Cu" "*.Mask") (roundrect_rratio 0.25) ${p.P2.str})
            (pad "1" thru_hole roundrect (at 9.75 -2.25 ${p.r}) (size 1.6 1.6) (drill 1) (layers "*.Cu" "*.Mask") (roundrect_rratio 0.25) ${p.P1.str})
            (pad "2" thru_hole roundrect (at 9.75 2.25 ${p.r}) (size 1.6 1.6) (drill 1) (layers "*.Cu" "*.Mask") (roundrect_rratio 0.25) ${p.P2.str})
        `

        const back_pads = `
            ${'' /* Note: KiCad dump shows these at -4.9, which is the "Reversible" offset */}
            (pad "A" thru_hole roundrect (at -4.9 2.5 ${p.r + 90}) (size 1.5 1.5) (drill 0.9) (layers "*.Cu" "*.Mask") (roundrect_rratio 0.25) ${p.P3.str})
            (pad "B" thru_hole roundrect (at -4.9 0 ${p.r + 90}) (size 1.5 1.5) (drill 0.9) (layers "*.Cu" "*.Mask") (roundrect_rratio 0.25) ${p.P4.str})
            (pad "C" thru_hole roundrect (at -4.9 -2.5 ${p.r + 90}) (size 1.5 1.5) (drill 0.9) (layers "*.Cu" "*.Mask") (roundrect_rratio 0.25) ${p.P1.str})
        `

        // 3. Return combined string based on reversibility
        if (p.reversible) {
            return `
                ${standard}
                ${front_pads}
                ${back_pads}
                )
            `
        } else {
            return `
                ${standard}
                ${front_pads}
                )
            `
        }
    }
}