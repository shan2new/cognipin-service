export type Compensation = {
  fixed_min_lpa?: number | null
  fixed_max_lpa?: number | null
  var_min_lpa?: number | null
  var_max_lpa?: number | null
}

export function computeCtc(comp: Compensation): {
  ctc_min: number | null
  ctc_max: number | null
  ctc_mid: number | null
  variable_pct_range: { min: number | null; max: number | null } | null
  fixed_mid: number | null
} {
  const fixedMin = comp.fixed_min_lpa ?? 0
  const fixedMax = comp.fixed_max_lpa ?? 0
  const varMin = comp.var_min_lpa ?? 0
  const varMax = comp.var_max_lpa ?? 0

  const ctcMin = (comp.fixed_min_lpa ?? 0) + (comp.var_min_lpa ?? 0)
  const ctcMax = (comp.fixed_max_lpa ?? 0) + (comp.var_max_lpa ?? 0)
  const ctcMid = ctcMin && ctcMax ? (ctcMin + ctcMax) / 2 : ctcMin || ctcMax || null

  const fixedMid = comp.fixed_min_lpa && comp.fixed_max_lpa ? (comp.fixed_min_lpa + comp.fixed_max_lpa) / 2 : null
  const varPctMin = fixedMid ? (varMin / fixedMid) * 100 : null
  const varPctMax = fixedMid ? (varMax / fixedMid) * 100 : null

  return {
    ctc_min: ctcMin || null,
    ctc_max: ctcMax || null,
    ctc_mid: ctcMid,
    variable_pct_range: fixedMid ? { min: varPctMin, max: varPctMax } : null,
    fixed_mid: fixedMid,
  }
}


