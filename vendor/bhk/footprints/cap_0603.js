// footprints/cap_0603.js
// Converted from KiCad 8 Footprint: Capacitor_0603
// Description: Capacitor SMD 0603 (1608 Metric), IPC_7351 nominal.

module.exports = {
    params: {
        designator: 'C',
        side: 'F',
        reversible: false,
        include_traces_vias: false,
        trace_distance: { type: 'number', value: 1.2 }, // Distance from pad center to via
        trace_width: 0.25,
        via_size: 0.6,
        via_drill: 0.3,
        from: { type: 'net', value: undefined },
        to: { type: 'net', value: undefined }
    },
    body: p => {
        
        const standard_opening = `
        (footprint "Capacitor_0603"
            (layer "${p.reversible ? 'F' : p.side}.Cu")
            ${p.at}
            (property "Reference" "${p.ref}"
                (at 0 -1.43 ${p.r})
                (layer "${p.reversible ? 'F' : p.side}.SilkS")
                (effects (font (size 1 1) (thickness 0.15)))
            )
            (property "Value" "Capacitor_0603"
                (at 0 1.43 ${p.r})
                (layer "F.Fab")
                (hide yes)
                (effects (font (size 1 1) (thickness 0.15)))
            )
            (attr smd)
        `

        // Silk screen lines based on KiCad courtyard/fab layers
        const front_silk = `
            (fp_line (start -1.48 -0.73) (end 1.48 -0.73) (layer "F.CrtYd") (stroke (width 0.05) (type solid)))
            (fp_line (start -1.48 0.73) (end -1.48 -0.73) (layer "F.CrtYd") (stroke (width 0.05) (type solid)))
            (fp_line (start 1.48 -0.73) (end 1.48 0.73) (layer "F.CrtYd") (stroke (width 0.05) (type solid)))
            (fp_line (start 1.48 0.73) (end -1.48 0.73) (layer "F.CrtYd") (stroke (width 0.05) (type solid)))
            (fp_line (start -0.8 -0.4) (end 0.8 -0.4) (layer "F.Fab") (stroke (width 0.1) (type solid)))
            (fp_line (start -0.8 0.4) (end -0.8 -0.4) (layer "F.Fab") (stroke (width 0.1) (type solid)))
            (fp_line (start 0.8 -0.4) (end 0.8 0.4) (layer "F.Fab") (stroke (width 0.1) (type solid)))
            (fp_line (start 0.8 0.4) (end -0.8 0.4) (layer "F.Fab") (stroke (width 0.1) (type solid)))
        `

        const back_silk = `
            (fp_line (start -1.48 -0.73) (end 1.48 -0.73) (layer "B.CrtYd") (stroke (width 0.05) (type solid)))
            (fp_line (start -1.48 0.73) (end -1.48 -0.73) (layer "B.CrtYd") (stroke (width 0.05) (type solid)))
            (fp_line (start 1.48 -0.73) (end 1.48 0.73) (layer "B.CrtYd") (stroke (width 0.05) (type solid)))
            (fp_line (start 1.48 0.73) (end -1.48 0.73) (layer "B.CrtYd") (stroke (width 0.05) (type solid)))
            (fp_line (start -0.8 -0.4) (end 0.8 -0.4) (layer "B.Fab") (stroke (width 0.1) (type solid)))
            (fp_line (start -0.8 0.4) (end -0.8 -0.4) (layer "B.Fab") (stroke (width 0.1) (type solid)))
            (fp_line (start 0.8 -0.4) (end 0.8 0.4) (layer "B.Fab") (stroke (width 0.1) (type solid)))
            (fp_line (start 0.8 0.4) (end -0.8 0.4) (layer "B.Fab") (stroke (width 0.1) (type solid)))
        `

        // SMD Pads
        const front_pads = `
            (pad "1" smd roundrect (at -0.775 0 ${p.r}) (size 0.9 0.95) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25) ${p.from.str})
            (pad "2" smd roundrect (at 0.775 0 ${p.r}) (size 0.9 0.95) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25) ${p.to.str})
        `

        const back_pads = `
            (pad "1" smd roundrect (at -0.775 0 ${p.r}) (size 0.9 0.95) (layers "B.Cu" "B.Paste" "B.Mask") (roundrect_rratio 0.25) ${p.from.str})
            (pad "2" smd roundrect (at 0.775 0 ${p.r}) (size 0.9 0.95) (layers "B.Cu" "B.Paste" "B.Mask") (roundrect_rratio 0.25) ${p.to.str})
        `

        // Reversible Traces & Vias logic
        const traces = `
            ${'' /* Right Pad (2) Trace & Via */}
            (segment
                (start ${p.eaxy(0.775, 0)})
                (end ${p.eaxy(0.775 + p.trace_distance, 0)})
                (width ${p.trace_width})
                (layer "F.Cu")
                (net ${p.to.index})
            )
            (via
                (at ${p.eaxy(0.775 + p.trace_distance, 0)})
                (size ${p.via_size})
                (drill ${p.via_drill})
                (layers "F.Cu" "B.Cu")
                (net ${p.to.index})
            )
            (segment
                (start ${p.eaxy(0.775 + p.trace_distance, 0)})
                (end ${p.eaxy(0.775, 0)})
                (width ${p.trace_width})
                (layer "B.Cu")
                (net ${p.to.index})
            )

            ${'' /* Left Pad (1) Trace & Via */}
            (segment
                (start ${p.eaxy(-0.775, 0)})
                (end ${p.eaxy(-0.775 - p.trace_distance, 0)})
                (width ${p.trace_width})
                (layer "F.Cu")
                (net ${p.from.index})
            )
            (via
                (at ${p.eaxy(-0.775 - p.trace_distance, 0)})
                (size ${p.via_size})
                (drill ${p.via_drill})
                (layers "F.Cu" "B.Cu")
                (net ${p.from.index})
            )
            (segment
                (start ${p.eaxy(-0.775 - p.trace_distance, 0)})
                (end ${p.eaxy(-0.775, 0)})
                (width ${p.trace_width})
                (layer "B.Cu")
                (net ${p.from.index})
            )
        `

        const model_3d = `
            (model "\${KICAD8_3DMODEL_DIR}/Capacitor_SMD.3dshapes/C_0603_1608Metric.wrl"
                (offset (xyz 0 0 0))
                (scale (xyz 1 1 1))
                (rotate (xyz 0 0 0))
            )
        `

        let final = standard_opening;

        if (p.side == "F" || p.reversible) {
            final += front_silk;
            final += front_pads;
        }
        if (p.side == "B" || p.reversible) {
            final += back_silk;
            final += back_pads;
        }

        final += model_3d;
        final += `)`; // Close footprint structure

        // Append traces AFTER the footprint closing parenthesis if enabled
        if (p.reversible && p.include_traces_vias) {
            final += traces;
        }

        return final;
    }
}