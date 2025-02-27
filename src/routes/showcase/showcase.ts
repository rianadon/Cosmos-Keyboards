type Keyboard = {
  author: string
  name?: string
  config: string
  projectLink?: string
  details?: string
  type: 'split' | 'left' | 'right' | 'unibody'
  modifiedInCAD?: boolean
  filament?: string
  resin?: string
  switches?: string
  keycaps?: string
}

let images: Record<string, { default: string }>
try {
  images = import.meta.glob(['./assets/*.jpg', '$target/media/kbd-*.jpg'], { query: '?url', eager: true })
} catch (e) {
  images = {}
}

// Generate the IDs with `openssl rand -hex 4`
const _keyboards: Record<string, Keyboard> = {
  '8f80172e': {
    author: 'TheBigSkree',
    type: 'split',
    modifiedInCAD: true,
    config:
      '#cm:CoYBCg0SBRCQQSATEgASADg7Cg0SBRCQTSATEgASADgnChcSBxCQWSATQAISABIDELAvOBNAhvC8AgoQEgUQkGUgExIAEgMQsDs4AAoTEgUQkHEgExIAEgA4FECKhorABwoXEgQQECATEgMQoE4SAhAwOChAlIaKsAcYAECgiZCtsF5I3PCioAEKYwpQEhIQQCAAQJSD8PMCSMKZoJWQvAESECAAQJ6J8IgDSO6V0O/w2AMSECAAQI+F0IzgBEisnbS8oD0SFAgWIAAwyAFAkcSXgCxIop2Il6AwOAAYAkDbjdSk0DFIrZHcjcGTBgpNCjoSEhBAIABAk4Pw8wJIwpmclaC8ARIQIABAnYnwiANI7pXM74DZAxIQIABAkIXQjOAESKyduLyQPTgAGANA3I3UpNAxSK2R4I2xkwYQAiIGCNIBELsBOAJACFAHaAA=',
    resin: 'Sunlu ABS-Like, painted with 2 layers of primer, 4 layers of color and then 4 layers of clear',
    keycaps: 'clear resin',
  },
  'b9a37e44': {
    author: 'fata1err0r',
    name: 'tamatama',
    type: 'split',
    config:
      '#cm:CpABChsSFRBAIAQw9ANAoIPwl6ADSISFpI6RBzAWOEUKFhIFEJBnIBMSBBCgwwQSAxCwKTgTQB0KGRIFEJAfIBMSBBCgtQYSAxCwUTgAQIDIjQMKFRIFEJARIBMSABIDELArOBRAgICcAQofEgUQkC0gExIEEKDFChIDELBxIgMgyhE4KEC8jofAHBgASOSUx9ACCjoKEBIMEMDAAhgBIABAgIAIOAAKDBIIEEAgAECAgAg4FBgCIggIvgEQyAEgAEDZj4ylgApIgKqb4dgCEAMYhiAiCwi0ARCqARgAIIgOOANAEkgDWAtoAHILGLQDGJ0CGNkCIB54q46W4Ck=',
    projectLink: 'https://github.com/dlip/tamatama',
    details:
      "This model was made earlier in Cosmos's history, and the current model is a close but not exact reproduction. You can access the original from expert mode <a href='http://localhost:5173/beta#expert:eJzlWd1P4zgQf+9fYfXluqgNTT+ArbQvcHcSd2I5AfuE+uAmDrVInch2Wgrq/34zdpLmoxRYsddIV6ESj8djz2/mN0mmXiSUJlGsOVxMyLW9IN/IS4uQFQ3Duzn3HgVTMDnqprLbuYwSn4uHCekbGZsV1DLRFRe59E/q6UjCnHOGs49sfU4VB+W2N4+8NsqUJ9nqUvjcYyC/H7jOuEsGp/g9PHFOprnO3TpmsNBcEy4Uk3pr4JY/4+TVcCu6iBKhmVRcPE6IlgnDGXBA+MyfkJcNDr1ICGaP2NZSqnZJiEZ/3J7D3Iw/lKfgwOxpQnouShfckxFMaRmFIUNbK7pkak4l68l40B/1e89MRsZCQJVm4qq6IqChMgdcglvco+FFyKikwgOvhmZnHN+iX2rrjZqzMARfiLbYzABcQJWEPE5Nkk1r0zo+Jt+v7/6YELueHBM9Z1tfyIrrOSoJ9kA1XzJA14SDgAMkDqnHfEITHS2oOVq4dlD7UhgzZs9j6i/xsD7RdNZFOWy9pGECRlZMsgkuqET6K4bYPcHvkbkcmG8jNuF3QTzFhVXU+62WZ/LXS+SS6gROaRM3H18HF1GYLMSEDExaFiZuolWaqyqmHiSzEcGB3NOS0BpAuUldKj3ceNNqHR8dtcgR+aFYkIQkAPwU0xrWEEp8HgTgrigcDXVRCbGKIRfXyALlgPg49cJILyquOI6Tm+i+4tq4cJy7uQmVYCRRGIaIxJHiyGqzcxLHTOY7k0v9mwIuaKpBd7Y2KpCW1gvhkyc7CatRG2bBCmSjCosLnkkUBOB70Rezz9+wzT/mLN8gp1bkTqqg8wWdslt2BhDd+36X4N/UXrr20iRtUdUta7r55VYzP1knVcwnDTrkdxZwwW2ByyJRwGN7eFB7gIIxIeDA/RQOfw/mMRgkIxhs5T3OgAKGy5AVKobEhByxQy9MgN1YAFJTqdqSSk6FRqYqW6iGo8UCiKqYUKb4/BUxGM6A47AQ6+ONKQxtsrEW7DJc7iN5xv1sIovypIw0fhxD3WtxRbXkT52XVFzPLfvx0rTqDYF8uVQaujiDfunjnqUKm3yzbRTOkMUQhvIUIL84X3fKCZKr2GjfRSsqfdVJI+5CmF1UMb6WApHfPsxNxaNQ7zL/YhkFPKwopY4MslEIlDWBCttGsvlQPH8B6G4F8p67B+GeuUn234/xpwE4zEbzaIEaHCtyu4bqvKGo9hsJ6qiGn2wofs1Myjqr/Wbg1/8IqQE5wK83PjSlF9z3Q1bntG4mpvsofShI64ReNBO8JuZjnc2rZoD3oVu0fYLpDQ7NZnyerHNZNRPRN7h8EEDrXA6aCV4Ts7HO5eV/CF75xbqO4OAjhB4Cfi6+lBz8mdu4Vee0aDCy+4h9OGDr1I4bjOHnJmdr+t7WkZ4ni1mhbeRjOwX0EmV7XoJROTNdrXxdN+8a2Q4RdowUJC+hC2zKFhtGxvq15A9cvNYt6u9uARVVeif93R2lotKwrmOaDJUmUm9kX2N67rg8A0BWAvxKeHfVbRvCbLR9wXLGrUJQ32yVFNsszik+n9l/Ju4VR1zrIHhh2mAY5m3DNAq2wc0y26mEpdqT3NlF3dGYLHdXt43Urzu6rgPTUy1suq/99pM8H9d4TtqVmmq2LpF/y3Z7rN0dv33cfzt996gVE3i/Wp7DbxWcckx/+s0qzc4Ccd9flGthSgP0/wX9nY/Ar4COVdxyZyW50jdM6Vdq6a+tYp9cw96GvWBjhC+pXTKCMsee4khqvEPRJNQmHQGNuc7KBLiU/uSZ5yX+EgXi9I7ezUOmplalgms3S/WQBW+YXXApI9l5xfqXfeY3/wIheCNg'>here</a>.",
  },
  '1afd1ac9': {
    author: 'jonas_h',
    type: 'split',
    config:
      '#cm:CpIBChASBRCQQSATEgASADgxQIBOCg0SBRCQTSATEgASADgdChUSBRCQWSATEgASAxCwLzgJQITIvQIKFRIFEJBlIBMSABIDELA7OApAgYCcAQoyEhEQkHEgE0CClKQMSP2JzLSQDBIHQICaJEiJBxIAEgoQMECA6uUNSOApOB5Aiq6KgAUYAECihdis8FJI3oyrwAEKYwpQEhMQQCAAQMuFsI6gAki5j4i2oZILEhMIFiAAQNqD2LbQCkjJo8DN4PsHEg8gAED/gopQSOWXxIzivhESESAAQM6DtJSACkiVm5yPgvYROAAYAkDji8ys8DNIpqngxvCzCAqOAQoQEgUQkDUgExIAEgA4MkCATgoNEgUQkCkgExIAEgA4HgoZEgUQkB0gExIAEgASBRCwUkAEOApAg8i9AgoZEgUQkBEgExIAEgASBRCwUEABOAlAgoCcAQomEhEQkAUgE0CClKQMSP2J0LSQDBIHQICaJEiJBxIAOB1Aia6KgAUYAUChhdis8FJI3oqruAEKPQoqEhMQQCAAQMCD6J7QNUi5j4S2kZILEhEgAEDMhbCOoAJIuY+EtpGSCzgAGANA5IvMrPAzSKap3MaAtAgQAxiGICIGCL4BELQBOANQAFhDaAB4rIW8fvIBAggB',
    filament: 'PolyTerra PLA Army Purple',
    keycaps: 'MBK PBT Coloured Blank',
    switches: 'Kailh Choc Nocturnal Linear 20gf Ambient Silent',
  },
  '7a01d710': {
    name: 'Cosmic Sushi',
    author: 'Lily',
    type: 'split',
    config:
      '#cm:CqMBChUSBRCAPyAnEgASAxCAQxIDELBFODsKDxIFEIBLICcSABIAEgA4JwocEgUQgFcgJxIAEgASAxCwLxIDELAvOBNAhoC8AgobEgUQgGMgJxIAEgASAxCwOxIDELA7OABAgIBQChoSBRCAbyAnEgASABIAEgMQsHU4FECShorwBAoZEgIgJxIAEgMQoE4SAhAwEgA4KECahorgBBgASNqHuOagMgplCgwSBBBAIA4SAiAFOBMKHRIMEMCAAkiAgIz9A1ByEggIgCAQQFCFATCAMDgAChgSChBASICAjP0DUFoSBQiAICAPMIAwOBQYAiILEM0BGMEDIIMHKABA24+c1KBQSKmNgLbxlxwiCwjIARDDASC8DyguQAlIBVgDYAFoAHILDQAAoEAgRigyMCh4z4fcrsB2',
    filament: 'GST3D Cyan PLA+',
    keycaps: 'MOA Profile',
    switches: 'Boba U4',
  },
  '4d3652f2': {
    name: 'Spidermo Special V1',
    author: 'spidermo',
    type: 'split',
    config:
      '#cm:CqkBChESBRCQQSATEgASADgxQICWBgoiEgkQkE0gE0iAgAQSBEiAgAQSBEiAgAQ4HUCQjglIkoCUDAoaEgUQkFkgExIAEgMQsC84CUC0yIwCSJKA1BwKJRIJEJBlIBNAAkgCEgRAAkgCEgcQsDtAAkgCOApA2O4MSKOCrDUKJRIIEJBxIBNIgAISBEiAgAQSBEiAgAQ4HkD2jo7QBkitg9TYqwEYAEjeqLPwAQqZAQoYEhQQwMACQICQhuAESMKZoJWQvAFQQzgIChUSERBAQICMhrAESOaZ/KeQC1BXUH8KFxITEEBAgICGqAZIwpmglZC8AVCGAVA6ChcSEBBAQICAGEjQlYDdkPUDUAswEFCeAgoWEhEQQECAgIbIB0jwmcy18DBQdFCVARgCIgsIyAEQyAEYACCDB0CXkbTVoDdI85PEhuH/BhADGIYgOAByEQ0AAKBAIANY0gaIAdIGcIQHeO2O14Aa',
    filament: 'Overture PETG, Digital Blue',
    keycaps: 'Chocfox Keycaps, Black',
    switches: 'Kailh Choc V1 Robin',
  },
  'de79d260': {
    author: 'umang',
    type: 'split',
    config:
      '#cm:CrwBChASBRCQQSATEgASA0iABDg7ChASBRCQTSATEgASA0iABDgnCiQSCRCQWSATSICABBIAEgYQsC9IgAQSBhCwX0iABDgTQIbwvAIKHxIJEJBlIBNIgIAEEgASBhCwO0iABBIGELBrSIAEOAAKGhIJEJBxIBNIgIAEEgASA0iABDgUQIiGisAHCiISCBAQIBNIgIAEEgMQoE4SBRAwSIAEMIAoQJKGirAHUKoDGABAzoeYr9CQAUiEh9j9oDIKfwppEhIQQCAAQISDgOMDSL/DmIby1BYSECAAQLCJ6MgZSPuduIbS0hYSFAiAKCAAQJiHzJ3QfUjyl8CskNACEhQIkCAgAECmhZiewHtI9auIlrD8DBITCIAoIABAq4O8lrBQSNCdkNfRVjgAGAIwgDBAy4uEpNAxSK2R3I3BkwYQAxiGICIMCNMBEMgBGOgCINgTKBQwPDgDSApYSWADaAByBw0AAAAAIDw=',
    filament: 'eSUN ABS Blue filament, keywell spray painted black',
    keycaps: 'Chocfox CFX Legends Blank',
    switches: 'Kailh Choc V1 White',
  },
  'c9b1eb44': {
    author: 'Gleb Sabirzyanov',
    type: 'right',
    name: 'Sexy Artsey',
    details:
      `<p>Cute 10-key wireless sculpted ergo keyboard with an encoder. It's fully <a href="https://gleb.sexy/sexy-artsey#resources">open source</a>! Make it personal by attaching various <a href="https://gleb.sexy/sexy-artsey#accessories">accessories</a> and designing your own! ✨</p><p>[Read More on Gleb's Site]</p><p>n.b. Cosmos has changed since this model was published. For a more accurate version in expert mode, go <a href="../../beta#expert:eJztWd9v2zYQfvdfQeRlaWHTon5Ysoe+NNuAYsgyNOlT4AdaomIusiSQVJy0yP++IynJkmw36dANQTMhsaXj8Xi87zvSPMVFLhUqSsXhZoEu7A16h76MENrSLLta8/g2ZxIa/XEtu1yLokp4frNAjpGxVUetEZ3zvJX+RmNVCGjDkW69ZQ/vqeSgfHKf0BMtkrFg2w95wmMG4usJGaP+/7LVunooGfQ094jnkgm1M3HJP+vGc28nOiuqXDEheX67QEpUTLfADPKEJQv05VE/xkWeM+vjSSVXJz2Ztvnp8r0eM+Obfhu4zO4X2keQbngsCmhSosgypm1t6R2TayrYRJSu4zuTz0wUxkJKpWL5+bBH498dzIrHNDvLGBU0j5kOnhkk1pJLPTG5U5drlmUwGaRscFYQ3vhkjDJeLmCoTDL0OHocTafoj4urXxfI9kdTpNZsNxm05WqtlXJ2QxW/YxBegwiCGaAyozFLEK1UsaHGuewBa+0PuTFjxpzS5E67myBFV2Mth6HvaFaBkS0TbKE7DMCOcDBGxNefrrkNzSfBwVJrD2PtutgbjWLD3LgSd1RV4J2lbPt8kZ4VWbXJF4gE437Dx2ILUkNTWdIYeGxk4AmZ46AntjY6LVTEAAREcjR9+3aE3qJPkqVVhlIInmRKQS9EUcLTFOaad/zTulpJB6oEJj7oJJAYxNN6KkZ6NpgPxrg1MT42v447V2uDU85QJTUGBSoLyXVSm5GrsmSiHRl9UD9JyARFFeiuHowKkNLOIk/QvW2E3lobWsEKkFFm3Q6fUZGmMHczF1RPxgz0O4zzp3HmHTBqi66ETE/f6FnZMU89Z4yu4V//Le0tsbeGsl1V0tck7e1Os3XttFZsG3V00C8s5Tm361uDRCceOyBA7QaWiwUC/6+X4Ps1WNdgoCa7NveTMraLhFnMYgpZZjUQKkWR8ox11jZ9CU06r3laFxutwDWhW5UM+GMWjb9OjOTRNlBZAvsBZ/sYZ5W0arWfdf8G50U/1PrCJnMv8nOqBL8/bRzdZ5e94ppYE7KTGfcnDg5qyWNruxf1CeSt0zbV0E2IhnkC+Rx6oRt5URCGcxJ5oO762Jt5MzeIgrkTeY4TAQMwIb5DwmjmeVFIHDdcttiTZX9cwHHz/uG0zzatYmL3XTDz9+DZvFB4XiM6w4za8CTJ2H5K3b4MzJxvzijnh4NsP6HGLxOcV4jNMJ0EhHw/mbKXgdc/2J6iHw6x/WzCLxOd1wjOMJ3MT/z9fPr5P0Ssf8rYh839tqSauHCiByxcOLodxs4PcEDcIAiJH81Cxw180PdJDzsAx8Vz4nueGzk+iIPoIG4/BCn2M3b6gvH/H34L/2j53DO2WlebVed8nehzJ+hV0hYHckbFyhz/237j9nhtj9L6aC1hyUB0o2tX3SqBsX4h+A3Pj52qJz6eub3r8Nm518ebYafXZ3b4aN7tpAsxYffa79PGuEsaL8IaLDI3X3M86ysAAANKHyH0oQ2oIW3zvDstjTokfgLtnrsRDgO9O5kvs0F1Y7BfwTg0Zd8evvy6FKEZtKtcFemON0264wHiw7rQsJzlHCkO9atcbTnLPVT9ck1dqzPos0sgR5csa+YZK1ZDQ2BU0Ltmx7k76PgVwg5WD1hretdxCAdU8PHcENYUpMHMwcWjk6FvBpvDcFuwbA1gdXlyg/luIQ6wO+te4TMDrJfbryFzLN5fSZDhZkJmGsSJ/SQeJv9ufFlMyHcnsEcG8X0ugWE1fIKVR+jseXjudS7/2QGHENtq+1zvkt6T0W72QbtEbAWX6iOT6shu9ErWc3ZfFkLpXZ5WmTIMg3is1aKp39cv18xbsX7I6ldh+hUI6NU/78a6j6WdeeVleJuxVDU/LvsmDxptzG64EIU4PWLd4vn4N0cbdD0=">here</a>.</p>`,
    projectLink: 'https://gleb.sexy/sexy-artsey',
    config:
      '#cm:CngKGxIIEKBPIAlIgAISA0iAAjgTQMSWMUicg7iobwoWEgUQoFsgCRIDELAvOABA0l5IgICMPAoZEgUQoGcgCRIDELA7OBRArqaKOEibg7SobwoYEgUQoHMgCRIAOChAmK6TkAJI24mMu9kBGABAxtCP+CtI6JjWoAMKTgo7EhIQQCAAQOLqhsgdSNODpI/Q+gESDiAAQMuFjIzQUEjah4RFEhMIECAAQI6FmJegA0j9q9zt0NIXOAAYAkD9i4Sc8DdIn4ekzeH7AxiCICIJCMMBEMMBGIQHQAFIBVhLaAA=',
    keycaps: 'NP PBT Blank White',
    switches: 'Akko Lavender Purple Tactile 36gf',
    filament: 'eSUN PLA+ Pink and Eryone Blue Lilac (purple) Matte PLA',
    modifiedInCAD: true,
  },
  '94e53433': {
    name: 'lz_manuform',
    author: 'toarukun',
    type: 'split',
    config:
      '#cm:CucBChASBBBwIDsSAhAAEgASADhPChgSCRDwPSA7YgJGNhIDEIA/EgASABIAODsKGBIJEPBJIDtiAkY3EgMQgEsSABIAEgA4JwolEgkQ8FUgO2ICRjgSAxCAVxIAEgASAxCwLxIDELBfOBNAhvCcAgogEgkQ8GEgO2ICRjkSAxCAYxIAEgASAxCwOxIDELBrOAAKJBIKEPBtIDtiA0YxMBIDEIBvEgASABIAEgMQwHc4FECKhorABwohEgQQcCA7EgIQABIAEgMQoE4SAhAwEgIQQDgoQJSGirAHGABAgomwrvB9SOCQuoACCoUBCnISFAiAKBBAIABAi4XQlhBIjYWAwN0NEhEIgCggAECawJYISI2FgMDdDRIPIABArYXkA0ibiYSe4NwQEhAgAEDig9DQAUjrk5yXoPAREg8gAEDP5o84SIOPnJegvRISESAAQPCFxJewAUjhncyNwNgSOAAYAkDji8ys8DNIpqngxvCzCBACIggYngMg6AsoHDgCaAA=',
    filament: 'PLA+',
    keycaps: 'SPKeyboards custom DSA',
    switches: 'Cherry MX Red Silence',
  },
  '76410aa9': {
    author: 'joedevivo',
    type: 'split',
    config:
      '#cm:CqIBCg0SBBAQIBMSADhPQIBGChASBRCQQSATEgASADg7QIBGCg0SBRCQTSATEgASADgnChwSBxCQWSATQAISABIDELAvEgMQsF84E0CG8LwCChUSBRCQZSATEgASAxCwOxIDELBrOAAKExIFEJBxIBMSABIAOBRAioaKwAcKFxIEEBAgExIDEKBOEgIQMDgoQJSGirAHGABAsomgrtBfSNzwoqABCpIBChcSExDAwAJAgICQAkjCmaCVkLwBUEM4CAoVEhAQQECAgBhI0JWA3ZD1A1ALUJ4CChYSEhBAQICA1AJIwpmglZC8AVCGAVA6ChQSEBBAQICA8AFI5pn8p5ALUFdQfwoVEhAQQECAgKwDSPCZzLXQMFB0UJUBGAIiCgjIARDIARgAIABAy4uEpNAxSK2R3I3BkwYQAhiEIChkOAJAElABWEhoAA==',
    filament: 'Bambu Labs Matte PLA Mandarin Orange',
    keycaps: 'Drop DSA Astrolokeys Keycaps by sailorhg & cassidoo',
    switches: 'Milktooth Outemu Lime Tactile Switch',
  },
  '445600b3': {
    author: 'Akidus',
    type: 'split',
    projectLink: 'https://reddit.com/r/ErgoMechKeyboards/comments/1edj99j',
    config:
      '#cm:CnUKERIFEJBBIBMSABIAODFAgoAkCg0SBRCQTSATEgASADgdChUSBRCQWSATEgASAxCwLzgJQISMlQIKEBIFEJBlIBMSABIDELA7OAoKGBIFEJBxIBMSABIAIgMgoAs4HkCOhorwBhgAQOyFyK7QUEjMh9DFgAwKYgoXEhMQwMACQIGIkAJIwpmglZC8AVBDOAgKFRIQEEBAgYAYSNCVgN2Q9QNQC1CeAgoVEhAQQECBjPABSKydtLygPVBTUI8BGAIiCAjIARDIARgAQMuLhKTQMUitkdyNwZMGIgMguAhYQ2gA',
    keycaps: 'DES (https://www.etsy.com/listing/1445917485/des-keycap-set-ergonomic-sculpted)',
    switches: 'Lubed GAZZEW Boba U4T V2 62g',
  },
  '1a16fc93': {
    author: 'trichofan',
    type: 'split',
    config:
      '#cm:CoIBChASBRCQQSATEgASADg7QIB2Cg0SBRCQTSATEgASADgnChYSBRCQWSATEgASAxCwLzgTQIDohugBChMSBRCQZSATEgASAxCwOzgAQIACChMSBRCQcSATEgASADgUQICGj/ADCg4SChAgIABAgP6P8AM4KBgAQLqJoK7wVUjc8KKgAQpjChcSExDAgAJAiYSwAkjVhajl8P0RUEM4CgoXEhAQQECAgCBIz5fo1NC5FFALMIAwOB4KFRIREEBAgYD4AUiii+DmsNUPUFc4CxgCIgQYACAAMIAoQMuLnK7QMUitkdyNwZMGCn0KEBIFEJA1IBMSABIAODxAgHYKDRIFEJApIBMSABIAOCgKExIFEJAdIBMSABIAOBRAgKiGqAEKERIFEJARIBMSABIAOABAgJ4IChMSBRCQBSATEgASADgTQICqjrADCg4SChAgIABAgKKPsAM4JxgBQLmJoK7wVUjc7qKYASIJCMgBEMgBIIgOQAlYR2ADaAByDZABugIQxAIoMjgKQAp48oWkn/Ey',
    filament: 'Overture Black ABS',
    keycaps: 'KOA Profile from AliExpress',
    switches: 'Gateron MX Brown',
  },
  'a4d7f304': {
    author: 'DieCuriousDnD',
    type: 'split',
    config:
      '#cm:CosBChESBRCQQSATEgASADg7QIDGAQoQEgUQkE0gExIAEgA4J0CATgoVEgUQkFkgExIAEgMQsC84E0CEyJ0BChASBRCQZSATEgASAxCwOzgAChMSBRCQcSATEgASADgUQIiGiqAGChcSBBAQIBMSAxCgThICEDA4KECShoqQBhgAQNaHiKyQW0jc8KKgAQqPAQoXEhMQwMACQICAkAJIwpmglZC8AVBDOAgKFRIQEEBAgIAYSNCVgN2Q9QNQC1CeAgoWEhIQQECAgNQCSMKZoJWQvAFQhgFQOgoUEhAQQECAgPABSOaZ/KeQC1BXUH8KFRIQEEBAgICsA0jwmcy10DBQdFCVARgCIgcQqgEYACAAQMuLhKTQMUitkdyNwZMGEAMYhiAiBgi+ARCqATgDggEBAkgDUAdoAA==',
    filament: 'OVV3D PLA Dual Color Purple and Sky Blue',
    details: 'KMK and Engram with a trackpoint. The trackpoint module and board are from some Lenovo usb keyboard, and I run two usb cables through the wire loom for it and the MCU.',
    switches: 'Choc Ambients Silent Twilights',
    keycaps: '3D Printed <a href="https://www.printables.com/model/864126-mote-choc-low-profile-flat-keycaps">flat keycaps</a>, printed at 95% for fit',
  },
  '1a66e84a': {
    author: 'Camembert',
    type: 'split',
    config:
      '#cm:CpQBChESBRCAPyAnEgASABIAODtAAAoREgUQgEsgJxIAEgASADgnQAAKFxIFEIBXICcSABIAEgMQsC84E0CA8LwCChQSBRCAYyAnEgASABIDELA7OABAAAoVEgUQgG8gJxIAEgASADgUQICGisAHChcSAiAnEgASAxCgThICEDA4KECAhorABxgAQLqJoK7wVUjc8KKgAQqKAQorEhMQwIACQICAmAJIwpmglZC8AVBDEhJAgIDMAkjCmaCVkLwBUIYBWDo4CAoVEhAQQECAgCBI0JWA3ZD1A1ALUJ4CCicSEBBAQICA+AFI5pn8p5ALUFcSEUCAgKQDSPCZxLXQMFB0WJUBUH8YAiIKCMgBEMgBGAAgAEDLi/yf0DFIrZHcjcGTBjAyggECBAJIClhLYANyAigneNyLvJwB',
    details: 'It had to be silent in sound, so I made it loud in color.',
    filament: 'eSUN Silk PLA - gold red green',
    switches: 'Outemu Silent Peach V2',
    keycaps: 'Botanical clone from KBDiy on AliExpress',
  },
  'a8479182': {
    author: 'jamgam',
    name: 'Tightyl-Inspired',
    type: 'split',
    config:
      '#cm:CpQBCg8SBRCQQSATEgASADg7QAAKDxIFEJBNIBMSABIAOCdAAAoaEgUQkFkgExIAEgMQsC8SAxCwXzgTQIDwvAIKFxIFEJBlIBMSABIDELA7EgMQsGs4AEAAChMSBRCQcSATEgASADgUQICGisAHChcSBBAQIBMSAxCgThICEDA4KECAhorABxgAQLqJoK7wVUjcjKvQAQpoChcSExDAgAJAgICYAkjCmaCVkLwBUEM4CAoVEhAQQECAgCBI0JWA3ZD1A1ALUJ4CChQSEBBAQICA+AFI5pn8p5ALUFdQfwoDUIICGAIiCgjIARDIARgAIABAy4v8n9AxSK2R3I3BkwYQCRiEIDgJggECBANIA1hHYANoAHIskAG5AhC5AiDd//////////8BKPoBMAo4C0AFSNT9/////////wFYlApwxgo=',
    filament: 'BambuLab PLA Basic Gradient Arctic Whisper',
    switches: 'Glorious Lynx',
    keycaps: 'Custom via KeyV2. <a href="../../jamgam%20keycap.stl">[STL]</a> or <a href="../../jamgam%20keycap%20with%20base%20for%20printing.stl">[STL with Base for Printing]</a>',
  },
  'd85e682f': {
    author: 'rianadon',
    name: 'Limbo',
    type: 'split',
    modifiedInCAD: true,
    details:
      "<p>I wanted to make a Dactyl-style keyboard as compact as possible while preserving the standard curvature and functionality. The result is the Limbo. It's portable enough to throw in a backpack, but it still packs enough keys to get your work done.</p><p>If you're going to try this yourself, beware of the thumb cluster. The vertical cluster requires you to press with the pad of your thumb, which places more strain on your fingers than pressing with the side. I recommend doing a test print of just the thumb cluster before going all-in.</p><p><i>Note: The top case was printed as-is from Cosmos, but I added the logo and stars to the bottom plate in CAD.</i></p>",
    config:
      '#cm:CrYBCg0SBRCQQSATEgASADgxCh8SEQgIEIBLKKoBMB5AgIBMULUCEgIgExIAEgA4HUAACiISBRCQWSATEgASAxCwLxIMCAgQsF8gJCigATB4OAlAgJg9CiISBRCQZSATEgASAxCwOxIMCAgQsGsgJCigATBkOApAgKoEChMSBRCQcSATEgASADgeQICmi/ACChgSBBAQIBMSBBCggAoSAhAwODJAgM6L8AEYAEDohaCu8FVI2vCisAEKRQosEhQQwIACIABA/pyGsARIwpmglZC8ARISEEAgAECdhaCNwAdIrJ20vKA9OAAYAiIEGAAgAECFjdydwAdIl9HUvILTCxADGIYgIgYIuQEQuQE4A4IBAgQCSAVQAlhHYAFyBCAKMBR4yIOUlAE=',
    filament: 'OVV3D PLA Tri-Color Red-Yellow-Blue',
    switches: 'Choc Brown',
    keycaps: 'YMDK Choc Keycaps',
  },
  '69c774a8': {
    author: 'Blaise',
    name: 'Nebulon',
    type: 'split',
    config:
      '#cm:CpMBChASBRCQQSATEgASADg7QIBGCg0SBRCQTSATEgASADgnChwSBxCQWSATQAISABIDELAvEgMQsF84E0CG8LwCChUSBRCQZSATEgASAxCwOxIDELBrOAAKExIFEJBxIBMSABIAOBRAioaKwAcKFxIEEBAgExIDEKBOEgIQMDgoQJSGirAHGABAsomgrtBfSNzwoqABCpIBChcSExDAwAJAgICQAkjCmaCVkLwBUEM4CAoVEhAQQECAgBhI0JWA3ZD1A1ALUJ4CChYSEhBAQICA1AJIwpmglZC8AVCGAVA6ChQSEBBAQICA8AFI5pn8p5ALUFdQfwoVEhAQQECAgKwDSPCZzLXQMFB0UJUBGAIiCgjIARDIARgAIABAy4uEpNAxSK2R3I3BkwYYhCAoZIIBAgQDWENoAA==',
    projectLink: 'https://github.com/rparker2003/qmk_firmware/tree/master/keyboards/nebulon',
    filament: 'Overture PETG Sparkle Blue',
    switches: 'Holy Panda 55g',
    keycaps: 'Aliexpress Purple PBT XDA Keycaps',
  },
}

function findImages(kbd: Keyboard) {
  const authorSplit = kbd.author.split(' ')[0].toLowerCase().replace(/\W/g, '')
  const kbdName = kbd.name?.replace(/\(.*\)/g, '').toLocaleLowerCase().replace(/\W/g, '')
  const matcher = new RegExp(`/src/routes/showcase/assets/kbd(-${kbdName})?-${authorSplit}(-\\d+)?.jpg`)
  const matchedPaths = Object.keys(images).filter(p => matcher.test(p)).sort((a, b) => {
    const nA = Number((a.match(/-(\d+).jpg/) || [])[1] || 0)
    const nB = Number((b.match(/-(\d+).jpg/) || [])[1] || 0)
    return nA - nB
  })
  return matchedPaths.map(fullPath => {
    const basename = fullPath.replace('/src/routes/showcase/assets/', '').replace('.jpg', '')
    const fallback = images[fullPath].default
    return {
      image: images[`/target/media/${basename}.thumb.jpg`]?.default || fallback,
      largeImage: images[`/target/media/${basename}.jpg`]?.default || fallback,
    }
  })
}

export const keyboards = Object.entries(_keyboards).map(([key, kbd]) => {
  const authorSplit = kbd.author.split(' ')[0].toLowerCase().replace(/\W/g, '')
  const foundImages = findImages(kbd)
  return {
    ...kbd,
    key,
    name: kbd.name || `${kbd.author}'s Keyboard`,
    named: !!kbd.name,
    images: foundImages,
    image: foundImages[0].image,
    largeImage: foundImages[0].largeImage,
    authorImage: images[`/src/routes/showcase/assets/author-${authorSplit}.jpg`]?.default,
  }
})

// https://stackoverflow.com/a/47593316
// I need an efficent RNG with a configurable seed
function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

/** Shuffles an array randomly */
function fisherYates<T>(array: T[], rand: () => number) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }
}

// Shuffle the list of keyboards so no one gets preference. The order changes once every day.
const daysSinceEpoch = Math.floor(Date.now() / 1000 / 3600 / 24)
fisherYates(keyboards, mulberry32(daysSinceEpoch))
